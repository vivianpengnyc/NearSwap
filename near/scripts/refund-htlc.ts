#!/usr/bin/env node

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { NearAPI, NearConfig } from '../lib/near-api';
import { HTLCBuilder } from '../lib/htlc-builder';

dotenv.config();

interface RefundConfig {
  htlcId: string;
  refunder: string;
}

async function main() {
  console.log('🔄 Refunding NEAR HTLC');
  console.log('======================');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const config = parseArguments(args);

  // Load NEAR configuration
  const nearConfig = loadNearConfig();
  
  console.log(`📡 Network: ${nearConfig.networkId}`);
  console.log(`👤 Refunder: ${config.refunder}`);
  console.log(`📝 HTLC ID: ${config.htlcId}`);

  // Initialize NEAR API
  const nearAPI = new NearAPI({
    ...nearConfig,
    accountId: config.refunder,
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
      throw new Error('HTLC already withdrawn - cannot refund');
    }

    if (htlcDetails.refunded) {
      throw new Error('HTLC already refunded');
    }

    // Check if refunder is the sender
    if (config.refunder !== htlcDetails.sender) {
      throw new Error('Only the sender can refund this HTLC');
    }

    // Check timelock
    const remainingTime = HTLCBuilder.getRemainingTime(htlcDetails.timelock);
    if (remainingTime > 0) {
      console.log(`⏰ Time remaining: ${Math.floor(remainingTime / 3600)} hours, ${Math.floor((remainingTime % 3600) / 60)} minutes`);
      throw new Error('HTLC has not yet expired - cannot refund');
    }

    console.log('✅ HTLC has expired and can be refunded');

    // Perform refund
    console.log('\n🔄 Refunding HTLC...');
    const result = await htlcBuilder.refund(config.htlcId);
    
    console.log(`✅ Refund transaction submitted!`);
    console.log(`📤 Transaction hash: ${result.transaction.hash}`);

    // Wait for transaction confirmation
    console.log('\n⏳ Waiting for transaction confirmation...');
    const txHash = `${result.transaction.hash}:${config.refunder}`;
    await nearAPI.waitForTransaction(txHash, 'FINAL');
    
    console.log('✅ Transaction confirmed');

    // Verify refund
    const updatedDetails = await htlcBuilder.getHTLCDetails(config.htlcId);
    if (updatedDetails?.refunded) {
      console.log(`\n🎉 HTLC successfully refunded!`);
      console.log(`💰 Amount refunded: ${HTLCBuilder.formatAmount(htlcDetails.amount)} NEAR`);
      console.log(`👤 Refunded to: ${htlcDetails.sender}`);
    } else {
      console.log('⚠️  Warning: HTLC refund may not have completed properly');
    }

  } catch (error) {
    console.error('❌ Error refunding HTLC:', error);
    process.exit(1);
  }
}

function parseArguments(args: string[]): RefundConfig {
  const config: RefundConfig = {
    htlcId: '',
    refunder: '',
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--htlc-id':
        config.htlcId = args[++i];
        break;
      case '--refunder':
        config.refunder = args[++i];
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

  if (!config.refunder) {
    console.error('❌ Refunder account ID is required');
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
Usage: npm run refund-htlc -- [options]

Options:
  --htlc-id <id>         HTLC ID to refund (required)
  --refunder <account>   NEAR account ID of the refunder (required)
  --help                 Show this help message

Examples:
  npm run refund-htlc -- --htlc-id alice.testnet:123 --refunder alice.testnet
`);
}

main().catch(console.error);