/**
 * Fork Verification Script
 * Verifies that Anvil fork is correctly connected to Base mainnet
 */
const { createPublicClient, http, formatUnits } = require('viem');
const { base } = require('viem/chains');
require('dotenv').config();

const {
  TOKENS,
  UNISWAP_V3_FACTORY,
  AAVE_POOL_PROVIDER,
  FEE_TIERS,
  FACTORY_ABI,
  POOL_ABI,
  AAVE_POOL_PROVIDER_ABI,
  AAVE_POOL_ABI,
  ERC20_ABI,
  ANVIL_RPC_URL,
} = require('../bot/config.js');

async function main() {
  console.log('🔍 Verifying Base Mainnet Fork...\n');

  // Connect to Anvil fork
  const client = createPublicClient({
    chain: base,
    transport: http(ANVIL_RPC_URL),
  });

  // 1. Verify chain ID
  const chainId = await client.getChainId();
  console.log(`✅ Chain ID: ${chainId} (expected: 8453)`);
  if (chainId !== 8453) {
    throw new Error('Wrong chain ID! Expected Base mainnet (8453)');
  }

  // 2. Verify current block
  const block = await client.getBlock();
  console.log(`✅ Current Block: ${block.number}`);
  console.log(`📅 Block Timestamp: ${new Date(Number(block.timestamp) * 1000).toISOString()}`);

  // 3. Verify Uniswap V3 Factory
  console.log('\n📊 Checking Uniswap V3...');
  const wethUsdcPool = await client.readContract({
    address: UNISWAP_V3_FACTORY,
    abi: FACTORY_ABI,
    functionName: 'getPool',
    args: [TOKENS.WETH, TOKENS.USDC, FEE_TIERS.MEDIUM],
  });
  console.log(`✅ WETH/USDC (0.3%) Pool: ${wethUsdcPool}`);

  if (wethUsdcPool === '0x0000000000000000000000000000000000000000') {
    throw new Error('Pool not found! Fork may be stale or incorrect.');
  }

  // 4. Get pool state
  const slot0 = await client.readContract({
    address: wethUsdcPool,
    abi: POOL_ABI,
    functionName: 'slot0',
  });
  const sqrtPriceX96 = slot0[0];
  const tick = slot0[1];
  
  // Calculate price from sqrtPriceX96
  const price = (Number(sqrtPriceX96) / 2 ** 96) ** 2 * 10 ** 12; // Adjust for decimals (18-6)
  console.log(`💰 Current WETH Price: $${(1/price).toFixed(2)} USDC`);
  console.log(`📈 Current Tick: ${tick}`);

  // 5. Check pool liquidity
  const liquidity = await client.readContract({
    address: wethUsdcPool,
    abi: POOL_ABI,
    functionName: 'liquidity',
  });
  console.log(`💧 Pool Liquidity: ${liquidity.toString()}`);

  // 6. Verify Aave Pool
  console.log('\n🏦 Checking Aave V3...');
  const aavePool = await client.readContract({
    address: AAVE_POOL_PROVIDER,
    abi: AAVE_POOL_PROVIDER_ABI,
    functionName: 'getPool',
  });
  console.log(`✅ Aave Pool Address: ${aavePool}`);

  // 7. Check flashloan premium
  const flashPremium = await client.readContract({
    address: aavePool,
    abi: AAVE_POOL_ABI,
    functionName: 'FLASHLOAN_PREMIUM_TOTAL',
  });
  console.log(`💸 Flashloan Premium: ${Number(flashPremium) / 100}%`);

  // 8. Check WETH balance of a known holder (to verify state)
  const wethBalance = await client.readContract({
    address: TOKENS.WETH,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [wethUsdcPool], // Pool should have WETH
  });
  console.log(`\n💰 WETH in Pool: ${formatUnits(wethBalance, 18)} WETH`);

  // 9. Check USDC balance
  const usdcBalance = await client.readContract({
    address: TOKENS.USDC,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [wethUsdcPool],
  });
  console.log(`💵 USDC in Pool: ${formatUnits(usdcBalance, 6)} USDC`);

  console.log('\n✅ Fork verification complete! All checks passed.');
  console.log('🚀 Ready for simulation and testing.\n');
}

main().catch((error) => {
  console.error('❌ Fork verification failed:', error.message);
  process.exit(1);
});
