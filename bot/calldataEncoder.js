/**
 * Calldata Encoder Module
 * Encodes swap instructions and arbitrage parameters for on-chain execution
 */
const { ethers } = require('ethers');
const {
  UNISWAP_V3_ROUTER,
  TOKENS,
} = require('./config');

// ABI for encoding FlashloanExecutor parameters
const EXECUTOR_ABI = [
  'function executeWithAave((address flashloanProvider, address borrowToken, uint256 borrowAmount, uint256 minProfit, (address router, address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint256 minAmountOut)[] swaps) params)',
];

/**
 * @class CalldataEncoder
 * @description Encodes calldata for FlashloanExecutor contract
 */
class CalldataEncoder {
  constructor(executorAddress) {
    this.executorAddress = executorAddress;
    this.interface = new ethers.Interface(EXECUTOR_ABI);
  }

  /**
   * Create a swap instruction object
   * @param {Object} options Swap options
   * @returns {Object} Swap instruction
   */
  createSwapInstruction(options) {
    return {
      router: options.router || UNISWAP_V3_ROUTER,
      tokenIn: options.tokenIn,
      tokenOut: options.tokenOut,
      fee: options.fee,
      amountIn: options.amountIn || '0', // 0 = use full balance
      minAmountOut: options.minAmountOut || '1', // Minimum 1 wei
    };
  }

  /**
   * Build arbitrage route from opportunity
   * @param {Object} opportunity Opportunity from OpportunityDetector
   * @param {Object} sizing Sizing from OpportunityDetector
   * @param {Object} profitAnalysis Profit analysis from OpportunityDetector
   * @returns {Object} Arbitrage parameters ready for encoding
   */
  buildArbitrageParams(opportunity, sizing, profitAnalysis) {
    // Determine swap sequence
    // Buy pool: buy token0 with token1 (or vice versa)
    // Sell pool: sell token0 for token1 (or vice versa)
    
    const borrowToken = opportunity.token0;
    const borrowAmount = sizing.optimalAmount;
    
    // Calculate minimum profit (use 50% of expected as safety margin)
    const expectedProfit = parseFloat(profitAnalysis.netProfitAfterGas);
    const minProfit = Math.max(0, Math.floor(expectedProfit * 0.5 * 1e6)).toString(); // In smallest unit
    
    // Create swap instructions
    const swaps = [
      // First swap: Buy pool - swap borrowed token for intermediate
      this.createSwapInstruction({
        router: UNISWAP_V3_ROUTER,
        tokenIn: opportunity.token0,
        tokenOut: opportunity.token1,
        fee: opportunity.buyFee,
        amountIn: borrowAmount,
        minAmountOut: '1', // Will be calculated based on slippage
      }),
      // Second swap: Sell pool - swap intermediate back to borrowed token
      this.createSwapInstruction({
        router: UNISWAP_V3_ROUTER,
        tokenIn: opportunity.token1,
        tokenOut: opportunity.token0,
        fee: opportunity.sellFee,
        amountIn: '0', // Use full balance from previous swap
        minAmountOut: borrowAmount, // Must get back at least what we borrowed
      }),
    ];

    return {
      flashloanProvider: this.executorAddress, // Will be replaced with Aave pool
      borrowToken,
      borrowAmount,
      minProfit,
      swaps,
    };
  }

  /**
   * Encode parameters for executeWithAave function
   * @param {Object} params Arbitrage parameters
   * @returns {string} Encoded calldata
   */
  encodeExecuteWithAave(params) {
    // Format swaps for ABI encoding
    const formattedSwaps = params.swaps.map(swap => [
      swap.router,
      swap.tokenIn,
      swap.tokenOut,
      swap.fee,
      swap.amountIn,
      swap.minAmountOut,
    ]);

    const calldata = this.interface.encodeFunctionData('executeWithAave', [{
      flashloanProvider: params.flashloanProvider,
      borrowToken: params.borrowToken,
      borrowAmount: params.borrowAmount,
      minProfit: params.minProfit,
      swaps: formattedSwaps,
    }]);

    return calldata;
  }

  /**
   * Build complete execution transaction
   * @param {Object} opportunity Arbitrage opportunity
   * @param {Object} sizing Sizing analysis
   * @param {Object} profitAnalysis Profit analysis
   * @param {Object} options Transaction options
   * @returns {Object} Ready-to-sign transaction
   */
  buildExecutionTransaction(opportunity, sizing, profitAnalysis, options = {}) {
    const params = this.buildArbitrageParams(opportunity, sizing, profitAnalysis);
    const calldata = this.encodeExecuteWithAave(params);
    
    return {
      to: this.executorAddress,
      data: calldata,
      gasLimit: options.gasLimit || 500000,
      maxFeePerGas: options.maxFeePerGas,
      maxPriorityFeePerGas: options.maxPriorityFeePerGas,
      
      // Metadata for logging
      meta: {
        opportunity: {
          buyDex: opportunity.buyDex,
          sellDex: opportunity.sellDex,
          priceDiff: opportunity.priceDiffPercent,
        },
        sizing: {
          borrowAmount: sizing.optimalAmount,
        },
        profit: {
          expected: profitAnalysis.netProfitAfterGas,
          minEnforced: params.minProfit,
        },
      },
    };
  }

  /**
   * Calculate minimum output with slippage protection
   * @param {bigint} expectedOutput Expected output amount
   * @param {number} slippageBps Slippage tolerance in basis points
   * @returns {string} Minimum output amount
   */
  calculateMinOutput(expectedOutput, slippageBps = 50) {
    const expected = BigInt(expectedOutput);
    const slippageFactor = 10000n - BigInt(slippageBps);
    const minOutput = (expected * slippageFactor) / 10000n;
    return minOutput.toString();
  }

  /**
   * Log encoded transaction details
   * @param {Object} tx Transaction from buildExecutionTransaction
   */
  logTransaction(tx) {
    console.log('\n📦 Encoded Transaction');
    console.log('═'.repeat(50));
    console.log(`To: ${tx.to}`);
    console.log(`Gas Limit: ${tx.gasLimit}`);
    console.log(`Data Length: ${tx.data.length} chars`);
    console.log('─'.repeat(50));
    console.log('Metadata:');
    console.log(`  Route: ${tx.meta.opportunity.buyDex} → ${tx.meta.opportunity.sellDex}`);
    console.log(`  Borrow: ${tx.meta.sizing.borrowAmount}`);
    console.log(`  Expected Profit: $${tx.meta.profit.expected}`);
    console.log('═'.repeat(50));
    
    return tx;
  }
}

module.exports = { CalldataEncoder };
