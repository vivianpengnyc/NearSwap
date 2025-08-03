# NEAR-EVM Atomic Swap Contracts

This directory contains smart contracts for atomic swaps between EVM chains and the NEAR blockchain.

## Overview

The atomic swap system enables trustless exchanges between EVM tokens (ETH/ERC20) and NEAR tokens. It uses a hash time-locked contract (HTLC) mechanism to ensure atomicity of the swap.

## Contract Architecture

### Core Contracts

1. **NEAREscrowSrc.sol** - Source escrow for EVM→NEAR swaps
   - Holds EVM tokens (ETH/ERC20)
   - Released when taker provides secret after sending NEAR

2. **NEAREscrowDst.sol** - Destination escrow for NEAR→EVM swaps
   - Holds EVM tokens for the taker
   - Released when maker provides secret after sending NEAR

3. **NEAREscrowFactory.sol** - Factory for creating escrow contracts
   - Deploys escrows using CREATE2 for deterministic addresses
   - Manages creation fees and configuration

### Supporting Contracts

- **BaseEscrow.sol** - Base abstract contract with common escrow logic
- **Escrow.sol** - Abstract escrow with withdrawal/cancellation logic
- **MockERC20.sol** - Test ERC20 token for development

## Deployment

### Prerequisites

```bash
npm install
```

### Deploy to Sepolia

```bash
npm run deploy:near
```

### Deploy to Local Network

```bash
npm run deploy:near:local
```

### Configuration

Edit `deploy-config-near.json` to customize:
- Creation fees
- Rescue delays
- NEAR amount limits
- Confirmation times

## Usage

### Creating a Swap Order (Maker)

```bash
npx hardhat run scripts/create-near-order.ts --network sepolia \
  --provide-asset ETH \
  --provide-amount 0.1 \
  --want-amount 1000000000000000000000000 \
  --near-account alice.near
```

Options:
- `--provide-asset`: ETH or ERC20
- `--provide-amount`: Amount to provide
- `--want-amount`: Amount of NEAR wanted (in yoctoNEAR)
- `--near-account`: NEAR account to receive funds
- `--token`: ERC20 token address (if providing ERC20)

### Swap Flow

1. **Maker** creates escrow with EVM tokens
2. **Maker** shares order ID with taker
3. **Taker** sends NEAR to maker's NEAR account
4. **Taker** reveals secret to claim EVM tokens
5. **Maker** uses secret to claim NEAR (off-chain)

## Key Differences from Bitcoin Implementation

1. **Account Model**: NEAR uses account IDs instead of addresses
2. **Units**: NEAR amounts are in yoctoNEAR (1 NEAR = 10^24 yoctoNEAR)
3. **Transaction Model**: Different confirmation mechanism
4. **No UTXO**: NEAR uses account-based model

## Security Considerations

1. Always verify NEAR account IDs before sending funds
2. Use appropriate timelock periods for your use case
3. Ensure sufficient gas for contract interactions
4. Test thoroughly on testnet before mainnet

## Testing

```bash
npx hardhat test
```

## Gas Optimization

The contracts use several optimization techniques:
- Minimal proxy pattern for escrow deployment
- Packed storage for addresses and timelocks
- Efficient CREATE2 for deterministic addresses

## License

MIT