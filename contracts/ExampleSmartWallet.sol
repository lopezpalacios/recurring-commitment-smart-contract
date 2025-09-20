// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

/**
 * @title SmartContractWallet
 * @dev A simple wallet contract with allowance-based access control
 * @notice This contract allows an owner to set allowances for other addresses
 */
contract SmartContractWallet {
    address payable public owner;
    mapping(address => uint256) public allowance;
    mapping(address => bool) public isAllowedToSend;
    
    // Events for better transparency and off-chain monitoring
    event AllowanceSet(address indexed user, uint256 amount);
    event AllowanceUsed(address indexed user, uint256 amount);
    event Transfer(address indexed to, uint256 amount, bool success);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event AllowedSenderUpdated(address indexed user, bool allowed);
    event EtherReceived(address indexed sender, uint256 amount);
    
    // Custom errors for gas efficiency
    error NotOwner();
    error NotAllowedToSend();
    error InsufficientAllowance();
    error TransferFailed();
    error ZeroAddress();
    error ZeroAmount();
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }
    
    constructor() {
        owner = payable(msg.sender);
        emit OwnershipTransferred(address(0), msg.sender);
    }
    
    /**
     * @dev Set allowance for a specific address
     * @param _for The address to set allowance for
     * @param _amount The allowance amount in wei
     */
    function setAllowance(address _for, uint256 _amount) external onlyOwner {
        if (_for == address(0)) revert ZeroAddress();
        
        allowance[_for] = _amount;
        emit AllowanceSet(_for, _amount);
    }
    
    /**
     * @dev Set whether an address is allowed to send ETH
     * @param _user The address to update permission for
     * @param _allowed Whether the address is allowed to send
     */
    function setAllowedToSend(address _user, bool _allowed) external onlyOwner {
        if (_user == address(0)) revert ZeroAddress();
        
        isAllowedToSend[_user] = _allowed;
        emit AllowedSenderUpdated(_user, _allowed);
    }
    
    /**
     * @dev Transfer ETH with optional payload
     * @param _to The recipient address
     * @param _amount The amount to transfer in wei
     * @param _payload Optional data payload for the call
     */
    function transfer(address payable _to, uint256 _amount, bytes memory _payload) external returns (bytes memory) {
        if (_to == address(0)) revert ZeroAddress();
        if (_amount == 0) revert ZeroAmount();
        
        // Check permissions for non-owner calls
        if (msg.sender != owner) {
            if (!isAllowedToSend[msg.sender]) revert NotAllowedToSend();
            if (allowance[msg.sender] < _amount) revert InsufficientAllowance();
            
            // Deduct from allowance
            allowance[msg.sender] -= _amount;
            emit AllowanceUsed(msg.sender, _amount);
        }
        
        // Ensure contract has sufficient balance
        require(address(this).balance >= _amount, "Insufficient contract balance");
        
        // Execute transfer
        (bool success, bytes memory returnData) = _to.call{value: _amount}(_payload);
        if (!success) revert TransferFailed();
        
        emit Transfer(_to, _amount, success);
        return returnData;
    }
    
    /**
     * @dev Simple ETH transfer without payload (gas efficient)
     * @param _to The recipient address
     * @param _amount The amount to transfer in wei
     */
    function simpleTransfer(address payable _to, uint256 _amount) external {
        if (_to == address(0)) revert ZeroAddress();
        if (_amount == 0) revert ZeroAmount();
        
        // Check permissions for non-owner calls
        if (msg.sender != owner) {
            if (!isAllowedToSend[msg.sender]) revert NotAllowedToSend();
            if (allowance[msg.sender] < _amount) revert InsufficientAllowance();
            
            allowance[msg.sender] -= _amount;
            emit AllowanceUsed(msg.sender, _amount);
        }
        
        require(address(this).balance >= _amount, "Insufficient contract balance");
        
        (bool success, ) = _to.call{value: _amount}("");
        if (!success) revert TransferFailed();
        
        emit Transfer(_to, _amount, success);
    }
    
    /**
     * @dev Transfer ownership to a new owner
     * @param newOwner The address of the new owner
     */
    function transferOwnership(address payable newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }
    
    /**
     * @dev Get the contract's ETH balance
     * @return The balance in wei
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @dev Emergency withdrawal function for owner
     * @param _amount Amount to withdraw (0 for full balance)
     */
    function emergencyWithdraw(uint256 _amount) external onlyOwner {
        uint256 withdrawAmount = _amount == 0 ? address(this).balance : _amount;
        require(withdrawAmount <= address(this).balance, "Insufficient balance");
        
        (bool success, ) = owner.call{value: withdrawAmount}("");
        if (!success) revert TransferFailed();
        
        emit Transfer(owner, withdrawAmount, success);
    }
    
    /**
     * @dev Receive function to accept ETH deposits
     */
    receive() external payable {
        emit EtherReceived(msg.sender, msg.value);
    }
    
    /**
     * @dev Fallback function
     */
    fallback() external payable {
        emit EtherReceived(msg.sender, msg.value);
    }
}