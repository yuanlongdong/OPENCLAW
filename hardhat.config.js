require('dotenv').config();
require('@nomicfoundation/hardhat-ethers');
require('@nomicfoundation/hardhat-verify');

module.exports = {
  solidity: '0.8.24',
  networks: {
    bscTestnet: {
      url: process.env.RPC_URL || 'https://bsc-testnet-rpc.publicnode.com',
      chainId: 97,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : []
    },
    bscMainnet: {
      url: process.env.MAINNET_RPC_URL || 'https://bsc-dataseed.binance.org',
      chainId: 56,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : []
    }
  },
  etherscan: {
    apiKey: process.env.BSCSCAN_API_KEY || ''
  }
};
