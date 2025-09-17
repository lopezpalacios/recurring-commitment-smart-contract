// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title RecurringCommitment
 * @notice Enables recurring payments with pull-payment model
 * @dev Implements subscription-like payments with role-based access control
 */
contract RecurringCommitment is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    
    /// @dev Role for arbiters who can pause/resume commitments
    bytes32 public constant ARBITER_ROLE = keccak256("ARBITER_ROLE");
    
    /// @dev Payment commitment states
    enum CommitmentState { Active, Paused, Terminated }
    
    /// @dev Structure representing a payment commitment
    struct Commitment {
        address payer;           // Who pays
        address recipient;       // Who receives
        IERC20 token;           // Payment token
        uint256 amount;         // Amount per period
        uint256 period;         // Period in seconds
        uint256 startTime;      // When commitment starts
        uint256 endTime;        // When commitment ends
        uint256 lastClaimed;    // Last claim timestamp
        uint256 gracePeriod;    // Grace period before late fees
        CommitmentState state;  // Current state
        bool terminated;        // Termination flag
    }
    
    /// @dev Custom errors for gas efficiency
    error CommitmentNotFound();
    error UnauthorizedCaller();
    error CommitmentAlreadyTerminated();
    error NoClaimableAmount();
    error InsufficientBalance();
    error InvalidTimeRange();
    error CommitmentExpired();
    
    /// @dev Events for off-chain monitoring
    event CommitmentCreated(
        uint256 indexed commitmentId,
        address indexed payer,
        address indexed recipient,
        address token,
        uint256 amount,
        uint256 period
    );
    
    event PaymentClaimed(
        uint256 indexed commitmentId,
        address indexed recipient,
        uint256 amount,
        uint256 timestamp
    );
    
    event CommitmentStateChanged(
        uint256 indexed commitmentId,
        CommitmentState newState
    );
    
    event CommitmentTerminated(
        uint256 indexed commitmentId,
        address indexed terminator,
        uint256 timestamp
    );
    
    /// @dev Storage
    mapping(uint256 => Commitment) public commitments;
    uint256 public nextCommitmentId;
    
    /// @dev Modifier to check commitment exists and is active
    modifier validCommitment(uint256 commitmentId) {
        Commitment storage commitment = commitments[commitmentId];
        if (commitment.payer == address(0)) revert CommitmentNotFound();
        if (commitment.terminated) revert CommitmentAlreadyTerminated();
        _;
    }
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ARBITER_ROLE, msg.sender);
    }
    
    /**
     * @notice Creates a new recurring payment commitment
     * @param recipient Address to receive payments
     * @param token ERC20 token for payments
     * @param amount Amount per payment period
     * @param period Payment period in seconds
     * @param duration Total duration in seconds
     * @param gracePeriod Grace period before penalties
     * @return commitmentId The ID of the created commitment
     */
    function createCommitment(
        address recipient,
        IERC20 token,
        uint256 amount,
        uint256 period,
        uint256 duration,
        uint256 gracePeriod
    ) external returns (uint256 commitmentId) {
        if (recipient == address(0) || amount == 0 || period == 0) {
            revert InvalidTimeRange();
        }
        
        commitmentId = nextCommitmentId++;
        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + duration;
        
        commitments[commitmentId] = Commitment({
            payer: msg.sender,
            recipient: recipient,
            token: token,
            amount: amount,
            period: period,
            startTime: startTime,
            endTime: endTime,
            lastClaimed: startTime,
            gracePeriod: gracePeriod,
            state: CommitmentState.Active,
            terminated: false
        });
        
        emit CommitmentCreated(
            commitmentId,
            msg.sender,
            recipient,
            address(token),
            amount,
            period
        );
    }
    
    /**
     * @notice Calculates claimable amount for a commitment
     * @param commitmentId The commitment ID
     * @return claimableAmount Amount that can be claimed
     */
    function getClaimableAmount(uint256 commitmentId) 
        public 
        view 
        returns (uint256 claimableAmount) 
    {
        Commitment storage commitment = commitments[commitmentId];
        
        if (commitment.payer == address(0) || 
            commitment.terminated || 
            commitment.state != CommitmentState.Active) {
            return 0;
        }
        
        uint256 currentTime = block.timestamp;
        if (currentTime <= commitment.lastClaimed || 
            currentTime < commitment.startTime) {
            return 0;
        }
        
        // Calculate periods elapsed since last claim
        uint256 timeSinceLastClaim = currentTime - commitment.lastClaimed;
        uint256 periodsElapsed = timeSinceLastClaim / commitment.period;
        
        if (periodsElapsed == 0) return 0;
        
        // Cap at end time
        uint256 maxTime = commitment.endTime > currentTime ? 
            currentTime : commitment.endTime;
        uint256 maxPeriodsFromStart = (maxTime - commitment.startTime) / commitment.period;
        uint256 claimedPeriods = (commitment.lastClaimed - commitment.startTime) / commitment.period;
        
        uint256 maxClaimablePeriods = maxPeriodsFromStart - claimedPeriods;
        periodsElapsed = periodsElapsed > maxClaimablePeriods ? 
            maxClaimablePeriods : periodsElapsed;
        
        claimableAmount = periodsElapsed * commitment.amount;
    }
    
    /**
     * @notice Claims available payments for a commitment
     * @param commitmentId The commitment ID to claim from
     */
    function claimPayment(uint256 commitmentId) 
        external 
        nonReentrant 
        whenNotPaused 
        validCommitment(commitmentId) 
    {
        Commitment storage commitment = commitments[commitmentId];
        
        if (msg.sender != commitment.recipient) {
            revert UnauthorizedCaller();
        }
        
        if (commitment.state != CommitmentState.Active) {
            revert CommitmentAlreadyTerminated();
        }
        
        uint256 claimableAmount = getClaimableAmount(commitmentId);
        if (claimableAmount == 0) revert NoClaimableAmount();
        
        // Check payer has sufficient balance
        if (commitment.token.balanceOf(commitment.payer) < claimableAmount) {
            revert InsufficientBalance();
        }
        
        // Effects
        uint256 periodsElapsed = claimableAmount / commitment.amount;
        commitment.lastClaimed += periodsElapsed * commitment.period;
        
        // Interactions
        commitment.token.safeTransferFrom(
            commitment.payer,
            commitment.recipient,
            claimableAmount
        );
        
        emit PaymentClaimed(
            commitmentId,
            commitment.recipient,
            claimableAmount,
            block.timestamp
        );
    }
    
    /**
     * @notice Terminates a commitment (callable by payer or recipient)
     * @param commitmentId The commitment ID to terminate
     */
    function terminateCommitment(uint256 commitmentId) 
        external 
        validCommitment(commitmentId) 
    {
        Commitment storage commitment = commitments[commitmentId];
        
        if (msg.sender != commitment.payer && 
            msg.sender != commitment.recipient) {
            revert UnauthorizedCaller();
        }
        
        commitment.terminated = true;
        commitment.state = CommitmentState.Terminated;
        
        emit CommitmentTerminated(commitmentId, msg.sender, block.timestamp);
    }
    
    /**
     * @notice Pauses a commitment (arbiter only)
     * @param commitmentId The commitment ID to pause
     */
    function pauseCommitment(uint256 commitmentId) 
        external 
        onlyRole(ARBITER_ROLE) 
        validCommitment(commitmentId) 
    {
        Commitment storage commitment = commitments[commitmentId];
        commitment.state = CommitmentState.Paused;
        
        emit CommitmentStateChanged(commitmentId, CommitmentState.Paused);
    }
    
    /**
     * @notice Resumes a paused commitment (arbiter only)
     * @param commitmentId The commitment ID to resume
     */
    function resumeCommitment(uint256 commitmentId) 
        external 
        onlyRole(ARBITER_ROLE) 
        validCommitment(commitmentId) 
    {
        Commitment storage commitment = commitments[commitmentId];
        commitment.state = CommitmentState.Active;
        
        emit CommitmentStateChanged(commitmentId, CommitmentState.Active);
    }
    
    /**
     * @notice Emergency pause all operations (admin only)
     */
    function emergencyPause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @notice Resume operations after emergency pause (admin only)
     */
    function emergencyUnpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @notice Get commitment details
     * @param commitmentId The commitment ID
     * @return commitment The commitment struct
     */
    function getCommitment(uint256 commitmentId) 
        external 
        view 
        returns (Commitment memory commitment) 
    {
        return commitments[commitmentId];
    }
}