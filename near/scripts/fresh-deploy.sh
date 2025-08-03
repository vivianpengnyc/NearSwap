#!/bin/bash

echo "🚀 Fresh NEAR HTLC Contract Deployment"
echo "====================================="
echo ""

# Configuration
MASTER_ACCOUNT="javweb3.testnet"
CONTRACT_ACCOUNT="htlc-fresh.testnet"  # New account name
WASM_FILE="../contracts/target/wasm32-unknown-unknown/release/htlc.wasm"

echo "📋 Deployment Configuration:"
echo "  Master Account: $MASTER_ACCOUNT"
echo "  Contract Account: $CONTRACT_ACCOUNT"
echo "  WASM File: $WASM_FILE"
echo ""

# Step 1: Create new account
echo "Step 1: Creating new account..."
near create-account $CONTRACT_ACCOUNT --masterAccount $MASTER_ACCOUNT --initialBalance 5

if [ $? -ne 0 ]; then
    echo "❌ Failed to create account. The account might already exist."
    echo "   Try a different account name or delete the existing account first."
    exit 1
fi

echo "✅ Account created successfully"
echo ""

# Step 2: Deploy contract
echo "Step 2: Deploying contract..."
near deploy --accountId $CONTRACT_ACCOUNT --wasmFile $WASM_FILE

if [ $? -ne 0 ]; then
    echo "❌ Failed to deploy contract"
    exit 1
fi

echo "✅ Contract deployed successfully"
echo ""

# Step 3: Initialize contract
echo "Step 3: Initializing contract..."
near call $CONTRACT_ACCOUNT new '{}' --accountId $CONTRACT_ACCOUNT

if [ $? -ne 0 ]; then
    echo "❌ Failed to initialize contract"
    exit 1
fi

echo "✅ Contract initialized successfully"
echo ""

# Step 4: Test basic view function
echo "Step 4: Testing view function..."
near view $CONTRACT_ACCOUNT get_all_htlcs '{}'

if [ $? -eq 0 ]; then
    echo "✅ View function working correctly"
else
    echo "⚠️  View function test failed, but contract might still be working"
fi

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "1. Update config/testnet.json with the new contract ID: $CONTRACT_ACCOUNT"
echo "2. Run the test scripts to verify all functions work"
echo ""
echo "Contract Explorer URL: https://explorer.testnet.near.org/accounts/$CONTRACT_ACCOUNT"