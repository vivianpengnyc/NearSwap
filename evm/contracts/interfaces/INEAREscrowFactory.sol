// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Address } from "../libraries/AddressLib.sol";
import { IBaseEscrow } from "./IBaseEscrow.sol";

/**
 * @title NEAR Escrow Factory interface for EVM-NEAR atomic swaps
 * @notice Interface for creating NEAR atomic swap escrows
 * @dev Supports both EVM→NEAR and NEAR→EVM swap directions
 * @custom:security-contact security@atomicswap.io
 */
interface INEAREscrowFactory {
    
    /// @notice Thrown when insufficient ETH is sent for escrow creation
    error InsufficientEscrowBalance();

    /**
     * @notice Emitted when a source escrow is created (EVM→NEAR)
     * @param escrow The address of the created source escrow
     * @param hashlock The hash of the secret
     * @param maker The address of the maker
     * @param creator The address of who created the escrow
     */
    event SrcEscrowCreated(
        address escrow, 
        bytes32 hashlock, 
        Address maker, 
        address indexed creator
    );

    /**
     * @notice Emitted when a destination escrow is created (NEAR→EVM)
     * @param escrow The address of the created destination escrow
     * @param hashlock The hash of the secret
     * @param taker The address of the taker
     * @param creator The address of who created the escrow
     */
    event DstEscrowCreated(
        address escrow, 
        bytes32 hashlock, 
        Address taker, 
        address indexed creator
    );

    /**
     * @notice Creates a source escrow for EVM→NEAR swaps
     * @dev Maker creates this escrow with EVM tokens, taker will provide NEAR
     * @param immutables The escrow immutables including NEAR parameters
     */
    function createSrcEscrow(IBaseEscrow.Immutables calldata immutables) external payable;

    /**
     * @notice Creates a destination escrow for NEAR→EVM swaps
     * @dev Taker creates this escrow with EVM tokens, maker will provide NEAR  
     * @param immutables The escrow immutables including NEAR parameters
     */
    function createDstEscrow(IBaseEscrow.Immutables calldata immutables) external payable;

    /**
     * @notice Returns the deterministic address of a source escrow
     * @param immutables The escrow immutables
     * @return The computed address of the source escrow
     */
    function addressOfEscrowSrc(IBaseEscrow.Immutables calldata immutables) external view returns (address);

    /**
     * @notice Returns the deterministic address of a destination escrow
     * @param immutables The escrow immutables
     * @return The computed address of the destination escrow
     */
    function addressOfEscrowDst(IBaseEscrow.Immutables calldata immutables) external view returns (address);

    /**
     * @notice Returns the source escrow implementation address
     * @return The address of the source escrow implementation
     */
    function NEAR_ESCROW_SRC_IMPLEMENTATION() external view returns (address);

    /**
     * @notice Returns the destination escrow implementation address
     * @return The address of the destination escrow implementation
     */
    function NEAR_ESCROW_DST_IMPLEMENTATION() external view returns (address);
}