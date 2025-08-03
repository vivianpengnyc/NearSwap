# EVM-NEAR Atomic Swap Testing Guide

This guide walks you through testing the complete EVM-NEAR atomic swap system.

## Prerequisites

### 1. NEAR Testnet Setup
- Create NEAR testnet accounts at [wallet.testnet.near.org](https://wallet.testnet.near.org)
- Get testnet NEAR tokens from the faucet
- Export your private key from NEAR wallet

### 2. EVM Testnet Setup
- Get Sepolia ETH from faucets
- Have MetaMask or similar wallet ready
- Note: EVM contracts are already deployed on Sepolia

## Step-by-Step Testing Process

### Phase 1: Environment Setup

1. **Setup NEAR side**:
```bash
cd near/
npm install

# Create environment file
cp .env.example .env
```

2. **Edit NEAR .env file**:
```env
NEAR_NETWORK=testnet
NEAR_PRIVATE_KEY=ed25519:your_near_private_key_here
```

3. **Setup EVM side** (already configured):
```bash
cd ../evm/
# EVM contracts already deployed on Sepolia
```

### Phase 2: Deploy NEAR HTLC Contract

1. **Install NEAR CLI**:
```bash
npm install -g near-cli
```

2. **Login to NEAR**:
```bash
near login
```

3. **Deploy HTLC contract**:
```bash
# Build the contract (if you have Rust toolchain)
cd near/contracts/
cargo build --target wasm32-unknown-unknown --release

# Deploy to testnet
near deploy --accountId your-contract.testnet --wasmFile target/wasm32-unknown-unknown/release/htlc.wasm
```

**Alternative**: Use a pre-deployed contract for testing.

### Phase 3: Test EVM→NEAR Swap

This tests the flow where someone wants to trade EVM tokens for NEAR tokens.

#### Step 1: Create EVM Escrow (Maker Side)

```bash
cd evm/

# Create an order where maker provides 0.01 ETH and wants 1 NEAR
npx hardhat run scripts/create-near-order.ts --network sepolia -- \
  --provide-asset ETH \
  --provide-amount 0.01 \
  --want-amount 1000000000000000000000000 \
  --near-account bob.testnet
```

This will output:
- Order ID
- Secret (keep this secret!)
- Hashlock
- EVM escrow address

#### Step 2: Create Matching NEAR HTLC (Taker Side)

```bash
cd ../near/

# Taker creates HTLC with 1 NEAR using the SAME hashlock
npm run create-htlc -- \
  --sender bob.testnet \
  --receiver alice.testnet \
  --amount 1 \
  --hashlock 0x[hashlock_from_step_1] \
  --timelock 24
```

#### Step 3: Maker Claims NEAR (Reveals Secret)

```bash
cd near/

# Maker uses secret to claim 1 NEAR
npm run claim-htlc -- \
  --htlc-id [htlc_id_from_step_2] \
  --secret 0x[secret_from_step_1] \
  --claimer alice.testnet
```

#### Step 4: Taker Claims EVM Tokens

```bash
cd ../evm/

# Taker uses the now-revealed secret to claim 0.01 ETH
npx hardhat run scripts/claim-evm-tokens.ts --network sepolia -- \
  --escrow-address [address_from_step_1] \
  --secret 0x[secret_from_step_1] \
  --claimer-address [taker_evm_address]
```

### Phase 4: Test NEAR→EVM Swap

This tests the reverse flow where someone trades NEAR for EVM tokens.

#### Step 1: Create NEAR HTLC First (Maker Side)

```bash
cd near/

# Maker creates HTLC with 2 NEAR
npm run create-htlc -- \
  --sender alice.testnet \
  --receiver bob.testnet \
  --amount 2 \
  --timelock 24
```

Save the secret and hashlock from output.

#### Step 2: Create Matching EVM Escrow (Taker Side)

```bash
cd ../evm/

# Taker creates escrow with 0.02 ETH using SAME hashlock
npx hardhat run scripts/create-near-order.ts --network sepolia -- \
  --provide-asset ETH \
  --provide-amount 0.02 \
  --hashlock 0x[hashlock_from_step_1] \
  --near-account alice.testnet
```

#### Step 3: Maker Claims EVM Tokens (Reveals Secret)

```bash
cd evm/

# Maker claims 0.02 ETH using secret
npx hardhat run scripts/claim-evm-tokens.ts --network sepolia -- \
  --escrow-address [address_from_step_2] \
  --secret 0x[secret_from_step_1] \
  --claimer-address [maker_evm_address]
```

#### Step 4: Taker Claims NEAR Tokens

```bash
cd ../near/

# Taker uses revealed secret to claim 2 NEAR
npm run claim-htlc -- \
  --htlc-id [htlc_id_from_step_1] \
  --secret 0x[revealed_secret] \
  --claimer bob.testnet
```

## Testing Scenarios

### 1. Happy Path Test
✅ Complete the full swap as described above

### 2. Timeout/Refund Test

Create a swap but don't complete it:

```bash
# Create HTLC with short timeout (1 hour)
npm run create-htlc -- \
  --sender alice.testnet \
  --receiver bob.testnet \
  --amount 1 \
  --timelock 1

# Wait for timeout, then refund
npm run refund-htlc -- \
  --htlc-id [htlc_id] \
  --refunder alice.testnet
```

### 3. Invalid Secret Test

Try to claim with wrong secret:

```bash
# This should fail
npm run claim-htlc -- \
  --htlc-id [htlc_id] \
  --secret 0x1234567890abcdef... \
  --claimer bob.testnet
```

## Monitoring and Verification

### Check NEAR Transactions
```bash
# View transaction on NEAR explorer
https://explorer.testnet.near.org/transactions/[tx_hash]
```

### Check EVM Transactions
```bash
# View on Sepolia Etherscan
https://sepolia.etherscan.io/tx/[tx_hash]
```

### Verify Account Balances

**NEAR**:
```bash
near view-state [account.testnet]
```

**EVM**:
```bash
npx hardhat run scripts/check-balance.ts --network sepolia
```

## Troubleshooting

### Common Issues

1. **"Account not found"**
   - Ensure NEAR account exists and has sufficient balance
   - Check account ID spelling

2. **"Invalid secret"**
   - Verify secret matches hashlock exactly
   - Check for copy-paste errors

3. **"Transaction failed"**
   - Check gas/storage costs
   - Verify account permissions
   - Ensure sufficient balance

4. **"HTLC expired"**
   - Check current time vs timelock
   - Use refund instead of claim

### Debug Commands

**Check HTLC status**:
```bash
cd near/
npm run create-htlc -- --help
```

**View detailed logs**:
```bash
DEBUG=true npm run claim-htlc -- [options]
```

## Success Criteria

A successful test should show:

✅ **Atomicity**: Either both sides complete or both fail
✅ **Secret Revelation**: Secret is revealed when first party claims
✅ **Timelock Enforcement**: Cannot claim after expiration
✅ **Balance Changes**: Correct token transfers on both chains
✅ **No Double Spending**: Cannot claim twice from same HTLC

## Production Readiness Checklist

Before using in production:

- [ ] Test with larger amounts
- [ ] Test network failures and recovery
- [ ] Verify gas cost calculations
- [ ] Test with multiple simultaneous swaps
- [ ] Audit smart contracts
- [ ] Set appropriate timelock periods
- [ ] Monitor for MEV attacks
- [ ] Implement proper error handling
- [ ] Set up monitoring and alerts

## Next Steps

1. **Start with small amounts** (0.001 ETH, 0.1 NEAR)
2. **Test all scenarios** including failures
3. **Monitor transactions** carefully
4. **Gradually increase** amounts
5. **Deploy to mainnet** when confident

The system is designed to be secure and atomic - if anything fails, funds can be recovered through the refund mechanism.