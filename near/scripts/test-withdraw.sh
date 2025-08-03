#!/bin/bash

# Test withdraw function
echo "Testing HTLC Withdraw Function"
echo "=============================="

# The secret that produces the hashlock you used
# You used hashlock: abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab
# You need to provide the actual secret that hashes to this value

# Example: if your secret was "mysecret", you would use:
# near call htlc-nearswap.testnet withdraw '{"htlc_id": "javweb3.testnet:0", "secret": "mysecret"}' --accountId javweb3.testnet

echo "To withdraw, you need to know the secret that produces your hashlock."
echo "Your hashlock was: abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab"
echo ""
echo "Run this command with your actual secret:"
echo 'near call htlc-nearswap.testnet withdraw '"'"'{"htlc_id": "javweb3.testnet:0", "secret": "YOUR_SECRET_HERE"}'"'"' --accountId javweb3.testnet'