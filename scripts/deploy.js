/**
 * Deployment Script for FlashloanExecutor
 * Deploys to local fork for testing, mainnet deployment requires additional verification
 */
require('dotenv').config();
const hre = require('hardhat');
const { ethers } = hre;

// Deployment configuration
const CONFIG = {
  // Minimum profit in basis points (10 = 0.1%)
  minProfitBps: 10,
  
  // Vault address - MUST BE SET BEFORE MAINNET DEPLOYMENT
  // This is where all profits are sent
  vaultAddress: process.env.PROFIT_VAULT_ADDRESS || null,
};

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║          🚀 FlashloanExecutor Deployment 🚀                   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Get network info
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  console.log(`Network: ${network.name} (Chain ID: ${chainId})`);

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH\n`);

  // Validate configuration
  if (!CONFIG.vaultAddress) {
    if (chainId === 8453) {
      // On mainnet, require explicit vault address
      console.error('❌ ERROR: PROFIT_VAULT_ADDRESS must be set for mainnet deployment');
      console.error('   Set it in your .env file');
      process.exit(1);
    } else {
      // On testnet/fork, use deployer as vault
      CONFIG.vaultAddress = deployer.address;
      console.log('⚠️  Using deployer as vault (testnet/fork mode)');
    }
  }

  console.log('\n📋 Deployment Configuration');
  console.log('─'.repeat(50));
  console.log(`   Vault Address: ${CONFIG.vaultAddress}`);
  console.log(`   Min Profit BPS: ${CONFIG.minProfitBps}`);
  console.log('─'.repeat(50));

  // Confirm deployment on mainnet
  if (chainId === 8453) {
    console.log('\n⚠️  MAINNET DEPLOYMENT - Are you sure?');
    console.log('   Press Ctrl+C to cancel within 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  // Deploy contract
  console.log('\n🔨 Deploying FlashloanExecutor...');
  
  const FlashloanExecutor = await ethers.getContractFactory('FlashloanExecutor');
  const executor = await FlashloanExecutor.deploy(
    CONFIG.vaultAddress,
    CONFIG.minProfitBps
  );

  await executor.waitForDeployment();
  const executorAddress = await executor.getAddress();

  console.log(`\n✅ FlashloanExecutor deployed at: ${executorAddress}`);

  // Verify deployment
  console.log('\n🔍 Verifying deployment...');
  
  const owner = await executor.owner();
  const vault = await executor.vault();
  const aavePool = await executor.aavePool();
  const minProfit = await executor.minProfitBps();
  const paused = await executor.paused();

  console.log('─'.repeat(50));
  console.log(`   Owner: ${owner}`);
  console.log(`   Vault: ${vault}`);
  console.log(`   Aave Pool: ${aavePool}`);
  console.log(`   Min Profit BPS: ${minProfit}`);
  console.log(`   Paused: ${paused}`);
  console.log('─'.repeat(50));

  // Verify all values are correct
  const allCorrect = (
    owner === deployer.address &&
    vault === CONFIG.vaultAddress &&
    aavePool !== ethers.ZeroAddress &&
    Number(minProfit) === CONFIG.minProfitBps &&
    paused === false
  );

  if (allCorrect) {
    console.log('\n✅ All deployment parameters verified correctly!');
  } else {
    console.log('\n⚠️  Some parameters may not match expected values.');
  }

  // Output deployment info for .env
  console.log('\n📝 Add to your .env file:');
  console.log('─'.repeat(50));
  console.log(`EXECUTOR_ADDRESS=${executorAddress}`);
  console.log('─'.repeat(50));

  // Contract verification reminder
  if (chainId === 8453) {
    console.log('\n📋 Verification Command:');
    console.log('─'.repeat(50));
    console.log(`npx hardhat verify --network base ${executorAddress} "${CONFIG.vaultAddress}" ${CONFIG.minProfitBps}`);
    console.log('─'.repeat(50));
  }

  return {
    executor: executorAddress,
    vault: CONFIG.vaultAddress,
    deployer: deployer.address,
    chainId,
  };
}

// Execute deployment
main()
  .then((result) => {
    console.log('\n🎉 Deployment complete!');
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
  });
