import { type Request, type Response } from "express";
import { z } from "zod";
import { BufferService } from "./buffer.service.js";
import { SupabaseService } from "../supabase/supabase.service.js";
import { CrossmintService } from "../crossmint/crossmint.service.js";

const getBalanceSchema = z.object({
  userId: z.string().uuid(),
});

const depositSchema = z.object({
  userId: z.string().uuid(),
  amountStroops: z.string().regex(/^\d+$/, "Must be a numeric string"),
});

const withdrawSchema = z.object({
  userId: z.string().uuid(),
  sharesAmount: z.string().regex(/^\d+$/, "Must be a numeric string"),
});

const submitSchema = z.object({
  userId: z.string().uuid(),
  walletLocator: z.string().min(1),
  transactionXDR: z.string().min(1),
  txId: z.string().uuid(),
});

export class BufferController {
  constructor(
    private readonly bufferService: BufferService,
    private readonly supabaseService: SupabaseService,
    private readonly crossmintService: CrossmintService,
  ) {}

  async getBalance(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = getBalanceSchema.parse(req.body);

      const user = await this.supabaseService.getUser(userId);
      if (!user.stellar_address) {
        res.status(400).json({ error: "User has no stellar address. Complete onboarding first." });
        return;
      }

      const balance = await this.bufferService.getBalance(user.stellar_address as string);
      res.json({ userId, balance });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request", details: error.flatten() });
        return;
      }
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[BufferController] getBalance failed: ${message}`);
      res.status(500).json({ error: "Failed to get buffer balance" });
    }
  }

  async prepareDeposit(req: Request, res: Response): Promise<void> {
    try {
      const { userId, amountStroops } = depositSchema.parse(req.body);

      const user = await this.supabaseService.getUser(userId);
      if (!user.stellar_address) {
        res.status(400).json({ error: "User has no stellar address. Complete onboarding first." });
        return;
      }

      const transactionXDR = await this.bufferService.buildDepositTransaction(
        user.stellar_address as string,
        amountStroops,
      );

      const txId = await this.supabaseService.createBufferTransaction({
        userId,
        transactionType: "DEPOSIT",
        amountStroops: Number(amountStroops),
        status: "PENDING",
      });

      res.json({ transactionXDR, txId });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request", details: error.flatten() });
        return;
      }
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[BufferController] prepareDeposit failed: ${message}`);
      res.status(500).json({ error: "Failed to prepare deposit transaction" });
    }
  }

  async submitDeposit(req: Request, res: Response): Promise<void> {
    try {
      const { userId, walletLocator, transactionXDR, txId } = submitSchema.parse(req.body);

      const result = await this.crossmintService.signAndSubmitTransaction({
        walletLocator,
        transactionXDR,
      });

      await this.supabaseService.updateBufferTransaction(txId, {
        stellarTxHash: result.transactionHash,
        status: "CONFIRMED",
        confirmedAt: new Date(),
      });

      res.json({ transactionHash: result.transactionHash, txId });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request", details: error.flatten() });
        return;
      }
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[BufferController] submitDeposit failed: ${message}`);
      res.status(500).json({ error: "Failed to submit deposit" });
    }
  }

  async prepareWithdraw(req: Request, res: Response): Promise<void> {
    try {
      const { userId, sharesAmount } = withdrawSchema.parse(req.body);

      const user = await this.supabaseService.getUser(userId);
      if (!user.stellar_address) {
        res.status(400).json({ error: "User has no stellar address. Complete onboarding first." });
        return;
      }

      const transactionXDR = await this.bufferService.buildWithdrawTransaction(
        user.stellar_address as string,
        sharesAmount,
      );

      const txId = await this.supabaseService.createBufferTransaction({
        userId,
        transactionType: "WITHDRAW",
        sharesDelta: Number(sharesAmount),
        status: "PENDING",
      });

      res.json({ transactionXDR, txId });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request", details: error.flatten() });
        return;
      }
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[BufferController] prepareWithdraw failed: ${message}`);
      res.status(500).json({ error: "Failed to prepare withdraw transaction" });
    }
  }

  async submitWithdraw(req: Request, res: Response): Promise<void> {
    try {
      const { userId, walletLocator, transactionXDR, txId } = submitSchema.parse(req.body);

      const result = await this.crossmintService.signAndSubmitTransaction({
        walletLocator,
        transactionXDR,
      });

      await this.supabaseService.updateBufferTransaction(txId, {
        stellarTxHash: result.transactionHash,
        status: "CONFIRMED",
        confirmedAt: new Date(),
      });

      res.json({ transactionHash: result.transactionHash, txId });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request", details: error.flatten() });
        return;
      }
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[BufferController] submitWithdraw failed: ${message}`);
      res.status(500).json({ error: "Failed to submit withdraw" });
    }
  }
}
