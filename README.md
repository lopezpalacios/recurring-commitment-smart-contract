# Recurring Commitment Smart Contract

A Solidity-based subscription payment system implementing the pull-payment pattern for secure, recurring transactions.

## 🎯 Overview

This project implements a decentralized subscription system where:
- **Payers** create commitments to pay recipients a fixed amount per period
- **Recipients** claim payments on their own schedule (pull-payment model)
- **Arbiters** can pause/resume commitments for dispute resolution
- **Admins** have emergency pause capabilities

## 🏗️ Architecture

### Core Contracts
- **RecurringCommitment.sol** - Main subscription contract with pull-payment logic
- **MockUSDC.sol** - Test token (USDC-like with 6 decimals)

### Key Features
- ✅ **Pull Payment Model** - Recipients control when to claim
- ✅ **Role-Based Access Control** - Admin and Arbiter roles
- ✅ **Reentrancy Protection** - Using OpenZeppelin's ReentrancyGuard
- ✅ **Emergency Pause** - Admin can halt all operations
- ✅ **Time-based Logic** - Automatic period calculations
- ✅ **Comprehensive Events** - Full audit trail

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Git

### Installation
```bash
# Clone the repository
git clone https://github.com/yourusername/recurring-commitment-smart-contract.git
cd recurring-commitment-smart-contract

# Install dependencies
npm install

# Copy environment file and configure
cp .env.example .env
# Edit .env with your settings

# Compile contracts
npm run build

# Run tests
npm run test

# Run tests with gas reporting
npm run test:gas
```

### Local Development
```bash
# Start local Hardhat node
npm run node

# Deploy to local network (in another terminal)
npm run deploy:local

# Run interaction demo
npm run interact:local
```

### Testnet Deployment
```bash
# Deploy to Sepolia testnet
npm run deploy:sepolia

# Verify contracts on Etherscan
npm run verify:sepolia <CONTRACT_ADDRESS>
```

## 📋 Usage Examples

### Creating a Commitment
```javascript
// Alice commits to pay Bob $100 every 30 days for 1 year
await recurringCommitment.createCommitment(
  bobAddress,           // recipient
  usdcAddress,          // token
  ethers.parseUnits("100", 6), // amount (100 USDC)
  30 * 24 * 60 * 60,    // period (30 days)
  365 * 24 * 60 * 60,   // duration (1 year)
  24 * 60 * 60          // grace period (1 day)
);
```

### Claiming Payments
```javascript
// Bob claims his payment after 30 days
await recurringCommitment.connect(bob).claimPayment(commitmentId);
```

### Admin Functions
```javascript
// Pause a specific commitment (arbiter only)
await recurringCommitment.connect(arbiter).pauseCommitment(commitmentId);

// Emergency pause all operations (admin only)
await recurringCommitment.emergencyPause();
```

## 🧪 Testing

The project includes comprehensive tests covering:
- Core functionality
- Edge cases
- Security scenarios
- Gas optimization
- Role-based access control

```bash
# Run all tests
npm run test

# Run with coverage
npm run test:coverage

# Run with gas reporting
npm run test:gas
```

## 🔒 Security Features

- **Reentrancy Protection** - Using OpenZeppelin ReentrancyGuard
- **Access Control** - Role-based permissions (Admin/Arbiter)
- **Input Validation** - Comprehensive parameter checking
- **Safe ERC20** - Using OpenZeppelin SafeERC20 for transfers
- **Pull Payments** - Recipients control claiming (DoS resistant)
- **Emergency Controls** - Pause functionality for crisis management

## 📊 Contract Addresses

### Sepolia Testnet
- RecurringCommitment: `0x...` (Update after deployment)
- MockUSDC: `0x...` (Update after deployment)

### Mainnet
- RecurringCommitment: `Not deployed`
- MockUSDC: `Not deployed`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- OpenZeppelin for secure contract templates
- Hardhat for development framework
- The Ethereum community for best practices