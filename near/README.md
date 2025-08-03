# NEAR Atomic Swap Implementation

This directory contains the NEAR blockchain side of the EVM-NEAR atomic swap system.

## Overview

The NEAR implementation provides Hash Time Lock Contracts (HTLCs) that work in conjunction with the EVM smart contracts to enable trustless atomic swaps between NEAR and EVM chains.

## Architecture

### Smart Contract (`contracts/htlc.rs`)
- Implements HTLC functionality on NEAR
- Supports locking NEAR tokens with hashlock and timelock
- Allows withdrawal with secret or refund after expiration

### API Client (`lib/near-api.ts`)
- Provides JavaScript interface to interact with NEAR blockchain
- Handles transaction signing and submission
- Manages account connections and contract calls

### HTLC Builder (`lib/htlc-builder.ts`)
- High-level interface for HTLC operations
- Secret generation and validation
- Transaction monitoring and status checking

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your NEAR credentials
   ```

3. **Deploy HTLC contract** (optional - use existing deployed contract):
   ```bash
   npm run deploy-contract
   ```

## Usage

### Create HTLC

Lock NEAR tokens with a hashlock:

```bash
npm run create-htlc -- \
  --sender alice.testnet \
  --receiver bob.testnet \
  --amount 5 \
  --timelock 24
```

This will:
- Lock 5 NEAR tokens
- Generate a secret and hashlock
- Set expiration to 24 hours from now
- Return HTLC ID for the receiver

### Claim HTLC

Receiver can claim with the secret:

```bash
npm run claim-htlc -- \
  --htlc-id alice.testnet:123 \
  --secret 0x1234567890abcdef... \
  --claimer bob.testnet
```

### Refund HTLC

Sender can refund after expiration:

```bash
npm run refund-htlc -- \
  --htlc-id alice.testnet:123 \
  --refunder alice.testnet
```

## Integration with EVM Side

### Atomic Swap Flow

1. **EVM→NEAR Swap**:
   - Maker creates EVM escrow with tokens
   - Maker creates NEAR HTLC with same hashlock
   - Taker withdraws from NEAR HTLC (reveals secret)
   - Maker uses secret to claim EVM tokens

2. **NEAR→EVM Swap**:
   - Maker creates NEAR HTLC with tokens
   - Taker creates EVM escrow with same hashlock
   - Maker withdraws from EVM escrow (reveals secret)
   - Taker uses secret to claim NEAR tokens

### Secret/Hashlock Coordination

Both sides must use the same secret/hashlock pair:

```javascript
// Generate secret (32 bytes)
const secret = HTLCBuilder.generateSecret();

// Generate hashlock
const hashlock = HTLCBuilder.generateHashlock(secret);

// Use same hashlock on both EVM and NEAR sides
```

## Configuration

### Networks

- **Testnet**: `testnet` (default)
- **Mainnet**: `mainnet`

Set via `NEAR_NETWORK` environment variable.

### Contract Addresses

- **Testnet**: `htlc.testnet` (example)
- **Mainnet**: `htlc.near` (example)

Update in `config/testnet.json` and `config/mainnet.json`.

## Security Considerations

1. **Secret Management**: Keep secrets secure until ready to claim
2. **Timelock Selection**: Choose appropriate expiration times
3. **Gas Costs**: Ensure sufficient balance for transactions
4. **Network Finality**: Wait for transaction finality before proceeding

## API Reference

### HTLCBuilder Methods

- `createHTLC(params)`: Create new HTLC
- `withdraw(htlcId, secret)`: Withdraw with secret
- `refund(htlcId)`: Refund after expiration
- `getHTLCDetails(htlcId)`: Get HTLC information
- `waitForHTLCEvent(htlcId, event)`: Monitor HTLC status

### Utility Functions

- `generateSecret()`: Generate random secret
- `generateHashlock(secret)`: Create hashlock from secret
- `validateSecret(secret, hashlock)`: Verify secret matches hashlock
- `getRemainingTime(timelock)`: Calculate time until expiration

## Testing

```bash
# Run tests (if implemented)
npm test

# Test on testnet
NEAR_NETWORK=testnet npm run create-htlc -- --sender test.testnet --receiver test2.testnet --amount 1
```

## Troubleshooting

### Common Issues

1. **"Account not found"**: Ensure account exists and has sufficient balance
2. **"Invalid secret"**: Verify secret matches the hashlock exactly
3. **"Transaction failed"**: Check gas costs and account permissions
4. **"HTLC expired"**: Cannot withdraw after timelock, use refund instead

### Debug Mode

Enable detailed logging:

```bash
DEBUG=true npm run create-htlc -- --sender alice.testnet --receiver bob.testnet
```

## Contract Deployment

To deploy your own HTLC contract:

1. Build the contract:
   ```bash
   cargo build --target wasm32-unknown-unknown --release
   ```

2. Deploy to NEAR:
   ```bash
   near deploy --accountId your-contract.testnet --contractName your-contract
   ```

3. Update configuration files with new contract address.

## License

MIT