const abi = [
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function insurancePool() view returns (uint256)',
  'function totalClaims() view returns (uint256)',
  'function insuranceShareBps() view returns (uint256)',
  'function minHoldForInsurance() view returns (uint256)',
  'function waitingPeriod() view returns (uint256)',
  'function deductibleBps() view returns (uint256)',
  'function payoutRatioBps() view returns (uint256)',
  'function maxPayoutPerClaim() view returns (uint256)',
  'function claimCooldown() view returns (uint256)',
  'function policies(address) view returns (address holder, uint256 startTime, bool active, uint256 totalPayout, uint256 lastClaimTime)',
  'function isInsured(address) view returns (bool)',
  'function purchaseInsurance()',
  'function submitClaim(bytes32, uint256)',
  'function calculatePayout(uint256) view returns (uint256)',
  'function claims(uint256) view returns (uint256 id, address claimant, bytes32 txHash, uint256 claimedLoss, uint256 payoutAmount, uint256 submitTime, uint8 status, address reviewer, string rejectReason)',
];
const TOKEN_DECIMALS = 18;
const REQUIRED_CHAIN_ID = BigInt(window.OPENCLAW_CHAIN_ID || 97);
const REQUIRED_CHAIN_HEX = `0x${REQUIRED_CHAIN_ID.toString(16)}`;
const NETWORK_NAME = window.OPENCLAW_CHAIN_NAME || 'BSC Testnet';
const CHAIN_RPC_URL = window.OPENCLAW_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';
const EXPLORER_BASE = window.OPENCLAW_EXPLORER || 'https://testnet.bscscan.com';
const NATIVE_SYMBOL = window.OPENCLAW_NATIVE_SYMBOL || 'tBNB';
const TOKEN_SYMBOL = window.OPENCLAW_SYMBOL || '马到成功';
let provider, signer, account;
let staticProvider;
function setText(id, val, cls) { const el = document.getElementById(id); if (!el) return; el.textContent = val; if (cls) el.className = cls; }
function getStaticProvider() { if (!staticProvider) staticProvider = new ethers.JsonRpcProvider(CHAIN_RPC_URL); return staticProvider; }
function getContract(readonly) {
  if (readonly) return new ethers.Contract(window.OPENCLAW_ADDRESS, abi, getStaticProvider());
  if (!provider) provider = new ethers.BrowserProvider(window.ethereum);
  return new ethers.Contract(window.OPENCLAW_ADDRESS, abi, signer || provider);
}
async function connectWallet() {
  if (!window.ethereum) throw new Error('未找到钱包，请在 MetaMask 或钱包内置浏览器打开');
  provider = new ethers.BrowserProvider(window.ethereum, 'any');
  const accs = await provider.send('eth_requestAccounts', []);
  account = accs[0];
  await ensureNetwork();
  provider = new ethers.BrowserProvider(window.ethereum, 'any');
  signer = await provider.getSigner();
  setText('walletStatus', `已连接: ${account.slice(0,6)}...${account.slice(-4)}`, 'ok');
  document.getElementById('myPolicySection').style.display = 'block';
  document.getElementById('claimSection').style.display = 'block';
  await refreshPoolStats();
  await refreshPolicy();
}
async function ensureNetwork() {
  const net = await provider.getNetwork();
  if (net.chainId === REQUIRED_CHAIN_ID) return;
  try { await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: REQUIRED_CHAIN_HEX }] }); }
  catch (e) {
    const code = e && (e.code === 4902 || e.code === -32603);
    if (code) { await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: REQUIRED_CHAIN_HEX, chainName: NETWORK_NAME, nativeCurrency: { name: NATIVE_SYMBOL, symbol: NATIVE_SYMBOL, decimals: 18 }, rpcUrls: [CHAIN_RPC_URL], blockExplorerUrls: [EXPLORER_BASE] }] }); return; }
    throw new Error(`请切换到 ${NETWORK_NAME}`);
  }
}
async function refreshPoolStats() {
  try {
    const c = getContract(true);
    const [pool, totalClaimsNum] = await Promise.all([c.insurancePool(), c.totalClaims()]);
    const poolBnb = ethers.formatUnits(pool, 18);
    setText('poolBalance', `${parseFloat(poolBnb).toFixed(4)} ${NATIVE_SYMBOL}`);
    setText('totalClaims', totalClaimsNum.toString());
    const pct = Math.min((parseFloat(poolBnb) / 100) * 100, 100);
    document.getElementById('poolFill').style.width = pct + '%';
    let paidCount = 0;
    for (let i = 0; i < Math.min(Number(totalClaimsNum), 50); i++) { try { const cl = await c.claims(i); if (cl.status === 3) paidCount++; } catch (_) {} }
    setText('pendingClaims', paidCount + ' 笔已赔付');
  } catch (e) { setText('poolBalance', '读取失败', 'bad'); }
}
async function refreshPolicy() {
  if (!account) return;
  try {
    const c = getContract(true);
    const [policy, insured, balance] = await Promise.all([c.policies(account), c.isInsured(account), c.balanceOf(account)]);
    const tokenBal = ethers.formatUnits(balance, TOKEN_DECIMALS);
    const minHold = await c.minHoldForInsurance();
    const minHoldStr = ethers.formatUnits(minHold, TOKEN_DECIMALS);
    if (insured) { setText('policyStatus', '✅ 已生效', 'ok'); document.getElementById('purchaseBtn').style.display = 'none'; }
    else if (policy.active) {
      const now = Math.floor(Date.now() / 1000);
      if (now < policy.startTime) { const remain = policy.startTime - now; const days = Math.floor(remain / 86400); const hours = Math.floor((remain % 86400) / 3600); setText('policyStatus', `⏳ 等待期中 (${days}天${hours}小时后生效)`, 'muted'); }
      else { setText('policyStatus', `⚠️ 持仓不足 (需≥${minHoldStr}，当前${parseFloat(tokenBal).toFixed(0)})`, 'bad'); }
      document.getElementById('purchaseBtn').style.display = 'none';
    } else {
      if (parseFloat(tokenBal) >= parseFloat(minHoldStr)) { setText('policyStatus', '可投保（持仓达标）', 'gold'); document.getElementById('purchaseBtn').style.display = 'inline-block'; }
      else { setText('policyStatus', `持仓不足（需≥${minHoldStr}，当前${parseFloat(tokenBal).toFixed(0)}）`, 'bad'); document.getElementById('purchaseBtn').style.display = 'none'; }
    }
    if (policy.startTime > 0n) setText('policyStartTime', new Date(Number(policy.startTime) * 1000).toLocaleString()); else setText('policyStartTime', '未投保');
    setText('policyTotalPayout', `${ethers.formatUnits(policy.totalPayout, 18)} ${NATIVE_SYMBOL}`);
    if (policy.lastClaimTime > 0n) setText('policyLastClaim', new Date(Number(policy.lastClaimTime) * 1000).toLocaleString()); else setText('policyLastClaim', '无');
  } catch (e) { setText('policyStatusText', e.message || '读取保单失败', 'bad'); }
}
async function purchaseInsurance() {
  try { if (!account) await connectWallet(); const c = getContract(false); setText('policyStatusText', '正在提交投保交易...', 'muted'); const tx = await c.purchaseInsurance(); await tx.wait(); setText('policyStatusText', '投保成功！等待期 7 天后保单生效', 'ok'); await refreshPolicy(); }
  catch (e) { setText('policyStatusText', e.message || '投保失败', 'bad'); }
}
async function calcEstimate() {
  try { const loss = document.getElementById('claimLoss').value; if (!loss || parseFloat(loss) <= 0) { setText('claimStatus', '请输入亏损额', 'bad'); return; } const c = getContract(true); const lossWei = ethers.parseUnits(loss, 18); const payout = await c.calculatePayout(lossWei); const payoutBnb = ethers.formatUnits(payout, 18); document.getElementById('claimEstimate').value = `${payoutBnb} ${NATIVE_SYMBOL}`; setText('claimStatus', '预估赔付已计算', 'ok'); }
  catch (e) { setText('claimStatus', e.message || '计算失败', 'bad'); }
}
async function submitClaim() {
  try {
    if (!account) await connectWallet();
    const txHash = document.getElementById('claimTxHash').value.trim();
    const loss = document.getElementById('claimLoss').value;
    if (!txHash || !txHash.startsWith('0x') || txHash.length !== 66) throw new Error('请输入有效的交易哈希（0x开头，66位）');
    if (!loss || parseFloat(loss) <= 0) throw new Error('请输入亏损额');
    const c = getContract(false);
    const lossWei = ethers.parseUnits(loss, 18);
    setText('claimStatus', '正在提交赔付申请...', 'muted');
    const tx = await c.submitClaim(txHash, lossWei);
    await tx.wait();
    setText('claimStatus', '申请已提交！请等待项目方审核', 'ok');
    document.getElementById('claimTxHash').value = ''; document.getElementById('claimLoss').value = ''; document.getElementById('claimEstimate').value = '';
    await refreshPoolStats();
  } catch (e) { setText('claimStatus', e.message || '提交失败', 'bad'); }
}
document.getElementById('connectWallet').onclick = async () => { try { await connectWallet(); } catch (e) { setText('walletStatus', e.message, 'bad'); } };
document.getElementById('connectWallet2').onclick = async () => { try { await connectWallet(); } catch (e) { setText('walletStatus', e.message, 'bad'); } };
document.getElementById('buyToken').onclick = () => { window.open(`https://pancakeswap.finance/swap?outputCurrency=${window.OPENCLAW_ADDRESS}`, '_blank'); };
document.getElementById('viewContract').onclick = () => { window.open(`${EXPLORER_BASE}/token/${window.OPENCLAW_ADDRESS}`, '_blank'); };
document.getElementById('purchaseBtn').onclick = purchaseInsurance;
document.getElementById('refreshPolicy').onclick = refreshPolicy;
document.getElementById('calcEstimate').onclick = calcEstimate;
document.getElementById('submitClaim').onclick = submitClaim;
refreshPoolStats();
