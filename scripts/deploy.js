const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🚀 Starting deployment process...\n");

    // Get deployment account
    const [deployer] = await ethers.getSigners();
    console.log("📝 Deploying contracts with account:", deployer.address);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(balance), "ETH\n");

    // ========== DEPLOY MOCKUSDC ==========
    console.log("📦 Deploying MockUSDC...");
    
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();
    
    const mockUSDCAddress = await mockUSDC.getAddress();
    console.log("✅ MockUSDC deployed to:", mockUSDCAddress);
    
    // Get initial token info
    const tokenName = await mockUSDC.name();
    const tokenSymbol = await mockUSDC.symbol();
    const tokenDecimals = await mockUSDC.decimals();
    const totalSupply = await mockUSDC.totalSupply();
    
    console.log(`📊 Token Info: ${tokenName} (${tokenSymbol})`);
    console.log(`🔢 Decimals: ${tokenDecimals}`);
    console.log(`💎 Initial Supply: ${ethers.formatUnits(totalSupply, tokenDecimals)} ${tokenSymbol}\n`);

    // ========== DEPLOY RECURRINGCOMMITMENT ==========
    console.log("📦 Deploying RecurringCommitment...");
    
    const RecurringCommitment = await ethers.getContractFactory("RecurringCommitment");
    const recurringCommitment = await RecurringCommitment.deploy();
    await recurringCommitment.waitForDeployment();
    
    const recurringCommitmentAddress = await recurringCommitment.getAddress();
    console.log("✅ RecurringCommitment deployed to:", recurringCommitmentAddress);
    
    // Verify deployer has admin role
    const DEFAULT_ADMIN_ROLE = await recurringCommitment.DEFAULT_ADMIN_ROLE();
    const hasAdminRole = await recurringCommitment.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
    console.log("👑 Deployer has admin role:", hasAdminRole);
    
    const ARBITER_ROLE = await recurringCommitment.ARBITER_ROLE();
    const hasArbiterRole = await recurringCommitment.hasRole(ARBITER_ROLE, deployer.address);
    console.log("⚖️  Deployer has arbiter role:", hasArbiterRole, "\n");

    // ========== SETUP DEMO DATA ==========
    console.log("🎭 Setting up demo scenario...");
    
    // Create a second account for demo
    const accounts = await ethers.getSigners();
    const recipient = accounts[1] || accounts[0]; // Use second account or fallback to first
    
    console.log("👤 Demo recipient:", recipient.address);
    
    // Mint some tokens to recipient for testing
    if (accounts.length > 1) {
        console.log("🎁 Minting demo tokens to recipient...");
        await mockUSDC.mint(recipient.address, ethers.parseUnits("1000", tokenDecimals));
        const recipientBalance = await mockUSDC.balanceOf(recipient.address);
        console.log(`💰 Recipient balance: ${ethers.formatUnits(recipientBalance, tokenDecimals)} ${tokenSymbol}`);
    }

    // ========== SAVE DEPLOYMENT INFO ==========
    const deploymentInfo = {
        network: (await ethers.provider.getNetwork()).name,
        chainId: (await ethers.provider.getNetwork()).chainId.toString(),
        deployer: deployer.address,
        deploymentTime: new Date().toISOString(),
        contracts: {
            MockUSDC: {
                address: mockUSDCAddress,
                name: tokenName,
                symbol: tokenSymbol,
                decimals: tokenDecimals.toString(),
                initialSupply: totalSupply.toString()
            },
            RecurringCommitment: {
                address: recurringCommitmentAddress,
                adminRole: DEFAULT_ADMIN_ROLE,
                arbiterRole: ARBITER_ROLE
            }
        },
        demoAccounts: {
            deployer: deployer.address,
            recipient: recipient.address
        }
    };

    // Save to JSON file
    const deploymentsDir = "./deployments";
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir);
    }
    
    const filename = `${deploymentsDir}/deployment-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
    console.log("📁 Deployment info saved to:", filename);

    // ========== VERIFICATION INSTRUCTIONS ==========
    console.log("\n🔍 Contract Verification Commands:");
    console.log("Run these commands to verify contracts on Etherscan:");
    console.log(`npx hardhat verify --network <network> ${mockUSDCAddress}`);
    console.log(`npx hardhat verify --network <network> ${recurringCommitmentAddress}`);

    // ========== INTERACTION EXAMPLES ==========
    console.log("\n🎯 Next Steps - Try These Interactions:");
    console.log("1. Create a commitment:");
    console.log(`   recurringCommitment.createCommitment(`);
    console.log(`     "${recipient.address}",`);
    console.log(`     "${mockUSDCAddress}",`);
    console.log(`     ${ethers.parseUnits("100", tokenDecimals)}, // 100 tokens`);
    console.log(`     ${30 * 24 * 60 * 60}, // 30 days`);
    console.log(`     ${365 * 24 * 60 * 60}, // 1 year`);
    console.log(`     ${24 * 60 * 60} // 1 day grace`);
    console.log(`   )`);
    
    console.log("\n2. Approve tokens for spending:");
    console.log(`   mockUSDC.approve("${recurringCommitmentAddress}", ${ethers.parseUnits("1200", tokenDecimals)})`);
    
    console.log("\n3. Claim payment (as recipient):");
    console.log(`   recurringCommitment.claimPayment(0)`);

    console.log("\n✨ Deployment completed successfully!");
    console.log("🎉 Ready to interact with your contracts!");
    
    return {
        mockUSDC: mockUSDCAddress,
        recurringCommitment: recurringCommitmentAddress,
        deployer: deployer.address
    };
}

// Handle deployment errors
main()
    .then((addresses) => {
        console.log("\n📋 Final Summary:");
        console.log("MockUSDC:", addresses.mockUSDC);
        console.log("RecurringCommitment:", addresses.recurringCommitment);
        console.log("Deployer:", addresses.deployer);
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });