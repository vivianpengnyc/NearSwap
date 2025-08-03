# 🚀 NEAR Contract Deployment Walkthrough

Follow these steps to deploy your HTLC contract to NEAR testnet.

## 🛠️ Prerequisites Setup

### 1. Install NEAR CLI
```bash
npm install -g near-cli
```

### 2. Install Rust (for building contract)
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Add WebAssembly target
rustup target add wasm32-unknown-unknown
```

### 3. Create NEAR Testnet Accounts
1. Go to [wallet.testnet.near.org](https://wallet.testnet.near.org)
2. Create your main account (e.g., `yourname.testnet`)
3. Create a contract account (e.g., `htlc-yourname.testnet`)
4. Get testnet NEAR from the faucet

### 4. Login to NEAR CLI
```bash
near login
# This opens a browser - authorize the CLI
```

## 🚀 Deployment Options

### Option 1: Automated Script (Recommended)

```bash
cd /Users/vivianpeng/NearSwap/near/

# Make script executable
chmod +x deploy-simple.sh

# Deploy with your accounts
./deploy-simple.sh --contract htlc-yourname.testnet --deployer yourname.testnet
```

### Option 2: Manual Step-by-Step

1. **Build the contract**:
```bash
cd /Users/vivianpeng/NearSwap/near/contracts/
cargo build --target wasm32-unknown-unknown --release
```

2. **Create contract account** (if needed):
```bash
near create-account htlc-yourname.testnet --masterAccount yourname.testnet --initialBalance 10
```

3. **Deploy contract**:
```bash
near deploy --accountId htlc-yourname.testnet --wasmFile target/wasm32-unknown-unknown/release/htlc.wasm
```

4. **Initialize contract**:
```bash
near call htlc-yourname.testnet new --accountId yourname.testnet
```

### Option 3: Using TypeScript Script

```bash
cd /Users/vivianpeng/NearSwap/near/
npm install
npm run deploy-contract -- --contract htlc-yourname.testnet --deployer yourname.testnet
```

## ✅ Verify Deployment

### 1. Check Contract State
```bash
near state htlc-yourname.testnet
```

### 2. Test Contract Methods
```bash
# Test view method
near view htlc-yourname.testnet get_htlc '{"htlc_id": "test:0"}'

# Create a test HTLC
near call htlc-yourname.testnet create_htlc \
  '{"receiver": "alice.testnet", "hashlock": "abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab", "timelock": 1756000000}' \
  --accountId yourname.testnet \
  --deposit 1
```

## 🔧 Configuration Update

After successful deployment, update your configuration:

### 1. Update NEAR Config
Edit `/Users/vivianpeng/NearSwap/near/config/testnet.json`:
```json
{
  "networkId": "testnet",
  "nodeUrl": "https://rpc.testnet.near.org",
  "contractId": "htlc-yourname.testnet",
  ...
}
```

### 2. Update Environment Variables
Edit `/Users/vivianpeng/NearSwap/near/.env`:
```env
NEAR_NETWORK=testnet
NEAR_PRIVATE_KEY=ed25519:your_private_key_here
NEAR_CONTRACT_ID=htlc-yourname.testnet
```

## 🧪 Test Integration

### 1. Test NEAR Side Only
```bash
cd /Users/vivianpeng/NearSwap/near/

# Create HTLC
npm run create-htlc -- \
  --sender yourname.testnet \
  --receiver alice.testnet \
  --amount 1 \
  --timelock 24

# Claim HTLC (with secret)
npm run claim-htlc -- \
  --htlc-id [id_from_above] \
  --secret [secret_from_above] \
  --claimer alice.testnet
```

### 2. Test Full EVM-NEAR Integration
```bash
# 1. Create EVM escrow (already working)
cd /Users/vivianpeng/NearSwap/evm/
npx hardhat run scripts/create-near-order.ts --network sepolia -- \
  --provide-asset ETH \
  --provide-amount 0.001 \
  --want-amount 100000000000000000000000 \
  --near-account alice.testnet

# 2. Create matching NEAR HTLC
cd ../near/
npm run create-htlc -- \
  --sender bob.testnet \
  --receiver alice.testnet \
  --amount 0.1 \
  --hashlock [hashlock_from_step_1] \
  --timelock 24

# 3. Complete the atomic swap!
```

## 🔍 Monitoring

### View on NEAR Explorer
- **Testnet**: https://explorer.testnet.near.org/accounts/htlc-yourname.testnet
- **Mainnet**: https://explorer.near.org/accounts/htlc-yourname.near

### Check Transactions
```bash
# View recent transactions
near tx-status [transaction_hash] --accountId htlc-yourname.testnet
```

## 🚨 Troubleshooting

### Common Issues

1. **"Account not found"**
   - Create the account first: `near create-account ...`
   - Make sure you have sufficient NEAR for storage

2. **"Build failed"**
   - Install Rust and wasm32 target
   - Check that you're in the `contracts/` directory

3. **"Deploy failed"**
   - Ensure account exists and has NEAR balance
   - Check that WASM file was built successfully

4. **"Method not found"**
   - Contract might not be initialized
   - Try calling the `new` method

### Debug Commands

```bash
# Check account balance and storage
near state htlc-yourname.testnet

# View contract methods
near view-state htlc-yourname.testnet --finality final

# Check logs
near tx-status [transaction_hash] --accountId htlc-yourname.testnet
```

## 🎯 Success Criteria

✅ Contract deployed without errors
✅ Contract responds to view calls  
✅ Can create HTLC successfully
✅ Can withdraw with valid secret
✅ Can refund after timelock expires
✅ Integration with EVM side works

## 📝 Next Steps

After successful deployment:
1. **Start with small amounts** (0.01 NEAR, 0.001 ETH)
2. **Test all scenarios** (success, timeout, invalid secret)
3. **Monitor gas costs** and optimize if needed
4. **Document your contract address** for others
5. **Consider mainnet deployment** when confident

Your NEAR HTLC contract is now ready for atomic swaps with the EVM side! 🚀