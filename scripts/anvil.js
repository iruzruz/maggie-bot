require('dotenv').config();
const { spawn, execSync } = require('child_process');

// Validate RPC URL
const rpcUrl = process.env.BASE_RPC_URL;
if (!rpcUrl) {
  console.error('❌ Error: BASE_RPC_URL is not set in .env file');
  process.exit(1);
}

// Check if Anvil (Foundry) is installed
let useAnvil = false;
try {
  execSync('anvil --version', { stdio: 'ignore' });
  useAnvil = true;
} catch (e) {
  useAnvil = false;
}

if (useAnvil) {
  console.log(`🚀 Starting Anvil fork of Base Mainnet...`);
  console.log(`   RPC URL: ${rpcUrl}`);
  console.log(`   Chain ID: 8453`);
  
  const anvil = spawn('anvil', ['--fork-url', rpcUrl, '--chain-id', '8453'], { stdio: 'inherit', shell: true });
  
  anvil.on('error', (err) => {
    console.error('❌ Anvil error:', err);
  });
} else {
  console.warn('⚠️  Anvil command not found. Foundry might not be installed.');
  console.log('🔄 Falling back to Hardhat Node (forked)...');
  console.log('   (Configuration loaded from hardhat.config.js)');

  // Hardhat node automatically uses the fork config if set in hardhat.config.js
  const hardhat = spawn('npx', ['hardhat', 'node'], { stdio: 'inherit', shell: true });
  
  hardhat.on('error', (err) => {
    console.error('❌ Hardhat node error:', err);
  });
}
