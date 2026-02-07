// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Bot Configuration
 * @notice Centralized configuration for the MEV arbitrage bot
 * @dev All addresses are for Base Mainnet (Chain ID: 8453)
 *      Addresses verified with correct EIP-55 checksums
 */
library Config {
    // ============ Chain Info ============
    uint256 constant CHAIN_ID = 8453;
    
    // ============ Flashloan Providers ============
    
    /// @notice Aave V3 PoolAddressesProvider on Base
    address constant AAVE_POOL_PROVIDER = 0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D;
    
    // ============ DEX Routers ============
    
    /// @notice Uniswap V3 SwapRouter02 on Base
    address constant UNISWAP_V3_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481;
    
    /// @notice Uniswap V3 Factory on Base
    address constant UNISWAP_V3_FACTORY = 0x33128a8fC17869897dcE68Ed026d694621f6FDfD;
    
    /// @notice Uniswap V3 Quoter V2 on Base
    address constant UNISWAP_V3_QUOTER = 0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a;
    
    /// @notice SushiSwap V3 Factory on Base
    address constant SUSHI_V3_FACTORY = 0xc35DADB65012eC5796536bD9864eD8773aBc74C4;
    
    // ============ Common Tokens ============
    
    /// @notice Wrapped ETH on Base
    address constant WETH = 0x4200000000000000000000000000000000000006;
    
    /// @notice USDC on Base (native)
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    
    /// @notice USDT on Base
    address constant USDT = 0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2;
    
    /// @notice DAI on Base  
    address constant DAI = 0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb;
    
    // ============ Safety Parameters ============
    
    /// @notice Maximum slippage in basis points (0.5% = 50 bps)
    uint256 constant MAX_SLIPPAGE_BPS = 50;
    
    /// @notice Minimum profit in basis points of borrowed amount
    uint256 constant MIN_PROFIT_BPS = 10;
    
    /// @notice Aave flashloan fee (0.05% = 5 bps)
    uint256 constant AAVE_FLASH_FEE_BPS = 5;
    
    /// @notice Basis points denominator
    uint256 constant BPS_DENOMINATOR = 10000;
}
