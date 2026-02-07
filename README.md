# 🧲 Maggie - Flashloan MEV Arbitrage Bot

A production-ready flashloan arbitrage bot for Base mainnet using a hybrid on-chain/off-chain architecture.

## Architecture

```
┌─────────────────────────────────────────────┐
│           OFF-CHAIN CONTROLLER              │
├─────────────────────────────────────────────┤
│ • Price monitoring across DEXs              │
│ • Opportunity detection & validation        │
│ • Slippage modeling                         │
│ • Gas estimation                            │
│ • Calldata construction                     │
└─────────────────────────────────────────────┘
                     │
                     ▼ Private TX
┌─────────────────────────────────────────────┐
│           ON-CHAIN EXECUTOR                 │
├─────────────────────────────────────────────┤
│ • Atomic flashloan execution                │
│ • DEX-agnostic swap routing                 │
│ • Profit enforcement (revert if < min)      │
│ • MEV protection                            │
└─────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js v20+
- Base mainnet RPC URL (Alchemy/Infura)
- Foundry (optional, for advanced testing)

### Installation

```bash
# Clone and install
cd maggie
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your RPC URL and vault address
```

### Running Simulations

```bash
# Start Anvil fork (terminal 1)
npx anvil --fork-url YOUR_BASE_RPC_URL --chain-id 8453

# Run simulation (terminal 2)
npm run simulate
```

### Running the Bot

```bash
# Test mode (single cycle)
node bot/index.js --test --anvil

# Continuous monitoring
node bot/index.js --anvil

# Limit cycles
node bot/index.js --anvil --cycles=10
```

### Running Tests

> ⚠️ Tests require a forked Base network (contract calls Aave pool provider at deployment)

```bash
# Compile contracts
npx hardhat compile

# Run tests on forked network (requires BASE_RPC_URL in .env)
npx hardhat test --network hardhat
```

## Project Structure

```
/maggie
├── /contracts
│   ├── FlashloanExecutor.sol     # Main executor contract
│   ├── /interfaces               # External interfaces
│   └── /libraries                # Config library
├── /bot
│   ├── index.js                  # Main controller
│   ├── priceMonitor.js           # DEX price tracking
│   ├── opportunityDetector.js    # Profit/slippage analysis
│   ├── calldataEncoder.js        # TX construction
│   └── config.js                 # Addresses & ABIs
├── /scripts
│   ├── deploy.js                 # Deployment script
│   ├── simulate.js               # Simulation suite
│   └── verifyFork.js             # Fork validation
└── /tests
    └── FlashloanExecutor.test.js # Unit tests
```

## Safety Features

- ✅ On-chain profit enforcement
- ✅ Reentrancy protection
- ✅ Owner-only execution
- ✅ Emergency pause
- ✅ Slippage protection
- ✅ No public mempool exposure

## Deployment

⚠️ **DO NOT DEPLOY TO MAINNET UNTIL:**

1. All tests pass
2. All simulations verify profitability
3. Vault address is correctly configured
4. Private TX relay is set up

```bash
# Dry-run on fork
npx hardhat run scripts/deploy.js --network anvil

# Mainnet (CAUTION!)
npx hardhat run scripts/deploy.js --network base
```

## Configuration

Edit `.env`:

```
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
PROFIT_VAULT_ADDRESS=0xYourVaultAddress
MIN_PROFIT_USD=0.50
MAX_SLIPPAGE_BPS=50
```

## License

MIT
