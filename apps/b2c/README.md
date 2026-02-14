## Redi B2C App: Run Guide

This guide explains how to run the `b2c` app with the wallet backend in local development.

### Prerequisites

- Node.js 20.x
- pnpm 9.x
- A valid Crossmint API key

Run all commands from:

```bash
cd redi
```

## Environment

### Frontend (b2c)

Copy the example file and then edit it:

```bash
cp apps/b2c/.env.local.example apps/b2c/.env.local
```

Update `apps/b2c/.env.local` with your values:

```env
NEXT_PUBLIC_API_URL=http://localhost:4103
NEXT_PUBLIC_CROSSMINT_API_KEY=ck_staging_xxxxxxxxxxxxxxxxx
```

### Backend (wallet-service)

Copy the example file and then edit it:

```bash
cp services/wallet-service/.env.example services/wallet-service/.env
```

Update `services/wallet-service/.env` with your values:

```env
CROSSMINT_API_KEY=sk_staging_xxxxxxxxxxxxxxxxx
WALLET_SERVICE_PORT=4103
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
```

### Install and Build

```bash
pnpm install
pnpm --filter @redi/config build
pnpm --filter @redi/crossmint build
pnpm --filter @redi/api-client build
```

### Run in Separate Terminals

Terminal 1: wallet backend

```bash
cd redi
pnpm --filter wallet-service dev
```

Terminal 2: b2c frontend

```bash
cd redi
pnpm --filter b2c dev
```

### Verify

- Backend health:

```bash
curl http://localhost:4103/health
```

- Frontend:
  - Open the URL printed by Next.js (`http://localhost:3000` by default).
