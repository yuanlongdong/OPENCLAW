require('dotenv').config();
require('@nomicfoundation/hardhat-ethers');

module.exports = {
  solidity: '0.8.24',
  networks: {
    bscTestnet: {
      url: process.env.RPC_URL || 'https://bsc-testnet-rpc.publicnode.com',
      chainId: 97,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : []
    }
  }
};
