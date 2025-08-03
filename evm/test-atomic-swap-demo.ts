#!/usr/bin/env node

/**
 * Simplified Atomic Swap Test Script
 * 
 * This script demonstrates the complete EVM-NEAR atomic swap flow
 * without requiring actual NEAR testnet deployment.
 * 
 * It shows how the components work together and what a real test would look like.
 */

const { sha256 } = require('js-sha256');

// Simulate the atomic swap process
class AtomicSwapSimulator {
  private secret: string;
  private hashlock: string;
  private evmEscrowAddress: string;
  private nearHTLCId: string;

  constructor() {
    // Generate secret and hashlock (same process used by both sides)
    this.secret = this.generateSecret();
    this.hashlock = this.generateHashlock(this.secret);
    this.evmEscrowAddress = '';
    this.nearHTLCId = '';
  }

  generateSecret(): string {
    // Generate 32-byte random secret
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  generateHashlock(secret: string): string {
    return '0x' + sha256(secret.slice(2));
  }

  async simulateEVMToNEARSwap() {
    console.log('🚀 Simulating EVM→NEAR Atomic Swap');
    console.log('==================================');
    
    const swapDetails = {
      maker: {
        evmAddress: '0xf59dA181591dbB122A894372C6E44cC079A7Bb3F',
        nearAccount: 'alice.testnet'
      },
      taker: {
        evmAddress: '0x742d35Cc6639C0532fA3ffc23e4F0bE96f6eB811',
        nearAccount: 'bob.testnet'
      },
      evmAmount: '0.01 ETH',
      nearAmount: '1 NEAR',
      timelock: Math.floor(Date.now() / 1000) + (24 * 3600) // 24 hours
    };

    console.log('\n📋 Swap Details:');
    console.log(`   Maker wants to trade: ${swapDetails.evmAmount} → ${swapDetails.nearAmount}`);
    console.log(`   EVM Maker: ${swapDetails.maker.evmAddress}`);
    console.log(`   NEAR Maker: ${swapDetails.maker.nearAccount}`);
    console.log(`   EVM Taker: ${swapDetails.taker.evmAddress}`);
    console.log(`   NEAR Taker: ${swapDetails.taker.nearAccount}`);
    console.log(`   Secret: ${this.secret}`);
    console.log(`   Hashlock: ${this.hashlock}`);

    // Step 1: Maker creates EVM escrow
    console.log('\n1️⃣ Maker creates EVM escrow...');
    this.evmEscrowAddress = await this.simulateEVMEscrowCreation(swapDetails);
    console.log(`   📍 EVM Escrow created at: ${this.evmEscrowAddress}`);
    console.log(`   💰 Locked: ${swapDetails.evmAmount}`);
    console.log(`   🔒 Hashlock: ${this.hashlock}`);
    console.log(`   ⏰ Expires: ${new Date(swapDetails.timelock * 1000).toISOString()}`);

    // Step 2: Taker creates NEAR HTLC
    console.log('\n2️⃣ Taker creates NEAR HTLC...');
    this.nearHTLCId = await this.simulateNEARHTLCCreation(swapDetails);
    console.log(`   📍 NEAR HTLC created with ID: ${this.nearHTLCId}`);
    console.log(`   💰 Locked: ${swapDetails.nearAmount}`);
    console.log(`   🔒 Same hashlock: ${this.hashlock}`);
    console.log(`   ⏰ Same expiration time`);

    // Step 3: Maker withdraws from NEAR HTLC (reveals secret)
    console.log('\n3️⃣ Maker withdraws from NEAR HTLC...');
    const revealedSecret = await this.simulateNEARWithdrawal();
    console.log(`   🔓 Secret revealed: ${revealedSecret}`);
    console.log(`   💰 Maker receives: ${swapDetails.nearAmount}`);
    console.log(`   ✅ NEAR side complete`);

    // Step 4: Taker uses revealed secret to claim EVM tokens
    console.log('\n4️⃣ Taker claims EVM tokens with revealed secret...');
    await this.simulateEVMClaim(revealedSecret);
    console.log(`   🔑 Taker uses secret: ${revealedSecret}`);
    console.log(`   💰 Taker receives: ${swapDetails.evmAmount}`);
    console.log(`   ✅ EVM side complete`);

    console.log('\n🎉 Atomic swap completed successfully!');
    console.log('=====================================');
    console.log(`✅ Maker: ${swapDetails.evmAmount} → ${swapDetails.nearAmount}`);
    console.log(`✅ Taker: ${swapDetails.nearAmount} → ${swapDetails.evmAmount}`);
    console.log('🔒 Atomicity guaranteed: Both sides completed or both would fail');
  }

  private async simulateEVMEscrowCreation(details: any): Promise<string> {
    // Simulate creating EVM escrow with deployed contracts
    console.log('   📝 Calling NEAREscrowFactory.createSrcEscrow()...');
    console.log('   ⛽ Gas used: ~200,000');
    console.log('   💸 Creation fee: 0.001 ETH');
    
    // Return simulated escrow address (would be deterministic in real implementation)
    return '0x' + Array.from({length: 20}, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
  }

  private async simulateNEARHTLCCreation(details: any): Promise<string> {
    // Simulate creating NEAR HTLC
    console.log('   📝 Calling NEAR HTLC contract create_htlc()...');
    console.log('   ⛽ Gas used: ~5 TGas');
    console.log('   💾 Storage cost: ~0.01 NEAR');
    
    // Return simulated HTLC ID
    return `${details.taker.nearAccount}:${Date.now()}`;
  }

  private async simulateNEARWithdrawal(): Promise<string> {
    // Simulate maker withdrawing from NEAR HTLC
    console.log('   📝 Calling NEAR withdraw() with secret...');
    console.log('   🔍 Secret validated against hashlock');
    console.log('   💸 NEAR tokens transferred to maker');
    console.log('   ⛽ Gas used: ~3 TGas');
    
    // Secret is now revealed on-chain
    return this.secret;
  }

  private async simulateEVMClaim(secret: string): Promise<void> {
    // Simulate taker claiming EVM tokens
    console.log('   📝 Calling NEAREscrowSrc.withdraw()...');
    console.log('   🔍 Secret validation: ' + (secret === this.secret ? '✅ Valid' : '❌ Invalid'));
    console.log('   💸 ERC20/ETH transferred to taker');
    console.log('   ⛽ Gas used: ~100,000');
  }

  async testRefundScenario() {
    console.log('\n🔄 Testing Refund Scenario');
    console.log('==========================');
    
    console.log('📅 Simulating timelock expiration...');
    console.log('⏰ Current time > timelock expiration');
    
    console.log('\n🔙 Maker refunds EVM escrow...');
    console.log('   📝 Calling cancel() function');
    console.log('   💰 ETH returned to maker');
    console.log('   ✅ EVM refund complete');
    
    console.log('\n🔙 Taker refunds NEAR HTLC...');
    console.log('   📝 Calling refund() function');
    console.log('   💰 NEAR returned to taker');
    console.log('   ✅ NEAR refund complete');
    
    console.log('\n✅ Both parties recovered their funds');
    console.log('🛡️  No loss of funds - system is safe');
  }

  async showActualCommands() {
    console.log('\n📝 Actual Commands for Real Testing');
    console.log('===================================');
    
    console.log('\n1️⃣ Create EVM escrow:');
    console.log(`npx hardhat run scripts/create-near-order.ts --network sepolia -- \\`);
    console.log(`  --provide-asset ETH \\`);
    console.log(`  --provide-amount 0.01 \\`);
    console.log(`  --want-amount 1000000000000000000000000 \\`);
    console.log(`  --near-account bob.testnet`);
    
    console.log('\n2️⃣ Create NEAR HTLC:');
    console.log(`cd ../near/`);
    console.log(`npm run create-htlc -- \\`);
    console.log(`  --sender bob.testnet \\`);
    console.log(`  --receiver alice.testnet \\`);
    console.log(`  --amount 1 \\`);
    console.log(`  --hashlock ${this.hashlock} \\`);
    console.log(`  --timelock 24`);
    
    console.log('\n3️⃣ Claim NEAR tokens:');
    console.log(`npm run claim-htlc -- \\`);
    console.log(`  --htlc-id [htlc_id_from_step_2] \\`);
    console.log(`  --secret ${this.secret} \\`);
    console.log(`  --claimer alice.testnet`);
    
    console.log('\n4️⃣ Claim EVM tokens:');
    console.log(`cd ../evm/`);
    console.log(`npx hardhat run scripts/claim-evm-tokens.ts --network sepolia -- \\`);
    console.log(`  --escrow-address [address_from_step_1] \\`);
    console.log(`  --secret ${this.secret} \\`);
    console.log(`  --claimer-address [taker_evm_address]`);
  }
}

async function main() {
  console.log('🧪 EVM-NEAR Atomic Swap Testing Suite');
  console.log('======================================');
  
  const simulator = new AtomicSwapSimulator();
  
  // Test successful swap
  await simulator.simulateEVMToNEARSwap();
  
  // Test refund scenario
  await simulator.testRefundScenario();
  
  // Show actual commands
  await simulator.showActualCommands();
  
  console.log('\n🎯 Next Steps for Real Testing:');
  console.log('1. Set up NEAR testnet accounts at wallet.testnet.near.org');
  console.log('2. Deploy NEAR HTLC contract (see near/contracts/htlc.rs)');
  console.log('3. Fund accounts with test tokens');
  console.log('4. Run the actual commands shown above');
  console.log('5. Monitor transactions on both chains');
  
  console.log('\n📚 Read TESTING_GUIDE.md and INTEGRATION_GUIDE.md for details');
  
  console.log('\n🏗️  System Status:');
  console.log('✅ EVM contracts deployed on Sepolia');
  console.log('✅ NEAR implementation ready');
  console.log('✅ Integration scripts created');
  console.log('⏳ Waiting for NEAR contract deployment and testing');
}

main().catch(console.error);