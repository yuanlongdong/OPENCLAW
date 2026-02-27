const abi = [
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function transfer(address,uint256) returns (bool)'
];
const TOKEN_DECIMALS = 18;
const REQUIRED_CHAIN_ID = BigInt(window.OPENCLAW_CHAIN_ID || 97);
const REQUIRED_CHAIN_HEX = `0x${REQUIRED_CHAIN_ID.toString(16)}`;
const NETWORK_NAME = window.OPENCLAW_CHAIN_NAME || 'BSC Testnet';
const CHAIN_RPC_URL = window.OPENCLAW_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';
const EXPLORER_BASE = window.OPENCLAW_EXPLORER || 'https://testnet.bscscan.com';
const NATIVE_SYMBOL = window.OPENCLAW_NATIVE_SYMBOL || 'tBNB';
const TOKEN_SYMBOL = window.OPENCLAW_SYMBOL || '马到成功';
const OWNER_ADDRESS = window.OPENCLAW_OWNER || '';
const HISTORY_KEY = 'openclaw_transfer_history_v1';

document.getElementById('networkLabel').textContent = NETWORK_NAME;
document.getElementById('chainIdLabel').textContent = REQUIRED_CHAIN_ID.toString();
document.getElementById('nativeLabel').textContent = `${NATIVE_SYMBOL} 余额:`;
const contractLinkEl = document.getElementById('contractLink');
contractLinkEl.textContent = window.OPENCLAW_ADDRESS;
contractLinkEl.href = `${EXPLORER_BASE}/token/${window.OPENCLAW_ADDRESS}`;

let provider, signer, account;
let staticProvider;
let transferHistory = [];

function setText(id, val, cls = 'muted') {
  const el = document.getElementById(id);
  el.textContent = val;
  el.className = cls;
}

function shortAddr(addr) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function ensureOwner() {
  if (!account || !ethers.isAddress(OWNER_ADDRESS)) return;
  if (ethers.getAddress(account) !== ethers.getAddress(OWNER_ADDRESS)) {
    throw new Error('当前钱包不是开发者地址，禁止执行写操作');
  }
}

function updateOwnerHint() {
  if (!account) {
    setText('ownerHint', '未连接钱包', 'muted');
    return;
  }
  if (!ethers.isAddress(OWNER_ADDRESS)) {
    setText('ownerHint', '未配置 OPENCLAW_OWNER，已跳过开发者地址校验', 'muted');
    return;
  }
  const ok = ethers.getAddress(account) === ethers.getAddress(OWNER_ADDRESS);
  setText('ownerHint', ok ? `开发者已验证: ${shortAddr(account)}` : `当前钱包 ${shortAddr(account)} 非开发者地址`, ok ? 'ok' : 'bad');
}

async function refreshNativeBalance() {
  if (!provider || !account) return;
  const wei = await provider.getBalance(account);
  setText('nativeOut', `${ethers.formatUnits(wei, 18)} ${NATIVE_SYMBOL}`, 'mono');
}

function getStaticProvider() {
  if (!staticProvider) staticProvider = new ethers.JsonRpcProvider(CHAIN_RPC_URL);
  return staticProvider;
}

async function fetchHolderCount() {
  const key = String(window.BSCSCAN_API_KEY || '').trim();
  if (!key) return null;
  const host = REQUIRED_CHAIN_ID === 56n ? 'https://api.bscscan.com' : 'https://api-testnet.bscscan.com';
  const url = `${host}/api?module=token&action=tokenholdercount&contractaddress=${window.OPENCLAW_ADDRESS}&apikey=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('持币地址数接口请求失败');
  const data = await res.json();
  if (data.status !== '1') throw new Error(data.message || '持币地址数接口失败');
  const n = Number(data.result);
  return Number.isFinite(n) ? n : null;
}

async function refreshIssuerStats() {
  try {
    const p = getStaticProvider();
    const c = new ethers.Contract(window.OPENCLAW_ADDRESS, abi, p);
    const totalBn = await c.totalSupply();
    const total = Number(ethers.formatUnits(totalBn, TOKEN_DECIMALS));
    setText('statTotal', `${total.toLocaleString()} ${TOKEN_SYMBOL}`, 'mono');
    if (ethers.isAddress(OWNER_ADDRESS)) {
      const ownerBn = await c.balanceOf(OWNER_ADDRESS);
      const owner = Number(ethers.formatUnits(ownerBn, TOKEN_DECIMALS));
      const pct = total > 0 ? (owner / total) * 100 : 0;
      setText('statOwner', `${owner.toLocaleString()} ${TOKEN_SYMBOL}`, 'mono');
      setText('statOwnerPct', `${pct.toFixed(4)}%`, 'mono');
    } else {
      setText('statOwner', '未配置 OPENCLAW_OWNER', 'muted');
      setText('statOwnerPct', '-', 'muted');
    }
    const holders = await fetchHolderCount().catch(() => null);
    setText('statHolders', holders == null ? '未配置 BSCSCAN_API_KEY' : String(holders), 'mono');
    setText('statsStatus', '发行看板已刷新', 'ok');
  } catch (e) {
    setText('statsStatus', e.message || '发行看板刷新失败', 'bad');
  }
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    transferHistory = raw ? JSON.parse(raw) : [];
  } catch (_) {
    transferHistory = [];
  }
}

function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(transferHistory.slice(0, 100)));
}

function addHistoryItem(item) {
  transferHistory.unshift(item);
  transferHistory = transferHistory.slice(0, 100);
  saveHistory();
  renderHistory();
}

function renderHistory() {
  const ul = document.getElementById('historyList');
  let total = 0;
  ul.innerHTML = '';
  if (!transferHistory.length) {
    const li = document.createElement('li');
    li.textContent = '暂无转账记录';
    ul.appendChild(li);
    setText('historyTotal', `0 ${TOKEN_SYMBOL}`, 'mono');
    return;
  }
  for (const r of transferHistory) {
    const li = document.createElement('li');
    const ts = new Date(r.time).toLocaleString();
    li.innerHTML = `<span class="mono">${shortAddr(r.from)} -> ${shortAddr(r.to)}</span> | ${r.amount} ${TOKEN_SYMBOL} | <a class="mono" href="${EXPLORER_BASE}/tx/${r.hash}" target="_blank" rel="noopener noreferrer">${r.hash.slice(0, 10)}...</a> | ${ts}`;
    ul.appendChild(li);
    const n = Number(r.amount || 0);
    if (Number.isFinite(n) && n > 0) total += n;
  }
  setText('historyTotal', `${total} ${TOKEN_SYMBOL}`, 'mono');
}

function parseBulkRows(text) {
  const normalized = String(text || '')
    .replace(/[，]/g, ',')
    .replace(/[；;]/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+(?=0x[a-fA-F0-9]{40}\s*,)/g, '\n');
  const rows = normalized.split('\n').map(x => x.trim()).filter(Boolean);
  const parsed = [];
  for (let i = 0; i < rows.length; i++) {
    const line = rows[i];
    const byComma = line.split(',').map(x => x.trim()).filter(Boolean);
    let to = '';
    let amount = '';
    if (byComma.length === 2) {
      to = byComma[0];
      amount = byComma[1];
    } else {
      const bySpace = line.split(/\s+/).map(x => x.trim()).filter(Boolean);
      if (bySpace.length === 2) {
        to = bySpace[0];
        amount = bySpace[1];
      } else {
        throw new Error(`第 ${i + 1} 行格式错误，应为 地址,数量`);
      }
    }
    if (!ethers.isAddress(to)) throw new Error(`第 ${i + 1} 行地址无效`);
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) throw new Error(`第 ${i + 1} 行数量无效`);
    parsed.push({ to: to.toLowerCase(), amount: String(n) });
  }
  if (parsed.length === 0) throw new Error('空投列表为空');
  if (parsed.length > 100) throw new Error('单次最多 100 行，避免超时');
  return parsed;
}

async function connect() {
  if (!window.ethereum) throw new Error('未找到 MetaMask，请在钱包内置浏览器打开');
  provider = new ethers.BrowserProvider(window.ethereum, 'any');
  const accs = await provider.send('eth_requestAccounts', []);
  account = accs[0];
  await ensureRequiredNetwork();
  provider = new ethers.BrowserProvider(window.ethereum, 'any');
  signer = await provider.getSigner();
  document.getElementById('account').textContent = account;
  updateOwnerHint();
}

function getContract(readonly = false) {
  if (!provider) provider = new ethers.BrowserProvider(window.ethereum);
  return new ethers.Contract(window.OPENCLAW_ADDRESS, abi, readonly ? provider : signer);
}

async function ensureRequiredNetwork() {
  const net = await provider.getNetwork();
  if (net.chainId === REQUIRED_CHAIN_ID) return;
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: REQUIRED_CHAIN_HEX }] });
  } catch (e) {
    const code = e && (e.code === 4902 || e.code === -32603);
    if (code) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: REQUIRED_CHAIN_HEX,
          chainName: NETWORK_NAME,
          nativeCurrency: { name: NATIVE_SYMBOL, symbol: NATIVE_SYMBOL, decimals: 18 },
          rpcUrls: [CHAIN_RPC_URL],
          blockExplorerUrls: [EXPLORER_BASE]
        }]
      });
      return;
    }
    throw new Error(`请切换到 ${NETWORK_NAME} (chainId ${REQUIRED_CHAIN_ID.toString()}) 后重试`);
  }
}

async function ensureTokenContractReady() {
  if (!provider) provider = new ethers.BrowserProvider(window.ethereum);
  const net = await provider.getNetwork();
  if (net.chainId !== REQUIRED_CHAIN_ID) throw new Error(`当前不是 ${NETWORK_NAME}，请先切换网络`);
  const code = await provider.getCode(window.OPENCLAW_ADDRESS);
  if (!code || code === '0x') throw new Error(`该网络上未找到 ${TOKEN_SYMBOL} 合约，请确认钱包网络为 ${NETWORK_NAME}`);
}


document.getElementById('connect').onclick = async () => {
  try {
    await connect();
    await refreshNativeBalance();
    await refreshIssuerStats();
    setText('status', '钱包已连接', 'ok');
  } catch (e) {
    setText('status', e.message || '连接失败', 'bad');
  }
};

document.getElementById('addToken').onclick = async () => {
  try {
    if (!window.ethereum) throw new Error('未找到钱包环境');
    const ok = await window.ethereum.request({
      method: 'wallet_watchAsset',
      params: { type: 'ERC20', options: { address: window.OPENCLAW_ADDRESS, symbol: TOKEN_SYMBOL, decimals: 18 } }
    });
    setText('status', ok ? `已请求添加 ${TOKEN_SYMBOL}，请在钱包确认` : `钱包未添加 ${TOKEN_SYMBOL}（用户取消或钱包不支持）`, ok ? 'ok' : 'bad');
  } catch (e) {
    setText('status', e.message || '添加代币失败', 'bad');
  }
};

document.getElementById('balance').onclick = async () => {
  try {
    if (!account) await connect();
    await ensureTokenContractReady();
    const c = getContract(true);
    const b = await c.balanceOf(account);
    setText('balanceOut', `${ethers.formatUnits(b, TOKEN_DECIMALS)} ${TOKEN_SYMBOL}`, 'mono');
    await refreshNativeBalance();
    await refreshIssuerStats();
  } catch (e) {
    setText('status', e.message || '查询失败', 'bad');
  }
};

document.getElementById('send').onclick = async () => {
  try {
    if (!account) await connect();
    ensureOwner();
    await ensureTokenContractReady();
    const to = document.getElementById('to').value.trim();
    const amount = document.getElementById('amount').value.trim();
    if (!ethers.isAddress(to)) throw new Error('收款地址无效');
    if (!(Number(amount) > 0)) throw new Error('数量必须 > 0');
    const c = getContract(false);
    const tx = await c.transfer(to, ethers.parseUnits(amount, TOKEN_DECIMALS));
    setText('status', `交易已提交: ${tx.hash}`, 'muted');
    await tx.wait();
    setText('status', `转账成功: ${tx.hash}`, 'ok');
    addHistoryItem({ from: account, to, amount, hash: tx.hash, time: Date.now() });
    await refreshIssuerStats();
  } catch (e) {
    setText('status', e.message || '转账失败', 'bad');
  }
};

document.getElementById('bulkPreview').onclick = () => {
  try {
    const parsed = parseBulkRows(document.getElementById('bulkInput').value);
    const total = parsed.reduce((s, x) => s + Number(x.amount), 0);
    setText('status', `空投预览: ${parsed.length} 笔, 合计 ${total} ${TOKEN_SYMBOL}`, 'ok');
  } catch (e) {
    setText('status', e.message || '预览失败', 'bad');
  }
};

document.getElementById('bulkSend').onclick = async () => {
  try {
    if (!account) await connect();
    ensureOwner();
    await ensureTokenContractReady();
    const parsed = parseBulkRows(document.getElementById('bulkInput').value);
    setText('status', `开始空投，共 ${parsed.length} 笔...`, 'muted');
    const c = getContract(false);
    for (let i = 0; i < parsed.length; i++) {
      const row = parsed[i];
      setText('status', `发送中 ${i + 1}/${parsed.length}: ${shortAddr(row.to)} ${row.amount} ${TOKEN_SYMBOL}`, 'muted');
      const tx = await c.transfer(row.to, ethers.parseUnits(row.amount, TOKEN_DECIMALS));
      await tx.wait();
      addHistoryItem({ from: account, to: row.to, amount: row.amount, hash: tx.hash, time: Date.now() });
    }
    setText('status', `空投完成，共 ${parsed.length} 笔`, 'ok');
    await refreshIssuerStats();
  } catch (e) {
    setText('status', e.message || '空投失败', 'bad');
  }
};

document.getElementById('refreshStats').onclick = async () => {
  await refreshIssuerStats();
};

document.getElementById('refreshHistory').onclick = () => {
  loadHistory();
  renderHistory();
  setText('status', '已刷新本地历史', 'ok');
};

document.getElementById('clearHistory').onclick = () => {
  transferHistory = [];
  saveHistory();
  renderHistory();
  setText('status', '已清空本地历史', 'ok');
};

(async () => {
  loadHistory();
  renderHistory();
  updateOwnerHint();
  await refreshIssuerStats();
})();
