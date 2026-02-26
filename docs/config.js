(function () {
  // Use URL param to switch network without editing file:
  // - Testnet (default): /OPENCLAW/
  // - Mainnet: /OPENCLAW/?net=mainnet
  const q = new URLSearchParams(window.location.search);
  const net = String(q.get('net') || 'testnet').toLowerCase();

  const TESTNET = {
    OPENCLAW_ADDRESS: '0x9b1e428ee00E5499eA1016e98e5C37a3DCe51641',
    OPENCLAW_CHAIN_ID: 97,
    OPENCLAW_CHAIN_NAME: 'BSC Testnet',
    OPENCLAW_RPC_URL: 'https://bsc-testnet-rpc.publicnode.com',
    OPENCLAW_EXPLORER: 'https://testnet.bscscan.com',
    OPENCLAW_NATIVE_SYMBOL: 'tBNB',
    OPENCLAW_OWNER: '0x9669C9d54A9BB73C0Ed1068aBD010aB79075dAAe',
    BSCSCAN_API_KEY: ''
  };

  // Fill mainnet contract/owner after mainnet deployment.
  const MAINNET = {
    OPENCLAW_ADDRESS: '0x4098B09922000492aaD8eCD31D88d6E1eb16385e',
    OPENCLAW_CHAIN_ID: 56,
    OPENCLAW_CHAIN_NAME: 'BNB Smart Chain',
    OPENCLAW_RPC_URL: 'https://bsc-dataseed.binance.org',
    OPENCLAW_EXPLORER: 'https://bscscan.com',
    OPENCLAW_NATIVE_SYMBOL: 'BNB',
    OPENCLAW_OWNER: '0x9669C9d54A9BB73C0Ed1068aBD010aB79075dAAe',
    BSCSCAN_API_KEY: ''
  };

  const cfg = net === 'mainnet' ? MAINNET : TESTNET;
  Object.assign(window, cfg);
})();
