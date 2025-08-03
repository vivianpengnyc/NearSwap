#!/usr/bin/env node

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

interface NEARAtomicSwapOrder {
  orderId: string;
  timestamp: number;
  network: string;
  chainId: number;
  
  maker: {
    address: string;
    provides: {
      asset: "ETH" | "ERC20";
      amount: string;
      token?: string;
    };
    wants: {
      asset: "NEAR";
      amount: string; // in yoctoNEAR
      account: string; // NEAR account ID
    };
  };
  
  secret: string;
  hashlock: string;
  
  timelock: {
    withdrawalPeriod: number;
    cancellationPeriod: number;
  };
  
  status: "CREATED" | "FILLED" | "COMPLETED" | "CANCELLED";
  
  contracts: {
    nearEscrowFactory: string;
    srcEscrow?: string;
    accessToken: string;
  };
}

async function main() {
  console.log("🚀 CREATING NEAR ATOMIC SWAP ORDER");
  console.log("==================================");
  
  // Get network info
  const network = await ethers.provider.getNetwork();
  const [maker] = await ethers.getSigners();
  
  console.log(`📡 Network: ${network.name} (${network.chainId})`);
  console.log(`👤 Maker: ${maker.address}`);
  console.log(`💰 Balance: ${ethers.formatEther(await ethers.provider.getBalance(maker.address))} ETH`);
  
  // Load deployment info
  const deploymentPath = path.join(__dirname, `../deployments/near-${network.name}-${network.chainId}.json`);
  if (!fs.existsSync(deploymentPath)) {
    console.error("❌ Deployment info not found. Please run deploy-near.ts first!");
    process.exit(1);
  }
  
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  console.log(`📄 Loaded deployment from: ${deploymentPath}`);
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const config = parseArguments(args);
  
  // Generate secret and hashlock
  const secret = crypto.randomBytes(32);
  const hashlock = crypto.createHash("sha256").update(secret).digest();
  
  console.log("\n📋 Order Details:");
  console.log(`   Maker provides: ${config.provideAmount} ${config.provideAsset}`);
  console.log(`   Maker wants: ${formatNEAR(config.wantAmount)} NEAR`);
  console.log(`   NEAR account: ${config.nearAccount}`);
  console.log(`   Secret: 0x${secret.toString("hex")}`);
  console.log(`   Hashlock: 0x${hashlock.toString("hex")}`);
  
  // Connect to NEAREscrowFactory
  const NEAREscrowFactory = await ethers.getContractFactory("NEAREscrowFactory");
  const factory = NEAREscrowFactory.attach(deployment.contracts.nearEscrowFactory);
  
  // Prepare immutables for the escrow
  const now = Math.floor(Date.now() / 1000);
  const immutables = {
    maker: packAddress(maker.address),
    taker: packAddress(ethers.ZeroAddress), // Will be set when taker fills order
    token: packAddress(config.token || ethers.ZeroAddress),
    amount: config.provideAsset === "ETH" ? ethers.parseEther(config.provideAmount) : ethers.parseUnits(config.provideAmount, 18),
    safetyDeposit: ethers.parseEther("0.01"), // 0.01 ETH safety deposit
    hashlock: hashlock,
    timelocks: packTimelocks({
      deployedAt: now,
      withdrawal: config.withdrawalDelay || 3600, // 1 hour default
      publicWithdrawal: config.publicWithdrawalDelay || 7200, // 2 hours default
      cancellation: config.cancellationDelay || 86400 // 24 hours default
    })
  };
  
  // Calculate required ETH
  const creationFee = await factory.creationFee();
  const requiredETH = config.provideAsset === "ETH" 
    ? immutables.amount + immutables.safetyDeposit + creationFee
    : immutables.safetyDeposit + creationFee;
    
  console.log(`\n💸 Transaction Details:`);
  console.log(`   Creation fee: ${ethers.formatEther(creationFee)} ETH`);
  console.log(`   Safety deposit: ${ethers.formatEther(immutables.safetyDeposit)} ETH`);
  console.log(`   Total ETH required: ${ethers.formatEther(requiredETH)} ETH`);
  
  // Get escrow address (deterministic)
  const escrowAddress = await factory.addressOfEscrowSrc(immutables);
  console.log(`\n📍 Escrow will be deployed at: ${escrowAddress}`);
  
  // Create the escrow
  console.log("\n🔄 Creating source escrow...");
  const tx = await factory.createSrcEscrow(immutables, { value: requiredETH });
  console.log(`📤 Transaction: ${tx.hash}`);
  
  const receipt = await tx.wait();
  console.log(`✅ Escrow created in block ${receipt?.blockNumber}`);
  console.log(`⛽ Gas used: ${receipt?.gasUsed?.toString()}`);
  
  // Record NEAR account in the escrow
  console.log("\n📝 Recording NEAR account...");
  const NEAREscrowSrc = await ethers.getContractFactory("NEAREscrowSrc");
  const escrow = NEAREscrowSrc.attach(escrowAddress);
  
  const recordTx = await escrow.recordNEARAccount(hashlock, config.nearAccount, immutables);
  await recordTx.wait();
  console.log(`✅ NEAR account recorded: ${config.nearAccount}`);
  
  // Prepare order data
  const order: NEARAtomicSwapOrder = {
    orderId: `near-${network.chainId}-${Date.now()}`,
    timestamp: Date.now(),
    network: network.name,
    chainId: Number(network.chainId),
    maker: {
      address: maker.address,
      provides: {
        asset: config.provideAsset as "ETH" | "ERC20",
        amount: config.provideAmount,
        token: config.token
      },
      wants: {
        asset: "NEAR",
        amount: config.wantAmount,
        account: config.nearAccount
      }
    },
    secret: `0x${secret.toString("hex")}`,
    hashlock: `0x${hashlock.toString("hex")}`,
    timelock: {
      withdrawalPeriod: config.withdrawalDelay || 3600,
      cancellationPeriod: config.cancellationDelay || 86400
    },
    status: "CREATED",
    contracts: {
      nearEscrowFactory: deployment.contracts.nearEscrowFactory,
      srcEscrow: escrowAddress,
      accessToken: deployment.contracts.accessToken
    }
  };
  
  // Save order
  const ordersDir = path.join(__dirname, "../orders");
  if (!fs.existsSync(ordersDir)) {
    fs.mkdirSync(ordersDir, { recursive: true });
  }
  
  const orderPath = path.join(ordersDir, `${order.orderId}.json`);
  fs.writeFileSync(orderPath, JSON.stringify(order, null, 2));
  
  console.log("\n🎉 Order created successfully!");
  console.log("================================");
  console.log(`📁 Order saved to: ${orderPath}`);
  console.log(`🔑 Order ID: ${order.orderId}`);
  console.log(`📍 Escrow address: ${escrowAddress}`);
  console.log(`🔐 Secret: ${order.secret}`);
  console.log(`🔒 Hashlock: ${order.hashlock}`);
  console.log("\n⏰ Timelock periods:");
  console.log(`   Withdrawal: ${config.withdrawalDelay || 3600} seconds`);
  console.log(`   Public withdrawal: ${config.publicWithdrawalDelay || 7200} seconds`);
  console.log(`   Cancellation: ${config.cancellationDelay || 86400} seconds`);
  console.log("\n📢 Share this order ID with the taker to fill the order!");
}

function parseArguments(args: string[]): any {
  const config: any = {
    provideAsset: "ETH",
    provideAmount: "0.1",
    wantAmount: "1000000000000000000000000", // 1 NEAR in yoctoNEAR
    nearAccount: "example.near"
  };
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--provide-asset":
        config.provideAsset = args[++i];
        break;
      case "--provide-amount":
        config.provideAmount = args[++i];
        break;
      case "--want-amount":
        config.wantAmount = args[++i];
        break;
      case "--near-account":
        config.nearAccount = args[++i];
        break;
      case "--token":
        config.token = args[++i];
        break;
      case "--withdrawal-delay":
        config.withdrawalDelay = parseInt(args[++i]);
        break;
      case "--cancellation-delay":
        config.cancellationDelay = parseInt(args[++i]);
        break;
      case "--public-withdrawal-delay":
        config.publicWithdrawalDelay = parseInt(args[++i]);
        break;
    }
  }
  
  return config;
}

function packAddress(address: string): bigint {
  return BigInt(address);
}

function packTimelocks(timelocks: any): bigint {
  // Pack timelocks into a single uint256
  // Format: [deployedAt(32)] [withdrawal(32)] [publicWithdrawal(32)] [cancellation(32)] [unused(128)]
  return (
    (BigInt(timelocks.deployedAt) << 224n) |
    (BigInt(timelocks.withdrawal) << 192n) |
    (BigInt(timelocks.publicWithdrawal) << 160n) |
    (BigInt(timelocks.cancellation) << 128n)
  );
}

function formatNEAR(yoctoNEAR: string): string {
  // Convert yoctoNEAR to NEAR (1 NEAR = 10^24 yoctoNEAR)
  return ethers.formatUnits(yoctoNEAR, 24);
}

// Error handling
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });