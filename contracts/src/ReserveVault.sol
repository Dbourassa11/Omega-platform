// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Omega Platform — Creator: David Charles Bourassa, Quantum Concepts LLC
//
// ReserveVault — holds the 15%-of-Ops reserve carved out by PhiSplitRouter
// and dispatches floor-cover payments to the Trust wallet when directed
// by the router.
// No OpenZeppelin dependency: access checks are hand-rolled natively so the
// scaffold is offline-reproducible without external package fetches.

contract ReserveVault {
    address payable public immutable TRUST_WALLET;
    address public owner;
    address public router;
    uint256 public totalDeposited;
    uint256 public totalDispatched;

    event Reserved(uint256 amount, uint256 newBalance);
    event FloorCovered(uint256 deficit, address indexed trustWallet);
    event RouterSet(address indexed router);

    constructor(address payable trustWallet) {
        require(trustWallet != address(0), "ReserveVault: zero trust wallet");
        TRUST_WALLET = trustWallet;
        owner = msg.sender;
    }

    modifier onlyRouter() {
        require(msg.sender == router, "ReserveVault: not router");
        _;
    }

    /// @notice Set the PhiSplitRouter address. Deployer-only, one-time.
    function setRouter(address router_) external {
        require(msg.sender == owner, "ReserveVault: not owner");
        require(router == address(0), "ReserveVault: router already set");
        require(router_ != address(0), "ReserveVault: zero address");
        router = router_;
        emit RouterSet(router_);
    }

    /// @notice Deposit reserve funds. Router-only; msg.value must equal amount.
    function depositReserve(uint256 amount) external payable onlyRouter {
        require(msg.value == amount, "ReserveVault: value != amount");
        totalDeposited += amount;
        emit Reserved(amount, address(this).balance);
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Send `deficit` to the Trust wallet to cover the annual floor.
    ///         Router-only; destination must be the immutable TRUST_WALLET.
    function triggerFloorCover(uint256 deficit, address trustWallet) external onlyRouter {
        require(trustWallet == TRUST_WALLET, "ReserveVault: wrong trust wallet");
        require(deficit > 0, "ReserveVault: zero deficit");
        require(address(this).balance >= deficit, "ReserveVault: insufficient balance");
        totalDispatched += deficit;
        (bool ok, ) = TRUST_WALLET.call{value: deficit}("");
        require(ok, "ReserveVault: transfer failed");
        emit FloorCovered(deficit, trustWallet);
    }
}
