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

    bytes32 internal constant MARKET_ID = keccak256("ETH_ABOVE_5000");
    uint64 internal endTime;

    function setUp() external {
        oddsX = new OddsX(admin, 150);
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

    function testZeroStakeWinningOutcomeCannotResolve() external {
        _approveAndBet(alice, 0, 100 ether);

        vm.warp(endTime);
        vm.prank(oracle);
        vm.expectRevert();
        oddsX.resolveMarket(MARKET_ID, 1);
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

    function _approveAndBet(address user, uint32 outcome, uint256 amount) internal {
        vm.startPrank(user);
        token.approve(address(oddsX), amount);
        oddsX.placeBet(MARKET_ID, outcome, amount);
        vm.stopPrank();
    }
}
