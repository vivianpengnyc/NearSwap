#!/usr/bin/env node

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { NearAPI, NearConfig } from '../lib/near-api';
import { HTLCBuilder } from '../lib/htlc-builder';

dotenv.config();

interface ClaimConfig {
  htlcId: string;
  secret: string;
  claimer: string;
}

async function main() {
  console.log('💰 Claiming NEAR HTLC');
  console.log('====================');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const config = parseArguments(args);

  // Load NEAR configuration
  const nearConfig = loadNearConfig();
  
  console.log(`📡 Network: ${nearConfig.networkId}`);
  console.log(`👤 Claimer: ${config.claimer}`);
  console.log(`📝 HTLC ID: ${config.htlcId}`);

  // Initialize NEAR API
  const nearAPI = new NearAPI({
    ...nearConfig,
    accountId: config.claimer,
    privateKey: process.env.NEAR_PRIVATE_KEY,
  });

  await nearAPI.connect();
  console.log('✅ Connected to NEAR');

  // Initialize HTLC builder
  const htlcBuilder = new HTLCBuilder(nearAPI);

  try {
    // Get HTLC details first
    console.log('\n🔍 Checking HTLC details...');
    const htlcDetails = await htlcBuilder.getHTLCDetails(config.htlcId);
    
    if (!htlcDetails) {
      throw new Error('HTLC not found');
    }

    console.log('📋 HTLC Details:');
    console.log(`   Sender: ${htlcDetails.sender}`);
    console.log(`   Receiver: ${htlcDetails.receiver}`);
    console.log(`   Amount: ${HTLCBuilder.formatAmount(htlcDetails.amount)} NEAR`);
    console.log(`   Hashlock: ${htlcDetails.hashlock}`);
    console.log(`   Timelock: ${new Date(htlcDetails.timelock * 1000).toISOString()}`);
    console.log(`   Withdrawn: ${htlcDetails.withdrawn}`);
    console.log(`   Refunded: ${htlcDetails.refunded}`);

    // Validate HTLC state
    if (htlcDetails.withdrawn) {
      throw new Error('HTLC already withdrawn');
    }

    if (htlcDetails.refunded) {
      throw new Error('HTLC already refunded');
    }

    // Check if claimer is the receiver
    if (config.claimer !== htlcDetails.receiver) {
      throw new Error('Only the receiver can withdraw from this HTLC');
    }

    // Validate secret
    console.log('\n🔐 Validating secret...');
    if (!HTLCBuilder.validateSecret(config.secret, htlcDetails.hashlock)) {
      throw new Error('Invalid secret - does not match hashlock');
    }
    console.log('✅ Secret validated');

    // Check timelock
    const remainingTime = HTLCBuilder.getRemainingTime(htlcDetails.timelock);
    if (remainingTime <= 0) {
      throw new Error('HTLC has expired - use refund instead');
    }

    console.log(`⏰ Time remaining: ${Math.floor(remainingTime / 3600)} hours, ${Math.floor((remainingTime % 3600) / 60)} minutes`);

    // Perform withdrawal
    console.log('\n💰 Withdrawing from HTLC...');
    const result = await htlcBuilder.withdraw(config.htlcId, config.secret);
    
    console.log(`✅ Withdrawal successful!`);
    console.log(`📤 Transaction hash: ${result.transaction.hash}`);

    // Wait for transaction confirmation
    console.log('\n⏳ Waiting for transaction confirmation...');
    const txHash = `${result.transaction.hash}:${config.claimer}`;
    await nearAPI.waitForTransaction(txHash, 'FINAL');
    
    console.log('✅ Transaction confirmed');

    // Verify withdrawal
    const updatedDetails = await htlcBuilder.getHTLCDetails(config.htlcId);
    if (updatedDetails?.withdrawn) {
      console.log(`\n🎉 HTLC successfully withdrawn!`);
      console.log(`💰 Amount claimed: ${HTLCBuilder.formatAmount(htlcDetails.amount)} NEAR`);
      
      if (updatedDetails.secret) {
        console.log(`🔑 Secret revealed: ${updatedDetails.secret}`);
      }
    } else {
      console.log('⚠️  Warning: HTLC withdrawal may not have completed properly');
    }

  } catch (error) {
    console.error('❌ Error claiming HTLC:', error);
    process.exit(1);
  }
}

function parseArguments(args: string[]): ClaimConfig {
  const config: ClaimConfig = {
    htlcId: '',
    secret: '',
    claimer: '',
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--htlc-id':
        config.htlcId = args[++i];
        break;
      case '--secret':
        config.secret = args[++i];
        break;
      case '--claimer':
        config.claimer = args[++i];
        break;
      case '--help':
        printUsage();
        process.exit(0);
    }
  }

  // Validate required parameters
  if (!config.htlcId) {
    console.error('❌ HTLC ID is required');
    printUsage();
    process.exit(1);
  }

  if (!config.secret) {
    console.error('❌ Secret is required');
    printUsage();
    process.exit(1);
  }

  if (!config.claimer) {
    console.error('❌ Claimer account ID is required');
    printUsage();
    process.exit(1);
  }

  return config;
}

function loadNearConfig(): NearConfig {
  const configFile = process.env.NEAR_NETWORK === 'mainnet' ? 'mainnet.json' : 'testnet.json';
  const configPath = path.join(__dirname, '..', 'config', configFile);

  if (!fs.existsSync(configPath)) {
    console.error(`❌ Configuration file not found: ${configPath}`);
    process.exit(1);
  }

  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function printUsage() {
  console.log(`
Usage: npm run claim-htlc -- [options]

Options:
  --htlc-id <id>         HTLC ID to claim from (required)
  --secret <secret>      32-byte hex secret (required)
  --claimer <account>    NEAR account ID of the claimer (required)
  --help                 Show this help message

Examples:
  npm run claim-htlc -- --htlc-id alice.testnet:123 --secret 0x1234... --claimer bob.testnet
`);
}

main().catch(console.error);