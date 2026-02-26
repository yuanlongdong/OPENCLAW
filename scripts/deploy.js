const hre = require('hardhat');

async function main() {
  const OpenClaw = await hre.ethers.getContractFactory('OPENCLAW');
  const token = await OpenClaw.deploy();
  await token.waitForDeployment();
  const address = await token.getAddress();
  console.log('OPENCLAW deployed to:', address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
