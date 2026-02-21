import { rpc, Keypair, Networks, Transaction, xdr, StrKey } from "@stellar/stellar-sdk";
import { SupabaseService } from "../supabase/supabase.service.js";
import { CrossmintService } from "../crossmint/crossmint.service.js";
import { DeFindexService } from "../defindex/defindex.service.js";

export interface OnboardingResult {
  userId: string;
  stellarAddress: string;
  vaultAddress: string;
  status: string;
}

interface HorizonTransactionResponse {
  successful: boolean;
  hash: string;
  result_xdr: string;
  extras?: {
    result_codes?: Record<string, unknown>;
  };
}

export class OnboardingService {
  private readonly adminKeypair: Keypair;
  private readonly networkPassphrase: string;
  private readonly horizonUrl: string;
  private readonly sorobanRpc: rpc.Server;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly crossmint: CrossmintService,
    private readonly defindex: DeFindexService,
  ) {
    const adminSecret = process.env.ADMIN_STELLAR_SECRET;
    const network = process.env.STELLAR_NETWORK ?? "testnet";

    if (!adminSecret) {
      throw new Error("[OnboardingService] Required env var: ADMIN_STELLAR_SECRET");
    }

    this.adminKeypair = Keypair.fromSecret(adminSecret);
    this.networkPassphrase = network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
    this.horizonUrl =
      network === "mainnet" ? "https://horizon.stellar.org" : "https://horizon-testnet.stellar.org";

    const rpcUrl =
      process.env.STELLAR_SOROBAN_RPC_URL ??
      (network === "mainnet"
        ? "https://mainnet.stellar.validationcloud.io/v1/XCeZqFTKymREBkxOH5ISRGEwFr5sXQ9Ye9sJU2FZ8q4="
        : "https://soroban-testnet.stellar.org");
    this.sorobanRpc = new rpc.Server(rpcUrl);
  }

  async onboardUser(userId: string, email: string): Promise<OnboardingResult> {
    console.info(`[OnboardingService] Starting onboarding for user ${userId}`);

    try {
      const user = await this.supabase.upsertUser(userId, email);

      if (user.buffer_onboarding_status === "READY") {
        console.info(`[OnboardingService] User ${userId} already onboarded`);
        return {
          userId,
          stellarAddress: user.stellar_address as string,
          vaultAddress: user.defindex_vault_address as string,
          status: "READY",
        };
      }

      if (!user.stellar_address) {
        await this.createWallet(userId, email);
      }

      const userWithWallet = await this.supabase.getUser(userId);

      if (!userWithWallet.defindex_vault_address) {
        await this.createVault(userId, userWithWallet.stellar_address as string);
      }

      const finalUser = await this.supabase.getUser(userId);

      console.info(`[OnboardingService] Onboarding complete for user ${userId}`);

      return {
        userId,
        stellarAddress: finalUser.stellar_address as string,
        vaultAddress: finalUser.defindex_vault_address as string,
        status: finalUser.buffer_onboarding_status as string,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[OnboardingService] Onboarding failed for user ${userId}: ${message}`);
      try {
        await this.supabase.updateUserOnboardingStatus(userId, "FAILED");
      } catch {
        // ignore status update failure
      }
      throw error;
    }
  }

  private async createWallet(userId: string, email: string): Promise<void> {
    console.info(`[OnboardingService] [1/2] Creating Crossmint wallet for user ${userId}`);

    const wallet = await this.crossmint.createWalletForUser(email);

    await this.supabase.updateUserOnboardingStatus(userId, "WALLET_CREATED", {
      stellar_address: wallet.address,
      crossmint_wallet_id: wallet.walletId,
    });

    console.info(`[OnboardingService] Wallet created: ${wallet.address}`);
  }

  private async createVault(userId: string, stellarAddress: string): Promise<void> {
    console.info(`[OnboardingService] [2/2] Creating DeFindex vault for user ${userId}`);

    await this.supabase.updateUserOnboardingStatus(userId, "VAULT_CREATING");

    const vaultResponse = await this.defindex.createVaultForUser({
      userAddress: stellarAddress,
      assetAddress: process.env.XLM_CONTRACT_ADDRESS,
      strategyAddress: process.env.XLM_BLEND_STRATEGY,
    });

    const tx = new Transaction(vaultResponse.transactionXDR, this.networkPassphrase);
    tx.sign(this.adminKeypair);
    const signedXdr = tx.toEnvelope().toXDR("base64");

    const response = await fetch(`${this.horizonUrl}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ tx: signedXdr }),
    });

    const result = (await response.json()) as HorizonTransactionResponse;

    if (!result.successful) {
      throw new Error(
        `[OnboardingService] Vault tx failed: ${JSON.stringify(result.extras?.result_codes)}`,
      );
    }

    console.info(`[OnboardingService] Vault tx confirmed: ${result.hash}`);

    let rpcResult = await this.sorobanRpc.getTransaction(result.hash);
    for (
      let i = 0;
      i < 10 && rpcResult.status === rpc.Api.GetTransactionStatus.NOT_FOUND;
      i++
    ) {
      await new Promise<void>((resolve) => setTimeout(resolve, 2_000));
      rpcResult = await this.sorobanRpc.getTransaction(result.hash);
    }

    if (rpcResult.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
      throw new Error(`[OnboardingService] Vault tx RPC status: ${rpcResult.status}`);
    }

    const vaultAddress =
      vaultResponse.predictedVaultAddress ?? this.extractVaultAddress(rpcResult.returnValue);

    const confirmed = await this.defindex.waitForVaultConfirmation(vaultAddress);
    if (!confirmed) {
      throw new Error(
        `[OnboardingService] Vault ${vaultAddress} not confirmed by DeFindex API after polling`,
      );
    }

    await this.supabase.updateUserOnboardingStatus(userId, "READY", {
      defindex_vault_address: vaultAddress,
    });

    console.info(`[OnboardingService] Vault persisted: ${vaultAddress}`);
  }

  private extractVaultAddress(returnValue: xdr.ScVal | undefined): string {
    if (!returnValue) {
      throw new Error("[OnboardingService] No return value in Soroban RPC response");
    }

    if (returnValue.switch().name !== "scvAddress") {
      throw new Error(
        `[OnboardingService] Unexpected return value type: ${returnValue.switch().name}`,
      );
    }

    const scAddress = returnValue.address();

    if (scAddress.switch().name !== "scAddressTypeContract") {
      throw new Error(
        `[OnboardingService] ScAddress is not a contract: ${scAddress.switch().name}`,
      );
    }

    const vaultAddress = StrKey.encodeContract(scAddress.contractId() as unknown as Buffer);

    if (!StrKey.isValidContract(vaultAddress)) {
      throw new Error(`[OnboardingService] Extracted vault address is invalid: ${vaultAddress}`);
    }

    console.info(`[OnboardingService] Vault address extracted from meta XDR: ${vaultAddress}`);
    return vaultAddress;
  }
}
