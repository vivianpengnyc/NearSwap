# NEAR Contract Deployment Guide

This guide walks you through deploying the HTLC smart contract to NEAR testnet.

## Prerequisites

### 1. Install NEAR CLI
```bash
npm install -g near-cli
```

### 2. Install Rust and wasm32 target
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Add WebAssembly target
rustup target add wasm32-unknown-unknown
```

### 3. Create NEAR Testnet Account
- Visit [wallet.testnet.near.org](https://wallet.testnet.near.org)
- Create an account (e.g., `yourname.testnet`)
- Get some testnet NEAR from the faucet

## Deployment Steps

### Step 1: Prepare the Contract

The contract is already written in `contracts/htlc.rs`. Let me create the necessary build files:

1. **Cargo.toml** (Rust project configuration)
2. **lib.rs** (Entry point)
3. **Build script**

### Step 2: Build the Contract

```bash
cd near/contracts/
cargo build --target wasm32-unknown-unknown --release
```

This creates a WebAssembly file at:
`target/wasm32-unknown-unknown/release/htlc.wasm`

### Step 3: Deploy to NEAR Testnet

```bash
# Login to NEAR CLI (opens browser)
near login

# Deploy the contract
near deploy --accountId javweb3.testnet --wasmFile target/wasm32-unknown-unknown/release/htlc.wasm

near deploy htlc-swap.testnet /Users/vivianpeng/NearSwap/near/contracts/target/wasm32-unknown-unknown/release/htlc.wasm

# Initialize the contract
near call your-contract.testnet new --accountId your-contract.testnet
```

### Step 4: Verify Deployment

```bash
# Test contract by creating a small HTLC
near call your-contract.testnet create_htlc \
  '{"receiver": "alice.testnet", "hashlock": "abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab", "timelock": 1756000000}' \
  --accountId your-account.testnet \
  --deposit 1
```

## Alternative: Quick Deploy with Pre-built Contract

If you want to skip the Rust build process, I'll provide a deployment script that handles everything.

## Post-Deployment Configuration

After successful deployment:

1. **Update config files** with your contract address
2. **Test basic functions** (create, withdraw, refund)
3. **Integration test** with EVM side

## Troubleshooting

### Common Issues
- **"Account not found"**: Create account at wallet.testnet.near.org
- **"Build failed"**: Ensure Rust and wasm32 target installed
- **"Deploy failed"**: Check account has sufficient NEAR for storage

### Debug Commands
```bash
# Check account status
near state your-contract.testnet

# View contract methods
near view your-contract.testnet get_htlc '{"htlc_id": "test:123"}'
```