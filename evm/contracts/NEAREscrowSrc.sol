// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AddressLib, Address } from "./libraries/AddressLib.sol";
import { Timelocks, TimelocksLib } from "./libraries/TimelocksLib.sol";

import { IBaseEscrow } from "./interfaces/IBaseEscrow.sol";
import { BaseEscrow } from "./BaseEscrow.sol";
import { Escrow } from "./Escrow.sol";

/**
 * @title NEAR Source Escrow for EVM→NEAR atomic swaps
 * @notice Escrow contract for EVM→NEAR swaps - holds ERC20/ETH, releases when taker provides secret
 * @dev Used when EVM tokens are the source and NEAR is the destination
 * @custom:security-contact security@atomicswap.io
 */
contract NEAREscrowSrc is Escrow {
    using SafeERC20 for IERC20;
    using AddressLib for Address;
    using TimelocksLib for Timelocks;

    /// @notice NEAR account where funds should be sent
    mapping(bytes32 => string) public nearAccounts;
    
    /// @notice NEAR transaction hash for verification (optional)
    mapping(bytes32 => string) public nearTxHashes;

    event NEARAccountRecorded(bytes32 indexed hashlock, string nearAccount);
    event NEARTxHashRecorded(bytes32 indexed hashlock, string nearTxHash);

    constructor(uint32 rescueDelay, IERC20 accessToken) BaseEscrow(rescueDelay, accessToken) {}

    // Allow contract to receive ETH
    receive() external payable {}

    /**
     * @notice Private withdrawal by taker using secret
     * @dev Taker reveals secret to claim EVM tokens after providing NEAR to maker
     * @param secret The secret that matches the hashlock
     * @param immutables The escrow immutables
     */
    function withdraw(bytes32 secret, Immutables calldata immutables)
        external
        override
        onlyValidImmutables(immutables)
        onlyValidSecret(secret, immutables)
        onlyAfter(immutables.timelocks.get(TimelocksLib.Stage.DstWithdrawal))
        onlyBefore(immutables.timelocks.get(TimelocksLib.Stage.DstCancellation))
    {
        // Allow both maker and taker to withdraw in private period
        if (msg.sender != immutables.maker.get() && msg.sender != immutables.taker.get()) {
            revert InvalidCaller();
        }

        _withdraw(secret, immutables);
    }

    /**
     * @notice Public withdrawal by anyone with access token
     * @dev Anyone with access token can trigger withdrawal in public period
     * @param secret The secret that matches the hashlock
     * @param immutables The escrow immutables
     */
    function publicWithdraw(bytes32 secret, Immutables calldata immutables)
        external
        onlyAccessTokenHolder()
        onlyValidImmutables(immutables)
        onlyValidSecret(secret, immutables)
        onlyAfter(immutables.timelocks.get(TimelocksLib.Stage.DstPublicWithdrawal))
        onlyBefore(immutables.timelocks.get(TimelocksLib.Stage.DstCancellation))
    {
        _withdraw(secret, immutables);
    }

    /**
     * @notice Cancels escrow and returns funds to maker
     * @dev Can only be called after cancellation period starts
     * @param immutables The escrow immutables
     */
    function cancel(Immutables calldata immutables)
        external
        override
        onlyMaker(immutables)
        onlyValidImmutables(immutables)
        onlyAfter(immutables.timelocks.get(TimelocksLib.Stage.DstCancellation))
    {
        // Return tokens to maker
        _uniTransfer(immutables.token.get(), immutables.maker.get(), immutables.amount);
        // Return safety deposit to maker
        _ethTransfer(immutables.maker.get(), immutables.safetyDeposit);
        
        emit EscrowCancelled();
    }

    /**
     * @notice Records NEAR account for the swap
     * @dev Links NEAR account to escrow for verification
     * @param hashlock The escrow hashlock
     * @param nearAccount The NEAR account where funds should be sent
     * @param immutables The escrow immutables
     */
    function recordNEARAccount(
        bytes32 hashlock,
        string calldata nearAccount,
        Immutables calldata immutables
    )
        external
        onlyValidImmutables(immutables)
    {
        // Only maker can record NEAR account
        if (msg.sender != immutables.maker.get()) {
            revert InvalidCaller();
        }

        nearAccounts[hashlock] = nearAccount;
        emit NEARAccountRecorded(hashlock, nearAccount);
    }

    /**
     * @notice Records NEAR transaction hash for verification
     * @dev Optional function to link NEAR transaction to escrow
     * @param hashlock The escrow hashlock
     * @param nearTxHash The NEAR transaction hash
     * @param immutables The escrow immutables
     */
    function recordNEARTx(
        bytes32 hashlock,
        string calldata nearTxHash,
        Immutables calldata immutables
    )
        external
        onlyValidImmutables(immutables)
    {
        // Only taker can record NEAR tx (proof of payment)
        if (msg.sender != immutables.taker.get()) {
            revert InvalidCaller();
        }

        nearTxHashes[hashlock] = nearTxHash;
        emit NEARTxHashRecorded(hashlock, nearTxHash);
    }

    /**
     * @notice Gets recorded NEAR account
     * @param hashlock The escrow hashlock
     * @return The NEAR account
     */
    function getNEARAccount(bytes32 hashlock) external view returns (string memory) {
        return nearAccounts[hashlock];
    }

    /**
     * @notice Gets recorded NEAR transaction hash
     * @param hashlock The escrow hashlock
     * @return The NEAR transaction hash
     */
    function getNEARTxHash(bytes32 hashlock) external view returns (string memory) {
        return nearTxHashes[hashlock];
    }

    /**
     * @dev Internal withdrawal logic
     * @param secret The secret that unlocks the escrow
     * @param immutables The escrow immutables
     */
    function _withdraw(bytes32 secret, Immutables calldata immutables) internal {
        // Transfer tokens to taker
        _uniTransfer(immutables.token.get(), immutables.taker.get(), immutables.amount);
        
        // Return safety deposit to maker
        _ethTransfer(immutables.maker.get(), immutables.safetyDeposit);
        
        emit EscrowWithdrawal(secret);
    }
}