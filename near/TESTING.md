# NEAR HTLC Contract Testing Guide

## Working Commands (Confirmed)

### 1. Create HTLC
```bash
near call htlc-nearswap.testnet create_htlc \
  '{"receiver": "javweb3.testnet", "hashlock": "abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab", "timelock": 1756000000}' \
  --accountId javweb3.testnet \
  --deposit 1
```

### 2. Withdraw (with correct secret)
```bash
# Replace HTLC_ID with actual ID (e.g., "javweb3.testnet:0")
# Replace SECRET with the actual secret that hashes to your hashlock
near call htlc-nearswap.testnet withdraw \
  '{"htlc_id": "HTLC_ID", "secret": "SECRET"}' \
  --accountId javweb3.testnet
```

### 3. Refund (after timelock expires)
```bash
# Replace HTLC_ID with actual ID
near call htlc-nearswap.testnet refund \
  '{"htlc_id": "HTLC_ID"}' \
  --accountId javweb3.testnet
```

## Known Issues

- Deserialization errors occur with some test scripts
- View methods (get_htlc, get_all_htlcs) are currently failing
- The contract may need to be redeployed and properly initialized

## Integration Testing

Once basic functions are working:
```bash
cd /Users/vivianpeng/NearSwap/near
npx ts-node scripts/integration-example.ts
```

This requires both NEAR and EVM contracts to be deployed and configured.