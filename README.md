# POWER · 马到成功

> BSC 首个交易者亏损保险协议 — 持币即投保，交易亏损可赔付

## 📌 项目简介

POWER（马到成功）是一个部署在 BNB Smart Chain 上的实用型保险代币。持有者自动获得「交易亏损险」保障，在 PancakeSwap 现货交易发生大幅亏损时，可申请链上透明的 BNB 赔付。

- **代币名称**：POWER
- **代币符号**：马到成功
- **区块链**：BNB Smart Chain (BEP-20)
- **总供应量**：1,000,000,000 (10亿)

## 🛡️ 保险机制

| 参数 | 默认值 | 说明 |
|------|--------|------|
| 投保门槛 | ≥ 10,000 POWER | 持币即投保 |
| 等待期 | 7 天 | 防止逆向选择 |
| 免赔额 | 亏损 ≥ 20% | 过滤正常波动 |
| 赔付比例 | 亏损额 30% | 例如亏1BNB赔0.3BNB |
| 单次上限 | 0.5 BNB | 控制单次风险 |
| 赔付冷却 | 30 天/次 | 防止频繁申请 |
| 保障范围 | PancakeSwap 现货 | 链上可验证交易 |

**赔付公式**：`赔付额 = min(亏损额 × 30%, 0.5 BNB, 保险池余额)`

## 💰 保险池资金

- 交易税的 **70%** 自动注入保险池（买入3% / 卖出5%）
- 剩余 **30%** 进入国库（开发/营销/运营）
- 保险池余额链上实时可查，专款专用
- 项目方可从国库向保险池充值

## 🔒 风控与防撸羊毛

1. **等待期**：投保后 7 天才能赔付，防止「先亏后买」
2. **免赔额**：20% 免赔，过滤正常波动的小亏损
3. **交易哈希验证**：每笔赔付需唯一交易哈希，不能重复赔付
4. **赔付冷却期**：30 天内只能赔付一次
5. **单次上限**：0.5 BNB 上限控制风险
6. **人工审核**：v1.0 所有申请需项目方审核交易真实性
7. **持仓维持**：保单生效后需持续持有最低数量代币

## 🌐 前端页面

- **首页**：`docs/index.html` — 项目介绍与入口
- **亏损险**：`docs/insurance.html` — 保险产品页（投保/申请赔付/保单查询）
- **白皮书**：`docs/whitepaper.html` — 完整项目白皮书
- **开发者控制台**：`docs/developer.html` — 合约管理与赔付审核

GitHub Pages 部署在 `docs/` 目录。

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 复制环境变量
cp .env.example .env
# 编辑 .env，填入 DEPLOYER_PRIVATE_KEY 等

# 编译合约
npm run compile
```

## 📦 部署

```bash
# 测试网部署
npm run deploy:bsc:testnet

# 主网部署
npm run deploy:bsc:mainnet

# 主网部署 + 自动同步前端配置
npm run deploy:bsc:mainnet:sync
```

部署参数可通过环境变量配置：
- `TREASURY_ADDRESS`：国库地址（默认部署者地址）
- `BUY_TAX_BPS`：买入税率（默认 300 = 3%）
- `SELL_TAX_BPS`：卖出税率（默认 500 = 5%）

## ✅ 合约验证 (BscScan)

```bash
# 在 .env 中设置 CONTRACT_ADDRESS 和 BSCSCAN_API_KEY
npm run verify:bsc:testnet   # 测试网
npm run verify:bsc:mainnet   # 主网
```

## 📂 项目结构

```
OPENCLAW/
├── contracts/
│   └── OPENCLAW.sol          # 核心合约（代币+保险机制）
├── docs/                      # GitHub Pages 前端
│   ├── index.html             # 首页
│   ├── insurance.html         # 亏损险产品页
│   ├── insurance.js           # 保险页交互逻辑
│   ├── whitepaper.html        # 白皮书
│   ├── developer.html         # 开发者控制台
│   ├── developer.js           # 控制台逻辑
│   ├── developer.css          # 控制台样式
│   ├── config.js              # 网络配置
│   └── assets/                # 静态资源
├── scripts/
│   ├── deploy.js              # 部署脚本
│   └── deploy-mainnet-and-sync.js  # 主网部署+同步前端
├── hardhat.config.js          # Hardhat 配置
├── package.json               # 依赖配置
├── .env.example               # 环境变量模板
├── README.md                  # 项目说明
└── MAINNET_LAUNCH.md          # 主网上线清单
```

## ⚠️ 风险提示

- 智能合约虽经审计，但仍可能存在未知漏洞
- 保险池余额有限，极端情况下赔付可能不足或延迟
- POWER 代币价格可能剧烈波动
- v1.0 赔付需人工审核，存在中心化风险
- 加密货币交易具有高风险性，可能导致全部本金损失
- 本项目不构成投资建议，不保证一定获得赔付

## 📄 许可证

MIT License
