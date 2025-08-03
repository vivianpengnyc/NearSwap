#!/usr/bin/env node

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface ValidationResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  fix?: string;
}

async function main() {
  console.log('🔍 NEAR Deployment Setup Validation');
  console.log('===================================');

  const results: ValidationResult[] = [];

  // Check NEAR CLI
  results.push(await checkNearCLI());
  
  // Check Rust
  results.push(await checkRust());
  
  // Check wasm32 target
  results.push(await checkWasmTarget());
  
  // Check authentication
  results.push(await checkAuthentication());
  
  // Check contract files
  results.push(await checkContractFiles());
  
  // Check config files
  results.push(await checkConfigFiles());

  // Display results
  console.log('\n📋 Validation Results:');
  console.log('======================');

  let passCount = 0;
  let failCount = 0;
  let warningCount = 0;

  results.forEach((result, index) => {
    const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
    const status = result.status.toUpperCase().padEnd(7);
    
    console.log(`${index + 1}. [${status}] ${icon} ${result.name}`);
    console.log(`   ${result.message}`);
    
    if (result.fix && result.status !== 'pass') {
      console.log(`   💡 Fix: ${result.fix}`);
    }
    console.log('');

    if (result.status === 'pass') passCount++;
    else if (result.status === 'fail') failCount++;
    else warningCount++;
  });

  // Summary
  console.log('📊 Summary:');
  console.log(`   ✅ Passed: ${passCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   ⚠️  Warnings: ${warningCount}`);

  if (failCount === 0) {
    console.log('\n🎉 Setup looks good! You\'re ready to deploy.');
    console.log('\nNext steps:');
    console.log('1. Run: ./deploy-simple.sh --contract your-htlc.testnet --deployer your-account.testnet');
    console.log('2. Or: npm run deploy-contract -- --contract your-htlc.testnet --deployer your-account.testnet');
  } else {
    console.log('\n🔧 Please fix the failed items before deploying.');
  }
}

async function checkNearCLI(): Promise<ValidationResult> {
  try {
    const version = execSync('near --version', { encoding: 'utf8', stdio: 'pipe' });
    return {
      name: 'NEAR CLI',
      status: 'pass',
      message: `Installed: ${version.trim()}`
    };
  } catch (error) {
    return {
      name: 'NEAR CLI',
      status: 'fail',
      message: 'NEAR CLI not found',
      fix: 'npm install -g near-cli'
    };
  }
}

async function checkRust(): Promise<ValidationResult> {
  try {
    const version = execSync('rustc --version', { encoding: 'utf8', stdio: 'pipe' });
    return {
      name: 'Rust Compiler',
      status: 'pass',
      message: `Installed: ${version.trim()}`
    };
  } catch (error) {
    return {
      name: 'Rust Compiler',
      status: 'warning',
      message: 'Rust not found (optional if using pre-built contract)',
      fix: 'curl --proto \'=https\' --tlsv1.2 -sSf https://sh.rustup.rs | sh'
    };
  }
}

async function checkWasmTarget(): Promise<ValidationResult> {
  try {
    const targets = execSync('rustup target list --installed', { encoding: 'utf8', stdio: 'pipe' });
    if (targets.includes('wasm32-unknown-unknown')) {
      return {
        name: 'WebAssembly Target',
        status: 'pass',
        message: 'wasm32-unknown-unknown target installed'
      };
    } else {
      return {
        name: 'WebAssembly Target',
        status: 'warning',
        message: 'wasm32-unknown-unknown target not installed',
        fix: 'rustup target add wasm32-unknown-unknown'
      };
    }
  } catch (error) {
    return {
      name: 'WebAssembly Target',
      status: 'warning',
      message: 'Cannot check (Rust not installed)',
      fix: 'Install Rust first, then: rustup target add wasm32-unknown-unknown'
    };
  }
}

async function checkAuthentication(): Promise<ValidationResult> {
  try {
    execSync('near keys', { stdio: 'pipe' });
    return {
      name: 'NEAR Authentication',
      status: 'pass',
      message: 'Logged in to NEAR CLI'
    };
  } catch (error) {
    return {
      name: 'NEAR Authentication',
      status: 'fail',
      message: 'Not logged in to NEAR CLI',
      fix: 'near login'
    };
  }
}

async function checkContractFiles(): Promise<ValidationResult> {
  const contractDir = path.join(__dirname, '..', 'contracts');
  const requiredFiles = [
    'Cargo.toml',
    'src/lib.rs'
  ];

  const missingFiles = requiredFiles.filter(file => 
    !fs.existsSync(path.join(contractDir, file))
  );

  if (missingFiles.length === 0) {
    return {
      name: 'Contract Source Files',
      status: 'pass',
      message: 'All required contract files present'
    };
  } else {
    return {
      name: 'Contract Source Files',
      status: 'fail',
      message: `Missing files: ${missingFiles.join(', ')}`,
      fix: 'Ensure contract files are in the contracts/ directory'
    };
  }
}

async function checkConfigFiles(): Promise<ValidationResult> {
  const configDir = path.join(__dirname, '..', 'config');
  const requiredConfigs = [
    'testnet.json',
    'mainnet.json'
  ];

  const missingConfigs = requiredConfigs.filter(file => 
    !fs.existsSync(path.join(configDir, file))
  );

  if (missingConfigs.length === 0) {
    return {
      name: 'Configuration Files',
      status: 'pass',
      message: 'Network configuration files present'
    };
  } else {
    return {
      name: 'Configuration Files',
      status: 'warning',
      message: `Missing configs: ${missingConfigs.join(', ')}`,
      fix: 'Config files will be created during deployment'
    };
  }
}

main().catch(console.error);