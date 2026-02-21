import { Router } from "express";
import { z } from "zod";
import { BufferController } from "../modules/buffer/buffer.controller.js";
import { OnboardingController } from "../modules/onboarding/onboarding.controller.js";

const emailSchema = z.object({
  email: z.string().email(),
});

const CROSSMINT_BASE_URL = "https://staging.crossmint.com";

function getCrossmintHeaders(): Record<string, string> {
  const apiKey = process.env.CROSSMINT_API_KEY;
  if (!apiKey) throw new Error("Required env var: CROSSMINT_API_KEY");
  return {
    "X-API-KEY": apiKey,
    "Content-Type": "application/json",
  };
}

// Upsert: GET primero, si no existe POST para crear
// Soporta todos los casos:
//   - Usuario nuevo: no tiene wallet → la crea
//   - Usuario existente con api-key signer → la devuelve
//   - Usuario existente con email signer (SDK legacy) → la devuelve igual
async function getOrProvisionWallet(email: string): Promise<Record<string, any>> {
  const headers = getCrossmintHeaders();
  const walletLocator = encodeURIComponent(`email:${email}:stellar`);

  // Paso 1: intentar recuperar wallet existente
  const getResponse = await fetch(`${CROSSMINT_BASE_URL}/api/2025-06-09/wallets/${walletLocator}`, {
    headers,
  });

  if (getResponse.ok) {
    const data = (await getResponse.json()) as Record<string, any>;
    console.info(`[buffer-wallet] Wallet retrieved for ${email}: ${data.address}`);
    return data;
  }

  // Paso 2: no existe → crear con api-key signer
  const createResponse = await fetch(`${CROSSMINT_BASE_URL}/api/2025-06-09/wallets`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      chainType: "stellar",
      type: "smart",
      config: { adminSigner: { type: "api-key" } },
      owner: `email:${email}`,
    }),
  });

  const createData = (await createResponse.json()) as Record<string, any>;

  if (!createResponse.ok) {
    throw new Error(`Failed to create wallet: ${JSON.stringify(createData)}`);
  }

  console.info(`[buffer-wallet] Wallet created for ${email}: ${createData.address}`);
  return createData;
}

export function createBufferWalletRouter(
  bufferController: BufferController,
  onboardingController: OnboardingController,
): Router {
  const router = Router();

  // GET o crea wallet Stellar — soporta usuario nuevo y existente
  router.post("/wallet/provision", async (req, res) => {
    try {
      const { email } = emailSchema.parse(req.body);
      const data = await getOrProvisionWallet(email);

      return res.json({
        address: data.address,
        walletLocator: `email:${email}:stellar`,
        chain: data.chainType ?? "stellar",
        type: data.type ?? "smart",
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request", details: error.flatten() });
      }
      console.error(`[buffer-wallet] wallet/provision error: ${error.message}`);
      return res.status(500).json({ error: "Failed to provision wallet" });
    }
  });

  // Balance de wallet Stellar
  router.post("/wallet/state", async (req, res) => {
    try {
      const { email } = emailSchema.parse(req.body);
      const walletLocator = encodeURIComponent(`email:${email}:stellar`);

      const response = await fetch(
        `${CROSSMINT_BASE_URL}/api/2025-06-09/wallets/${walletLocator}/balances?tokens=xlm,usdc`,
        { headers: getCrossmintHeaders() },
      );

      const data = (await response.json()) as Record<string, any>;

      if (!response.ok) {
        console.error(`[buffer-wallet] wallet/state failed: ${JSON.stringify(data)}`);
        return res.status(500).json({ error: "Failed to get wallet state" });
      }

      return res.json(data);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request", details: error.flatten() });
      }
      console.error(`[buffer-wallet] wallet/state error: ${error.message}`);
      return res.status(500).json({ error: "Failed to get wallet state" });
    }
  });

  router.post("/onboarding", (req, res) => onboardingController.onboard(req, res));
  router.post("/onboarding/status", (req, res) => onboardingController.getStatus(req, res));

  router.post("/balance", (req, res) => bufferController.getBalance(req, res));

  router.post("/deposit/prepare", (req, res) => bufferController.prepareDeposit(req, res));
  router.post("/deposit/submit", (req, res) => bufferController.submitDeposit(req, res));

  router.post("/withdraw/prepare", (req, res) => bufferController.prepareWithdraw(req, res));
  router.post("/withdraw/submit", (req, res) => bufferController.submitWithdraw(req, res));

  return router;
}
