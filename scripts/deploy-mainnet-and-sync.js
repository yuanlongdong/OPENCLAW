const fs = require('fs');
const path = require('path');
const hre = require('hardhat');

// PancakeSwap Router address for BSC Mainnet
const ROUTER_MAINNET = '0x10ED43C718714eb63d5aA57B78B54704E256024E';

async function main() {
  const signers = await hre.ethers.getSigners();
  if (!signers.length || !signers[0]) {
    throw new Error('未检测到部署账户。请在 .env 配置 DEPLOYER_PRIVATE_KEY，并确保该地址有主网 BNB。');
  }
  const [deployer] = signers;
  const net = await hre.ethers.provider.getNetwork();
  if (net.chainId !== 56n) {
    throw new Error(`当前网络不是 BSC Mainnet (56)，实际为 ${net.chainId.toString()}`);
  }
  console.log('Network:', net.name, 'chainId:', net.chainId.toString());
  console.log('Deployer:', deployer.address);

  // Treasury: use deployer by default, override with TREASURY_ADDRESS env
  const treasuryAddress = process.env.TREASURY_ADDRESS || deployer.address;

  // Tax rates: default 3% buy, 5% sell
  const buyTaxBps = Number(process.env.BUY_TAX_BPS || '300');  // 3%
  const sellTaxBps = Number(process.env.SELL_TAX_BPS || '500'); // 5%

  if (buyTaxBps > 1000 || sellTaxBps > 1000) {
    throw new Error('Tax rate cannot exceed 1000 bps (10%)');
  }

  console.log('Router:', ROUTER_MAINNET);
  console.log('Treasury:', treasuryAddress);
  console.log('Buy Tax:', buyTaxBps, 'bps (', buyTaxBps / 100, '%)');
  console.log('Sell Tax:', sellTaxBps, 'bps (', sellTaxBps / 100, '%)');

  const OpenClaw = await hre.ethers.getContractFactory('OPENCLAW');
  const token = await OpenClaw.deploy(
    ROUTER_MAINNET,
    treasuryAddress,
    buyTaxBps,
    sellTaxBps
  );
  await token.waitForDeployment();
  const address = await token.getAddress();
  const tx = token.deploymentTransaction();
  console.log('');
  console.log('✅ InsurFi deployed to:', address);
  if (tx) console.log('   Deploy tx hash:', tx.hash);

  // Sync frontend config
  const cfgPath = path.join(__dirname, '..', 'docs', 'config.js');
  let cfg = fs.readFileSync(cfgPath, 'utf8');
  cfg = cfg.replace(
    /const MAINNET = \{[\s\S]*?\};/,
    `const MAINNET = {\n` +
      `    OPENCLAW_ADDRESS: '${address}',\n` +
      `    OPENCLAW_SYMBOL: 'INSUR',\n` +
      `    OPENCLAW_CHAIN_ID: 56,\n` +
      `    OPENCLAW_CHAIN_NAME: 'BNB Smart Chain',\n` +
      `    OPENCLAW_RPC_URL: 'https://bsc-dataseed.binance.org',\n` +
      `    OPENCLAW_EXPLORER: 'https://bscscan.com',\n` +
      `    OPENCLAW_NATIVE_SYMBOL: 'BNB',\n` +
      `    OPENCLAW_OWNER: '${deployer.address}',\n` +
      `    BSCSCAN_API_KEY: ''\n` +
      `  };`
  );
  fs.writeFileSync(cfgPath, cfg);
  console.log('✅ Synced docs/config.js MAINNET address + owner.');
  console.log('');
  console.log('Next steps:');
  console.log(`  1) export CONTRACT_ADDRESS=${address}`);
  console.log('  2) npm run verify:bsc:mainnet');
  console.log('  3) push docs/config.js to GitHub to publish mainnet page');
  console.log('  4) Add liquidity on PancakeSwap');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
