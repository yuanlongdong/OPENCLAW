require('dotenv').config();
require('@nomicfoundation/hardhat-ethers');

module.exports = {
  solidity: '0.8.24',
  networks: {
    sepolia: {
      url: process.env.RPC_URL || '',
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : []
    }
  }
};
