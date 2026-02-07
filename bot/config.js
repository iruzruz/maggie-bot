/**
 * Bot Configuration for Base Mainnet
 * All addresses verified for Chain ID 8453
 */
require('dotenv').config();

// Chain configuration
const CHAIN_ID = 8453;
const CHAIN_NAME = 'base';

// RPC endpoints
const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const ANVIL_RPC_URL = 'http://127.0.0.1:8545';

// Flashloan Providers
const AAVE_POOL_PROVIDER = '0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D';

// DEX Routers
const UNISWAP_V3_ROUTER = '0x2626664c2603336E57B271c5C0b26F421741e481';
const UNISWAP_V3_FACTORY = '0x33128a8fC17869897dcE68Ed026d694621f6FDfD';
const UNISWAP_V3_QUOTER = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a';
const SUSHI_V3_FACTORY = '0xc35DADB65012eC5796536bD9864eD8773aBc74C4';

// Common Tokens
const TOKENS = {
  WETH: '0x4200000000000000000000000000000000000006',
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  USDT: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
  DAI: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
};

// Token Decimals
const DECIMALS = {
  [TOKENS.WETH]: 18,
  [TOKENS.USDC]: 6,
  [TOKENS.USDT]: 6,
  [TOKENS.DAI]: 18,
};

// Uniswap V3 Fee Tiers (in hundredths of a basis point)
const FEE_TIERS = {
  LOWEST: 100,    // 0.01%
  LOW: 500,       // 0.05%
  MEDIUM: 3000,   // 0.30%
  HIGH: 10000,    // 1.00%
};

// Safety Parameters
const SAFETY = {
  MAX_SLIPPAGE_BPS: parseInt(process.env.MAX_SLIPPAGE_BPS) || 50,        // 0.5%
  MIN_PROFIT_USD: parseFloat(process.env.MIN_PROFIT_USD) || 0.50,        // $0.50
  MIN_PROFIT_BPS: 10,                                                     // 0.1% of borrowed
  MAX_FLASHLOAN_PERCENT: 10,                                             // 10% of pool liquidity
  MAX_PRICE_IMPACT_BPS: 30,                                              // 0.3%
  MAX_GAS_PRICE_GWEI: parseFloat(process.env.MAX_GAS_PRICE_GWEI) || 0.001,
};

// Aave flashloan fee
const AAVE_FLASH_FEE_BPS = 5; // 0.05%

// Monitor intervals
const POLL_INTERVAL_MS = 500;  // 500ms between price checks

// Profit vault (set via environment)
const PROFIT_VAULT = process.env.PROFIT_VAULT_ADDRESS || '';

// Pairs to monitor (token0, token1)
const MONITORED_PAIRS = [
  { token0: TOKENS.WETH, token1: TOKENS.USDC, name: 'WETH/USDC' },
  { token0: TOKENS.WETH, token1: TOKENS.USDT, name: 'WETH/USDT' },
  { token0: TOKENS.USDC, token1: TOKENS.USDT, name: 'USDC/USDT' },
];

// ABIs (minimal for price fetching)
const POOL_ABI = [
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() external view returns (uint128)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function fee() external view returns (uint24)',
];

const FACTORY_ABI = [
  'function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)',
];

const QUOTER_ABI = [
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
];

const ERC20_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
];

const AAVE_POOL_PROVIDER_ABI = [
  'function getPool() external view returns (address)',
];

const AAVE_POOL_ABI = [
  'function flashLoanSimple(address receiverAddress, address asset, uint256 amount, bytes calldata params, uint16 referralCode) external',
  'function FLASHLOAN_PREMIUM_TOTAL() external view returns (uint128)',
];

module.exports = {
  CHAIN_ID,
  CHAIN_NAME,
  BASE_RPC_URL,
  ANVIL_RPC_URL,
  AAVE_POOL_PROVIDER,
  UNISWAP_V3_ROUTER,
  UNISWAP_V3_FACTORY,
  UNISWAP_V3_QUOTER,
  SUSHI_V3_FACTORY,
  TOKENS,
  DECIMALS,
  FEE_TIERS,
  SAFETY,
  AAVE_FLASH_FEE_BPS,
  POLL_INTERVAL_MS,
  PROFIT_VAULT,
  MONITORED_PAIRS,
  POOL_ABI,
  FACTORY_ABI,
  QUOTER_ABI,
  ERC20_ABI,
  AAVE_POOL_PROVIDER_ABI,
  AAVE_POOL_ABI,
};
