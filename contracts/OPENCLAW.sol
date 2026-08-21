// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
interface IUniswapV2Factory {
    function createPair(address tokenA, address tokenB) external returns (address pair);
}
interface IUniswapV2Router02 {
    function factory() external pure returns (address);
    function WETH() external pure returns (address);
    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external;
}
contract OPENCLAW is ERC20, Ownable {
    uint256 public constant MAX_TAX_BPS = 1000;
    uint256 public constant MAX_SWAP_SLIPPAGE_BPS = 2000;
    uint256 public buyTaxBps;
    uint256 public sellTaxBps;
    uint256 public swapTokensAtAmount;
    uint256 public swapSlippageToleranceBps;
    address public treasury;
    IUniswapV2Router02 public immutable router;
    address public immutable pair;
    mapping(address => bool) public isExcludedFromFee;
    mapping(address => bool) public automatedMarketMakerPairs;
    bool private inSwap;
    uint256 public insurancePool;
    uint256 public insuranceShareBps;
    uint256 public minHoldForInsurance;
    uint256 public waitingPeriod;
    uint256 public deductibleBps;
    uint256 public payoutRatioBps;
    uint256 public maxPayoutPerClaim;
    uint256 public claimCooldown;
    enum ClaimStatus { Pending, Approved, Rejected, Paid }
    struct Policy {
        address holder;
        uint256 startTime;
        bool active;
        uint256 totalPayout;
        uint256 lastClaimTime;
    }
    struct Claim {
        uint256 id;
        address claimant;
        bytes32 txHash;
        uint256 claimedLoss;
        uint256 payoutAmount;
        uint256 submitTime;
        ClaimStatus status;
        address reviewer;
        string rejectReason;
    }
    uint256 public totalClaims;
    mapping(address => Policy) public policies;
    mapping(uint256 => Claim) public claims;
    mapping(bytes32 => bool) public usedTxHashes;
    event TaxesUpdated(uint256 buyTaxBps, uint256 sellTaxBps);
    event TreasuryUpdated(address indexed treasury);
    event ExcludedFromFee(address indexed account, bool isExcluded);
    event AMMPairUpdated(address indexed pair, bool isAMM);
    event SwapAndSendToTreasury(uint256 tokenAmount, uint256 bnbAmount);
    event SwapSlippageUpdated(uint256 newSlippageBps);
    event StuckBNBWithdrawn(uint256 amount);
    event InsurancePurchased(address indexed holder, uint256 startTime);
    event ClaimSubmitted(uint256 indexed claimId, address indexed claimant, bytes32 txHash, uint256 claimedLoss);
    event ClaimApproved(uint256 indexed claimId, address indexed reviewer, uint256 payoutAmount);
    event ClaimRejected(uint256 indexed claimId, address indexed reviewer, string reason);
    event ClaimPaid(uint256 indexed claimId, address indexed claimant, uint256 amount);
    event InsurancePoolFunded(uint256 amount);
    event InsuranceParamsUpdated();
    modifier lockSwap() {
        inSwap = true;
        _;
        inSwap = false;
    }
    constructor(
        address routerAddress,
        address treasuryAddress,
        uint256 initialBuyTaxBps,
        uint256 initialSellTaxBps
    ) ERC20('InsurFi', 'INSUR') Ownable(msg.sender) {
        require(routerAddress != address(0), 'router=0');
        require(treasuryAddress != address(0), 'treasury=0');
        require(initialBuyTaxBps <= MAX_TAX_BPS, 'buy tax too high');
        require(initialSellTaxBps <= MAX_TAX_BPS, 'sell tax too high');
        router = IUniswapV2Router02(routerAddress);
        treasury = treasuryAddress;
        buyTaxBps = initialBuyTaxBps;
        sellTaxBps = initialSellTaxBps;
        swapSlippageToleranceBps = 1000;
        insuranceShareBps = 7000;
        minHoldForInsurance = 10_000 * 10 ** decimals();
        waitingPeriod = 7 days;
        deductibleBps = 2000;
        payoutRatioBps = 3000;
        maxPayoutPerClaim = 0.5 ether;
        claimCooldown = 30 days;
        address createdPair = IUniswapV2Factory(router.factory()).createPair(address(this), router.WETH());
        pair = createdPair;
        automatedMarketMakerPairs[createdPair] = true;
        isExcludedFromFee[msg.sender] = true;
        isExcludedFromFee[address(this)] = true;
        isExcludedFromFee[treasuryAddress] = true;
        uint256 totalSupplyAmount = 1_000_000_000 * 10 ** decimals();
        swapTokensAtAmount = totalSupplyAmount / 10_000;
        _mint(msg.sender, totalSupplyAmount);
    }
    receive() external payable {}
    function setTaxes(uint256 newBuyTaxBps, uint256 newSellTaxBps) external onlyOwner {
        require(newBuyTaxBps <= MAX_TAX_BPS, 'buy tax too high');
        require(newSellTaxBps <= MAX_TAX_BPS, 'sell tax too high');
        buyTaxBps = newBuyTaxBps;
        sellTaxBps = newSellTaxBps;
        emit TaxesUpdated(newBuyTaxBps, newSellTaxBps);
    }
    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), 'treasury=0');
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }
    function setExcludedFromFee(address account, bool excluded) external onlyOwner {
        isExcludedFromFee[account] = excluded;
        emit ExcludedFromFee(account, excluded);
    }
    function setAutomatedMarketMakerPair(address ammPair, bool isAMM) external onlyOwner {
        require(ammPair != pair, 'cannot remove default pair');
        automatedMarketMakerPairs[ammPair] = isAMM;
        emit AMMPairUpdated(ammPair, isAMM);
    }
    function setSwapTokensAtAmount(uint256 amount) external onlyOwner {
        require(amount > 0, 'amount=0');
        swapTokensAtAmount = amount;
    }
    function setSwapSlippageTolerance(uint256 newSlippageBps) external onlyOwner {
        require(newSlippageBps <= MAX_SWAP_SLIPPAGE_BPS, 'slippage too high');
        require(newSlippageBps > 0, 'slippage=0');
        swapSlippageToleranceBps = newSlippageBps;
        emit SwapSlippageUpdated(newSlippageBps);
    }
    function withdrawStuckBNB() external onlyOwner {
        uint256 balance = address(this).balance - insurancePool;
        require(balance > 0, 'no BNB to withdraw');
        payable(treasury).transfer(balance);
        emit StuckBNBWithdrawn(balance);
    }
    function setInsuranceParams(
        uint256 newInsuranceShareBps,
        uint256 newMinHold,
        uint256 newWaitingPeriod,
        uint256 newDeductibleBps,
        uint256 newPayoutRatioBps,
        uint256 newMaxPayout,
        uint256 newCooldown
    ) external onlyOwner {
        require(newInsuranceShareBps <= 10000, 'share too high');
        require(newPayoutRatioBps <= 10000, 'payout ratio too high');
        insuranceShareBps = newInsuranceShareBps;
        minHoldForInsurance = newMinHold;
        waitingPeriod = newWaitingPeriod;
        deductibleBps = newDeductibleBps;
        payoutRatioBps = newPayoutRatioBps;
        maxPayoutPerClaim = newMaxPayout;
        claimCooldown = newCooldown;
        emit InsuranceParamsUpdated();
    }
    function fundInsurancePool() external payable onlyOwner {
        require(msg.value > 0, 'amount=0');
        insurancePool += msg.value;
        emit InsurancePoolFunded(msg.value);
    }
    function purchaseInsurance() external {
        require(balanceOf(msg.sender) >= minHoldForInsurance, '持仓不足，无法投保');
        Policy storage p = policies[msg.sender];
        if (!p.active) {
            p.holder = msg.sender;
            p.startTime = block.timestamp + waitingPeriod;
            p.active = true;
            p.totalPayout = 0;
            p.lastClaimTime = 0;
            emit InsurancePurchased(msg.sender, p.startTime);
        }
    }
    function isInsured(address account) public view returns (bool) {
        Policy storage p = policies[account];
        if (!p.active) return false;
        if (balanceOf(account) < minHoldForInsurance) return false;
        if (block.timestamp < p.startTime) return false;
        return true;
    }
    function submitClaim(bytes32 txHash, uint256 claimedLoss) external {
        require(isInsured(msg.sender), '未投保或保单未生效');
        require(!usedTxHashes[txHash], '该交易已申请过赔付');
        require(claimedLoss > 0, '亏损额不能为0');
        Policy storage p = policies[msg.sender];
        if (p.lastClaimTime > 0) {
            require(block.timestamp >= p.lastClaimTime + claimCooldown, '赔付冷却期内，请稍后再试');
        }
        uint256 claimId = totalClaims++;
        claims[claimId] = Claim({
            id: claimId,
            claimant: msg.sender,
            txHash: txHash,
            claimedLoss: claimedLoss,
            payoutAmount: 0,
            submitTime: block.timestamp,
            status: ClaimStatus.Pending,
            reviewer: address(0),
            rejectReason: ''
        });
        usedTxHashes[txHash] = true;
        emit ClaimSubmitted(claimId, msg.sender, txHash, claimedLoss);
    }
    function approveClaim(uint256 claimId, uint256 payoutAmount) external onlyOwner {
        Claim storage c = claims[claimId];
        require(c.status == ClaimStatus.Pending, '申请状态不正确');
        require(payoutAmount <= maxPayoutPerClaim, '超过单次赔付上限');
        require(payoutAmount <= insurancePool, '保险池余额不足');
        c.status = ClaimStatus.Approved;
        c.payoutAmount = payoutAmount;
        c.reviewer = msg.sender;
        emit ClaimApproved(claimId, msg.sender, payoutAmount);
    }
    function rejectClaim(uint256 claimId, string calldata reason) external onlyOwner {
        Claim storage c = claims[claimId];
        require(c.status == ClaimStatus.Pending, '申请状态不正确');
        c.status = ClaimStatus.Rejected;
        c.reviewer = msg.sender;
        c.rejectReason = reason;
        usedTxHashes[c.txHash] = false;
        emit ClaimRejected(claimId, msg.sender, reason);
    }
    function payoutClaim(uint256 claimId) external onlyOwner {
        Claim storage c = claims[claimId];
        require(c.status == ClaimStatus.Approved, '申请未通过审核');
        require(c.payoutAmount <= insurancePool, '保险池余额不足');
        c.status = ClaimStatus.Paid;
        insurancePool -= c.payoutAmount;
        Policy storage p = policies[c.claimant];
        p.totalPayout += c.payoutAmount;
        p.lastClaimTime = block.timestamp;
        payable(c.claimant).transfer(c.payoutAmount);
        emit ClaimPaid(claimId, c.claimant, c.payoutAmount);
    }
    function calculatePayout(uint256 lossAmount) external view returns (uint256) {
        uint256 payout = (lossAmount * payoutRatioBps) / 10_000;
        if (payout > maxPayoutPerClaim) payout = maxPayoutPerClaim;
        if (payout > insurancePool) payout = insurancePool;
        return payout;
    }
    function getPolicy(address account) external view returns (
        address holder, uint256 startTime, bool active, uint256 totalPayout, uint256 lastClaimTime, bool currentlyInsured
    ) {
        Policy storage p = policies[account];
        return (p.holder, p.startTime, p.active, p.totalPayout, p.lastClaimTime, isInsured(account));
    }
    function getClaim(uint256 claimId) external view returns (
        address claimant, bytes32 txHash, uint256 claimedLoss, uint256 payoutAmount, uint256 submitTime, ClaimStatus status, address reviewer, string memory rejectReason
    ) {
        Claim storage c = claims[claimId];
        return (c.claimant, c.txHash, c.claimedLoss, c.payoutAmount, c.submitTime, c.status, c.reviewer, c.rejectReason);
    }
    function _update(address from, address to, uint256 amount) internal override {
        if (amount == 0) { super._update(from, to, 0); return; }
        if (from == address(0) || to == address(0) || isExcludedFromFee[from] || isExcludedFromFee[to]) {
            super._update(from, to, amount); return;
        }
        uint256 contractTokenBalance = balanceOf(address(this));
        bool canSwap = contractTokenBalance >= swapTokensAtAmount;
        if (canSwap && !inSwap && automatedMarketMakerPairs[to]) {
            _swapAndSendToTreasury(contractTokenBalance);
        }
        uint256 feeAmount = 0;
        if (automatedMarketMakerPairs[from] && buyTaxBps > 0) {
            feeAmount = (amount * buyTaxBps) / 10_000;
        } else if (automatedMarketMakerPairs[to] && sellTaxBps > 0) {
            feeAmount = (amount * sellTaxBps) / 10_000;
        }
        if (feeAmount > 0) {
            super._update(from, address(this), feeAmount);
            amount -= feeAmount;
        }
        super._update(from, to, amount);
    }
    function _getMinOutput(uint256 tokenAmount) private view returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = address(this); path[1] = router.WETH();
        try router.getAmountsOut(tokenAmount, path) returns (uint[] memory amounts) {
            return (amounts[1] * (10_000 - swapSlippageToleranceBps)) / 10_000;
        } catch { return 0; }
    }
    function _swapAndSendToTreasury(uint256 tokenAmount) private lockSwap {
        if (tokenAmount == 0 || treasury == address(0)) return;
        address[] memory path = new address[](2);
        path[0] = address(this); path[1] = router.WETH();
        _approve(address(this), address(router), tokenAmount);
        uint256 bnbBefore = address(this).balance;
        uint256 amountOutMin = _getMinOutput(tokenAmount);
        router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokenAmount, amountOutMin, path, address(this), block.timestamp
        );
        uint256 gained = address(this).balance - bnbBefore;
        if (gained > 0) {
            uint256 toInsurance = (gained * insuranceShareBps) / 10_000;
            uint256 toTreasury = gained - toInsurance;
            insurancePool += toInsurance;
            if (toTreasury > 0) { payable(treasury).transfer(toTreasury); }
            emit SwapAndSendToTreasury(tokenAmount, gained);
        }
    }
}