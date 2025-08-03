# EVM-NEAR Atomic Swap Integration Guide

This guide explains how to use the modified EVM contracts with the new NEAR implementation for atomic swaps.

## Architecture Overview

```
EVM Side                           NEAR Side
├── NEAREscrowSrc.sol             ├── htlc.rs (smart contract)
├── NEAREscrowDst.sol             ├── near-api.ts (API client)
├── NEAREscrowFactory.sol         ├── htlc-builder.ts (HTLC operations)
└── Scripts:                      └── Scripts:
    ├── deploy-near.ts                ├── create-htlc.ts
    └── create-near-order.ts          ├── claim-htlc.ts
                                      └── refund-htlc.ts
```

## Completed Modifications

### ✅ EVM Side (Already Deployed)
- **NEAREscrowSrc.sol**: Escrow for EVM→NEAR swaps
- **NEAREscrowDst.sol**: Escrow for NEAR→EVM swaps  
- **NEAREscrowFactory.sol**: Factory for creating NEAR escrows
- **Deployed on Sepolia**: Factory at `0xCE8D78684a4bbfdAB257168536933a6C359EaBC5`

### ✅ NEAR Side (Ready for Deployment)
- **HTLC Smart Contract**: Rust contract for NEAR blockchain
- **API Client**: JavaScript interface to NEAR blockchain
- **HTLC Builder**: High-level operations and utilities
- **Scripts**: Create, claim, and refund HTLCs

## Integration Flow

### EVM→NEAR Atomic Swap

1. **Maker** creates EVM escrow with tokens using deployed contract
2. **Maker** creates NEAR HTLC with same hashlock
3. **Taker** withdraws from NEAR HTLC (reveals secret)
4. **Maker** uses revealed secret to claim EVM tokens

### NEAR→EVM Atomic Swap

1. **Maker** creates NEAR HTLC with tokens
2. **Taker** creates EVM escrow with same hashlock  
3. **Maker** withdraws from EVM escrow (reveals secret)
4. **Taker** uses revealed secret to claim NEAR tokens

## Setup Instructions

### 1. EVM Side Setup (Already Complete)
```bash
cd evm/
npm install
npm run compile
# Already deployed to Sepolia
```

### 2. NEAR Side Setup

```bash
cd near/
npm install

# Configure environment
cp .env.example .env
# Edit .env with your NEAR credentials

# Deploy HTLC contract (optional - can use existing)
# Deploy contract to NEAR testnet using near-cli
```

### 3. Environment Configuration

**EVM (.env)**:
```env
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
PRIVATE_KEY=your_private_key_here
```

**NEAR (.env)**:
```env
NEAR_NETWORK=testnet
NEAR_PRIVATE_KEY=ed25519:your_near_private_key
```

## Usage Examples

### Create EVM→NEAR Swap

1. **Create EVM escrow**:
```bash
cd evm/
npx hardhat run scripts/create-near-order.ts --network sepolia \
  --provide-asset ETH \
  --provide-amount 0.1 \
  --want-amount 1000000000000000000000000 \
  --near-account alice.near
```

2. **Create matching NEAR HTLC**:
```bash
cd near/
npm run create-htlc -- \
  --sender bob.testnet \
  --receiver alice.testnet \
  --amount 1 \
  --hashlock 0x[hashlock_from_step_1]
```

3. **Claim tokens** (using revealed secret from NEAR withdrawal).

### Create NEAR→EVM Swap

1. **Create NEAR HTLC first**:
```bash
cd near/
npm run create-htlc -- \
  --sender alice.testnet \
  --receiver bob.testnet \
  --amount 1 \
  --timelock 24
```

2. **Create matching EVM escrow** using same hashlock.

3. **Complete the swap** by claiming with secrets.

## Key Changes from Bitcoin Implementation

| Bitcoin Implementation | NEAR Implementation |
|----------------------|---------------------|
| Bitcoin addresses | NEAR account IDs |
| UTXO model | Account-based model |
| Bitcoin Script | NEAR smart contract |
| Satoshis | yoctoNEAR (10^24) |
| Bitcoin RPC | NEAR RPC |
| secp256k1 signatures | ed25519 signatures |

## Security Considerations

1. **Secret Management**: Keep secrets secure until claiming
2. **Timelock Selection**: Use appropriate expiration times (24-48 hours)
3. **Gas/Storage**: Ensure sufficient balance for NEAR transactions
4. **Network Finality**: Wait for transaction confirmation before proceeding
5. **Testing**: Always test on testnets first

## Contract Addresses

### Sepolia Testnet (EVM)
- **NEAREscrowFactory**: `0xCE8D78684a4bbfdAB257168536933a6C359EaBC5`
- **AccessToken**: `0x7B8BFc656Da1690536D094b64631773F806560cD`

### NEAR Testnet
- **HTLC Contract**: Deploy using provided Rust contract
- **Network**: `testnet`
- **RPC**: `https://rpc.testnet.near.org`

## Testing the Integration

1. **Deploy NEAR contract** to testnet
2. **Update configuration** files with deployed addresses  
3. **Run integration test**:
```bash
cd near/
npm run integration-example
```

4. **Test full swap** with small amounts first

## Troubleshooting

### Common Issues
- **"Account not found"**: Ensure NEAR account exists
- **"Insufficient balance"**: Add NEAR tokens for gas
- **"Invalid secret"**: Check secret/hashlock match exactly
- **"Transaction failed"**: Verify gas and permissions

### Debug Mode
Enable detailed logging with `DEBUG=true` environment variable.

## Next Steps

1. **Deploy NEAR contract** to testnet/mainnet
2. **Test atomic swaps** with small amounts
3. **Monitor transactions** and validate atomicity
4. **Scale to production** volumes

The integration is complete and ready for testing. Both EVM and NEAR sides implement the same atomic swap protocol with proper secret/hashlock coordination.