# Recurring Commitment Smart Contract

A Solidity-based subscription payment system implementing the pull-payment pattern for secure, recurring transactions.

## Features
- 🔄 **Pull-Payment Model** - Recipients control when to claim payments
- 🛡️ **Security First** - ReentrancyGuard, AccessControl, SafeERC20
- ⏰ **Time-Based Logic** - Automatic period calculations
- 🚨 **Emergency Controls** - Pause/unpause functionality
- 🎭 **Role Management** - Admin and Arbiter roles

## Tech Stack
- Solidity ^0.8.20
- OpenZeppelin Contracts
- Hardhat/Remix IDE