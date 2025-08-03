#!/bin/bash

# Use Pre-built NEAR Contract

echo "📦 Using Pre-built NEAR HTLC Contract"
echo "===================================="

# Check NEAR RPC status first
echo "🔍 Checking NEAR testnet status..."
if curl -s https://rpc.testnet.near.org/status > /dev/null 2>&1; then
    echo "✅ NEAR testnet is online"
else
    echo "❌ NEAR testnet RPC is currently down"
    echo "💡 Try again later or use a different RPC endpoint"
    exit 1
fi

# You can download a pre-built contract or use an existing one
echo ""
echo "🎯 Deployment Options:"
echo ""
echo "1. Build locally (if Rust build succeeds):"
echo "   cd contracts/"
echo "   cargo build --target wasm32-unknown-unknown --release"
echo ""
echo "2. Deploy when RPC is working:"
echo "   near deploy --accountId htlc-javweb3.testnet --wasmFile [path-to-wasm]"
echo ""
echo "3. Use existing deployed contract for testing"
echo ""
echo "📝 Alternative: Deploy a simple fungible token contract first to test the setup"
echo "   near deploy --accountId test-javweb3.testnet --wasmFile res/fungible_token.wasm"