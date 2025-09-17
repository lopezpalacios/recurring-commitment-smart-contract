const { ethers } = require("hardhat");

async function main() {
    console.log("🎬 Starting RecurringCommitment Demo...\n");

    // ========== SETUP ACCOUNTS ==========
    const [deployer, alice, bob, carol] = await ethers.getSigners();
    
    console.log("👥 Demo Participants:");
    console.log("🏦 Deployer (Bank):", deployer.address);
    console.log("👩 Alice (Payer):", alice.address);
    console.log("👨 Bob (Recipient):", bob.address);
    console.log("👩‍💼 Carol (Arbiter):", carol.address);
    console.log("");

    // ========== GET DEPLOYED CONTRACTS ==========
    console.log("🔍 Connecting to deployed contracts...");
    
    // You'll need to update these addresses after deployment
    const MOCKUSDC_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // Update this
    const RECURRING_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"; // Update this
    
    const mockUSDC = await ethers.getContractAt("MockUSDC", MOCKUSDC_ADDRESS);
    const recurringCommitment = await ethers.getContractAt("RecurringCommitment", RECURRING_ADDRESS);
    
    console.log("✅ MockUSDC connected at:", await mockUSDC.getAddress());
    console.log("✅ RecurringCommitment connected at:", await recurringCommitment.getAddress());
    console.log("");

    // ========== INITIAL SETUP ==========
    console.log("🎁 Setting up demo balances...");
    
    // Mint tokens to Alice (she'll be the payer)
    await mockUSDC.mint(alice.address, ethers.parseUnits("5000", 6)); // 5000 USDC
    await mockUSDC.mint(bob.address, ethers.parseUnits("100", 6));    // 100 USDC for Bob
    
    console.log("💰 Alice balance:", ethers.formatUnits(await mockUSDC.balanceOf(alice.address), 6), "USDC");
    console.log("💰 Bob balance:", ethers.formatUnits(await mockUSDC.balanceOf(bob.address), 6), "USDC");
    
    // Grant Carol arbiter role
    const ARBITER_ROLE = await recurringCommitment.ARBITER_ROLE();
    await recurringCommitment.grantRole(ARBITER_ROLE, carol.address);
    console.log("⚖️  Carol granted arbiter role");
    console.log("");

    // ========== SCENARIO 1: CREATE SUBSCRIPTION ==========
    console.log("📋 SCENARIO 1: Alice creates a subscription to pay Bob");
    console.log("💡 Setup: $100 every 30 days for 1 year (12 payments total)");
    
    const paymentAmount = ethers.parseUnits("100", 6);     // $100 USDC
    const paymentPeriod = 30 * 24 * 60 * 60;              // 30 days in seconds
    const totalDuration = 365 * 24 * 60 * 60;             // 1 year in seconds
    const gracePeriod = 24 * 60 * 60;                     // 1 day grace period
    
    // Alice approves the contract to spend her tokens
    console.log("🔐 Alice approving contract to spend USDC...");
    await mockUSDC.connect(alice).approve(
        await recurringCommitment.getAddress(),
        ethers.parseUnits("1200", 6) // Approve enough for all payments
    );
    
    // Alice creates the commitment
    console.log("📝 Alice creating commitment...");
    const tx = await recurringCommitment.connect(alice).createCommitment(
        bob.address,           // recipient
        await mockUSDC.getAddress(), // token
        paymentAmount,         // amount per period
        paymentPeriod,         // period in seconds
        totalDuration,         // total duration
        gracePeriod           // grace period
    );
    
    const receipt = await tx.wait();
    const commitmentId = 0; // First commitment gets ID 0
    
    console.log("✅ Commitment created with ID:", commitmentId);
    console.log("📄 Transaction hash:", receipt.hash);
    
    // Get commitment details
    const commitment = await recurringCommitment.getCommitment(commitmentId);
    console.log("📊 Commitment Details:");
    console.log("   Payer:", commitment.payer);
    console.log("   Recipient:", commitment.recipient);
    console.log("   Amount per period:", ethers.formatUnits(commitment.amount, 6), "USDC");
    console.log("   Period:", commitment.period.toString(), "seconds");
    console.log("   State:", commitment.state === 0n ? "Active" : commitment.state === 1n ? "Paused" : "Terminated");
    console.log("");

    // ========== SCENARIO 2: IMMEDIATE CLAIM ATTEMPT ==========
    console.log("📋 SCENARIO 2: Bob tries to claim immediately (should fail)");
    
    let claimableAmount = await recurringCommitment.getClaimableAmount(commitmentId);
    console.log("💰 Claimable amount:", ethers.formatUnits(claimableAmount, 6), "USDC");
    
    if (claimableAmount === 0n) {
        console.log("⏰ No payment due yet - need to wait for first period");
        try {
            await recurringCommitment.connect(bob).claimPayment(commitmentId);
        } catch (error) {
            console.log("❌ Claim failed as expected:", error.message.split('(')[0]);
        }
    }
    console.log("");

    // ========== SCENARIO 3: SIMULATE TIME PASSAGE ==========
    console.log("📋 SCENARIO 3: Simulating time passage (fast-forward 31 days)");
    
    // Fast-forward time by 31 days (more than one period)
    await ethers.provider.send("evm_increaseTime", [31 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");
    
    claimableAmount = await recurringCommitment.getClaimableAmount(commitmentId);
    console.log("💰 Claimable amount after 31 days:", ethers.formatUnits(claimableAmount, 6), "USDC");
    
    // Bob claims his first payment
    console.log("💸 Bob claiming payment...");
    const bobBalanceBefore = await mockUSDC.balanceOf(bob.address);
    
    await recurringCommitment.connect(bob).claimPayment(commitmentId);
    
    const bobBalanceAfter = await mockUSDC.balanceOf(bob.address);
    console.log("✅ Payment claimed successfully!");
    console.log("💰 Bob's balance before:", ethers.formatUnits(bobBalanceBefore, 6), "USDC");
    console.log("💰 Bob's balance after:", ethers.formatUnits(bobBalanceAfter, 6), "USDC");
    console.log("📈 Bob received:", ethers.formatUnits(bobBalanceAfter - bobBalanceBefore, 6), "USDC");
    console.log("");

    // ========== SCENARIO 4: MULTIPLE PERIODS ==========
    console.log("📋 SCENARIO 4: Skip 2 months, claim multiple periods at once");
    
    // Fast-forward another 60 days (2 more periods)
    await ethers.provider.send("evm_increaseTime", [60 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");
    
    claimableAmount = await recurringCommitment.getClaimableAmount(commitmentId);
    console.log("💰 Claimable amount after 3 total periods:", ethers.formatUnits(claimableAmount, 6), "USDC");
    
    const bobBalanceBefore2 = await mockUSDC.balanceOf(bob.address);
    await recurringCommitment.connect(bob).claimPayment(commitmentId);
    const bobBalanceAfter2 = await mockUSDC.balanceOf(bob.address);
    
    console.log("✅ Multiple periods claimed!");
    console.log("💰 Bob received:", ethers.formatUnits(bobBalanceAfter2 - bobBalanceBefore2, 6), "USDC");
    console.log("");

    // ========== SCENARIO 5: ARBITER ACTIONS ==========
    console.log("📋 SCENARIO 5: Carol (Arbiter) pauses the commitment");
    
    console.log("⚖️  Carol pausing commitment...");
    await recurringCommitment.connect(carol).pauseCommitment(commitmentId);
    
    const commitmentAfterPause = await recurringCommitment.getCommitment(commitmentId);
    console.log("📊 Commitment state after pause:", 
        commitmentAfterPause.state === 0n ? "Active" : 
        commitmentAfterPause.state === 1n ? "Paused" : "Terminated");
    
    // Try to claim while paused
    console.log("🚫 Bob trying to claim while paused...");
    try {
        await recurringCommitment.connect(bob).claimPayment(commitmentId);
    } catch (error) {
        console.log("❌ Claim failed while paused:", error.message.split('(')[0]);
    }
    
    // Carol resumes the commitment
    console.log("▶️  Carol resuming commitment...");
    await recurringCommitment.connect(carol).resumeCommitment(commitmentId);
    console.log("✅ Commitment resumed");
    console.log("");

    // ========== SCENARIO 6: EMERGENCY PAUSE ==========
    console.log("📋 SCENARIO 6: Emergency pause by admin");
    
    console.log("🚨 Deployer (admin) triggering emergency pause...");
    await recurringCommitment.emergencyPause();
    
    console.log("🚫 Trying operations while emergency paused...");
    try {
        await recurringCommitment.connect(bob).claimPayment(commitmentId);
    } catch (error) {
        console.log("❌ Claim failed during emergency:", error.message.split('(')[0]);
    }
    
    // Resume from emergency
    console.log("🔄 Admin resuming from emergency pause...");
    await recurringCommitment.emergencyUnpause();
    console.log("✅ Emergency resolved");
    console.log("");

    // ========== SCENARIO 7: TERMINATION ==========
    console.log("📋 SCENARIO 7: Alice terminates the commitment");
    
    console.log("🛑 Alice terminating commitment...");
    await recurringCommitment.connect(alice).terminateCommitment(commitmentId);
    
    const finalCommitment = await recurringCommitment.getCommitment(commitmentId);
    console.log("📊 Final commitment state:", 
        finalCommitment.state === 0n ? "Active" : 
        finalCommitment.state === 1n ? "Paused" : "Terminated");
    console.log("🔒 Terminated:", finalCommitment.terminated);
    
    // Try to claim after termination
    console.log("🚫 Bob trying to claim after termination...");
    try {
        await recurringCommitment.connect(bob).claimPayment(commitmentId);
    } catch (error) {
        console.log("❌ Claim failed after termination:", error.message.split('(')[0]);
    }
    console.log("");

    // ========== FINAL SUMMARY ==========
    console.log("📊 FINAL SUMMARY");
    console.log("================");
    
    const finalAliceBalance = await mockUSDC.balanceOf(alice.address);
    const finalBobBalance = await mockUSDC.balanceOf(bob.address);
    
    console.log("💰 Alice final balance:", ethers.formatUnits(finalAliceBalance, 6), "USDC");
    console.log("💰 Bob final balance:", ethers.formatUnits(finalBobBalance, 6), "USDC");
    console.log("📈 Total paid to Bob:", ethers.formatUnits(finalBobBalance - ethers.parseUnits("100", 6), 6), "USDC");
    
    console.log("\n🎉 Demo completed successfully!");
    console.log("✨ All subscription features demonstrated!");
}

// Helper function to wait for user input (for interactive demos)
async function waitForInput(message) {
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    return new Promise((resolve) => {
        readline.question(message + " (Press Enter to continue)", () => {
            readline.close();
            resolve();
        });
    });
}

// Run the demo
main()
    .then(() => {
        console.log("\n✅ Interaction demo completed!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Demo failed:", error);
        process.exit(1);
    });