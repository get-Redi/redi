import { type Request, type Response } from "express";
import { z } from "zod";
import { OnboardingService } from "./onboarding.service.js";
import { SupabaseService } from "../supabase/supabase.service.js";

const onboardSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
});

const statusSchema = z.object({
  userId: z.string().uuid(),
});

export class OnboardingController {
  constructor(
    private readonly onboardingService: OnboardingService,
    private readonly supabaseService: SupabaseService,
  ) {}

  // POST /api/buffer/onboarding
  async onboard(req: Request, res: Response): Promise<void> {
    try {
      const { userId, email } = onboardSchema.parse(req.body);
      const result = await this.onboardingService.onboardUser(userId, email);
      res.json(result);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request", details: error.flatten() });
        return;
      }
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[OnboardingController] onboard failed: ${message}`);
      res.status(500).json({ error: "Onboarding failed" });
    }
  }

  // POST /api/buffer/onboarding/status
  // Solo consulta — no dispara onboarding
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = statusSchema.parse(req.body);

      try {
        const user = await this.supabaseService.getUser(userId);
        res.json({
          userId,
          status: user.buffer_onboarding_status ?? "PENDING",
          stellarAddress: user.stellar_address ?? null,
          vaultAddress: user.defindex_vault_address ?? null,
        });
      } catch {
        // Usuario no existe en DB todavía
        res.json({ userId, status: "NOT_STARTED" });
      }
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request", details: error.flatten() });
        return;
      }
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[OnboardingController] getStatus failed: ${message}`);
      res.status(500).json({ error: "Failed to get onboarding status" });
    }
  }
}
