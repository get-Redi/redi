import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { getOrCreateWalletByEmail, getWalletBalanceByEmail } from "@redi/crossmint";

const router = Router();

const bodySchema = z.object({
  email: z.string().email(),
});

router.post("/wallet/provision", async (req, res) => {
  try {
    const { email } = bodySchema.parse(req.body);
    const wallet = await getOrCreateWalletByEmail(email, "stellar-testnet");
    return res.json(wallet);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.flatten() });
    }
    return res.status(500).json({ error: "Failed to provision wallet" });
  }
});

router.post("/wallet/state", async (req, res) => {
  try {
    const { email } = bodySchema.parse(req.body);
    const balance = await getWalletBalanceByEmail(email, "stellar-testnet");
    return res.json(balance);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.flatten() });
    }
    return res.status(500).json({ error: "Failed to get wallet state" });
  }
});

export default router;
