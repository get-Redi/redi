import { z } from "zod";

const serverEnvSchema = z.object({
  CROSSMINT_API_KEY: z.string().min(1),
  WALLET_SERVICE_PORT: z.coerce.number().int().positive().default(4103),
  STELLAR_NETWORK: z.enum(["testnet", "mainnet"]).default("testnet"),
  STELLAR_HORIZON_URL: z.string().url().default("https://horizon-testnet.stellar.org"),
});

const publicEnvSchema = z.object({
  NEXT_PUBLIC_CROSSMINT_API_KEY: z.string().min(1),
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:4103"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function getServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  return serverEnvSchema.parse(source);
}

export function getPublicEnv(source: NodeJS.ProcessEnv = process.env): PublicEnv {
  return publicEnvSchema.parse(source);
}
