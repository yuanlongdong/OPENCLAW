const hre = require('hardhat');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const net = await hre.ethers.provider.getNetwork();
  console.log('Network:', net.name, 'chainId:', net.chainId.toString());
  console.log('Deployer:', deployer.address);

  const OpenClaw = await hre.ethers.getContractFactory('OPENCLAW');
  const token = await OpenClaw.deploy();
  await token.waitForDeployment();
  const address = await token.getAddress();
  const tx = token.deploymentTransaction();
  console.log('OPENCLAW deployed to:', address);
  if (tx) console.log('Deploy tx hash:', tx.hash);
  console.log('Next: set CONTRACT_ADDRESS and run verify command for this network.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
