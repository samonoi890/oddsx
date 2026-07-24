// SPDX-License-Identifier: MIT
// packages/contracts/src/OddsX.sol
pragma solidity 0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IOddsX} from "./interfaces/IOddsX.sol";

contract OddsX is IOddsX, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public constant NATIVE_ASSET = address(0);
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint16 public constant MAX_PROTOCOL_FEE_BPS = 1_000;
    uint32 public constant MAX_OUTCOMES = 256;

    bytes32 public constant MARKET_CREATOR_ROLE = keccak256("MARKET_CREATOR_ROLE");
    bytes32 public constant RESOLVER_ROLE = keccak256("RESOLVER_ROLE");
    bytes32 public constant CANCELLER_ROLE = keccak256("CANCELLER_ROLE");
    bytes32 public constant FEE_MANAGER_ROLE = keccak256("FEE_MANAGER_ROLE");

    uint16 public defaultProtocolFeeBps;

    mapping(bytes32 marketId => Market market) private markets;
    mapping(bytes32 marketId => mapping(uint32 outcome => uint256 pool)) private outcomePools;
    mapping(bytes32 marketId => mapping(address user => mapping(uint32 outcome => uint256 stake))) private stakes;
    mapping(bytes32 marketId => mapping(address user => bool claimed)) private rewardClaimed;
    mapping(address asset => uint256 fees) public accruedProtocolFees;

    event DefaultProtocolFeeUpdated(uint16 previousFeeBps, uint16 newFeeBps);
    event ProtocolFeesWithdrawn(address indexed asset, address indexed recipient, uint256 amount);

    error ZeroAddress();
    error EmptyMarketId();
    error EmptyDescription();
    error MarketAlreadyExists(bytes32 marketId);
    error MarketDoesNotExist(bytes32 marketId);
    error InvalidEndTime(uint256 suppliedEndTime, uint256 currentTime);
    error InvalidOutcomeCount(uint32 suppliedCount);
    error InvalidOutcome(uint32 outcome, uint32 outcomesCount);
    error InvalidFeeBps(uint256 suppliedFeeBps);
    error InvalidAmount();
    error InvalidNativeAmount(uint256 expected, uint256 received);
    error NativeCurrencyNotAccepted();
    error MarketNotOpen(bytes32 marketId, MarketState currentState);
    error MarketNotResolved(bytes32 marketId, MarketState currentState);
    error MarketNotCancelled(bytes32 marketId, MarketState currentState);
    error BettingPeriodEnded(bytes32 marketId, uint256 endTime, uint256 currentTime);
    error ResolutionTooEarly(bytes32 marketId, uint256 endTime, uint256 currentTime);
    error UnauthorizedResolver(address caller);
    error WinningOutcomeHasNoStake(bytes32 marketId, uint32 winningOutcome);
    error NoWinningStake(bytes32 marketId, address user);
    error RewardAlreadyClaimed(bytes32 marketId, address user);
    error NoRefundAvailable(bytes32 marketId, address user, uint32 outcome);
    error UnsupportedTokenBehavior(address token, uint256 expectedAmount, uint256 receivedAmount);
    error AssetTransferFailed(address recipient, uint256 amount);
    error InsufficientAccruedFees(address asset, uint256 requested, uint256 available);
    error DirectNativeTransferNotAllowed();

    constructor(address initialAdmin, uint16 initialFeeBps) {
        if (initialAdmin == address(0)) revert ZeroAddress();
        if (initialFeeBps > MAX_PROTOCOL_FEE_BPS) revert InvalidFeeBps(initialFeeBps);

        defaultProtocolFeeBps = initialFeeBps;
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(MARKET_CREATOR_ROLE, initialAdmin);
        _grantRole(RESOLVER_ROLE, initialAdmin);
        _grantRole(CANCELLER_ROLE, initialAdmin);
        _grantRole(FEE_MANAGER_ROLE, initialAdmin);
    }

    function createMarket(
        bytes32 marketId,
        string calldata description,
        uint64 endTime,
        uint32 outcomesCount,
        address oracleAddress,
        address asset
    ) external onlyRole(MARKET_CREATOR_ROLE) {
        if (marketId == bytes32(0)) revert EmptyMarketId();
        if (markets[marketId].state != MarketState.None) revert MarketAlreadyExists(marketId);
        if (bytes(description).length == 0) revert EmptyDescription();
        if (endTime <= block.timestamp) revert InvalidEndTime(endTime, block.timestamp);
        if (outcomesCount < 2 || outcomesCount > MAX_OUTCOMES) revert InvalidOutcomeCount(outcomesCount);
        if (oracleAddress == address(0)) revert ZeroAddress();

        uint16 marketFeeBps = defaultProtocolFeeBps;
        Market storage market = markets[marketId];
        market.asset = asset;
        market.endTime = endTime;
        market.outcomesCount = outcomesCount;
        market.feeBps = marketFeeBps;
        market.state = MarketState.Open;
        market.oracle = oracleAddress;
        market.description = description;

        emit MarketCreated(
            marketId, msg.sender, oracleAddress, asset, endTime, outcomesCount, marketFeeBps, description
        );
    }

    function placeBet(bytes32 marketId, uint32 outcome, uint256 amount) external payable nonReentrant {
        Market storage market = _getExistingMarket(marketId);
        if (market.state != MarketState.Open) revert MarketNotOpen(marketId, market.state);
        if (block.timestamp >= market.endTime) {
            revert BettingPeriodEnded(marketId, market.endTime, block.timestamp);
        }
        if (outcome >= market.outcomesCount) revert InvalidOutcome(outcome, market.outcomesCount);
        if (amount == 0) revert InvalidAmount();

        _collectStake(market.asset, msg.sender, amount);

        uint256 updatedUserStake = stakes[marketId][msg.sender][outcome] + amount;
        uint256 updatedOutcomePool = outcomePools[marketId][outcome] + amount;
        uint256 updatedMarketPool = market.totalPool + amount;

        stakes[marketId][msg.sender][outcome] = updatedUserStake;
        outcomePools[marketId][outcome] = updatedOutcomePool;
        market.totalPool = updatedMarketPool;

        emit BetPlaced(marketId, msg.sender, outcome, amount, updatedUserStake, updatedOutcomePool, updatedMarketPool);
    }

    function resolveMarket(bytes32 marketId, uint32 winningOutcome) external {
        Market storage market = _getExistingMarket(marketId);
        if (market.state != MarketState.Open) revert MarketNotOpen(marketId, market.state);
        if (block.timestamp < market.endTime) {
            revert ResolutionTooEarly(marketId, market.endTime, block.timestamp);
        }
        if (msg.sender != market.oracle && !hasRole(RESOLVER_ROLE, msg.sender)) {
            revert UnauthorizedResolver(msg.sender);
        }
        if (winningOutcome >= market.outcomesCount) {
            revert InvalidOutcome(winningOutcome, market.outcomesCount);
        }

        uint256 winningPool = outcomePools[marketId][winningOutcome];
        if (winningPool == 0) revert WinningOutcomeHasNoStake(marketId, winningOutcome);

        uint256 protocolFee = Math.mulDiv(market.totalPool, market.feeBps, BPS_DENOMINATOR);
        uint256 distributablePool = market.totalPool - protocolFee;

        market.state = MarketState.Resolved;
        market.winningOutcome = winningOutcome;
        market.winningPool = winningPool;
        market.distributablePool = distributablePool;
        market.protocolFee = protocolFee;
        accruedProtocolFees[market.asset] += protocolFee;

        emit MarketResolved(
            marketId, winningOutcome, msg.sender, market.totalPool, winningPool, distributablePool, protocolFee
        );
    }

    function claimReward(bytes32 marketId) external nonReentrant returns (uint256 reward) {
        Market storage market = _getExistingMarket(marketId);
        if (market.state != MarketState.Resolved) revert MarketNotResolved(marketId, market.state);
        if (rewardClaimed[marketId][msg.sender]) revert RewardAlreadyClaimed(marketId, msg.sender);

        uint32 winningOutcome = market.winningOutcome;
        uint256 winningStake = stakes[marketId][msg.sender][winningOutcome];
        if (winningStake == 0) revert NoWinningStake(marketId, msg.sender);

        reward = Math.mulDiv(winningStake, market.distributablePool, market.winningPool);

        rewardClaimed[marketId][msg.sender] = true;
        stakes[marketId][msg.sender][winningOutcome] = 0;
        _transferAsset(market.asset, msg.sender, reward);

        emit RewardClaimed(marketId, msg.sender, winningOutcome, winningStake, reward);
    }

    function cancelMarket(bytes32 marketId, bytes32 reason) external onlyRole(CANCELLER_ROLE) {
        Market storage market = _getExistingMarket(marketId);
        if (market.state != MarketState.Open) revert MarketNotOpen(marketId, market.state);

        market.state = MarketState.Cancelled;
        emit MarketCancelled(marketId, msg.sender, reason);
    }

    function emergencyRefund(bytes32 marketId, uint32 outcome) external nonReentrant returns (uint256 refundAmount) {
        Market storage market = _getExistingMarket(marketId);
        if (market.state != MarketState.Cancelled) revert MarketNotCancelled(marketId, market.state);
        if (outcome >= market.outcomesCount) revert InvalidOutcome(outcome, market.outcomesCount);

        refundAmount = stakes[marketId][msg.sender][outcome];
        if (refundAmount == 0) revert NoRefundAvailable(marketId, msg.sender, outcome);

        stakes[marketId][msg.sender][outcome] = 0;
        outcomePools[marketId][outcome] -= refundAmount;
        market.totalPool -= refundAmount;
        _transferAsset(market.asset, msg.sender, refundAmount);

        emit EmergencyRefundClaimed(marketId, msg.sender, outcome, refundAmount);
    }

    function setDefaultProtocolFee(uint16 newFeeBps) external onlyRole(FEE_MANAGER_ROLE) {
        if (newFeeBps > MAX_PROTOCOL_FEE_BPS) revert InvalidFeeBps(newFeeBps);

        uint16 previousFeeBps = defaultProtocolFeeBps;
        defaultProtocolFeeBps = newFeeBps;
        emit DefaultProtocolFeeUpdated(previousFeeBps, newFeeBps);
    }

    function withdrawProtocolFees(address asset, address recipient, uint256 amount)
        external
        onlyRole(FEE_MANAGER_ROLE)
        nonReentrant
    {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();

        uint256 available = accruedProtocolFees[asset];
        if (amount > available) revert InsufficientAccruedFees(asset, amount, available);

        accruedProtocolFees[asset] = available - amount;
        _transferAsset(asset, recipient, amount);
        emit ProtocolFeesWithdrawn(asset, recipient, amount);
    }

    function getMarket(bytes32 marketId) external view returns (Market memory market) {
        market = _getExistingMarket(marketId);
    }

    function getOutcomePool(bytes32 marketId, uint32 outcome) external view returns (uint256 pool) {
        Market storage market = _getExistingMarket(marketId);
        if (outcome >= market.outcomesCount) revert InvalidOutcome(outcome, market.outcomesCount);
        pool = outcomePools[marketId][outcome];
    }

    function getUserStake(bytes32 marketId, address user, uint32 outcome) external view returns (uint256 stake) {
        Market storage market = _getExistingMarket(marketId);
        if (outcome >= market.outcomesCount) revert InvalidOutcome(outcome, market.outcomesCount);
        stake = stakes[marketId][user][outcome];
    }

    function hasClaimedReward(bytes32 marketId, address user) external view returns (bool) {
        _getExistingMarket(marketId);
        return rewardClaimed[marketId][user];
    }

    function previewReward(bytes32 marketId, address user) external view returns (uint256 reward) {
        Market storage market = _getExistingMarket(marketId);
        if (market.state != MarketState.Resolved || rewardClaimed[marketId][user]) return 0;

        uint256 winningStake = stakes[marketId][user][market.winningOutcome];
        if (winningStake == 0) return 0;

        reward = Math.mulDiv(winningStake, market.distributablePool, market.winningPool);
    }

    function isBettingOpen(bytes32 marketId) external view returns (bool) {
        Market storage market = _getExistingMarket(marketId);
        return market.state == MarketState.Open && block.timestamp < market.endTime;
    }

    function _getExistingMarket(bytes32 marketId) internal view returns (Market storage market) {
        market = markets[marketId];
        if (market.state == MarketState.None) revert MarketDoesNotExist(marketId);
    }

    function _collectStake(address asset, address from, uint256 amount) internal {
        if (asset == NATIVE_ASSET) {
            if (msg.value != amount) revert InvalidNativeAmount(amount, msg.value);
            return;
        }
        if (msg.value != 0) revert NativeCurrencyNotAccepted();

        IERC20 token = IERC20(asset);
        uint256 balanceBefore = token.balanceOf(address(this));
        token.safeTransferFrom(from, address(this), amount);
        uint256 receivedAmount = token.balanceOf(address(this)) - balanceBefore;

        if (receivedAmount != amount) {
            revert UnsupportedTokenBehavior(asset, amount, receivedAmount);
        }
    }

    function _transferAsset(address asset, address recipient, uint256 amount) internal {
        if (amount == 0) return;

        if (asset == NATIVE_ASSET) {
            (bool success,) = payable(recipient).call{value: amount}("");
            if (!success) revert AssetTransferFailed(recipient, amount);
            return;
        }

        IERC20(asset).safeTransfer(recipient, amount);
    }

    receive() external payable {
        revert DirectNativeTransferNotAllowed();
    }

    fallback() external payable {
        revert DirectNativeTransferNotAllowed();
    }
}
