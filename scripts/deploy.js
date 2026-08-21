const hre = require('hardhat');

// PancakeSwap Router addresses
const ROUTERS = {
  97: '0xD99D1c33F9fC3444f8101754aBC46c52416550D',  // BSC Testnet
  56: '0x10ED43C718714eb63d5aA57B78B54704E256024E',  // BSC Mainnet
};

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const net = await hre.ethers.provider.getNetwork();
  const chainId = Number(net.chainId);

  console.log('Network:', net.name, 'chainId:', chainId);
  console.log('Deployer:', deployer.address);

  const routerAddress = ROUTERS[chainId];
  if (!routerAddress) {
    throw new Error(`Unsupported chainId ${chainId}. Supported: 56 (BSC Mainnet), 97 (BSC Testnet)`);
  }

  // Treasury: use deployer by default, override with TREASURY_ADDRESS env
  const treasuryAddress = process.env.TREASURY_ADDRESS || deployer.address;

  // Tax rates: default 3% buy, 5% sell, override with env vars
  const buyTaxBps = Number(process.env.BUY_TAX_BPS || '300');  // 3%
  const sellTaxBps = Number(process.env.SELL_TAX_BPS || '500'); // 5%

  if (buyTaxBps > 1000 || sellTaxBps > 1000) {
    throw new Error('Tax rate cannot exceed 1000 bps (10%)');
  }

  console.log('Router:', routerAddress);
  console.log('Treasury:', treasuryAddress);
  console.log('Buy Tax:', buyTaxBps, 'bps (', buyTaxBps / 100, '%)');
  console.log('Sell Tax:', sellTaxBps, 'bps (', sellTaxBps / 100, '%)');

  const OpenClaw = await hre.ethers.getContractFactory('OPENCLAW');
  const token = await OpenClaw.deploy(
    routerAddress,
    treasuryAddress,
    buyTaxBps,
    sellTaxBps
  );
  await token.waitForDeployment();
  const address = await token.getAddress();
  const tx = token.deploymentTransaction();

  console.log('');
  console.log('✅ OPENCLAW deployed to:', address);
  if (tx) console.log('   Deploy tx hash:', tx.hash);
  console.log('');
  console.log('Next steps:');
  console.log(`  1) export CONTRACT_ADDRESS=${address}`);
  console.log(`  2) npm run verify:bsc:${chainId === 56 ? 'mainnet' : 'testnet'}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
