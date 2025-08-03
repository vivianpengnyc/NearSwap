import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

interface DeploymentConfig {
  accessTokenAddress?: string;
  owner?: string;
  rescueDelaySrc: number;
  rescueDelayDst: number;
  creationFee: string; // in ETH
  treasury?: string;
  nearConfig: {
    minAmount: string; // in yoctoNEAR (1 NEAR = 10^24 yoctoNEAR)
    maxAmount: string; // in yoctoNEAR
    confirmationTime: number; // in seconds
  };
}

interface DeploymentResult {
  network: string;
  chainId: number;
  contracts: {
    accessToken: string;
    nearEscrowFactory: string;
    nearEscrowSrcImplementation: string;
    nearEscrowDstImplementation: string;
  };
  config: DeploymentConfig;
  deployedAt: string;
  gasUsed: {
    accessToken: string;
    nearEscrowFactory: string;
    total: string;
  };
}

async function main() {
  console.log("🚀 Deploying NEAR Atomic Swap System");
  console.log("===================================");

  // Get deployer
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log(`📡 Network: ${network.name} (${network.chainId})`);
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(`💰 Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);

  // Load deployment configuration
  const config = loadDeploymentConfig();
  console.log(`⚙️  Configuration loaded`);

  let totalGasUsed = 0n;
  const gasUsed: any = {};

  // Deploy Access Token (if not provided)
  let accessTokenAddress = config.accessTokenAddress;
  if (!accessTokenAddress) {
    console.log("\n📝 Deploying Access Token...");
    // Note: You'll need to create a MockERC20 contract or use an existing one
    const AccessToken = await ethers.getContractFactory("MockERC20");
    const accessToken = await AccessToken.deploy("Access Token", "ACCESS");
    await accessToken.waitForDeployment();
    
    const deployTx = accessToken.deploymentTransaction();
    const receipt = await deployTx?.wait();
    gasUsed.accessToken = receipt?.gasUsed?.toString() || "0";
    totalGasUsed += receipt?.gasUsed || 0n;
    
    accessTokenAddress = await accessToken.getAddress();
    console.log(`✅ Access Token deployed: ${accessTokenAddress}`);
  } else {
    console.log(`🔗 Using existing Access Token: ${accessTokenAddress}`);
    gasUsed.accessToken = "0";
  }

  // Deploy NEAR Escrow Factory
  console.log("\n🏭 Deploying NEAR Escrow Factory...");
  const NEAREscrowFactory = await ethers.getContractFactory("NEAREscrowFactory");
  
  const nearConfigStruct = {
    minAmount: config.nearConfig.minAmount,
    maxAmount: config.nearConfig.maxAmount,
    confirmationTime: config.nearConfig.confirmationTime
  };

  console.log("Constructor args:", {
    accessToken: accessTokenAddress,
    owner: config.owner || deployer.address,
    rescueDelaySrc: config.rescueDelaySrc,
    rescueDelayDst: config.rescueDelayDst,
    creationFee: config.creationFee,
    treasury: config.treasury || deployer.address,
    nearConfig: nearConfigStruct
  });
  
  const nearEscrowFactory = await NEAREscrowFactory.deploy(
    accessTokenAddress,
    config.owner || deployer.address,
    config.rescueDelaySrc,
    config.rescueDelayDst,
    ethers.parseEther(config.creationFee),
    config.treasury || deployer.address,
    nearConfigStruct
  );
  await nearEscrowFactory.waitForDeployment();
  
  const factoryDeployTx = nearEscrowFactory.deploymentTransaction();
  const factoryReceipt = await factoryDeployTx?.wait();
  gasUsed.nearEscrowFactory = factoryReceipt?.gasUsed?.toString() || "0";
  totalGasUsed += factoryReceipt?.gasUsed || 0n;

  const factoryAddress = await nearEscrowFactory.getAddress();
  console.log(`✅ NEAR Escrow Factory deployed: ${factoryAddress}`);

  // Get implementation addresses
  const srcImplementation = await nearEscrowFactory.NEAR_ESCROW_SRC_IMPLEMENTATION();
  const dstImplementation = await nearEscrowFactory.NEAR_ESCROW_DST_IMPLEMENTATION();
  
  console.log(`📋 Source Implementation: ${srcImplementation}`);
  console.log(`📋 Destination Implementation: ${dstImplementation}`);

  // Prepare deployment result
  gasUsed.total = totalGasUsed.toString();
  
  const deploymentResult: DeploymentResult = {
    network: network.name,
    chainId: Number(network.chainId),
    contracts: {
      accessToken: accessTokenAddress,
      nearEscrowFactory: factoryAddress,
      nearEscrowSrcImplementation: srcImplementation,
      nearEscrowDstImplementation: dstImplementation
    },
    config,
    deployedAt: new Date().toISOString(),
    gasUsed
  };

  // Save deployment info
  await saveDeploymentInfo(deploymentResult);

  // Display summary
  console.log("\n🎉 Deployment Complete!");
  console.log("========================");
  console.log(`🏭 NEAR Escrow Factory: ${factoryAddress}`);
  console.log(`🔑 Access Token: ${accessTokenAddress}`);
  console.log(`⛽ Total Gas Used: ${ethers.formatUnits(totalGasUsed, "gwei")} Gwei`);
  console.log(`💸 Creation Fee: ${config.creationFee} ETH`);
  console.log(`🏦 Treasury: ${config.treasury || deployer.address}`);
  
  console.log("\n🔗 NEAR Configuration:");
  console.log(`   Min Amount: ${formatNEAR(config.nearConfig.minAmount)} NEAR`);
  console.log(`   Max Amount: ${formatNEAR(config.nearConfig.maxAmount)} NEAR`);
  console.log(`   Confirmation Time: ${config.nearConfig.confirmationTime} seconds`);

  console.log("\n📁 Files saved:");
  console.log(`   deployments/near-${network.name}-${network.chainId}.json`);
}

function formatNEAR(yoctoNEAR: string): string {
  // Convert yoctoNEAR to NEAR (1 NEAR = 10^24 yoctoNEAR)
  return ethers.formatUnits(yoctoNEAR, 24);
}

function loadDeploymentConfig(): DeploymentConfig {
  const configPath = path.join(__dirname, "../deploy-config-near.json");
  
  let config: DeploymentConfig;
  
  if (fs.existsSync(configPath)) {
    console.log(`📋 Loading config from: ${configPath}`);
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } else {
    console.log(`📋 Using default configuration`);
    config = {
      rescueDelaySrc: 7 * 24 * 3600, // 7 days
      rescueDelayDst: 7 * 24 * 3600, // 7 days  
      creationFee: "0.001", // 0.001 ETH
      nearConfig: {
        minAmount: "1000000000000000000000000", // 1 NEAR in yoctoNEAR
        maxAmount: "1000000000000000000000000000", // 1000 NEAR in yoctoNEAR
        confirmationTime: 120 // 2 minutes
      }
    };
    
    // Save default config for future use
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`💾 Default config saved to: ${configPath}`);
  }
  
  return config;
}

async function saveDeploymentInfo(result: DeploymentResult): Promise<void> {
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // Save detailed deployment info
  const detailedPath = path.join(deploymentsDir, `near-${result.network}-${result.chainId}.json`);
  fs.writeFileSync(detailedPath, JSON.stringify(result, null, 2));

  // Save simple addresses file
  const addressesPath = path.join(deploymentsDir, `addresses-near-${result.network}.json`);
  const addresses = {
    network: result.network,
    chainId: result.chainId,
    ...result.contracts,
    deployedAt: result.deployedAt
  };
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));

  console.log(`💾 Deployment info saved to: ${detailedPath}`);
  console.log(`💾 Addresses saved to: ${addressesPath}`);
}

// Error handling
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });