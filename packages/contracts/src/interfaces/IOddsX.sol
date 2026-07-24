// SPDX-License-Identifier: MIT
// packages/contracts/src/interfaces/IOddsX.sol
pragma solidity 0.8.30;

interface IOddsX {
    enum MarketState {
        None,
        Open,
        Resolved,
        Cancelled
    }

    struct Market {
        address asset;
        uint64 endTime;
        uint32 outcomesCount;
        uint16 feeBps;
        MarketState state;
        address oracle;
        uint32 winningOutcome;
        string description;
        uint256 totalPool;
        uint256 winningPool;
        uint256 distributablePool;
        uint256 protocolFee;
    }

    event MarketCreated(
        bytes32 indexed marketId,
        address indexed creator,
        address indexed oracle,
        address asset,
        uint64 endTime,
        uint32 outcomesCount,
        uint16 feeBps,
        string description
    );

    event BetPlaced(
        bytes32 indexed marketId,
        address indexed bettor,
        uint32 indexed outcome,
        uint256 amount,
        uint256 newUserStake,
        uint256 newOutcomePool,
        uint256 newMarketPool
    );

    event MarketResolved(
        bytes32 indexed marketId,
        uint32 indexed winningOutcome,
        address indexed resolver,
        uint256 totalPool,
        uint256 winningPool,
        uint256 distributablePool,
        uint256 protocolFee
    );

    event MarketCancelled(bytes32 indexed marketId, address indexed cancelledBy, bytes32 indexed reason);

    event RewardClaimed(
        bytes32 indexed marketId,
        address indexed user,
        uint32 indexed winningOutcome,
        uint256 winningStake,
        uint256 reward
    );

    event EmergencyRefundClaimed(
        bytes32 indexed marketId, address indexed user, uint32 indexed outcome, uint256 amount
    );

    function createMarket(
        bytes32 marketId,
        string calldata description,
        uint64 endTime,
        uint32 outcomesCount,
        address oracleAddress,
        address asset
    ) external;

    function placeBet(bytes32 marketId, uint32 outcome, uint256 amount) external payable;

    function resolveMarket(bytes32 marketId, uint32 winningOutcome) external;

    function cancelMarket(bytes32 marketId, bytes32 reason) external;

    function claimReward(bytes32 marketId) external returns (uint256 reward);

    function emergencyRefund(bytes32 marketId, uint32 outcome) external returns (uint256 refundAmount);

    function getMarket(bytes32 marketId) external view returns (Market memory market);

    function getOutcomePool(bytes32 marketId, uint32 outcome) external view returns (uint256 pool);

    function getUserStake(bytes32 marketId, address user, uint32 outcome) external view returns (uint256 stake);

    function previewReward(bytes32 marketId, address user) external view returns (uint256 reward);
}
