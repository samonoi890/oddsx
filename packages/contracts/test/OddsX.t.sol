// SPDX-License-Identifier: MIT
// packages/contracts/test/OddsX.t.sol
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {OddsX} from "../src/OddsX.sol";
import {IOddsX} from "../src/interfaces/IOddsX.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

contract OddsXTest is Test {
    OddsX internal oddsX;
    MockERC20 internal token;

    address internal admin = makeAddr("admin");
    address internal oracle = makeAddr("oracle");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal treasury = makeAddr("treasury");

    bytes32 internal constant MARKET_ID = keccak256("ETH_ABOVE_5000");
    uint64 internal endTime;

    event MarketCancelled(bytes32 indexed marketId, address indexed cancelledBy, bytes32 indexed reason);
    event MarketCancelledNoWinningStake(
        bytes32 indexed marketId, uint32 indexed reportedWinningOutcome, address indexed resolver, uint256 totalPool
    );

    function setUp() external {
        oddsX = new OddsX(admin, 150, 0);
        token = new MockERC20();
        endTime = uint64(block.timestamp + 1 days);

        token.mint(alice, 1_000 ether);
        token.mint(bob, 1_000 ether);

        vm.prank(admin);
        oddsX.createMarket(MARKET_ID, "Will ETH trade above 5,000 USD at expiry?", endTime, 2, oracle, address(token));
    }

    function testCreateMarketStoresConfiguration() external view {
        IOddsX.Market memory market = oddsX.getMarket(MARKET_ID);

        assertEq(market.asset, address(token));
        assertEq(market.oracle, oracle);
        assertEq(market.endTime, endTime);
        assertEq(market.outcomesCount, 2);
        assertEq(market.feeBps, 150);
        assertEq(uint256(market.state), uint256(IOddsX.MarketState.Open));
        assertEq(oddsX.getMarketResolutionDelay(MARKET_ID), 0);
    }

    function testGetMarketWithPoolsReturnsCoherentSnapshot() external {
        _approveAndBet(alice, 0, 100 ether);
        _approveAndBet(bob, 1, 300 ether);

        (IOddsX.Market memory market, uint256[] memory pools) = oddsX.getMarketWithPools(MARKET_ID);

        assertEq(market.totalPool, 400 ether);
        assertEq(pools.length, 2);
        assertEq(pools[0], 100 ether);
        assertEq(pools[1], 300 ether);
    }

    function testPlaceBetTracksPoolsAndStake() external {
        _approveAndBet(alice, 0, 100 ether);

        assertEq(oddsX.getUserStake(MARKET_ID, alice, 0), 100 ether);
        assertEq(oddsX.getOutcomePool(MARKET_ID, 0), 100 ether);
        assertEq(oddsX.getMarket(MARKET_ID).totalPool, 100 ether);
    }

    function testResolveAndClaimProportionalReward() external {
        _approveAndBet(alice, 0, 100 ether);
        _approveAndBet(bob, 1, 300 ether);

        vm.warp(endTime);
        vm.prank(oracle);
        oddsX.resolveMarket(MARKET_ID, 0);

        uint256 expectedFee = 6 ether;
        uint256 expectedReward = 394 ether;

        assertEq(oddsX.accruedProtocolFees(address(token)), expectedFee);
        assertEq(oddsX.previewReward(MARKET_ID, alice), expectedReward);

        uint256 balanceBefore = token.balanceOf(alice);
        vm.prank(alice);
        oddsX.claimReward(MARKET_ID);

        assertEq(token.balanceOf(alice) - balanceBefore, expectedReward);
    }

    function testCannotResolveBeforeEndTime() external {
        vm.prank(oracle);
        vm.expectRevert();
        oddsX.resolveMarket(MARKET_ID, 0);
    }

    function testZeroStakeWinningOutcomeCancelsAndRefundsEveryone() external {
        _approveAndBet(alice, 0, 100 ether);
        _approveAndBet(bob, 0, 300 ether);

        vm.warp(endTime);
        vm.expectEmit(true, true, true, true, address(oddsX));
        emit MarketCancelled(MARKET_ID, oracle, oddsX.ZERO_WINNING_POOL_REASON());
        vm.expectEmit(true, true, true, true, address(oddsX));
        emit MarketCancelledNoWinningStake(MARKET_ID, 1, oracle, 400 ether);
        vm.prank(oracle);
        oddsX.resolveMarket(MARKET_ID, 1);

        assertEq(uint256(oddsX.getMarket(MARKET_ID).state), uint256(IOddsX.MarketState.Cancelled));
        assertEq(oddsX.accruedProtocolFees(address(token)), 0);

        uint256 aliceBefore = token.balanceOf(alice);
        uint256 bobBefore = token.balanceOf(bob);
        vm.prank(alice);
        oddsX.emergencyRefund(MARKET_ID, 0);
        vm.prank(bob);
        oddsX.emergencyRefund(MARKET_ID, 0);

        assertEq(token.balanceOf(alice) - aliceBefore, 100 ether);
        assertEq(token.balanceOf(bob) - bobBefore, 300 ether);
    }

    function testCancelledMarketRefundsStake() external {
        _approveAndBet(alice, 0, 100 ether);

        vm.prank(admin);
        oddsX.cancelMarket(MARKET_ID, keccak256("ORACLE_FAILURE"));

        uint256 balanceBefore = token.balanceOf(alice);
        vm.prank(alice);
        oddsX.emergencyRefund(MARKET_ID, 0);

        assertEq(token.balanceOf(alice) - balanceBefore, 100 ether);
        assertEq(oddsX.getUserStake(MARKET_ID, alice, 0), 0);
    }

    function testNativeMarketBetAndClaim() external {
        bytes32 nativeMarketId = keccak256("NATIVE_MARKET");
        uint64 nativeEndTime = uint64(block.timestamp + 1 days);

        vm.prank(admin);
        oddsX.createMarket(
            nativeMarketId, "Will the native market resolve to outcome zero?", nativeEndTime, 2, oracle, address(0)
        );

        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);

        vm.prank(alice);
        oddsX.placeBet{value: 1 ether}(nativeMarketId, 0, 1 ether);

        vm.prank(bob);
        oddsX.placeBet{value: 3 ether}(nativeMarketId, 1, 3 ether);

        vm.warp(nativeEndTime);
        vm.prank(oracle);
        oddsX.resolveMarket(nativeMarketId, 0);

        uint256 balanceBefore = alice.balance;
        vm.prank(alice);
        oddsX.claimReward(nativeMarketId);

        assertEq(alice.balance - balanceBefore, 3.94 ether);
    }

    function testUnauthorizedAccountsCannotManageMarkets() external {
        vm.startPrank(alice);
        vm.expectRevert();
        oddsX.createMarket(
            keccak256("UNAUTHORIZED"), "Unauthorized", uint64(block.timestamp + 1 days), 2, alice, address(0)
        );
        vm.expectRevert();
        oddsX.cancelMarket(MARKET_ID, keccak256("NO_AUTHORITY"));
        vm.expectRevert();
        oddsX.setDefaultResolutionDelay(1 hours);
        vm.expectRevert();
        oddsX.withdrawProtocolFees(address(token), treasury, 1);
        vm.stopPrank();
    }

    function testUnauthorizedAccountCannotResolve() external {
        _approveAndBet(alice, 0, 100 ether);
        vm.warp(endTime);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(OddsX.UnauthorizedResolver.selector, bob));
        oddsX.resolveMarket(MARKET_ID, 0);
    }

    function testCannotClaimTwice() external {
        _approveAndBet(alice, 0, 100 ether);
        _approveAndBet(bob, 1, 300 ether);
        vm.warp(endTime);
        vm.prank(oracle);
        oddsX.resolveMarket(MARKET_ID, 0);

        vm.prank(alice);
        oddsX.claimReward(MARKET_ID);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(OddsX.RewardAlreadyClaimed.selector, MARKET_ID, alice));
        oddsX.claimReward(MARKET_ID);
    }

    function testFinalWinnerReceivesRoundingRemainder() external {
        address carol = makeAddr("carol");
        token.mint(carol, 1 ether);
        _approveAndBet(alice, 0, 1 ether);
        _approveAndBet(bob, 0, 1 ether);
        vm.startPrank(carol);
        token.approve(address(oddsX), 1 ether);
        oddsX.placeBet(MARKET_ID, 0, 1 ether);
        vm.stopPrank();

        address loser = makeAddr("loser");
        token.mint(loser, 1 ether);
        vm.startPrank(loser);
        token.approve(address(oddsX), 1 ether);
        oddsX.placeBet(MARKET_ID, 1, 1 ether);
        vm.stopPrank();

        vm.warp(endTime);
        vm.prank(oracle);
        oddsX.resolveMarket(MARKET_ID, 0);

        vm.prank(alice);
        uint256 aliceReward = oddsX.claimReward(MARKET_ID);
        vm.prank(bob);
        uint256 bobReward = oddsX.claimReward(MARKET_ID);
        vm.prank(carol);
        uint256 carolReward = oddsX.claimReward(MARKET_ID);

        IOddsX.Market memory market = oddsX.getMarket(MARKET_ID);
        assertEq(aliceReward + bobReward + carolReward, market.distributablePool);
        assertEq(token.balanceOf(address(oddsX)), market.protocolFee);
    }

    function testFeeManagerCanWithdrawAccruedFees() external {
        _approveAndBet(alice, 0, 100 ether);
        _approveAndBet(bob, 1, 300 ether);
        vm.warp(endTime);
        vm.prank(oracle);
        oddsX.resolveMarket(MARKET_ID, 0);

        uint256 balanceBefore = token.balanceOf(treasury);
        vm.prank(admin);
        oddsX.withdrawProtocolFees(address(token), treasury, 6 ether);

        assertEq(token.balanceOf(treasury) - balanceBefore, 6 ether);
        assertEq(oddsX.accruedProtocolFees(address(token)), 0);
    }

    function testResolutionDelayIsSnapshottedPerMarket() external {
        vm.prank(admin);
        oddsX.setDefaultResolutionDelay(1 hours);

        bytes32 delayedMarketId = keccak256("DELAYED_MARKET");
        uint64 delayedEndTime = uint64(block.timestamp + 1 days);
        vm.prank(admin);
        oddsX.createMarket(delayedMarketId, "Delayed resolution market", delayedEndTime, 2, oracle, address(token));
        assertEq(oddsX.getMarketResolutionDelay(delayedMarketId), 1 hours);
        assertEq(oddsX.getMarketResolutionDelay(MARKET_ID), 0);

        vm.startPrank(alice);
        token.approve(address(oddsX), 100 ether);
        oddsX.placeBet(delayedMarketId, 0, 100 ether);
        vm.stopPrank();

        vm.warp(delayedEndTime);
        vm.prank(oracle);
        vm.expectRevert();
        oddsX.resolveMarket(delayedMarketId, 0);

        vm.warp(uint256(delayedEndTime) + 1 hours);
        vm.prank(oracle);
        oddsX.resolveMarket(delayedMarketId, 0);
        assertEq(uint256(oddsX.getMarket(delayedMarketId).state), uint256(IOddsX.MarketState.Resolved));
    }

    function testResolutionDelayRejectsValueAboveMaximum() external {
        uint64 invalidDelay = oddsX.MAX_RESOLUTION_DELAY() + 1;
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(OddsX.InvalidResolutionDelay.selector, invalidDelay));
        oddsX.setDefaultResolutionDelay(invalidDelay);
    }

    function testBoundedBetRejectsExpiredDeadline() external {
        vm.startPrank(alice);
        token.approve(address(oddsX), 100 ether);
        vm.expectRevert();
        oddsX.placeBetWithBounds(MARKET_ID, 0, 100 ether, 0, uint64(block.timestamp - 1));
        vm.stopPrank();
    }

    function testBoundedBetRejectsRewardBelowMinimum() external {
        vm.startPrank(alice);
        token.approve(address(oddsX), 100 ether);
        vm.expectRevert();
        oddsX.placeBetWithBounds(MARKET_ID, 0, 100 ether, 99 ether, uint64(block.timestamp + 5 minutes));
        vm.stopPrank();
    }

    function testBoundedBetAcceptsSatisfiedMinimum() external {
        vm.startPrank(alice);
        token.approve(address(oddsX), 100 ether);
        oddsX.placeBetWithBounds(MARKET_ID, 0, 100 ether, 98 ether, uint64(block.timestamp + 5 minutes));
        vm.stopPrank();

        assertEq(oddsX.getUserStake(MARKET_ID, alice, 0), 100 ether);
    }

    function testInvalidAndExpiredBetsRevert() external {
        vm.startPrank(alice);
        token.approve(address(oddsX), 100 ether);
        vm.expectRevert(OddsX.InvalidAmount.selector);
        oddsX.placeBet(MARKET_ID, 0, 0);
        vm.expectRevert();
        oddsX.placeBet(MARKET_ID, 2, 1 ether);
        vm.stopPrank();

        vm.warp(endTime);
        vm.prank(alice);
        vm.expectRevert();
        oddsX.placeBet(MARKET_ID, 0, 1 ether);
    }

    function testDuplicateMarketReverts() external {
        vm.prank(admin);
        vm.expectRevert();
        oddsX.createMarket(MARKET_ID, "Duplicate", uint64(block.timestamp + 1 days), 2, oracle, address(token));
    }

    function testCancelledUserCanRefundBothOutcomes() external {
        _approveAndBet(alice, 0, 100 ether);
        _approveAndBet(alice, 1, 50 ether);
        vm.prank(admin);
        oddsX.cancelMarket(MARKET_ID, keccak256("MANUAL_CANCELLATION"));

        uint256 balanceBefore = token.balanceOf(alice);
        vm.startPrank(alice);
        oddsX.emergencyRefund(MARKET_ID, 0);
        oddsX.emergencyRefund(MARKET_ID, 1);
        vm.stopPrank();

        assertEq(token.balanceOf(alice) - balanceBefore, 150 ether);
        assertEq(oddsX.getMarket(MARKET_ID).totalPool, 0);
    }

    function testDirectNativeTransferReverts() external {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        (bool success,) = address(oddsX).call{value: 1 ether}("");
        assertFalse(success);
    }

    function testFuzzWinnerReceivesDistributablePool(uint96 winningStake, uint96 losingStake) external {
        winningStake = uint96(bound(winningStake, 1, 1_000 ether));
        losingStake = uint96(bound(losingStake, 1, 1_000 ether));
        token.mint(alice, winningStake);
        token.mint(bob, losingStake);
        _approveAndBet(alice, 0, winningStake);
        _approveAndBet(bob, 1, losingStake);

        vm.warp(endTime);
        vm.prank(oracle);
        oddsX.resolveMarket(MARKET_ID, 0);

        IOddsX.Market memory market = oddsX.getMarket(MARKET_ID);
        assertEq(oddsX.previewReward(MARKET_ID, alice), market.distributablePool);
        assertEq(market.distributablePool + market.protocolFee, uint256(winningStake) + uint256(losingStake));
    }

    function testFuzzZeroWinnerCancellationRefunds(uint96 aliceStake, uint96 bobStake) external {
        aliceStake = uint96(bound(aliceStake, 1, 1_000 ether));
        bobStake = uint96(bound(bobStake, 1, 1_000 ether));
        token.mint(alice, aliceStake);
        token.mint(bob, bobStake);
        _approveAndBet(alice, 0, aliceStake);
        _approveAndBet(bob, 0, bobStake);

        vm.warp(endTime);
        vm.prank(oracle);
        oddsX.resolveMarket(MARKET_ID, 1);

        uint256 aliceBefore = token.balanceOf(alice);
        uint256 bobBefore = token.balanceOf(bob);
        vm.prank(alice);
        oddsX.emergencyRefund(MARKET_ID, 0);
        vm.prank(bob);
        oddsX.emergencyRefund(MARKET_ID, 0);
        assertEq(token.balanceOf(alice) - aliceBefore, aliceStake);
        assertEq(token.balanceOf(bob) - bobBefore, bobStake);
        assertEq(oddsX.getMarket(MARKET_ID).totalPool, 0);
    }

    function _approveAndBet(address user, uint32 outcome, uint256 amount) internal {
        vm.startPrank(user);
        token.approve(address(oddsX), amount);
        oddsX.placeBet(MARKET_ID, outcome, amount);
        vm.stopPrank();
    }
}
