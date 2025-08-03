#!/usr/bin/env node

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { NearAPI, NearConfig } from '../lib/near-api';
import { HTLCBuilder } from '../lib/htlc-builder';

dotenv.config();

/**
 * Integration example showing how NEAR and EVM sides coordinate
 * This demonstrates the atomic swap flow between EVM and NEAR
 */

interface SwapParticipants {
  maker: {
    nearAccount: string;
    evmAddress: string;
  };
  taker: {
    nearAccount: string;
    evmAddress: string;
  };
}

interface SwapOrder {
  id: string;
  type: 'EVM_TO_NEAR' | 'NEAR_TO_EVM';
  maker: SwapParticipants['maker'];
  taker: SwapParticipants['taker'];
  evmAmount: string;
  nearAmount: string;
  secret: string;
  hashlock: string;
  timelock: number;
  evmEscrowAddress?: string;
  nearHTLCId?: string;
}

async function main() {
  console.log('🔄 EVM-NEAR Atomic Swap Integration Example');
  console.log('============================================');

  // Example swap order (would come from EVM side)
  const swapOrder: SwapOrder = {
    id: 'swap-' + Date.now(),
    type: 'EVM_TO_NEAR',
    maker: {
      nearAccount: 'alice.testnet',
      evmAddress: '0xf59dA181591dbB122A894372C6E44cC079A7Bb3F'
    },
    taker: {
      nearAccount: 'bob.testnet', 
      evmAddress: '0x742d35Cc6639C0532fA3ffc23e4F0bE96f6eB811'
    },
    evmAmount: '0.1', // ETH
    nearAmount: '10', // NEAR
    secret: HTLCBuilder.generateSecret(),
    hashlock: '', // Will be generated
    timelock: Math.floor(Date.now() / 1000) + (24 * 3600), // 24 hours
  };

  swapOrder.hashlock = HTLCBuilder.generateHashlock(swapOrder.secret);

  console.log('\n📋 Swap Order Details:');
  console.log(`   ID: ${swapOrder.id}`);
  console.log(`   Type: ${swapOrder.type}`);
  console.log(`   Maker: ${swapOrder.maker.nearAccount} (EVM: ${swapOrder.maker.evmAddress})`);
  console.log(`   Taker: ${swapOrder.taker.nearAccount} (EVM: ${swapOrder.taker.evmAddress})`);
  console.log(`   EVM Amount: ${swapOrder.evmAmount} ETH`);
  console.log(`   NEAR Amount: ${swapOrder.nearAmount} NEAR`);
  console.log(`   Hashlock: ${swapOrder.hashlock}`);
  console.log(`   Secret: ${swapOrder.secret}`);

  // Simulate the atomic swap flow
  if (swapOrder.type === 'EVM_TO_NEAR') {
    await simulateEVMToNEARSwap(swapOrder);
  } else {
    await simulateNEARToEVMSwap(swapOrder);
  }
}

async function simulateEVMToNEARSwap(order: SwapOrder) {
  console.log('\n🚀 Simulating EVM→NEAR Atomic Swap');
  console.log('==================================');

  // Step 1: Maker creates EVM escrow (simulated)
  console.log('\n1️⃣ Maker creates EVM escrow...');
  console.log(`   📝 Maker (${order.maker.evmAddress}) creates escrow with:`);
  console.log(`      - Amount: ${order.evmAmount} ETH`);
  console.log(`      - Hashlock: ${order.hashlock}`);
  console.log(`      - Timelock: ${new Date(order.timelock * 1000).toISOString()}`);
  console.log(`   ✅ EVM escrow created (simulated)`);
  order.evmEscrowAddress = '0x1234567890123456789012345678901234567890'; // Simulated

  // Step 2: Taker creates NEAR HTLC
  console.log('\n2️⃣ Taker creates NEAR HTLC...');
  
  try {
    const nearConfig = loadNearConfig();
    const nearAPI = new NearAPI({
      ...nearConfig,
      accountId: order.taker.nearAccount,
      privateKey: process.env.NEAR_PRIVATE_KEY_TAKER,
    });

    await nearAPI.connect();
    console.log('   ✅ Connected to NEAR as taker');

    const htlcBuilder = new HTLCBuilder(nearAPI);
    
    // Create HTLC parameters
    const htlcParams = {
      sender: order.taker.nearAccount,
      receiver: order.maker.nearAccount,
      amount: HTLCBuilder.parseAmount(order.nearAmount),
      hashlock: order.hashlock,
      timelock: order.timelock,
    };

    console.log(`   📝 Creating NEAR HTLC:`);
    console.log(`      - Sender: ${htlcParams.sender}`);
    console.log(`      - Receiver: ${htlcParams.receiver}`);
    console.log(`      - Amount: ${order.nearAmount} NEAR`);

    // Note: This would actually create the HTLC, but requires real accounts and tokens
    console.log('   ⏸️  HTLC creation simulated (requires testnet setup)');
    order.nearHTLCId = `${order.taker.nearAccount}:${Date.now()}`;

  } catch (error) {
    console.log('   ⚠️  NEAR connection failed (expected in demo):', error.message);
    console.log('   📝 HTLC creation simulated');
    order.nearHTLCId = `${order.taker.nearAccount}:${Date.now()}`;
  }

  // Step 3: Maker withdraws from NEAR HTLC (reveals secret)
  console.log('\n3️⃣ Maker withdraws from NEAR HTLC...');
  console.log(`   📝 Maker uses secret to withdraw ${order.nearAmount} NEAR`);
  console.log(`   🔓 Secret revealed: ${order.secret}`);
  console.log('   ✅ Maker receives NEAR tokens');

  // Step 4: Taker uses revealed secret to claim EVM tokens
  console.log('\n4️⃣ Taker claims EVM tokens with revealed secret...');
  console.log(`   📝 Taker uses secret: ${order.secret}`);
  console.log(`   💰 Taker claims ${order.evmAmount} ETH from EVM escrow`);
  console.log('   ✅ Atomic swap completed successfully!');

  // Save swap details
  await saveSwapDetails(order, 'COMPLETED');
}

async function simulateNEARToEVMSwap(order: SwapOrder) {
  console.log('\n🚀 Simulating NEAR→EVM Atomic Swap');
  console.log('==================================');

  // Step 1: Maker creates NEAR HTLC
  console.log('\n1️⃣ Maker creates NEAR HTLC...');
  console.log(`   📝 Maker (${order.maker.nearAccount}) creates HTLC with:`);
  console.log(`      - Amount: ${order.nearAmount} NEAR`);
  console.log(`      - Hashlock: ${order.hashlock}`);
  console.log(`      - Timelock: ${new Date(order.timelock * 1000).toISOString()}`);
  console.log('   ✅ NEAR HTLC created (simulated)');
  order.nearHTLCId = `${order.maker.nearAccount}:${Date.now()}`;

  // Step 2: Taker creates EVM escrow (simulated)
  console.log('\n2️⃣ Taker creates EVM escrow...');
  console.log(`   📝 Taker (${order.taker.evmAddress}) creates escrow with:`);
  console.log(`      - Amount: ${order.evmAmount} ETH`);
  console.log(`      - Same hashlock: ${order.hashlock}`);
  console.log('   ✅ EVM escrow created (simulated)');
  order.evmEscrowAddress = '0x1234567890123456789012345678901234567890';

  // Step 3: Maker withdraws from EVM escrow (reveals secret)
  console.log('\n3️⃣ Maker withdraws from EVM escrow...');
  console.log(`   📝 Maker uses secret to withdraw ${order.evmAmount} ETH`);
  console.log(`   🔓 Secret revealed: ${order.secret}`);
  console.log('   ✅ Maker receives EVM tokens');

  // Step 4: Taker uses revealed secret to claim NEAR tokens
  console.log('\n4️⃣ Taker claims NEAR tokens with revealed secret...');
  console.log(`   📝 Taker uses secret: ${order.secret}`);
  console.log(`   💰 Taker claims ${order.nearAmount} NEAR from HTLC`);
  console.log('   ✅ Atomic swap completed successfully!');

  // Save swap details
  await saveSwapDetails(order, 'COMPLETED');
}

async function saveSwapDetails(order: SwapOrder, status: string) {
  const swapData = {
    ...order,
    status,
    completedAt: new Date().toISOString(),
  };

  const ordersDir = path.join(__dirname, '../orders');
  if (!fs.existsSync(ordersDir)) {
    fs.mkdirSync(ordersDir, { recursive: true });
  }

  const orderPath = path.join(ordersDir, `${order.id}.json`);
  fs.writeFileSync(orderPath, JSON.stringify(swapData, null, 2));

  console.log(`\n💾 Swap details saved to: ${orderPath}`);
}

function loadNearConfig(): NearConfig {
  const configFile = process.env.NEAR_NETWORK === 'mainnet' ? 'mainnet.json' : 'testnet.json';
  const configPath = path.join(__dirname, '..', 'config', configFile);

  if (!fs.existsSync(configPath)) {
    throw new Error(`Configuration file not found: ${configPath}`);
  }

  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

main().catch(console.error);