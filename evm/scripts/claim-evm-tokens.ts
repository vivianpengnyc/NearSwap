#!/usr/bin/env node

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

interface ClaimConfig {
  escrowAddress: string;
  secret: string;
  claimerAddress: string;
}

async function main() {
  console.log("💰 Claiming EVM Tokens from NEAR Escrow");
  console.log("=======================================");

  // Parse command line arguments
  const args = process.argv.slice(2);
  const config = parseArguments(args);

  // Get network info
  const network = await ethers.provider.getNetwork();
  const [signer] = await ethers.getSigners();
  
  console.log(`📡 Network: ${network.name} (${network.chainId})`);
  console.log(`👤 Signer: ${signer.address}`);
  console.log(`📍 Escrow: ${config.escrowAddress}`);
  console.log(`👥 Claimer: ${config.claimerAddress}`);

  try {
    // Connect to escrow contract
    const NEAREscrowSrc = await ethers.getContractFactory("NEAREscrowSrc");
    const escrow = NEAREscrowSrc.attach(config.escrowAddress);

    // You would need to get the immutables from the original order
    // For now, this is a placeholder showing the structure
    console.log("\n🔍 Getting escrow details...");
    
    // Note: In a real implementation, you'd need to:
    // 1. Load the original order details to get immutables
    // 2. Call escrow.withdraw(secret, immutables)
    
    console.log("⚠️  This is a placeholder script.");
    console.log("📝 To complete implementation:");
    console.log("   1. Load original order immutables");
    console.log("   2. Call escrow.withdraw(secret, immutables)");
    console.log("   3. Handle transaction confirmation");
    
    console.log(`\n🔑 Secret provided: ${config.secret}`);
    console.log("✅ Script structure ready for full implementation");

  } catch (error) {
    console.error("❌ Error claiming tokens:", error);
    process.exit(1);
  }
}

function parseArguments(args: string[]): ClaimConfig {
  const config: ClaimConfig = {
    escrowAddress: '',
    secret: '',
    claimerAddress: '',
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--escrow-address':
        config.escrowAddress = args[++i];
        break;
      case '--secret':
        config.secret = args[++i];
        break;
      case '--claimer-address':
        config.claimerAddress = args[++i];
        break;
      case '--help':
        printUsage();
        process.exit(0);
    }
  }

  // Validate required parameters
  if (!config.escrowAddress) {
    console.error('❌ Escrow address is required');
    printUsage();
    process.exit(1);
  }

  if (!config.secret) {
    console.error('❌ Secret is required');
    printUsage();
    process.exit(1);
  }

  if (!config.claimerAddress) {
    console.error('❌ Claimer address is required');
    printUsage();
    process.exit(1);
  }

  return config;
}

function printUsage() {
  console.log(`
Usage: npx hardhat run scripts/claim-evm-tokens.ts --network sepolia -- [options]

Options:
  --escrow-address <addr>    EVM escrow contract address (required)
  --secret <secret>          32-byte hex secret (required)
  --claimer-address <addr>   Address of the claimer (required)
  --help                     Show this help message

Examples:
  npx hardhat run scripts/claim-evm-tokens.ts --network sepolia -- \\
    --escrow-address 0x1234... \\
    --secret 0xabcd1234... \\
    --claimer-address 0x5678...
`);
}

main().catch(console.error);