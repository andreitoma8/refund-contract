// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title Refund Contract
 * @notice This contract is used to refund the users that have bought the tokens in the sale
 * @notice The investors can claim the refund in the first 90 days after the sale
 * @notice After the 90 days, the owner can withdraw the funds from the contract
 */
contract Refund is Ownable, ReentrancyGuard {
    /**
     * @notice The duration of the refund period in seconds
     */
    uint256 public constant REFUND_PERIOD_DURATION = 90 days;

    /**
     * @notice The UNIX timestamp after which the refund period is over
     */
    uint256 public immutable refundDeadline;

    /**
     * @notice The merkle root of the users that have bought the tokens in the sale
     */
    bytes32 public immutable merkleRoot;

    /**
     * @notice This mapping is used to keep track of the users that have claimed their tokens
     */
    mapping(address => bool) public claimed;

    /**
     * @notice This event is emitted when a user claims the refund
     * @param user The address of the user that has claimed the refund
     * @param amount The amount of tokens that the user has claimed
     */
    event RefundClaimed(address indexed user, uint256 amount);

    /**
     * @notice This event is emitted when the owner withdraws the funds from the contract
     * @param amount The amount of funds that have been withdrawn
     */
    event FundsWithdrawn(uint256 amount);

    constructor(bytes32 _merkleRoot) Ownable() {
        // Check if the merkle root is not empty
        require(_merkleRoot != bytes32(0), "Merkle root cannot be empty");

        // Set the refund deadline
        refundDeadline = block.timestamp + REFUND_PERIOD_DURATION;

        // Set the merkle root
        merkleRoot = _merkleRoot;
    }

    /**
     * @notice This function is used to refund the users that have bought the tokens in the sale
     * @param _proof The merkle proof of the user
     * @param _amount The amount of tokens that the user has bought
     */
    function claimRefund(bytes32[] calldata _proof, uint256 _amount) external nonReentrant {
        // Check if the refund period is over
        require(block.timestamp <= refundDeadline, "Refund period over");

        // Check if the user has already claimed
        require(!claimed[msg.sender], "Already claimed");

        // Verify the merkle proof
        bytes32 node = keccak256(abi.encodePacked(msg.sender, _amount));
        require(MerkleProof.verify(_proof, merkleRoot, node), "Invalid proof");

        // Mark the user as claimed
        claimed[msg.sender] = true;

        // Transfer the funds to the user
        (bool success,) = msg.sender.call{value: _amount}("");
        require(success, "Transfer failed");

        // Emit the refund claimed event
        emit RefundClaimed(msg.sender, _amount);
    }

    /**
     * @notice This function is used to withdraw the funds from the contract
     * in case any excess funds are present
     * @param _amount The amount of funds to withdraw
     */
    function withdraw(uint256 _amount) external onlyOwner {
        // Check if the refund period is over
        require(block.timestamp > refundDeadline, "Refund period not over");

        // Check if the balance is sufficient
        require(address(this).balance >= _amount, "Insufficient funds");

        // Transfer the funds to the owner
        (bool success,) = msg.sender.call{value: _amount}("");
        require(success, "Transfer failed");

        // Emit the withdraw event
        emit FundsWithdrawn(_amount);
    }

    /**
     * @dev Used to send the funds to be claimed after the contract is deployed
     */
    receive() external payable {}
}
