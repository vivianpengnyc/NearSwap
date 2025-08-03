#!/bin/bash

echo "Testing with the exact format that worked for you..."

# Create HTLC using the exact format that worked
near call htlc-nearswap.testnet create_htlc \
  '{"receiver": "javweb3.testnet", "hashlock": "abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab", "timelock": 1756000000}' \
  --accountId javweb3.testnet \
  --deposit 1

echo "Done!"