# Bridge Contract

Smart contract for installment payment plans on Stellar Soroban network.

## Overview

The Bridge Contract enables users to create collateralized installment payment plans for purchases. It integrates with the Buffer Contract to lock and manage user funds as collateral.

## Key Features

- **Installment Plans**: Create payment plans with 1-12 installments
- **Collateralized**: Uses Buffer shares as collateral (100% collateralization)
- **Automatic Collection**: Attempts payment from available funds, falls back to protected
- **Complete Integration**: Works seamlessly with Buffer Contract

## Quick Start

### Prerequisites

- Rust toolchain
- Soroban CLI
- `wasm32-unknown-unknown` target

```bash
rustup target add wasm32-unknown-unknown
cargo install soroban-cli
```

### Build

```bash
cargo build --target wasm32-unknown-unknown --release
```

The compiled `.wasm` file will be at:
```
target/wasm32-unknown-unknown/release/bridge_contract.wasm
```

### Test

```bash
cargo test
```

### Deploy to Testnet

```bash
# Configure testnet
soroban network add \
  --global testnet \
  --rpc-url https://soroban-testnet.stellar.org:443 \
  --network-passphrase "Test SDF Network ; September 2015"

# Generate identity
soroban keys generate --global deployer --network testnet

# Deploy
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/bridge_contract.wasm \
  --source deployer \
  --network testnet

# Save the returned contract ID
```

## Main Functions

### `create_plan`

Creates a new installment plan.

**Parameters:**
- `user`: User address (must sign)
- `merchant`: Merchant receiving payments
- `total_amount`: Total amount to finance (in tokens)
- `installments_count`: Number of installments (1-12)
- `due_dates`: Vector of due dates (timestamps)
- `buffer_contract`: Buffer Contract address

**Returns:** Plan ID (String)

**Validations:**
- Amount must be positive
- Installments between 1-12
- User must have sufficient collateral in Buffer
- All due dates must be in the future

### `collect_installment`

Collects a due installment.

**Parameters:**
- `plan_id`: Plan identifier
- `installment_number`: Installment to collect (1, 2, 3...)
- `buffer_contract`: Buffer Contract address
- `merchant_address`: Merchant receiving payment

**Returns:** Payment source (Available or Protected)

**Logic:**
1. Validates installment is pending and due
2. Attempts collection from available shares
3. Falls back to protected shares if insufficient
4. Marks as failed if neither is sufficient
5. Unlocks remaining collateral when plan completes

### `get_plan`

Retrieves plan details.

**Parameters:**
- `plan_id`: Plan identifier

**Returns:** BridgePlan struct

### `get_user_plans`

Gets all plan IDs for a user.

**Parameters:**
- `user`: User address

**Returns:** Vector of plan IDs

### `get_next_due`

Finds next due installment for a plan.

**Parameters:**
- `plan_id`: Plan identifier

**Returns:** Optional<Installment>

### `get_plan_summary`

Gets plan with current Buffer values.

**Parameters:**
- `plan_id`: Plan identifier
- `buffer_contract`: Buffer Contract address

**Returns:** (BridgePlan, available_value, protected_value)

## Data Structures

### BridgePlan

```rust
pub struct BridgePlan {
    pub plan_id: String,             // Unique plan ID
    pub user: Address,               // User who created plan
    pub merchant: Address,           // Merchant receiving payments
    pub total_amount: i128,          // Total amount in tokens
    pub total_shares: i128,          // Total shares locked as collateral
    pub installments_count: u32,     // Number of installments
    pub installments: Vec<Installment>, // List of installments
    pub protected_shares: i128,      // Currently protected shares
    pub status: PlanStatus,          // Active | Completed | Defaulted
    pub created_at: u64,             // Creation timestamp
}
```

### Installment

```rust
pub struct Installment {
    pub number: u32,                 // Installment number (1, 2, 3...)
    pub amount: i128,                // Amount in tokens
    pub due_date: u64,               // Due date timestamp
    pub paid_at: Option<u64>,        // Payment timestamp
    pub payment_source: Option<PaymentSource>, // Available | Protected
    pub status: InstallmentStatus,   // Pending | Paid | Failed
}
```

## Events

### `plan_new`

Emitted when a plan is created.

**Data:**
- plan_id
- user
- merchant
- total_amount
- installments_count
- shares_locked

### `inst_paid`

Emitted when an installment is paid.

**Data:**
- plan_id
- installment_number
- payment_source
- shares_used

## Error Codes

| Code | Error | Description |
|------|-------|-------------|
| 1 | InvalidAmount | Amount <= 0 |
| 2 | InvalidInstallments | Count = 0 or > 12 |
| 3 | InsufficientCollateral | Buffer total < amount |
| 4 | InsufficientAvailable | Buffer available < amount |
| 5 | DatesMismatch | Dates count ≠ installments |
| 6 | InvalidDueDate | Due date in the past |
| 7 | PlanNotFound | Plan doesn't exist |
| 8 | InstallmentNotFound | Installment doesn't exist |
| 9 | AlreadyPaid | Installment already paid |
| 10 | NotDueYet | Installment not due yet |
| 11 | InsufficientFunds | Not enough funds to pay |
| 12 | TooManyInstallments | More than 12 installments |
| 13 | BufferContractError | Buffer call failed |
| 14 | InvalidShares | Invalid share calculation |

## Integration with Buffer Contract

The Bridge Contract requires the Buffer Contract to have these functions:

- `get_balance(user)` → Returns BufferBalance
- `lock_shares(user, shares)` → Locks shares as collateral
- `unlock_shares(user, shares)` → Releases collateral
- `debit_available(user, shares, to)` → Debits from available
- `debit_protected(user, shares, to)` → Debits from protected (fallback)
- `get_values(user)` → Returns (available, protected, total) in tokens
- `shares_for_amount(amount)` → Calculates shares needed

See `docs/contracts/integration.md` for detailed integration guide.

## Development

### Project Structure

```
bridge/
├── src/
│   └── lib.rs          # Main contract code
├── Cargo.toml          # Dependencies
└── README.md           # This file
```

### Testing

```bash
# Run all tests
cargo test

# Run with output
cargo test -- --nocapture

# Run specific test
cargo test test_create_plan
```

### Optimization

```bash
# Build optimized for size
cargo build --target wasm32-unknown-unknown --release

# Further optimize (optional)
soroban contract optimize \
  --wasm target/wasm32-unknown-unknown/release/bridge_contract.wasm
```

## License

MIT

---

**REDI Project** - Collateralized installment payment system on Stellar