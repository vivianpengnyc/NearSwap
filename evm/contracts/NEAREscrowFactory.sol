// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

import { AddressLib, Address } from "./libraries/AddressLib.sol";
import { ImmutablesLib } from "./libraries/ImmutablesLib.sol";
import { TimelocksLib, Timelocks } from "./libraries/TimelocksLib.sol";
import { ProxyHashLib } from "./libraries/ProxyHashLib.sol";

import { IBaseEscrow } from "./interfaces/IBaseEscrow.sol";
import { INEAREscrowFactory } from "./interfaces/INEAREscrowFactory.sol";
import { NEAREscrowDst } from "./NEAREscrowDst.sol";
import { NEAREscrowSrc } from "./NEAREscrowSrc.sol";

/**
 * @title NEAR Escrow Factory for EVM-NEAR atomic swaps
 * @notice Factory contract for creating NEAR atomic swap escrows
 * @dev Supports both EVM→NEAR and NEAR→EVM swap directions
 * @custom:security-contact security@atomicswap.io
 */
contract NEAREscrowFactory is INEAREscrowFactory, Ownable {
    using SafeERC20 for IERC20;
    using AddressLib for Address;
    using TimelocksLib for Timelocks;

    /// @notice Implementation contract for source escrows (EVM→NEAR)
    address public immutable NEAR_ESCROW_SRC_IMPLEMENTATION;
    
    /// @notice Implementation contract for destination escrows (NEAR→EVM)
    address public immutable NEAR_ESCROW_DST_IMPLEMENTATION;
    
    /// @notice Proxy bytecode hash for source escrows
    bytes32 private immutable _PROXY_SRC_BYTECODE_HASH;
    
    /// @notice Proxy bytecode hash for destination escrows
    bytes32 private immutable _PROXY_DST_BYTECODE_HASH;

    /// @notice Access token for public operations
    IERC20 public immutable ACCESS_TOKEN;

    /// @notice Creation fee in ETH
    uint256 public creationFee;

    /// @notice Treasury address for fee collection
    address public treasury;

    /// @notice NEAR network configuration
    struct NEARConfig {
        uint256 minAmount;           // Minimum NEAR amount in yoctoNEAR
        uint256 maxAmount;           // Maximum NEAR amount in yoctoNEAR
        uint32 confirmationTime;     // Time to wait for NEAR confirmation
    }

    NEARConfig public nearConfig;

    error InvalidFeeAmount();
    error FeeTransferFailed();
    error InvalidNEARAmount();
    error InvalidNEARAccount();

    event CreationFeeUpdated(uint256 oldFee, uint256 newFee);
    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event NEARConfigUpdated(NEARConfig config);

    constructor(
        IERC20 accessToken,
        address owner,
        uint32 rescueDelaySrc,
        uint32 rescueDelayDst,
        uint256 _creationFee,
        address _treasury,
        NEARConfig memory _nearConfig
    ) Ownable(owner) {
        ACCESS_TOKEN = accessToken;
        creationFee = _creationFee;
        treasury = _treasury;
        nearConfig = _nearConfig;
        
        // Deploy implementations
        NEAR_ESCROW_SRC_IMPLEMENTATION = address(new NEAREscrowSrc(rescueDelaySrc, accessToken));
        NEAR_ESCROW_DST_IMPLEMENTATION = address(new NEAREscrowDst(rescueDelayDst, accessToken));
        
        // Compute proxy bytecode hashes
        _PROXY_SRC_BYTECODE_HASH = ProxyHashLib.computeProxyBytecodeHash(NEAR_ESCROW_SRC_IMPLEMENTATION);
        _PROXY_DST_BYTECODE_HASH = ProxyHashLib.computeProxyBytecodeHash(NEAR_ESCROW_DST_IMPLEMENTATION);
    }

    /**
     * @notice Creates source escrow for EVM→NEAR swaps
     * @param immutables Escrow immutables including NEAR details
     */
    function createSrcEscrow(IBaseEscrow.Immutables calldata immutables) external payable override {
        // Note: NEAR validation handled at application level
        
        address token = immutables.token.get();
        
        // Calculate required ETH
        uint256 requiredForEscrow = token == address(0) 
            ? immutables.amount + immutables.safetyDeposit
            : immutables.safetyDeposit;
            
        uint256 totalRequired = requiredForEscrow + creationFee;
        
        if (msg.value != totalRequired) {
            revert InsufficientEscrowBalance();
        }

        // Deploy escrow
        address escrow = _deployEscrow(immutables, _PROXY_SRC_BYTECODE_HASH, requiredForEscrow);

        // Transfer ERC20 tokens if needed
        if (token != address(0)) {
            IERC20(token).safeTransferFrom(msg.sender, escrow, immutables.amount);
        }

        _collectFee();
        
        emit SrcEscrowCreated(escrow, immutables.hashlock, immutables.maker, msg.sender);
    }

    /**
     * @notice Creates destination escrow for NEAR→EVM swaps  
     * @param immutables Escrow immutables including NEAR details
     */
    function createDstEscrow(IBaseEscrow.Immutables calldata immutables) external payable override {
        // Note: NEAR validation handled at application level
        
        address token = immutables.token.get();
        
        // Calculate required ETH
        uint256 requiredForEscrow = token == address(0) 
            ? immutables.amount + immutables.safetyDeposit
            : immutables.safetyDeposit;
            
        uint256 totalRequired = requiredForEscrow + creationFee;
        
        if (msg.value != totalRequired) {
            revert InsufficientEscrowBalance();
        }

        // Deploy escrow
        address escrow = _deployEscrow(immutables, _PROXY_DST_BYTECODE_HASH, requiredForEscrow);

        // Transfer ERC20 tokens if needed
        if (token != address(0)) {
            IERC20(token).safeTransferFrom(msg.sender, escrow, immutables.amount);
        }

        _collectFee();
        
        emit DstEscrowCreated(escrow, immutables.hashlock, immutables.taker, msg.sender);
    }

    /**
     * @notice Returns address of source escrow
     */
    function addressOfEscrowSrc(IBaseEscrow.Immutables calldata immutables) external view override returns (address) {
        IBaseEscrow.Immutables memory modifiedImmutables = immutables;
        modifiedImmutables.timelocks = immutables.timelocks.setDeployedAt(block.timestamp);
        
        bytes32 salt = ImmutablesLib.hashMem(modifiedImmutables);
        return Create2.computeAddress(salt, _PROXY_SRC_BYTECODE_HASH, address(this));
    }

    /**
     * @notice Returns address of destination escrow
     */
    function addressOfEscrowDst(IBaseEscrow.Immutables calldata immutables) external view override returns (address) {
        IBaseEscrow.Immutables memory modifiedImmutables = immutables;
        modifiedImmutables.timelocks = immutables.timelocks.setDeployedAt(block.timestamp);
        
        bytes32 salt = ImmutablesLib.hashMem(modifiedImmutables);
        return Create2.computeAddress(salt, _PROXY_DST_BYTECODE_HASH, address(this));
    }

    /**
     * @notice Updates creation fee (only owner)
     * @param newFee New creation fee in wei
     */
    function setCreationFee(uint256 newFee) external onlyOwner {
        uint256 oldFee = creationFee;
        creationFee = newFee;
        emit CreationFeeUpdated(oldFee, newFee);
    }

    /**
     * @notice Updates treasury address (only owner)
     * @param newTreasury New treasury address
     */
    function setTreasury(address newTreasury) external onlyOwner {
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    /**
     * @notice Updates NEAR configuration (only owner)
     * @param newConfig New NEAR configuration
     */
    function setNEARConfig(NEARConfig calldata newConfig) external onlyOwner {
        nearConfig = newConfig;
        emit NEARConfigUpdated(newConfig);
    }

    /**
     * @dev Validates NEAR-specific parameters
     */
    function _validateNEARParams(IBaseEscrow.Immutables calldata immutables) internal view {
        // Validate NEAR amount is within bounds
        if (immutables.amount < nearConfig.minAmount || immutables.amount > nearConfig.maxAmount) {
            revert InvalidNEARAmount();
        }
        
        // Additional NEAR account validation can be added here
    }

    /**
     * @dev Deploys escrow using Create2
     */
    function _deployEscrow(
        IBaseEscrow.Immutables calldata immutables,
        bytes32 proxyBytecodeHash,
        uint256 ethAmount
    ) internal returns (address) {
        // Set deployment timestamp
        IBaseEscrow.Immutables memory modifiedImmutables = immutables;
        modifiedImmutables.timelocks = immutables.timelocks.setDeployedAt(block.timestamp);

        // Compute salt and deploy escrow with Create2
        bytes32 salt = ImmutablesLib.hashMem(modifiedImmutables);
        
        // Create minimal proxy bytecode
        bytes memory bytecode = abi.encodePacked(
            hex"3d602d80600a3d3981f3363d3d373d3d3d363d73",
            proxyBytecodeHash == _PROXY_SRC_BYTECODE_HASH 
                ? NEAR_ESCROW_SRC_IMPLEMENTATION 
                : NEAR_ESCROW_DST_IMPLEMENTATION,
            hex"5af43d82803e903d91602b57fd5bf3"
        );

        // Deploy escrow with required ETH
        return Create2.deploy(ethAmount, salt, bytecode);
    }

    /**
     * @dev Collects creation fee
     */
    function _collectFee() internal {
        if (creationFee > 0 && treasury != address(0)) {
            (bool success, ) = treasury.call{value: creationFee}("");
            if (!success) revert FeeTransferFailed();
        }
    }
}