# OPENCLAW

- ERC-20 token contract (`OpenClaw`, symbol `OCL`) for BSC Testnet
- Minimal Web3 dApp served by GitHub Pages
- Hyperliquid perp module (market data + order pre-check + jump to official trade page)

## Networks
- Testnet: BSC Testnet (chainId 97)
- Mainnet: BNB Smart Chain (chainId 56)

## Quick Start
- `cp .env.example .env`
- Fill `.env` with your deployer key and RPC
- `npm install`
- `npm run compile`

## Deploy
- Testnet: `npm run deploy:bsc:testnet`
- Mainnet: `npm run deploy:bsc:mainnet`
- Mainnet + auto sync frontend config: `npm run deploy:bsc:mainnet:sync`

## Verify (BscScan)
- Set `CONTRACT_ADDRESS=0x...` in `.env`
- Testnet: `npm run verify:bsc:testnet`
- Mainnet: `npm run verify:bsc:mainnet`

## Launch to Real Trading
- See `MAINNET_LAUNCH.md` for full checklist (deploy, verify, add Pancake liquidity, publish links).
