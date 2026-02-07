/**
 * Maggie MEV Bot - Main Controller
 * Flashloan Arbitrage Bot for Base Mainnet
 */
require('dotenv').config();

const { PriceMonitor } = require('./priceMonitor');
const { OpportunityDetector } = require('./opportunityDetector');
const { CalldataEncoder } = require('./calldataEncoder');
const {
  TOKENS,
  MONITORED_PAIRS,
  POLL_INTERVAL_MS,
  PROFIT_VAULT,
  SAFETY,
} = require('./config');

/**
 * @class MaggieBot
 * @description Main MEV arbitrage controller
 */
class MaggieBot {
  constructor(options = {}) {
    this.useAnvil = options.useAnvil || false;
    this.executorAddress = options.executorAddress || null;
    this.dryRun = options.dryRun !== false; // Default to dry-run mode
    
    // Initialize modules
    this.priceMonitor = new PriceMonitor(this.useAnvil);
    this.opportunityDetector = new OpportunityDetector({
      minProfitUsd: options.minProfitUsd || SAFETY.MIN_PROFIT_USD,
      maxSlippageBps: options.maxSlippageBps || SAFETY.MAX_SLIPPAGE_BPS,
      ethPriceUsd: options.ethPriceUsd || 3000,
    });
    
    if (this.executorAddress) {
      this.calldataEncoder = new CalldataEncoder(this.executorAddress);
    }
    
    // State
    this.isRunning = false;
    this.stats = {
      cyclesCompleted: 0,
      opportunitiesFound: 0,
      viableOpportunities: 0,
      executedTrades: 0,
      totalProfit: 0,
    };
  }

  /**
   * Log startup banner
   */
  logBanner() {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                  🧲 MAGGIE MEV BOT 🧲                          ║');
    console.log('║            Flashloan Arbitrage on Base Mainnet                ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║ Mode: ${this.dryRun ? '🔍 DRY-RUN (Simulation Only)' : '🚀 LIVE EXECUTION'}           ║`);
    console.log(`║ Network: ${this.useAnvil ? 'Anvil Fork' : 'Base Mainnet'}                              ║`);
    console.log(`║ Min Profit: $${SAFETY.MIN_PROFIT_USD}                                        ║`);
    console.log(`║ Max Slippage: ${SAFETY.MAX_SLIPPAGE_BPS / 100}%                                          ║`);
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
  }

  /**
   * Run a single monitoring cycle
   */
  async runCycle() {
    console.log(`\n🔄 Cycle #${this.stats.cyclesCompleted + 1} - ${new Date().toISOString()}`);
    console.log('─'.repeat(60));
    
    for (const pair of MONITORED_PAIRS) {
      try {
        // 1. Get prices
        const { prices, opportunities } = await this.priceMonitor.monitorPair(
          pair.token0,
          pair.token1
        );
        
        if (opportunities.length === 0) {
          continue;
        }
        
        this.stats.opportunitiesFound += opportunities.length;
        
        // 2. Evaluate each opportunity
        for (const opp of opportunities) {
          const evaluation = this.opportunityDetector.evaluate(opp);
          this.opportunityDetector.logEvaluation(evaluation);
          
          if (evaluation.shouldExecute) {
            this.stats.viableOpportunities++;
            
            // 3. Build transaction (if executor is set)
            if (this.calldataEncoder && !this.dryRun) {
              const tx = this.calldataEncoder.buildExecutionTransaction(
                opp,
                evaluation.sizing,
                evaluation.profitAnalysis
              );
              this.calldataEncoder.logTransaction(tx);
              
              // TODO: Sign and submit via private relay
              console.log('\n⚠️  LIVE EXECUTION NOT YET IMPLEMENTED');
              console.log('   Transaction prepared but not submitted.');
              
            } else if (this.dryRun) {
              console.log('\n📝 DRY-RUN: Would execute this trade');
              this.stats.executedTrades++;
              this.stats.totalProfit += parseFloat(evaluation.profitAnalysis.netProfitAfterGas);
            }
          }
        }
        
      } catch (error) {
        console.error(`Error monitoring ${pair.name}:`, error.message);
      }
    }
    
    this.stats.cyclesCompleted++;
  }

  /**
   * Log current statistics
   */
  logStats() {
    console.log('\n📊 Session Statistics');
    console.log('═'.repeat(40));
    console.log(`Cycles Completed: ${this.stats.cyclesCompleted}`);
    console.log(`Opportunities Found: ${this.stats.opportunitiesFound}`);
    console.log(`Viable Opportunities: ${this.stats.viableOpportunities}`);
    console.log(`Simulated Trades: ${this.stats.executedTrades}`);
    console.log(`Simulated Profit: $${this.stats.totalProfit.toFixed(4)}`);
    console.log('═'.repeat(40));
  }

  /**
   * Start continuous monitoring
   * @param {number} maxCycles Maximum cycles to run (0 = infinite)
   */
  async start(maxCycles = 0) {
    this.logBanner();
    this.isRunning = true;
    
    console.log('🚀 Starting arbitrage monitoring...\n');
    
    let cycles = 0;
    while (this.isRunning) {
      await this.runCycle();
      cycles++;
      
      if (maxCycles > 0 && cycles >= maxCycles) {
        console.log(`\n✅ Completed ${maxCycles} cycles.`);
        break;
      }
      
      // Wait before next cycle
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    
    this.logStats();
  }

  /**
   * Stop monitoring
   */
  stop() {
    console.log('\n🛑 Stopping bot...');
    this.isRunning = false;
  }

  /**
   * Run a single test cycle
   */
  async test() {
    this.logBanner();
    console.log('🧪 Running single test cycle...\n');
    await this.runCycle();
    this.logStats();
  }
}

// CLI Entry Point
async function main() {
  const args = process.argv.slice(2);
  const useAnvil = args.includes('--anvil') || args.includes('-a');
  const testMode = args.includes('--test') || args.includes('-t');
  const maxCycles = parseInt(args.find(a => a.startsWith('--cycles='))?.split('=')[1]) || 0;
  
  const bot = new MaggieBot({
    useAnvil,
    dryRun: true, // Always dry-run until executor is deployed
    executorAddress: process.env.EXECUTOR_ADDRESS || null,
  });
  
  // Handle Ctrl+C
  process.on('SIGINT', () => {
    bot.stop();
    process.exit(0);
  });
  
  if (testMode) {
    await bot.test();
  } else {
    await bot.start(maxCycles);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { MaggieBot };
