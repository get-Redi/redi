export interface CreateWalletResponse {
  walletId: string;
  address: string;
  chain: string;
}

export interface SignTransactionRequest {
  walletLocator: string;
  transactionXDR: string;
}

export interface SignTransactionResponse {
  signedXDR: string;
  transactionHash: string;
}

export class CrossmintService {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor() {
    const apiKey = process.env.CROSSMINT_API_KEY;

    if (!apiKey) {
      throw new Error("[CrossmintService] Required env var: CROSSMINT_API_KEY");
    }

    this.baseUrl = "https://staging.crossmint.com";
    this.headers = {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    };
  }

  // GET primero — soporta wallet existente con cualquier signer (email o api-key)
  // Solo crea si no existe — idempotente
  async createWalletForUser(email: string): Promise<CreateWalletResponse> {
    const walletLocator = encodeURIComponent(`email:${email}:stellar`);

    const getResponse = await fetch(`${this.baseUrl}/api/2025-06-09/wallets/${walletLocator}`, {
      headers: this.headers,
    });

    if (getResponse.ok) {
      const data = (await getResponse.json()) as Record<string, unknown>;
      console.info(`[CrossmintService] Wallet retrieved for ${email}: ${data.address}`);
      return {
        walletId: `email:${email}:stellar`,
        address: data.address as string,
        chain: (data.chainType as string) ?? "stellar",
      };
    }

    const createResponse = await fetch(`${this.baseUrl}/api/2025-06-09/wallets`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        chainType: "stellar",
        type: "smart",
        config: { adminSigner: { type: "api-key" } },
        owner: `email:${email}`,
      }),
    });

    const createData = (await createResponse.json()) as Record<string, unknown>;

    if (!createResponse.ok) {
      throw new Error(
        `[CrossmintService] createWalletForUser failed: ${JSON.stringify(createData)}`,
      );
    }

    console.info(`[CrossmintService] Wallet created for ${email}: ${createData.address}`);

    return {
      walletId: `email:${email}:stellar`,
      address: createData.address as string,
      chain: (createData.chainType as string) ?? "stellar",
    };
  }

  async getWalletBalances(email: string): Promise<Record<string, unknown>> {
    const walletLocator = encodeURIComponent(`email:${email}:stellar`);

    const response = await fetch(
      `${this.baseUrl}/api/2025-06-09/wallets/${walletLocator}/balances?tokens=xlm,usdc`,
      { headers: this.headers },
    );

    const data = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      throw new Error(`[CrossmintService] getWalletBalances failed: ${JSON.stringify(data)}`);
    }

    return data;
  }

  async signAndSubmitTransaction(
    request: SignTransactionRequest,
  ): Promise<SignTransactionResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/2025-06-09/wallets/${request.walletLocator}/transactions`,
      {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          params: {
            transaction: {
              type: "stellar-xdr",
              xdr: request.transactionXDR,
            },
            signer: "api-key",
          },
        }),
      },
    );

    const data = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      throw new Error(
        `[CrossmintService] signAndSubmitTransaction failed: ${JSON.stringify(data)}`,
      );
    }

    console.info(
      `[CrossmintService] Transaction submitted for ${request.walletLocator}: ${(data.onChain as Record<string, unknown>)?.txId}`,
    );

    return {
      signedXDR: request.transactionXDR,
      transactionHash:
        ((data.onChain as Record<string, unknown>)?.txId as string) ?? (data.id as string),
    };
  }
}
