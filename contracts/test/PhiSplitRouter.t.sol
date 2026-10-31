// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Omega Platform — Creator: David Charles Bourassa, Quantum Concepts LLC

import "forge-std/Test.sol";
import "../src/PhiSplitRouter.sol";
import "../src/MerkleAnchor.sol";
import "../src/ReserveVault.sol";

contract PhiSplitRouterTest is Test {
    address payable trust;
    address payable members;
    address payable ops;
    address guardian;

    MerkleAnchor anchor;
    ReserveVault vault;
    PhiSplitRouter router;

    function setUp() public {
        trust = payable(makeAddr("trust"));
        members = payable(makeAddr("members"));
        ops = payable(makeAddr("ops"));
        guardian = makeAddr("guardian");

        anchor = new MerkleAnchor();
        vault = new ReserveVault(trust);
        router = new PhiSplitRouter(trust, members, ops, address(vault), address(anchor), guardian, 0);

        vault.setRouter(address(router));
        anchor.setRouter(address(router));

        vm.deal(address(this), 1000 ether);
    }

    function routeEth(uint256 amount) internal {
        (bool ok, ) = address(router).call{value: amount}("");
        assertTrue(ok, "route failed");
    }

    // --- Split math -----------------------------------------------------------

    function testSplitIdentity_MultipleAmounts() public view {
        uint256[5] memory amounts = [uint256(1000), 999999, 1 ether, 123456789, 100 ether];
        for (uint256 i = 0; i < amounts.length; i++) {
            (uint256 t, uint256 m, uint256 o) = router.computeSplit(amounts[i]);
            assertEq(t + m + o, amounts[i], "split identity broken");
        }
    }

    function testFuzz_SplitIdentity(uint256 amount) public view {
        amount = bound(amount, 1000, 1e24);
        (uint256 t, uint256 m, uint256 o) = router.computeSplit(amount);
        assertEq(t + m + o, amount, "split identity broken");
    }

    // --- Dust / minimum ---------------------------------------------------------

    function testDustReverts() public {
        (bool ok, ) = address(router).call{value: 999}("");
        assertFalse(ok, "dust route should fail");
    }

    // --- Freeze controls ------------------------------------------------------

    function testFrozenRoutingReverts() public {
        vm.prank(guardian);
        router.emergencyFreeze();
        assertTrue(router.emergencyFrozen());

        (bool ok, ) = address(router).call{value: 1 ether}("");
        assertFalse(ok, "route should fail while frozen");

        vm.prank(guardian);
        router.emergencyUnfreeze();
        assertFalse(router.emergencyFrozen());

        routeEth(1 ether);
    }

    function testNonGuardianFreezeReverts() public {
        vm.prank(makeAddr("random"));
        vm.expectRevert();
        router.emergencyFreeze();
    }

    // --- Reserve carve / balances ----------------------------------------------

    function testReserveCarveAndBalances() public {
        (uint256 trustAmt, uint256 membersAmt, uint256 opsGross) = router.computeSplit(1 ether);
        uint256 reserve = (opsGross * router.RESERVE_BPS()) / router.BASIS_POINTS();
        uint256 opsNet = opsGross - reserve;
        assertEq(trustAmt + membersAmt + opsNet + reserve, 1 ether, "full identity broken");

        uint256 trustBefore = trust.balance;
        uint256 membersBefore = members.balance;
        uint256 opsBefore = ops.balance;

        routeEth(1 ether);

        assertEq(ops.balance - opsBefore, opsNet, "ops delta mismatch");
        assertEq(vault.getBalance(), reserve, "vault balance mismatch");
        assertEq(trust.balance - trustBefore, trustAmt, "trust delta mismatch");
        assertEq(members.balance - membersBefore, membersAmt, "member pool delta mismatch");
    }

    // --- Merkle anchoring --------------------------------------------------------

    function testMerkleAnchorIncrements() public {
        vm.prank(guardian);
        router.setBatchThreshold(3);

        routeEth(1 ether);
        routeEth(1 ether);
        routeEth(1 ether);

        assertEq(anchor.anchoredCount(), 1, "expected one anchored root");
        assertEq(anchor.totalTxAnchored(), 3, "expected 3 tx anchored");
    }

    // --- Annual floor -----------------------------------------------------------

    function testFloorDisabledReverts() public {
        vm.expectRevert();
        router.claimFloor();
    }

    function testFloorClaim() public {
        // Fresh router/vault/anchor set with a small enabled floor.
        // Route 10_000 wei: trust = 6_180, ops(pre-reserve) = 1_460,
        // reserve = 219. Floor 6_300 => deficit = 120 <= reserve 219.
        MerkleAnchor anchor2 = new MerkleAnchor();
        ReserveVault vault2 = new ReserveVault(trust);
        PhiSplitRouter router2 = new PhiSplitRouter(
            trust, members, ops, address(vault2), address(anchor2), guardian, 6300
        );
        vault2.setRouter(address(router2));
        anchor2.setRouter(address(router2));

        (bool ok, ) = address(router2).call{value: 10000}("");
        assertTrue(ok, "router2 route failed");
        assertEq(router2.annualTrustAccumulator(), 6180);
        assertEq(vault2.getBalance(), 219);

        vm.warp(block.timestamp + 366 days);

        uint256 trustBefore = trust.balance;
        vm.prank(trust);
        router2.claimFloor();

        assertEq(trust.balance - trustBefore, 120, "floor deficit payout mismatch");
    }
}
