// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Omega Platform — Creator: David Charles Bourassa, Quantum Concepts LLC
//
// ============================================================================
// SCAFFOLD / STUB — TreasuryRegistry
// Human-readable labels for treasury-related addresses. No funds are held
// or moved by this contract. Expanded registry features are not implemented.
// ============================================================================

contract TreasuryRegistry {
    address public owner;
    mapping(address => string) public labels;

    event LabelSet(address indexed account, string label);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "TreasuryRegistry: not owner");
        _;
    }

    function setLabel(address account, string calldata label) external onlyOwner {
        labels[account] = label;
        emit LabelSet(account, label);
    }

    function getLabel(address account) external view returns (string memory) {
        return labels[account];
    }
}
