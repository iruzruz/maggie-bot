// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IUniswapV3FlashCallback
 * @notice Callback interface for Uniswap V3 flash loans
 * @dev The calling contract must implement this interface to receive flash loans
 */
interface IUniswapV3FlashCallback {
    /**
     * @notice Called on the token receiver after a flash loan
     * @param fee0 The fee amount in token0 due to the pool
     * @param fee1 The fee amount in token1 due to the pool  
     * @param data Any data passed through by the caller via the flash call
     */
    function uniswapV3FlashCallback(
        uint256 fee0,
        uint256 fee1,
        bytes calldata data
    ) external;
}

/**
 * @title IUniswapV3Pool
 * @notice Minimal Uniswap V3 Pool interface for flash loans and swaps
 */
interface IUniswapV3Pool {
    /**
     * @notice Flash loan tokens from the pool
     * @param recipient The address which will receive the token0 and token1 amounts
     * @param amount0 The amount of token0 to send
     * @param amount1 The amount of token1 to send
     * @param data Any data to be passed through to the callback
     */
    function flash(
        address recipient,
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) external;

    /// @notice The first of the two tokens of the pool, sorted by address
    function token0() external view returns (address);

    /// @notice The second of the two tokens of the pool, sorted by address  
    function token1() external view returns (address);

    /// @notice The pool's fee in hundredths of a bip (e.g., 3000 = 0.3%)
    function fee() external view returns (uint24);

    /// @notice The current price of the pool as a sqrt(token1/token0) Q64.96 value
    function slot0()
        external
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            uint8 feeProtocol,
            bool unlocked
        );

    /// @notice The amounts of token0 and token1 that are owed to the pool
    function liquidity() external view returns (uint128);
}

/**
 * @title IUniswapV3Factory
 * @notice Minimal factory interface to get pool addresses
 */
interface IUniswapV3Factory {
    /// @notice Returns the pool address for a given pair of tokens and a fee
    function getPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) external view returns (address pool);
}
