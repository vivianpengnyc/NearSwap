import { connect, keyStores, Contract, utils } from 'near-api-js';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import crypto from 'crypto';

const config = JSON.parse(readFileSync(join(__dirname, '../config/testnet.json'), 'utf8'));

interface HTLCContract extends Contract {
  create_htlc: (args: {
    receiver: string;
    hashlock: string;
    timelock: number;
  }, gas?: string, deposit?: string) => Promise<string>;
  
  withdraw: (args: {
    htlc_id: string;
    secret: string;
  }) => Promise<void>;
  
  refund: (args: {
    htlc_id: string;
  }) => Promise<void>;
  
  get_htlc: (args: {
    htlc_id: string;
  }) => Promise<any>;
}

async function testBasicFunctions() {
  console.log('🚀 Starting NEAR HTLC Contract Tests on Testnet\n');
  
  // Setup
  const keyStore = new keyStores.UnencryptedFileSystemKeyStore(
    join(homedir(), '.near-credentials')
  );
  
  const near = await connect({
    networkId: config.networkId,
    nodeUrl: config.nodeUrl,
    keyStore,
  });
  
  const accountId = 'javweb3.testnet'; // Your test account
  const account = await near.account(accountId);
  
  const contract = new Contract(account, config.contractId, {
    viewMethods: ['get_htlc', 'get_all_htlcs'],
    changeMethods: ['create_htlc', 'withdraw', 'refund'],
    useLocalViewExecution: false,
  }) as HTLCContract;
  
  console.log(`📋 Contract ID: ${config.contractId}`);
  console.log(`👤 Test Account: ${accountId}\n`);
  
  try {
    // Test 1: Create HTLC
    console.log('Test 1: Creating HTLC');
    console.log('━'.repeat(50));
    
    const secret = 'test-secret-123';
    const secretHash = crypto.createHash('sha256').update(secret).digest('hex');
    const receiver = 'receiver-test.testnet';
    const timelock = Math.floor(Date.now() / 1000) + 300; // 5 minutes from now
    const amount = utils.format.parseNearAmount('0.1')!;
    
    console.log(`Secret: ${secret}`);
    console.log(`Hashlock: ${secretHash}`);
    console.log(`Receiver: ${receiver}`);
    console.log(`Amount: 0.1 NEAR`);
    console.log(`Timelock: ${new Date(timelock * 1000).toISOString()}`);
    
    const htlcId = await contract.create_htlc(
      {
        receiver,
        hashlock: secretHash,
        timelock,
      },
      '30000000000000', // 30 TGas
      amount
    );
    
    console.log(`✅ HTLC Created with ID: ${htlcId}\n`);
    
    // Verify creation
    const htlcData = await contract.get_htlc({ htlc_id: htlcId });
    console.log('HTLC Data:', JSON.stringify(htlcData, null, 2));
    console.log();
    
    // Test 2: Withdraw with correct secret
    console.log('Test 2: Testing Withdraw Function');
    console.log('━'.repeat(50));
    
    // Create another HTLC for withdrawal test
    const withdrawSecret = 'withdraw-test-456';
    const withdrawSecretHash = crypto.createHash('sha256').update(withdrawSecret).digest('hex');
    const withdrawReceiver = accountId; // We'll withdraw to ourselves for testing
    
    const withdrawHtlcId = await contract.create_htlc(
      {
        receiver: withdrawReceiver,
        hashlock: withdrawSecretHash,
        timelock: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      },
      '30000000000000',
      utils.format.parseNearAmount('0.05')!
    );
    
    console.log(`Created HTLC for withdrawal test: ${withdrawHtlcId}`);
    console.log(`Attempting withdrawal with secret: ${withdrawSecret}`);
    
    await contract.withdraw({
      htlc_id: withdrawHtlcId,
      secret: withdrawSecret,
    });
    
    console.log('✅ Withdrawal successful!');
    
    // Verify withdrawal
    const withdrawnHtlc = await contract.get_htlc({ htlc_id: withdrawHtlcId });
    console.log('HTLC after withdrawal:', JSON.stringify(withdrawnHtlc, null, 2));
    console.log();
    
    // Test 3: Refund after timelock
    console.log('Test 3: Testing Refund Function');
    console.log('━'.repeat(50));
    
    // Create HTLC with short timelock for refund test
    const refundSecret = 'refund-test-789';
    const refundSecretHash = crypto.createHash('sha256').update(refundSecret).digest('hex');
    const shortTimelock = Math.floor(Date.now() / 1000) + 5; // 5 seconds
    
    const refundHtlcId = await contract.create_htlc(
      {
        receiver: 'some-receiver.testnet',
        hashlock: refundSecretHash,
        timelock: shortTimelock,
      },
      '30000000000000',
      utils.format.parseNearAmount('0.02')!
    );
    
    console.log(`Created HTLC for refund test: ${refundHtlcId}`);
    console.log('Waiting 6 seconds for timelock to expire...');
    
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    console.log('Attempting refund...');
    await contract.refund({
      htlc_id: refundHtlcId,
    });
    
    console.log('✅ Refund successful!');
    
    // Verify refund
    const refundedHtlc = await contract.get_htlc({ htlc_id: refundHtlcId });
    console.log('HTLC after refund:', JSON.stringify(refundedHtlc, null, 2));
    console.log();
    
    // Summary
    console.log('📊 Test Summary');
    console.log('━'.repeat(50));
    console.log('✅ Create HTLC: PASSED');
    console.log('✅ Withdraw with secret: PASSED');
    console.log('✅ Refund after timelock: PASSED');
    console.log('\n🎉 All basic function tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error && 'kind' in error) {
      console.error('Error details:', JSON.stringify(error, null, 2));
    }
    process.exit(1);
  }
}

// Run tests
testBasicFunctions().catch(console.error);