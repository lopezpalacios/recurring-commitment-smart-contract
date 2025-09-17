// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title MockUSDC
 * @notice Mock USDC token for testing purposes
 * @dev ERC20 token with 6 decimals to simulate USDC
 * @author Your Name
 */
contract MockUSDC is ERC20, Ownable, Pausable {
    uint8 private constant _DECIMALS = 6;

    /// @dev Events for better tracking
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    event BatchMintCompleted(uint256 totalRecipients, uint256 totalAmount);
    event AirdropCompleted(uint256 totalRecipients, uint256 amountEach);

    constructor() ERC20("Mock USDC", "mUSDC") Ownable(msg.sender) {
        // Mint 1M tokens to deployer for testing
        uint256 initialSupply = 1000000 * 10**_DECIMALS;
        _mint(msg.sender, initialSupply);
        emit TokensMinted(msg.sender, initialSupply);
    }

    /**
     * @notice Override decimals to return 6 (like real USDC)
     */
    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    // ========== MINTING FUNCTIONS ==========

    /**
     * @notice Mint tokens to specified address
     * @param to Address to receive tokens
     * @param amount Amount of tokens to mint (in token units, not wei)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Cannot mint to zero address");
        require(amount > 0, "Amount must be greater than 0");
        
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    /**
     * @notice Mint tokens to multiple addresses (for testing)
     * @param recipients Array of addresses to receive tokens
     * @param amounts Array of amounts to mint to each recipient
     */
    function batchMint(address[] calldata recipients, uint256[] calldata amounts) external onlyOwner {
        require(recipients.length == amounts.length, "Arrays length mismatch");
        require(recipients.length > 0, "Empty arrays not allowed");
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Cannot mint to zero address");
            require(amounts[i] > 0, "Amount must be greater than 0");
            
            _mint(recipients[i], amounts[i]);
            totalAmount += amounts[i];
            emit TokensMinted(recipients[i], amounts[i]);
        }
        
        emit BatchMintCompleted(recipients.length, totalAmount);
    }

    // ========== BURNING FUNCTIONS ==========

    /**
     * @notice Burn tokens from caller's balance
     * @param amount Amount of tokens to burn
     */
    function burn(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance to burn");
        
        _burn(msg.sender, amount);
        emit TokensBurned(msg.sender, amount);
    }

    /**
     * @notice Burn tokens from specified account (with allowance)
     * @param account Account to burn tokens from
     * @param amount Amount of tokens to burn
     */
    function burnFrom(address account, uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        require(account != address(0), "Cannot burn from zero address");
        
        _spendAllowance(account, msg.sender, amount);
        _burn(account, amount);
        emit TokensBurned(account, amount);
    }

    // ========== UTILITY FUNCTIONS ==========

    /**
     * @notice Get total supply in human-readable format
     * @return Formatted string showing total supply
     */
    function totalSupplyFormatted() external view returns (string memory) {
        return _formatAmount(totalSupply());
    }

    /**
     * @notice Get balance in human-readable format
     * @param account Address to check balance for
     * @return Formatted string showing balance
     */
    function balanceOfFormatted(address account) external view returns (string memory) {
        return _formatAmount(balanceOf(account));
    }

    /**
     * @notice Format amount with decimals and symbol
     * @param amount Raw amount to format
     * @return Formatted string
     */
    function _formatAmount(uint256 amount) internal pure returns (string memory) {
        uint256 wholePart = amount / 10**_DECIMALS;
        uint256 decimalPart = (amount % 10**_DECIMALS) / 10**(_DECIMALS-2);
        
        return string(abi.encodePacked(
            _toString(wholePart), 
            ".", 
            _padZeros(_toString(decimalPart), 2),
            " mUSDC"
        ));
    }

    // ========== ADVANCED FEATURES ==========

    /**
     * @notice Pause all token transfers (emergency)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause token transfers
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Airdrop tokens to many addresses efficiently
     * @param recipients Array of addresses to receive tokens
     * @param amountEach Amount each recipient receives
     */
    function airdrop(address[] calldata recipients, uint256 amountEach) external onlyOwner {
        require(recipients.length > 0, "Empty recipients array");
        require(amountEach > 0, "Amount must be greater than 0");
        
        uint256 totalAmount = recipients.length * amountEach;
        require(balanceOf(msg.sender) >= totalAmount, "Insufficient balance for airdrop");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Cannot airdrop to zero address");
            _transfer(msg.sender, recipients[i], amountEach);
        }
        
        emit AirdropCompleted(recipients.length, amountEach);
    }

    /**
     * @notice Emergency withdrawal of accidentally sent tokens
     * @param token Token contract address
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        require(token != address(this), "Cannot withdraw own tokens");
        IERC20(token).transfer(owner(), amount);
    }

    // ========== HELPER FUNCTIONS ==========

    /**
     * @notice Convert uint to string (helper function)
     * @param value Number to convert
     * @return String representation
     */
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        
        return string(buffer);
    }

    /**
     * @notice Pad string with leading zeros
     * @param str String to pad
     * @param length Desired length
     * @return Padded string
     */
    function _padZeros(string memory str, uint256 length) internal pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        if (strBytes.length >= length) return str;
        
        bytes memory result = new bytes(length);
        uint256 padCount = length - strBytes.length;
        
        // Add leading zeros
        for (uint256 i = 0; i < padCount; i++) {
            result[i] = "0";
        }
        
        // Add original string
        for (uint256 i = 0; i < strBytes.length; i++) {
            result[padCount + i] = strBytes[i];
        }
        
        return string(result);
    }

    // ========== OVERRIDE FUNCTIONS FOR PAUSABLE ==========

    /**
     * @notice Override transfer to respect pause state
     */
    function _update(address from, address to, uint256 value) internal override whenNotPaused {
        super._update(from, to, value);
    }

    // ========== VIEW FUNCTIONS ==========

    /**
     * @notice Get contract information
     * @return name Token name
     * @return symbol Token symbol  
     * @return decimals Token decimals
     * @return totalSupply Total token supply
     * @return owner Contract owner
     * @return paused Pause state
     */
    function getInfo() external view returns (
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint256 totalSupply,
        address owner,
        bool paused
    ) {
        return (
            name(),
            symbol(),
            decimals(),
            totalSupply(),
            owner(),
            paused()
        );
    }
}