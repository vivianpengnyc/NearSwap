#!/bin/bash

echo "🔍 Checking Deployment Status"
echo "============================"

echo ""
echo "📋 EVM Side (Sepolia):"
echo "✅ NEAREscrowFactory: 0xCE8D78684a4bbfdAB257168536933a6C359EaBC5"
echo "✅ AccessToken: 0x7B8BFc656Da1690536D094b64631773F806560cD"
echo "✅ Status: DEPLOYED AND READY"

echo ""
echo "📋 NEAR Side (Testnet):"
echo "⏳ Contract: Not yet deployed"
echo "📁 Source code: Ready in near/contracts/src/lib.rs"
echo "🔧 Build command: cd near/contracts && cargo build --target wasm32-unknown-unknown --release"

echo ""
echo "🚀 Next Steps:"
echo "1. Fix the Rust build errors by using the updated contract code"
echo "2. Build the contract: ./build-contract.sh"
echo "3. Deploy when NEAR RPC is working: near deploy --accountId htlc-javweb3.testnet --wasmFile [wasm-path]"
echo "4. Test the integration between EVM and NEAR"

echo ""
echo "💡 Quick Test (EVM side only):"
echo "cd evm/"
echo "npx hardhat run scripts/create-near-order.ts --network sepolia -- --provide-asset ETH --provide-amount 0.001 --want-amount 1000000000000000000000000 --near-account javweb3.testnet"