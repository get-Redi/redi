export interface CreateVaultRequest {
  userAddress: string;
  assetAddress?: string;
  strategyAddress?: string;
}

export interface CreateVaultResponse {
  transactionXDR: string;
  predictedVaultAddress?: string;
}

export class DeFindexService {
  private readonly apiUrl: string;
  private readonly network: string;
  private readonly adminAddress: string;
  private readonly headers: Record<string, string>;

  constructor() {
    const apiUrl = process.env.DEFINDEX_API_URL;
    const apiKey = process.env.DEFINDEX_API_KEY;
    const adminAddress = process.env.ADMIN_STELLAR_ADDRESS;

    this.network = process.env.STELLAR_NETWORK ?? "testnet";

    if (!apiUrl || !apiKey || !adminAddress) {
      throw new Error(
        "[DeFindexService] Required env vars: DEFINDEX_API_URL, DEFINDEX_API_KEY, ADMIN_STELLAR_ADDRESS",
      );
    }

    this.apiUrl = apiUrl;
    this.adminAddress = adminAddress;
    this.headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
  }

  async createVaultForUser(request: CreateVaultRequest): Promise<CreateVaultResponse> {
    const assetAddress = request.assetAddress ?? process.env.XLM_CONTRACT_ADDRESS;
    const strategyAddress = request.strategyAddress ?? process.env.XLM_BLEND_STRATEGY;

    if (!assetAddress || !strategyAddress) {
      throw new Error(
        "[DeFindexService] Required env vars: XLM_CONTRACT_ADDRESS, XLM_BLEND_STRATEGY",
      );
    }

    const strategyName =
      assetAddress === process.env.XLM_CONTRACT_ADDRESS
        ? "XLM_blend_strategy"
        : "USDC_blend_strategy";

    const payload = {
      caller: this.adminAddress,
      roles: {
        "0": this.adminAddress,
        "1": this.adminAddress,
        "2": request.userAddress,
        "3": this.adminAddress,
      },
      vault_fee_bps: 25,
      upgradable: true,
      name_symbol: {
        name: "REDI Buffer Vault",
        symbol: "RVLT",
      },
      assets: [
        {
          address: assetAddress,
          strategies: [
            {
              address: strategyAddress,
              name: strategyName,
              paused: false,
            },
          ],
        },
      ],
    };

    let response: Response;
    try {
      response = await fetch(
        `${this.apiUrl}/factory/create-vault?network=${this.network}`,
        {
          method: "POST",
          headers: this.headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(60_000),
        },
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`[DeFindexService] createVaultForUser network error: ${message}`);
    }

    const data = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      throw new Error(`[DeFindexService] createVaultForUser failed: ${JSON.stringify(data)}`);
    }

    console.info(
      `[DeFindexService] Vault creation initiated for ${request.userAddress}`,
    );

    return {
      transactionXDR: data.xdr as string,
      predictedVaultAddress: data.predictedVaultAddress as string | undefined,
    };
  }

  async waitForVaultConfirmation(
    vaultAddress: string,
    maxAttempts = 20,
    delayMs = 3_000,
  ): Promise<boolean> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(
          `${this.apiUrl}/vault/${vaultAddress}?network=${this.network}`,
          { headers: this.headers, signal: AbortSignal.timeout(15_000) },
        );

        if (response.ok) {
          const data = (await response.json()) as Record<string, unknown>;
          if (data?.name) {
            console.info(`[DeFindexService] Vault confirmed: ${vaultAddress}`);
            return true;
          }
        }
      } catch {
        console.debug(
          `[DeFindexService] waitForVaultConfirmation attempt ${attempt}/${maxAttempts} — retrying in ${delayMs}ms`,
        );
      }

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    console.warn(
      `[DeFindexService] Vault ${vaultAddress} not confirmed after ${maxAttempts} attempts`,
    );
    return false;
  }
}

export { DeFindexService as default };
