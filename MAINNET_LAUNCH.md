# OPENCLAW Mainnet Launch (BSC)

## 1) Security first
- Use a brand-new deployer wallet.
- Never reuse previously leaked seed phrase/private key.
- Keep `DEPLOYER_PRIVATE_KEY` only in local `.env`, never commit it.

## 2) Prepare environment
- `cp .env.example .env`
- Fill:
  - `DEPLOYER_PRIVATE_KEY`
  - `MAINNET_RPC_URL`
  - `BSCSCAN_API_KEY`

## 3) Deploy to BSC Mainnet
- `npm install`
- `npm run compile`
- `npm run deploy:bsc:mainnet`

Record:
- Token contract address
- Deployment tx hash

## 4) Verify source on BscScan
- Set `CONTRACT_ADDRESS` in `.env`
- `npm run verify:bsc:mainnet`

After verify, BscScan should show contract source as verified.

## 5) Open trading on PancakeSwap
- Open: `https://pancakeswap.finance/add`
- Select network: BNB Smart Chain (mainnet)
- Import your token by contract address
- Provide initial liquidity pair `OCL/BNB`
- Confirm LP creation

## 6) Share trading links
- Pair page on PancakeSwap
- Token page on BscScan
- Official project page (GitHub Pages)

## 7) Optional trust steps
- Lock LP position (commonly used for trust).
- Publish tokenomics and treasury addresses.
- Publish risk disclosure and admin permissions.
