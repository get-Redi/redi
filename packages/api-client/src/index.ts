import { z } from "zod";

const walletSchema = z.object({
  address: z.string(),
  chain: z.string(),
  type: z.string(),
});

const walletBalanceSchema = z.object({
  address: z.string(),
  chain: z.string(),
  type: z.string(),
  nativeToken: z.object({
    amount: z.string(),
    rawAmount: z.string(),
  }),
  customTokens: z.array(z.unknown()),
});

const onboardingSchema = z.object({
  userId: z.string(),
  stellarAddress: z.string().nullish(),
  vaultAddress: z.string().nullish(),
  status: z.string(),
});

const bufferBalanceSchema = z.object({
  userId: z.string(),
  balance: z.object({
    availableShares: z.string(),
    protectedShares: z.string(),
    totalDeposited: z.string(),
    lastDepositTs: z.number(),
    version: z.number(),
  }),
});

export type WalletResponse = z.infer<typeof walletSchema>;
export type WalletBalanceResponse = z.infer<typeof walletBalanceSchema>;
export type OnboardingResponse = z.infer<typeof onboardingSchema>;
export type BufferBalanceResponse = z.infer<typeof bufferBalanceSchema>;

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4103";
}

async function postJson<T>(path: string, payload: unknown, schema: z.ZodSchema<T>): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`API request failed (${response.status})`);
  }

  const data = await response.json();
  return schema.parse(data);
}

export function provisionBufferWallet(email: string) {
  return postJson("/api/buffer/wallet/provision", { email }, walletSchema);
}

export function getBufferWalletState(email: string) {
  return postJson("/api/buffer/wallet/state", { email }, walletBalanceSchema);
}

export function onboardUser(userId: string, email: string) {
  return postJson("/api/buffer/onboarding", { userId, email }, onboardingSchema);
}

export function getBufferBalance(userId: string) {
  return postJson("/api/buffer/balance", { userId }, bufferBalanceSchema);
}
