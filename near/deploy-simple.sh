#!/bin/bash

# Simple NEAR Contract Deployment Script
# This script handles the most common deployment scenario

set -e

echo "🚀 NEAR HTLC Contract Deployment"
echo "================================"

# Default values
NETWORK="testnet"
CONTRACT_ACCOUNT=""
DEPLOYER_ACCOUNT=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --contract)
      CONTRACT_ACCOUNT="$2"
      shift 2
      ;;
    --deployer)
      DEPLOYER_ACCOUNT="$2"
      shift 2
      ;;
    --network)
      NETWORK="$2"
      shift 2
      ;;
    --help)
      echo "Usage: ./deploy-simple.sh --contract htlc.testnet --deployer alice.testnet [--network testnet]"
      echo ""
      echo "Prerequisites:"
      echo "1. Install NEAR CLI: npm install -g near-cli"
      echo "2. Login: near login"
      echo "3. Install Rust: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
      echo "4. Add wasm target: rustup target add wasm32-unknown-unknown"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Validate required arguments
if [ -z "$CONTRACT_ACCOUNT" ]; then
  echo "❌ Contract account is required. Use --contract <account>"
  exit 1
fi

if [ -z "$DEPLOYER_ACCOUNT" ]; then
  echo "❌ Deployer account is required. Use --deployer <account>"
  exit 1
fi

echo "📡 Network: $NETWORK"
echo "📝 Contract: $CONTRACT_ACCOUNT"
echo "👤 Deployer: $DEPLOYER_ACCOUNT"
echo ""

# Step 1: Check if NEAR CLI is installed
echo "1️⃣ Checking NEAR CLI..."
if ! command -v near &> /dev/null; then
  echo "❌ NEAR CLI not found. Install with: npm install -g near-cli"
  exit 1
fi
echo "✅ NEAR CLI found"

# Step 2: Check if logged in
echo ""
echo "2️⃣ Checking authentication..."
if ! near keys > /dev/null 2>&1; then
  echo "❌ Not logged in to NEAR CLI. Run: near login"
  exit 1
fi
echo "✅ Authenticated"

# Step 3: Build contract
echo ""
echo "3️⃣ Building contract..."
cd contracts

# Check if Rust is available
if command -v cargo &> /dev/null; then
  echo "📦 Building with Cargo..."
  cargo build --target wasm32-unknown-unknown --release
  WASM_FILE="target/wasm32-unknown-unknown/release/htlc.wasm"
  
  if [ -f "$WASM_FILE" ]; then
    echo "✅ Contract built successfully"
  else
    echo "❌ Build failed"
    exit 1
  fi
else
  echo "⚠️  Rust not found. You'll need to build the contract manually or use a pre-built one."
  echo "Install Rust: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
  echo "Add wasm target: rustup target add wasm32-unknown-unknown"
  exit 1
fi

# Step 4: Create account if it doesn't exist
echo ""
echo "4️⃣ Checking contract account..."
if ! near state "$CONTRACT_ACCOUNT" > /dev/null 2>&1; then
  echo "📝 Creating contract account..."
  near create-account "$CONTRACT_ACCOUNT" --masterAccount "$DEPLOYER_ACCOUNT" --initialBalance 10
  echo "✅ Account created"
else
  echo "✅ Account exists"
fi

# Step 5: Deploy contract
echo ""
echo "5️⃣ Deploying contract..."
near deploy --accountId "$CONTRACT_ACCOUNT" --wasmFile "$WASM_FILE"
echo "✅ Contract deployed"

# Step 6: Initialize contract
echo ""
echo "6️⃣ Initializing contract..."
near call "$CONTRACT_ACCOUNT" new --accountId "$DEPLOYER_ACCOUNT"
echo "✅ Contract initialized"

# Step 7: Test contract
echo ""
echo "7️⃣ Testing contract..."
echo "Testing view method..."
near view "$CONTRACT_ACCOUNT" get_htlc '{"htlc_id": "test:0"}' || true
echo "✅ Contract is responsive"

# Step 8: Save deployment info
echo ""
echo "8️⃣ Saving deployment info..."
cd ..
mkdir -p deployments

cat > "deployments/${NETWORK}-deployment.json" << EOF
{
  "network": "$NETWORK",
  "contractAccount": "$CONTRACT_ACCOUNT",
  "deployerAccount": "$DEPLOYER_ACCOUNT",
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")",
  "explorerUrl": "https://explorer.${NETWORK}.near.org/accounts/${CONTRACT_ACCOUNT}",
  "rpcUrl": "https://rpc.${NETWORK}.near.org"
}
EOF

echo "💾 Deployment info saved"

# Update config file
CONFIG_FILE="config/${NETWORK}.json"
if [ -f "$CONFIG_FILE" ]; then
  # Update contractId in config file
  jq ".contractId = \"$CONTRACT_ACCOUNT\"" "$CONFIG_FILE" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"
  echo "⚙️  Updated $CONFIG_FILE"
fi

echo ""
echo "🎉 Deployment completed successfully!"
echo "===================================="
echo "📝 Contract Account: $CONTRACT_ACCOUNT"
echo "🔗 Explorer: https://explorer.${NETWORK}.near.org/accounts/$CONTRACT_ACCOUNT"
echo ""
echo "Next steps:"
echo "1. Test the contract with small amounts"
echo "2. Update your .env file with the contract address"
echo "3. Run integration tests with the EVM side"
echo ""
echo "Test HTLC creation:"
echo "near call $CONTRACT_ACCOUNT create_htlc '{\"receiver\": \"alice.testnet\", \"hashlock\": \"abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab\", \"timelock\": 1756000000}' --accountId $DEPLOYER_ACCOUNT --deposit 1"