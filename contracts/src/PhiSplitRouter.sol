// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Omega Platform — Creator: David Charles Bourassa, Quantum Concepts LLC
//
// PhiSplitRouter — routes gross revenue through the canonical phi split:
//
//   Trust   = gross x PHI_MINOR            (PHI_MINOR = 0.618033988749894848)
//   remaining = gross - Trust
//   Members = remaining x PHI_MINOR
//   Ops     = remaining - Members          (pre-reserve Ops stream)
//   Reserve = Ops x 15%                    (RESERVE_BPS = 1500, to ReserveVault)
//   OpsNet  = Ops - Reserve
//
// Identity (exact, in wei): trust + members + opsNet + reserve == gross.
//
// Blueprint defects fixed relative to the original draft:
//   (1) _anchorBatch() was called but never defined — it is implemented
//       below and anchors a sequential keccak256 chain of pending receipt
//       hashes into MerkleAnchor.
//   (2) No emergencyFreeze() existed — emergencyFreeze()/emergencyUnfreeze()
//       (guardian-only) are implemented below.
//   (3) ANNUAL_FLOOR_WEI was hardcoded at 4_000 ether — the annual floor is
//       now the constructor parameter `annualFloorWei` (0 = floor disabled;
//       claimFloor reverts when disabled).
//
// No OpenZeppelin dependency: the reentrancy guard, freeze flag, and access
// checks are hand-rolled natively so this scaffold is offline-reproducible
// without external package fetches.

interface IReserveVault {
    function depositReserve(uint256 amount) external payable;
    function triggerFloorCover(uint256 deficit, address trustWallet) external;
    function getBalance() external view returns (uint256);
}

interface IMerkleAnchor {
    function anchor(bytes32 root, uint256 txCount) external;
}

contract PhiSplitRouter {
    // --- Canonical phi-split constants -------------------------------------
    uint256 public constant PHI_NUM = 618033988749894848; // 0.618033988749894848 * 1e18
    uint256 public constant PHI_DEN = 1e18;
    uint256 public constant RESERVE_BPS = 1500; // 15% of the Ops stream
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MIN_GROSS = 1000; // wei; dust below this reverts

    // --- Immutables ---------------------------------------------------------
    address payable public immutable TRUST_WALLET;
    address payable public immutable MEMBER_POOL;
    address payable public immutable OPS_WALLET;
    address public immutable RESERVE_VAULT;
    address public immutable MERKLE_ANCHOR;
    address public immutable GUARDIAN_MULTISIG;
    uint256 public immutable annualFloorWei;

    // --- State --------------------------------------------------------------
    uint256 public fiscalYearStart;
    uint256 public annualTrustAccumulator;
    uint256 public totalRoutedAllTime;
    uint256 public txCount;
    bool public emergencyFrozen;
    bytes32[] public pendingHashes;
    uint256 public batchAnchorThreshold = 100;

    // Hand-rolled reentrancy guard (see header note on dependencies).
    bool private locked;

    // --- Events -------------------------------------------------------------
    event RevenueRouted(
        address indexed sender,
        uint256 gross,
        uint256 trust,
        uint256 members,
        uint256 opsNet,
        uint256 reserve,
        bytes32 receiptHash,
        uint256 txIndex
    );
    event MerkleAnchored(bytes32 root, uint256 count);
    event EmergencyFreezeToggled(bool frozen, address indexed actor);
    event FloorGuaranteeTriggered(uint256 deficit, uint256 fiscalYearStart);
    event BatchThresholdSet(uint256 threshold, address indexed actor);
    event FiscalYearReset(uint256 fiscalYearStart, address indexed actor);

    modifier nonReentrant() {
        require(!locked, "PHI: reentrant call");
        locked = true;
        _;
        locked = false;
    }

    modifier onlyGuardian() {
        require(msg.sender == GUARDIAN_MULTISIG, "PHI: not guardian");
        _;
    }

    constructor(
        address payable trustWallet,
        address payable memberPool,
        address payable opsWallet,
        address reserveVault,
        address merkleAnchor,
        address guardianMultisig,
        uint256 annualFloorWei_
    ) {
        require(trustWallet != address(0), "PHI: zero trust wallet");
        require(memberPool != address(0), "PHI: zero member pool");
        require(opsWallet != address(0), "PHI: zero ops wallet");
        require(reserveVault != address(0), "PHI: zero reserve vault");
        require(merkleAnchor != address(0), "PHI: zero merkle anchor");
        require(guardianMultisig != address(0), "PHI: zero guardian");

        TRUST_WALLET = trustWallet;
        MEMBER_POOL = memberPool;
        OPS_WALLET = opsWallet;
        RESERVE_VAULT = reserveVault;
        MERKLE_ANCHOR = merkleAnchor;
        GUARDIAN_MULTISIG = guardianMultisig;
        annualFloorWei = annualFloorWei_;
        fiscalYearStart = block.timestamp;
    }

    // --- Split math -----------------------------------------------------------

    /// @notice Compute the phi split for `amount`.
    /// @return trust Trust share (gross x phi).
    /// @return members Members share (remaining x phi).
    /// @return ops Pre-reserve Ops share (remaining - members). The reserve
    ///         carve is applied on top of this in _route, so
    ///         trust + members + ops == amount exactly.
    function computeSplit(uint256 amount)
        public
        pure
        returns (uint256 trust, uint256 members, uint256 ops)
    {
        trust = (amount * PHI_NUM) / PHI_DEN;
        uint256 remaining = amount - trust;
        members = (remaining * PHI_NUM) / PHI_DEN;
        ops = remaining - members;
        assert(trust + members + ops == amount);
    }

    // --- Routing --------------------------------------------------------------

    receive() external payable nonReentrant {
        _route(msg.sender);
    }

    /// @notice Route msg.value, crediting `sender` in the receipt hash.
    function route(address sender) external payable nonReentrant {
        _route(sender);
    }

    function _route(address sender) internal {
        require(!emergencyFrozen, "PHI: emergency frozen");
        uint256 gross = msg.value;
        require(gross >= MIN_GROSS, "PHI: below minimum gross");

        (uint256 trust, uint256 members, uint256 ops) = computeSplit(gross);
        uint256 reserve = (ops * RESERVE_BPS) / BASIS_POINTS;
        uint256 opsNet = ops - reserve;
        require(trust + members + opsNet + reserve == gross, "PHI: split identity broken");

        annualTrustAccumulator += trust;
        totalRoutedAllTime += gross;
        uint256 currentTx = txCount;
        txCount += 1;

        bytes32 receiptHash = keccak256(
            abi.encodePacked(gross, trust, members, opsNet, reserve, block.timestamp, sender, currentTx)
        );
        pendingHashes.push(receiptHash);

        (bool okTrust, ) = TRUST_WALLET.call{value: trust}("");
        require(okTrust, "PHI: trust transfer failed");
        (bool okMembers, ) = MEMBER_POOL.call{value: members}("");
        require(okMembers, "PHI: member transfer failed");
        (bool okOps, ) = OPS_WALLET.call{value: opsNet}("");
        require(okOps, "PHI: ops transfer failed");
        IReserveVault(RESERVE_VAULT).depositReserve{value: reserve}(reserve);

        emit RevenueRouted(sender, gross, trust, members, opsNet, reserve, receiptHash, currentTx);

        if (pendingHashes.length >= batchAnchorThreshold) {
            _anchorBatch();
        }
    }

    /// @notice Anchor the pending receipt hashes into MerkleAnchor.
    /// @dev Blueprint defect fix (1): this function was called in the draft
    ///      but never defined. The root is a sequential keccak256 chain over
    ///      pendingHashes, starting from bytes32(0).
    function _anchorBatch() internal {
        uint256 count = pendingHashes.length;
        if (count == 0) return;
        bytes32 root = bytes32(0);
        for (uint256 i = 0; i < count; i++) {
            root = keccak256(abi.encodePacked(root, pendingHashes[i]));
        }
        delete pendingHashes;
        IMerkleAnchor(MERKLE_ANCHOR).anchor(root, count);
        emit MerkleAnchored(root, count);
    }

    function pendingCount() external view returns (uint256) {
        return pendingHashes.length;
    }

    // --- Guardian controls ----------------------------------------------------

    function setBatchThreshold(uint256 threshold) external onlyGuardian {
        require(threshold > 0, "PHI: zero threshold");
        batchAnchorThreshold = threshold;
        emit BatchThresholdSet(threshold, msg.sender);
    }

    /// @notice Blueprint defect fix (2): emergency freeze, guardian-only.
    function emergencyFreeze() external onlyGuardian {
        emergencyFrozen = true;
        emit EmergencyFreezeToggled(true, msg.sender);
    }

    function emergencyUnfreeze() external onlyGuardian {
        emergencyFrozen = false;
        emit EmergencyFreezeToggled(false, msg.sender);
    }

    // --- Annual floor guarantee ----------------------------------------------

    /// @notice Claim the annual Trust floor shortfall from the ReserveVault.
    /// @dev Blueprint defect fix (3): the floor is the constructor parameter
    ///      `annualFloorWei`, not a hardcoded constant. 0 disables the floor.
    function claimFloor() external nonReentrant {
        require(annualFloorWei > 0, "PHI: floor disabled");
        require(
            msg.sender == TRUST_WALLET || msg.sender == GUARDIAN_MULTISIG,
            "PHI: not authorised for floor claim"
        );
        require(block.timestamp >= fiscalYearStart + 365 days, "PHI: fiscal year not complete");
        require(annualTrustAccumulator < annualFloorWei, "PHI: floor already met");

        uint256 deficit = annualFloorWei - annualTrustAccumulator;
        require(
            IReserveVault(RESERVE_VAULT).getBalance() >= deficit,
            "PHI: reserve insufficient for floor"
        );

        IReserveVault(RESERVE_VAULT).triggerFloorCover(deficit, TRUST_WALLET);
        emit FloorGuaranteeTriggered(deficit, fiscalYearStart);

        fiscalYearStart = block.timestamp;
        annualTrustAccumulator = 0;
    }

    /// @notice Reset the fiscal year once it is complete. Guardian-only.
    function resetFiscalYear() external onlyGuardian {
        require(block.timestamp >= fiscalYearStart + 365 days, "PHI: fiscal year not complete");
        fiscalYearStart = block.timestamp;
        annualTrustAccumulator = 0;
        emit FiscalYearReset(fiscalYearStart, msg.sender);
    }
}
