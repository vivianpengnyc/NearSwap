#!/bin/bash

# Test refund function
echo "Testing HTLC Refund Function"
echo "============================"

# Create an HTLC with a short timelock for testing refund
echo "1. Creating HTLC with 10-second timelock for refund test..."

# Get current timestamp + 10 seconds
TIMELOCK=$(($(date +%s) + 10))

# Create HTLC
near call htlc-nearswap.testnet create_htlc \
  '{"receiver": "receiver-test.testnet", "hashlock": "test1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab", "timelock": '$TIMELOCK'}' \
  --accountId javweb3.testnet \
  --deposit 0.1

echo ""
echo "2. Waiting 11 seconds for timelock to expire..."
sleep 11

echo ""
echo "3. Attempting refund..."
# Assuming the HTLC ID will be javweb3.testnet:1 (next in sequence)
near call htlc-nearswap.testnet refund '{"htlc_id": "javweb3.testnet:1"}' --accountId javweb3.testnet

echo ""
echo "Refund test complete!"