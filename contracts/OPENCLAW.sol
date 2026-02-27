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
    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external;
}

contract OPENCLAW is ERC20, Ownable {
    uint256 public constant MAX_TAX_BPS = 1000; // 10%
    uint256 public buyTaxBps;
    uint256 public sellTaxBps;
    uint256 public swapTokensAtAmount;

    address public treasury;
    IUniswapV2Router02 public immutable router;
    address public immutable pair;

    mapping(address => bool) public isExcludedFromFee;
    mapping(address => bool) public automatedMarketMakerPairs;

    bool private inSwap;

    event TaxesUpdated(uint256 buyTaxBps, uint256 sellTaxBps);
    event TreasuryUpdated(address indexed treasury);
    event ExcludedFromFee(address indexed account, bool isExcluded);
    event AMMPairUpdated(address indexed pair, bool isAMM);
    event SwapAndSendToTreasury(uint256 tokenAmount, uint256 bnbAmount);

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
    ) ERC20('POWER', unicode'马到成功') Ownable(msg.sender) {
        require(routerAddress != address(0), 'router=0');
        require(treasuryAddress != address(0), 'treasury=0');
        require(initialBuyTaxBps <= MAX_TAX_BPS, 'buy tax too high');
        require(initialSellTaxBps <= MAX_TAX_BPS, 'sell tax too high');

        router = IUniswapV2Router02(routerAddress);
        treasury = treasuryAddress;
        buyTaxBps = initialBuyTaxBps;
        sellTaxBps = initialSellTaxBps;

        address createdPair = IUniswapV2Factory(router.factory()).createPair(address(this), router.WETH());
        pair = createdPair;
        automatedMarketMakerPairs[createdPair] = true;

        isExcludedFromFee[msg.sender] = true;
        isExcludedFromFee[address(this)] = true;
        isExcludedFromFee[treasuryAddress] = true;

        uint256 totalSupplyAmount = 1_000_000_000 * 10 ** decimals();
        swapTokensAtAmount = totalSupplyAmount / 10_000; // 0.01%
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

    function _update(address from, address to, uint256 amount) internal override {
        if (amount == 0) {
            super._update(from, to, 0);
            return;
        }

        // Mint/burn or excluded addresses bypass fee.
        if (from == address(0) || to == address(0) || isExcludedFromFee[from] || isExcludedFromFee[to]) {
            super._update(from, to, amount);
            return;
        }

        // Swap back only on sell path to keep gas lower.
        uint256 contractTokenBalance = balanceOf(address(this));
        bool canSwap = contractTokenBalance >= swapTokensAtAmount;
        if (canSwap && !inSwap && automatedMarketMakerPairs[to]) {
            _swapAndSendToTreasury(contractTokenBalance);
        }

        uint256 feeAmount = 0;
        if (automatedMarketMakerPairs[from] && buyTaxBps > 0) {
            // Buy
            feeAmount = (amount * buyTaxBps) / 10_000;
        } else if (automatedMarketMakerPairs[to] && sellTaxBps > 0) {
            // Sell
            feeAmount = (amount * sellTaxBps) / 10_000;
        }

        if (feeAmount > 0) {
            super._update(from, address(this), feeAmount);
            amount -= feeAmount;
        }

        super._update(from, to, amount);
    }

    function _swapAndSendToTreasury(uint256 tokenAmount) private lockSwap {
        if (tokenAmount == 0 || treasury == address(0)) return;

        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = router.WETH();

        _approve(address(this), address(router), tokenAmount);
        uint256 bnbBefore = address(this).balance;
        router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokenAmount,
            0,
            path,
            address(this),
            block.timestamp
        );
        uint256 gained = address(this).balance - bnbBefore;
        if (gained > 0) {
            payable(treasury).transfer(gained);
            emit SwapAndSendToTreasury(tokenAmount, gained);
        }
    }
}
