const fs = require('fs');
const path = require('path');
const hre = require('hardhat');

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

  const OpenClaw = await hre.ethers.getContractFactory('OPENCLAW');
  const token = await OpenClaw.deploy();
  await token.waitForDeployment();
  const address = await token.getAddress();
  const tx = token.deploymentTransaction();

  console.log('OPENCLAW deployed to:', address);
  if (tx) console.log('Deploy tx hash:', tx.hash);

  const cfgPath = path.join(__dirname, '..', 'docs', 'config.js');
  let cfg = fs.readFileSync(cfgPath, 'utf8');
  cfg = cfg.replace(
    /const MAINNET = \{[\s\S]*?\};/,
    `const MAINNET = {\n` +
      `    OPENCLAW_ADDRESS: '${address}',\n` +
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
  console.log('Synced docs/config.js MAINNET address + owner.');

  console.log('Next steps:');
  console.log(`1) export CONTRACT_ADDRESS=${address}`);
  console.log('2) npm run verify:bsc:mainnet');
  console.log('3) push docs/config.js to GitHub to publish mainnet page');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
