const hre = require("hardhat");

async function main() {
  console.log("Testing fork connection...");
  const blockNumber = await hre.ethers.provider.getBlockNumber();
  console.log(`Current block number: ${blockNumber}`);
  
  const [signer] = await hre.ethers.getSigners();
  console.log(`Signer address: ${signer.address}`);
  
  const balance = await hre.ethers.provider.getBalance(signer.address);
  console.log(`Signer balance: ${hre.ethers.formatEther(balance)} ETH`);
  
  // Try to impersonate a whale to test forking capabilities
  const WHALE = "0x4200000000000000000000000000000000000006"; // WETH contract
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [WHALE],
  });
  
  const whaleSigner = await hre.ethers.getSigner(WHALE);
  console.log(`Impersonated WETH contract: ${whaleSigner.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
