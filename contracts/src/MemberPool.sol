// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Omega Platform — Creator: David Charles Bourassa, Quantum Concepts LLC
//
// ============================================================================
// SCAFFOLD / STUB — MemberPool
// Member distribution rules are NOT implemented in this contract.
// It currently only receives funds from PhiSplitRouter and tracks the total
// received. DO NOT use with real funds until distribution logic, claimant
// accounting, and withdrawal safety have been designed, implemented, and
// audited.
// ============================================================================

contract MemberPool {
    uint256 public totalReceived;

    event Received(address indexed sender, uint256 amount, uint256 totalReceived);

    receive() external payable {
        totalReceived += msg.value;
        emit Received(msg.sender, msg.value, totalReceived);
    }
}
