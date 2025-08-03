#!/usr/bin/env node

import { ethers } from "hardhat";

async function main() {
  console.log("💰 Checking EVM Account Balances");
  console.log("================================");

  // Get network info
  const network = await ethers.provider.getNetwork();
  const [signer] = await ethers.getSigners();
  
  console.log(`📡 Network: ${network.name} (${network.chainId})`);
  
  // Check ETH balance
  const ethBalance = await ethers.provider.getBalance(signer.address);
  console.log(`\n👤 Account: ${signer.address}`);
  console.log(`💎 ETH Balance: ${ethers.formatEther(ethBalance)} ETH`);

  // Load deployment info to check access token balance
  try {
    const deploymentPath = `./deployments/near-${network.name}-${network.chainId}.json`;
    const deployment = JSON.parse(require('fs').readFileSync(deploymentPath, 'utf8'));
    
    // Check Access Token balance
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const accessToken = MockERC20.attach(deployment.contracts.accessToken);
    
    const tokenBalance = await accessToken.balanceOf(signer.address);
    const tokenName = await accessToken.name();
    const tokenSymbol = await accessToken.symbol();
    
    console.log(`🎫 ${tokenName} (${tokenSymbol}) Balance: ${ethers.formatEther(tokenBalance)} tokens`);
    
    console.log(`\n📋 Contract Addresses:`);
    console.log(`   Access Token: ${deployment.contracts.accessToken}`);
    console.log(`   NEAR Factory: ${deployment.contracts.nearEscrowFactory}`);
    
  } catch (error) {
    console.log("⚠️  Could not load deployment info or check token balance");
  }

  // Parse command line for specific address
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--address' && args[i + 1]) {
      const address = args[i + 1];
      const balance = await ethers.provider.getBalance(address);
      console.log(`\n👥 Address: ${address}`);
      console.log(`💎 ETH Balance: ${ethers.formatEther(balance)} ETH`);
      break;
    }
  }
}

main().catch(console.error);