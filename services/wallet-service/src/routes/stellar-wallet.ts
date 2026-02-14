import { Router } from "express";
import { Horizon } from "@stellar/stellar-sdk";
import { z } from "zod";
import { getServerEnv } from "@redi/config";

const router = Router();

const requestSchema = z.object({
  publicKey: z.string().min(1),
});

router.post("/wallet/native-state", async (req, res) => {
  try {
    const { publicKey } = requestSchema.parse(req.body);
    const env = getServerEnv();
    const server = new Horizon.Server(env.STELLAR_HORIZON_URL);

    const account = await server.loadAccount(publicKey);
    const nativeBalance = account.balances.find((item) => item.asset_type === "native");
    const issuedAssets = account.balances
      .filter(
        (item) => item.asset_type === "credit_alphanum4" || item.asset_type === "credit_alphanum12",
      )
      .map((item) => ({
        assetCode: "asset_code" in item ? item.asset_code : "",
        assetIssuer: "asset_issuer" in item ? item.asset_issuer : "",
        balance: item.balance,
      }));

    return res.json({
      publicKey,
      nativeToken: {
        code: "XLM",
        balance: nativeBalance?.balance ?? "0",
      },
      issuedAssets,
      sequence: account.sequence,
    });
  } catch (error: unknown) {
    const err = error as { response?: { status?: number } };
    if (err.response?.status === 404) {
      const parsed = requestSchema.safeParse(req.body);
      return res.json({
        publicKey: parsed.success ? parsed.data.publicKey : "",
        nativeToken: {
          code: "XLM",
          balance: "0",
        },
        issuedAssets: [],
        sequence: "",
      });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.flatten() });
    }
    return res.status(500).json({ error: "Failed to get Stellar balance" });
  }
});

export default router;
