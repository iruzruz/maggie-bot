/**
 * Price Monitor Module
 * Fetches and tracks prices across DEXs on Base mainnet
 */
const { createPublicClient, http, formatUnits, parseUnits } = require('viem');
const { base } = require('viem/chains');
const {
  TOKENS,
  DECIMALS,
  UNISWAP_V3_FACTORY,
  SUSHI_V3_FACTORY,
  FEE_TIERS,
  FACTORY_ABI,
  POOL_ABI,
  QUOTER_ABI,
  UNISWAP_V3_QUOTER,
  ANVIL_RPC_URL,
  BASE_RPC_URL,
} = require('./config');

/**
 * @class PriceMonitor
 * @description Monitors prices across DEXs and identifies discrepancies
 */
class PriceMonitor {
  constructor(useAnvil = false) {
    this.client = createPublicClient({
      chain: base,
      transport: http(useAnvil ? ANVIL_RPC_URL : BASE_RPC_URL),
    });
    
    // Cache for pool addresses
    this.poolCache = new Map();
    
    // Price cache with timestamps
    this.priceCache = new Map();
  }

  /**
   * Get pool address for a token pair on a specific DEX
   * @param {string} tokenA First token address
   * @param {string} tokenB Second token address
   * @param {number} fee Fee tier
   * @param {string} factory Factory address
   * @returns {Promise<string>} Pool address
   */
  async getPoolAddress(tokenA, tokenB, fee, factory = UNISWAP_V3_FACTORY) {
    const cacheKey = `${factory}-${tokenA}-${tokenB}-${fee}`;
    
    if (this.poolCache.has(cacheKey)) {
      return this.poolCache.get(cacheKey);
    }

    const poolAddress = await this.client.readContract({
      address: factory,
      abi: FACTORY_ABI,
      functionName: 'getPool',
      args: [tokenA, tokenB, fee],
    });

    if (poolAddress !== '0x0000000000000000000000000000000000000000') {
      this.poolCache.set(cacheKey, poolAddress);
    }

    return poolAddress;
  }

  /**
   * Get current pool state (price, liquidity, tick)
   * @param {string} poolAddress Pool address
   * @returns {Promise<Object>} Pool state
   */
  async getPoolState(poolAddress) {
    const [slot0, liquidity, token0, token1, fee] = await Promise.all([
      this.client.readContract({
        address: poolAddress,
        abi: POOL_ABI,
        functionName: 'slot0',
      }),
      this.client.readContract({
        address: poolAddress,
        abi: POOL_ABI,
        functionName: 'liquidity',
      }),
      this.client.readContract({
        address: poolAddress,
        abi: POOL_ABI,
        functionName: 'token0',
      }),
      this.client.readContract({
        address: poolAddress,
        abi: POOL_ABI,
        functionName: 'token1',
      }),
      this.client.readContract({
        address: poolAddress,
        abi: POOL_ABI,
        functionName: 'fee',
      }),
    ]);

    const sqrtPriceX96 = slot0[0];
    const tick = slot0[1];

    return {
      sqrtPriceX96,
      tick,
      liquidity,
      token0,
      token1,
      fee,
    };
  }

  /**
   * Calculate price from sqrtPriceX96
   * @param {bigint} sqrtPriceX96 Square root price in Q96 format
   * @param {number} token0Decimals Decimals of token0
   * @param {number} token1Decimals Decimals of token1
   * @returns {number} Price of token0 in terms of token1
   */
  sqrtPriceToPrice(sqrtPriceX96, token0Decimals, token1Decimals) {
    const sqrtPrice = Number(sqrtPriceX96) / 2 ** 96;
    const price = sqrtPrice ** 2;
    // Adjust for decimal difference
    const decimalAdjustment = 10 ** (token0Decimals - token1Decimals);
    return price * decimalAdjustment;
  }

  /**
   * Get prices for a token pair across all DEXs and fee tiers
   * @param {string} tokenA First token
   * @param {string} tokenB Second token
   * @returns {Promise<Array>} Array of price data objects
   */
  async getPricesForPair(tokenA, tokenB) {
    const prices = [];
    const feeTiers = Object.values(FEE_TIERS);
    const factories = [
      { address: UNISWAP_V3_FACTORY, name: 'Uniswap' },
      { address: SUSHI_V3_FACTORY, name: 'SushiSwap' },
    ];

    for (const factory of factories) {
      for (const fee of feeTiers) {
        try {
          const poolAddress = await this.getPoolAddress(tokenA, tokenB, fee, factory.address);
          
          if (poolAddress === '0x0000000000000000000000000000000000000000') {
            continue;
          }

          const state = await this.getPoolState(poolAddress);
          const token0Decimals = DECIMALS[state.token0] || 18;
          const token1Decimals = DECIMALS[state.token1] || 18;
          
          const price = this.sqrtPriceToPrice(
            state.sqrtPriceX96,
            token0Decimals,
            token1Decimals
          );

          prices.push({
            dex: factory.name,
            factory: factory.address,
            pool: poolAddress,
            fee,
            feePercent: (fee / 10000).toFixed(2) + '%',
            token0: state.token0,
            token1: state.token1,
            price,
            inversePrice: 1 / price,
            liquidity: state.liquidity.toString(),
            tick: Number(state.tick),
            timestamp: Date.now(),
          });
        } catch (error) {
          // Pool doesn't exist or error reading - skip
          console.debug(`Skipping ${factory.name} ${fee}: ${error.message}`);
        }
      }
    }

    return prices;
  }

  /**
   * Find arbitrage opportunities between price sources
   * @param {Array} prices Array of price data
   * @returns {Array} Array of arbitrage opportunities
   */
  findArbitrageOpportunities(prices) {
    const opportunities = [];
    
    // Compare all price pairs
    for (let i = 0; i < prices.length; i++) {
      for (let j = i + 1; j < prices.length; j++) {
        const priceA = prices[i];
        const priceB = prices[j];
        
        // Calculate price difference (as percentage)
        const priceDiff = Math.abs(priceA.price - priceB.price);
        const avgPrice = (priceA.price + priceB.price) / 2;
        const priceDiffPercent = (priceDiff / avgPrice) * 100;
        
        // Calculate total fees (both swaps)
        const totalFeeBps = (priceA.fee + priceB.fee) / 100;
        const totalFeePercent = totalFeeBps / 100;
        
        // Gross profit = price diff - fees
        const grossProfitPercent = priceDiffPercent - totalFeePercent;
        
        if (grossProfitPercent > 0) {
          // Determine buy/sell direction
          const buyFrom = priceA.price < priceB.price ? priceA : priceB;
          const sellTo = priceA.price < priceB.price ? priceB : priceA;
          
          opportunities.push({
            buyDex: buyFrom.dex,
            buyPool: buyFrom.pool,
            buyFee: buyFrom.fee,
            buyPrice: buyFrom.price,
            sellDex: sellTo.dex,
            sellPool: sellTo.pool,
            sellFee: sellTo.fee,
            sellPrice: sellTo.price,
            priceDiffPercent,
            totalFeePercent,
            grossProfitPercent,
            buyLiquidity: buyFrom.liquidity,
            sellLiquidity: sellTo.liquidity,
            token0: buyFrom.token0,
            token1: buyFrom.token1,
          });
        }
      }
    }

    // Sort by profit potential
    opportunities.sort((a, b) => b.grossProfitPercent - a.grossProfitPercent);
    
    return opportunities;
  }

  /**
   * Monitor a specific pair and log opportunities
   * @param {string} tokenA First token
   * @param {string} tokenB Second token
   */
  async monitorPair(tokenA, tokenB) {
    console.log(`\n📊 Monitoring ${tokenA.slice(0, 10)}.../${tokenB.slice(0, 10)}...`);
    
    const prices = await this.getPricesForPair(tokenA, tokenB);
    
    console.log(`Found ${prices.length} price sources:`);
    prices.forEach(p => {
      console.log(`  ${p.dex} (${p.feePercent}): ${p.price.toFixed(8)} | Liq: ${p.liquidity.slice(0, 15)}...`);
    });

    const opportunities = this.findArbitrageOpportunities(prices);
    
    if (opportunities.length > 0) {
      console.log(`\n🎯 Found ${opportunities.length} potential opportunities:`);
      opportunities.slice(0, 3).forEach((opp, i) => {
        console.log(`\n  [${i + 1}] ${opp.buyDex} → ${opp.sellDex}`);
        console.log(`      Buy @ ${opp.buyPrice.toFixed(8)} (${opp.buyFee / 10000}%)`);
        console.log(`      Sell @ ${opp.sellPrice.toFixed(8)} (${opp.sellFee / 10000}%)`);
        console.log(`      Gross Profit: ${opp.grossProfitPercent.toFixed(4)}%`);
      });
    } else {
      console.log('  No profitable opportunities found.');
    }

    return { prices, opportunities };
  }
}

module.exports = { PriceMonitor };
