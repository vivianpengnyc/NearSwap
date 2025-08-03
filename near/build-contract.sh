#!/bin/bash

# NEAR Contract Build Script

set -e

echo "🔨 Building NEAR HTLC Contract"
echo "=============================="

# Navigate to contracts directory
cd contracts/

# Clean previous builds
echo "🧹 Cleaning previous builds..."
cargo clean

# Build the contract
echo "📦 Building contract..."
cargo build --target wasm32-unknown-unknown --release

# Check if build succeeded
if [ -f "target/wasm32-unknown-unknown/release/htlc.wasm" ]; then
    echo "✅ Build successful!"
    echo "📄 Contract location: target/wasm32-unknown-unknown/release/htlc.wasm"
    
    # Show contract size
    SIZE=$(ls -lh target/wasm32-unknown-unknown/release/htlc.wasm | awk '{print $5}')
    echo "📏 Contract size: $SIZE"
else
    echo "❌ Build failed!"
    exit 1
fi

echo ""
echo "🎯 Next steps:"
echo "1. Deploy the contract: near deploy --accountId htlc-javweb3.testnet --wasmFile target/wasm32-unknown-unknown/release/htlc.wasm"
echo "2. Initialize: near call htlc-javweb3.testnet new --accountId javweb3.testnet"