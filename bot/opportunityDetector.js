/**
 * Opportunity Detector Module
 * Analyzes arbitrage opportunities and validates profitability
 */
const { parseUnits, formatUnits } = require('viem');
const {
  SAFETY,
  AAVE_FLASH_FEE_BPS,
  DECIMALS,
} = require('./config');

/**
 * @class OpportunityDetector
 * @description Analyzes and validates arbitrage opportunities with slippage modeling
 */
class OpportunityDetector {
  constructor(options = {}) {
    this.minProfitUsd = options.minProfitUsd || SAFETY.MIN_PROFIT_USD;
    this.maxSlippageBps = options.maxSlippageBps || SAFETY.MAX_SLIPPAGE_BPS;
    this.minProfitBps = options.minProfitBps || SAFETY.MIN_PROFIT_BPS;
    this.maxFlashloanPercent = options.maxFlashloanPercent || SAFETY.MAX_FLASHLOAN_PERCENT;
    
    // ETH price in USD (should be fetched dynamically in production)
    this.ethPriceUsd = options.ethPriceUsd || 3000;
    
    // Base gas price in gwei (typically very low on Base)
    this.baseFeeGwei = options.baseFeeGwei || 0.001;
  }

  /**
   * Calculate optimal flashloan amount based on liquidity constraints
   * @param {Object} opportunity Arbitrage opportunity
   * @returns {Object} Optimal amount and constraints
   */
  calculateOptimalAmount(opportunity) {
    // Parse liquidity values
    const buyLiquidity = BigInt(opportunity.buyLiquidity);
    const sellLiquidity = BigInt(opportunity.sellLiquidity);
    
    // Use the smaller liquidity as the constraint
    const constrainingLiquidity = buyLiquidity < sellLiquidity ? buyLiquidity : sellLiquidity;
    
    // Maximum flashloan = X% of constraining liquidity
    const maxFlashloan = (constrainingLiquidity * BigInt(this.maxFlashloanPercent)) / 100n;
    
    // Estimate optimal size (start conservative)
    const optimalAmount = maxFlashloan / 10n; // Start with 1% of max
    
    return {
      maxFlashloan: maxFlashloan.toString(),
      optimalAmount: optimalAmount.toString(),
      constrainingLiquidity: constrainingLiquidity.toString(),
      limitingPool: buyLiquidity < sellLiquidity ? 'buy' : 'sell',
    };
  }

  /**
   * Model slippage for a given trade size
   * @param {bigint} tradeSize Size of trade
   * @param {bigint} liquidity Pool liquidity
   * @param {number} feeTier Pool fee tier
   * @returns {Object} Slippage estimate
   */
  modelSlippage(tradeSize, liquidity, feeTier) {
    // Simplified slippage model: slippage ≈ (tradeSize / liquidity) * factor
    // In practice, this should use tick-based calculation
    
    const tradeSizeBn = BigInt(tradeSize);
    const liquidityBn = BigInt(liquidity);
    
    if (liquidityBn === 0n) {
      return { slippageBps: 10000, acceptable: false }; // 100% slippage
    }
    
    // Calculate impact ratio (scaled by 10000 for bps)
    const impactRatio = (tradeSizeBn * 10000n) / liquidityBn;
    
    // Apply a multiplier based on fee tier (lower fees = tighter spread = more slippage)
    const feeMultiplier = feeTier === 100 ? 3 : feeTier === 500 ? 2 : 1;
    
    const slippageBps = Number(impactRatio) * feeMultiplier;
    
    return {
      slippageBps,
      acceptable: slippageBps <= this.maxSlippageBps,
      maxAllowedBps: this.maxSlippageBps,
    };
  }

  /**
   * Estimate gas cost for the arbitrage transaction
   * @returns {Object} Gas estimate
   */
  estimateGasCost() {
    // Typical gas for flashloan + 2 swaps on Base
    const gasUnits = 350000; // Conservative estimate
    const gasPriceGwei = this.baseFeeGwei;
    
    // Gas cost in ETH
    const gasCostEth = (gasUnits * gasPriceGwei) / 1e9;
    
    // Gas cost in USD
    const gasCostUsd = gasCostEth * this.ethPriceUsd;
    
    return {
      gasUnits,
      gasPriceGwei,
      gasCostEth,
      gasCostUsd,
    };
  }

  /**
   * Calculate expected profit after all costs
   * @param {Object} opportunity Arbitrage opportunity
   * @param {string} borrowAmount Amount to borrow (as string)
   * @param {number} tokenDecimals Decimals of borrowed token
   * @returns {Object} Profit analysis
   */
  calculateProfit(opportunity, borrowAmount, tokenDecimals = 18) {
    const amount = BigInt(borrowAmount);
    const amountFloat = Number(formatUnits(amount, tokenDecimals));
    
    // Gross profit from price difference
    const grossProfitPercent = opportunity.grossProfitPercent / 100;
    const grossProfitAmount = amountFloat * grossProfitPercent;
    
    // Flashloan fee (Aave: 0.05%)
    const flashFeePercent = AAVE_FLASH_FEE_BPS / 10000;
    const flashFeeAmount = amountFloat * flashFeePercent;
    
    // Slippage estimates
    const buySlippage = this.modelSlippage(borrowAmount, opportunity.buyLiquidity, opportunity.buyFee);
    const sellSlippage = this.modelSlippage(borrowAmount, opportunity.sellLiquidity, opportunity.sellFee);
    
    const totalSlippagePercent = (buySlippage.slippageBps + sellSlippage.slippageBps) / 10000;
    const slippageCost = amountFloat * totalSlippagePercent;
    
    // Gas cost
    const gasEstimate = this.estimateGasCost();
    
    // Net profit calculation
    const netProfitBeforeGas = grossProfitAmount - flashFeeAmount - slippageCost;
    const netProfitAfterGas = netProfitBeforeGas - gasEstimate.gasCostUsd;
    
    // Profit in basis points of borrowed amount
    const profitBps = (netProfitAfterGas / amountFloat) * 10000;
    
    return {
      borrowAmount: borrowAmount,
      borrowAmountFormatted: amountFloat.toFixed(6),
      
      // Gross
      grossProfitPercent: (grossProfitPercent * 100).toFixed(4),
      grossProfitAmount: grossProfitAmount.toFixed(6),
      
      // Costs
      flashFeePercent: (flashFeePercent * 100).toFixed(4),
      flashFeeAmount: flashFeeAmount.toFixed(6),
      totalSlippagePercent: (totalSlippagePercent * 100).toFixed(4),
      slippageCost: slippageCost.toFixed(6),
      gasCostUsd: gasEstimate.gasCostUsd.toFixed(6),
      
      // Net
      netProfitBeforeGas: netProfitBeforeGas.toFixed(6),
      netProfitAfterGas: netProfitAfterGas.toFixed(6),
      profitBps: profitBps.toFixed(2),
      
      // Validation
      slippageAcceptable: buySlippage.acceptable && sellSlippage.acceptable,
      profitAcceptable: netProfitAfterGas >= this.minProfitUsd,
      bpsAcceptable: profitBps >= this.minProfitBps,
      
      // Overall
      isViable: (
        buySlippage.acceptable &&
        sellSlippage.acceptable &&
        netProfitAfterGas >= this.minProfitUsd &&
        profitBps >= this.minProfitBps
      ),
    };
  }

  /**
   * Evaluate an opportunity and determine if it should be executed
   * @param {Object} opportunity Arbitrage opportunity from PriceMonitor
   * @returns {Object} Full evaluation with recommendation
   */
  evaluate(opportunity) {
    // Calculate optimal amount
    const sizing = this.calculateOptimalAmount(opportunity);
    
    // Calculate profit with optimal amount
    const token0Decimals = DECIMALS[opportunity.token0] || 18;
    const profitAnalysis = this.calculateProfit(
      opportunity,
      sizing.optimalAmount,
      token0Decimals
    );
    
    // Build recommendation
    const recommendation = {
      opportunity,
      sizing,
      profitAnalysis,
      shouldExecute: profitAnalysis.isViable,
      reason: '',
    };
    
    // Determine reason for pass/fail
    if (!profitAnalysis.slippageAcceptable) {
      recommendation.reason = 'Slippage exceeds threshold';
    } else if (!profitAnalysis.profitAcceptable) {
      recommendation.reason = `Net profit $${profitAnalysis.netProfitAfterGas} < min $${this.minProfitUsd}`;
    } else if (!profitAnalysis.bpsAcceptable) {
      recommendation.reason = `Profit ${profitAnalysis.profitBps} bps < min ${this.minProfitBps} bps`;
    } else if (profitAnalysis.isViable) {
      recommendation.reason = 'All criteria met - EXECUTE';
    }
    
    return recommendation;
  }

  /**
   * Log evaluation results
   * @param {Object} evaluation Evaluation from evaluate()
   */
  logEvaluation(evaluation) {
    const { opportunity, sizing, profitAnalysis, shouldExecute, reason } = evaluation;
    
    console.log('\n📋 Opportunity Evaluation');
    console.log('═'.repeat(50));
    console.log(`Route: ${opportunity.buyDex} → ${opportunity.sellDex}`);
    console.log(`Price Diff: ${opportunity.priceDiffPercent.toFixed(4)}%`);
    console.log('─'.repeat(50));
    console.log('Sizing:');
    console.log(`  Optimal Amount: ${sizing.optimalAmount}`);
    console.log(`  Max Flashloan: ${sizing.maxFlashloan}`);
    console.log(`  Limiting Pool: ${sizing.limitingPool}`);
    console.log('─'.repeat(50));
    console.log('Profit Analysis:');
    console.log(`  Gross Profit: $${profitAnalysis.grossProfitAmount}`);
    console.log(`  Flash Fee: -$${profitAnalysis.flashFeeAmount}`);
    console.log(`  Slippage: -$${profitAnalysis.slippageCost}`);
    console.log(`  Gas Cost: -$${profitAnalysis.gasCostUsd}`);
    console.log(`  NET PROFIT: $${profitAnalysis.netProfitAfterGas}`);
    console.log('─'.repeat(50));
    console.log(`Decision: ${shouldExecute ? '✅ EXECUTE' : '❌ SKIP'}`);
    console.log(`Reason: ${reason}`);
    console.log('═'.repeat(50));
    
    return evaluation;
  }
}

module.exports = { OpportunityDetector };
