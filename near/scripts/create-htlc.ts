#!/usr/bin/env node

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { NearAPI, NearConfig } from '../lib/near-api';
import { HTLCBuilder, HTLCParams } from '../lib/htlc-builder';

dotenv.config();

interface OrderConfig {
  sender: string;
  receiver: string;
  amount: string; // in NEAR
  secret?: string;
  hashlock?: string;
  timelock: number; // hours from now
}

async function main() {
  console.log('🚀 Creating NEAR HTLC');
  console.log('====================');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const config = parseArguments(args);

  // Load NEAR configuration
  const nearConfig = loadNearConfig();
  
  console.log(`📡 Network: ${nearConfig.networkId}`);
  console.log(`👤 Sender: ${config.sender}`);
  console.log(`👥 Receiver: ${config.receiver}`);
  console.log(`💰 Amount: ${config.amount} NEAR`);
  console.log(`⏰ Timelock: ${config.timelock} hours from now`);

  // Initialize NEAR API
  const nearAPI = new NearAPI({
    ...nearConfig,
    accountId: config.sender,
    privateKey: process.env.NEAR_PRIVATE_KEY,
  });

  await nearAPI.connect();
  console.log('✅ Connected to NEAR');

  // Generate secret and hashlock if not provided
  let secret = config.secret;
  let hashlock = config.hashlock;

  if (!secret && !hashlock) {
    secret = HTLCBuilder.generateSecret();
    hashlock = HTLCBuilder.generateHashlock(secret);
    console.log(`🔑 Generated secret: ${secret}`);
    console.log(`🔒 Generated hashlock: ${hashlock}`);
  } else if (secret && !hashlock) {
    hashlock = HTLCBuilder.generateHashlock(secret);
    console.log(`🔒 Generated hashlock from secret: ${hashlock}`);
  } else if (!secret && hashlock) {
    console.log(`🔒 Using provided hashlock: ${hashlock}`);
  } else {
    // Validate secret matches hashlock
    if (!HTLCBuilder.validateSecret(secret!, hashlock!)) {
      throw new Error('Secret does not match hashlock');
    }
    console.log(`✅ Secret and hashlock validated`);
  }

  // Calculate timelock timestamp
  const timelockTimestamp = Math.floor(Date.now() / 1000) + (config.timelock * 3600);

  // Create HTLC parameters
  const htlcParams: HTLCParams = {
    sender: config.sender,
    receiver: config.receiver,
    amount: HTLCBuilder.parseAmount(config.amount),
    hashlock: hashlock!,
    timelock: timelockTimestamp,
  };

  // Create HTLC
  console.log('\n🔄 Creating HTLC...');
  const htlcBuilder = new HTLCBuilder(nearAPI);
  
  try {
    const htlcId = await htlcBuilder.createHTLC(htlcParams);
    console.log(`✅ HTLC created successfully!`);
    console.log(`📝 HTLC ID: ${htlcId}`);

    // Save HTLC details
    const htlcData = {
      htlcId,
      ...htlcParams,
      secret: secret || 'SECRET_NOT_GENERATED',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(timelockTimestamp * 1000).toISOString(),
    };

    const ordersDir = path.join(__dirname, '../orders');
    if (!fs.existsSync(ordersDir)) {
      fs.mkdirSync(ordersDir, { recursive: true });
    }

    const orderPath = path.join(ordersDir, `htlc-${htlcId}.json`);
    fs.writeFileSync(orderPath, JSON.stringify(htlcData, null, 2));

    console.log('\n📋 HTLC Details:');
    console.log(`   ID: ${htlcId}`);
    console.log(`   Sender: ${htlcParams.sender}`);
    console.log(`   Receiver: ${htlcParams.receiver}`);
    console.log(`   Amount: ${HTLCBuilder.formatAmount(htlcParams.amount)} NEAR`);
    console.log(`   Hashlock: ${htlcParams.hashlock}`);
    console.log(`   Expires: ${new Date(timelockTimestamp * 1000).toISOString()}`);
    
    if (secret) {
      console.log(`   Secret: ${secret}`);
    }

    console.log(`\n💾 Order saved to: ${orderPath}`);
    console.log('\n🎉 HTLC creation complete!');

  } catch (error) {
    console.error('❌ Error creating HTLC:', error);
    process.exit(1);
  }
}

function parseArguments(args: string[]): OrderConfig {
  const config: OrderConfig = {
    sender: '',
    receiver: '',
    amount: '1',
    timelock: 24, // 24 hours default
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--sender':
        config.sender = args[++i];
        break;
      case '--receiver':
        config.receiver = args[++i];
        break;
      case '--amount':
        config.amount = args[++i];
        break;
      case '--secret':
        config.secret = args[++i];
        break;
      case '--hashlock':
        config.hashlock = args[++i];
        break;
      case '--timelock':
        config.timelock = parseInt(args[++i]);
        break;
      case '--help':
        printUsage();
        process.exit(0);
    }
  }

  // Validate required parameters
  if (!config.sender) {
    console.error('❌ Sender account ID is required');
    printUsage();
    process.exit(1);
  }

  if (!config.receiver) {
    console.error('❌ Receiver account ID is required');
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
Usage: npm run create-htlc -- [options]

Options:
  --sender <account>     NEAR account ID of the sender (required)
  --receiver <account>   NEAR account ID of the receiver (required)
  --amount <amount>      Amount in NEAR (default: 1)
  --secret <secret>      32-byte hex secret (generates if not provided)
  --hashlock <hash>      SHA256 hash of secret (generates if not provided)
  --timelock <hours>     Hours until expiration (default: 24)
  --help                 Show this help message

Examples:
  npm run create-htlc -- --sender alice.testnet --receiver bob.testnet --amount 5
  npm run create-htlc -- --sender alice.testnet --receiver bob.testnet --amount 10 --timelock 48
  npm run create-htlc -- --sender alice.testnet --receiver bob.testnet --hashlock abc123... --timelock 12
`);
}

main().catch(console.error);