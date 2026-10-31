// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Omega Platform — Creator: David Charles Bourassa, Quantum Concepts LLC
//
// MerkleAnchor — records Merkle roots of batched PhiSplitRouter receipts.
// No OpenZeppelin dependency: access checks are hand-rolled natively so the
// scaffold is offline-reproducible without external package fetches.

contract MerkleAnchor {
    address public owner;
    address public router;
    bytes32[] public roots;
    uint256 public totalTxAnchored;

    event RootAnchored(bytes32 root, uint256 txCount, uint256 anchorIndex);
    event RouterSet(address indexed router);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "MerkleAnchor: not owner");
        _;
    }

    /// @notice Set the PhiSplitRouter address. Owner-only, one-time.
    function setRouter(address router_) external onlyOwner {
        require(router == address(0), "MerkleAnchor: router already set");
        require(router_ != address(0), "MerkleAnchor: zero address");
        router = router_;
        emit RouterSet(router_);
    }

    /// @notice Anchor a Merkle root for a batch of routed transactions.
    /// @dev Router-only. This is the function the blueprint draft called
    ///      via _anchorBatch() without ever defining the callee-side logic.
    function anchor(bytes32 root, uint256 txCount) external {
        require(msg.sender == router, "MerkleAnchor: not router");
        require(root != bytes32(0), "MerkleAnchor: empty root");
        roots.push(root);
        totalTxAnchored += txCount;
        emit RootAnchored(root, txCount, roots.length - 1);
    }

    function anchoredCount() external view returns (uint256) {
        return roots.length;
    }

    function getRoot(uint256 i) external view returns (bytes32) {
        return roots[i];
    }
}
