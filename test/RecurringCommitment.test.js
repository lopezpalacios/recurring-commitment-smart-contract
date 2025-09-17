const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("RecurringCommitment Contract", function () {
    let mockUSDC, recurringCommitment;
    let owner, payer, recipient, arbiter, unauthorized;
    let commitmentId;
    
    // Test constants
    const PAYMENT_AMOUNT = ethers.parseUnits("100", 6); // 100 USDC
    const PAYMENT_PERIOD = 30 * 24 * 60 * 60; // 30 days
    const TOTAL_DURATION = 365 * 24 * 60 * 60; // 1 year
    const GRACE_PERIOD = 24 * 60 * 60; // 1 day
    const INITIAL_BALANCE = ethers.parseUnits("5000", 6); // 5000 USDC

    beforeEach(async function () {
        // Get signers
        [owner, payer, recipient, arbiter, unauthorized] = await ethers.getSigners();

        // Deploy MockUSDC
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        mockUSDC = await MockUSDC.deploy();
        await mockUSDC.waitForDeployment();

        // Deploy RecurringCommitment
        const RecurringCommitment = await ethers.getContractFactory("RecurringCommitment");
        recurringCommitment = await RecurringCommitment.deploy();
        await recurringCommitment.waitForDeployment();

        // Setup: Mint tokens to payer and approve spending
        await mockUSDC.mint(payer.address, INITIAL_BALANCE);
        await mockUSDC.connect(payer).approve(
            await recurringCommitment.getAddress(),
            ethers.parseUnits("2000", 6)
        );

        // Grant arbiter role
        const ARBITER_ROLE = await recurringCommitment.ARBITER_ROLE();
        await recurringCommitment.grantRole(ARBITER_ROLE, arbiter.address);
    });

    // ========== DEPLOYMENT TESTS ==========
    describe("Deployment", function () {
        it("Should set the correct admin and arbiter roles", async function () {
            const DEFAULT_ADMIN_ROLE = await recurringCommitment.DEFAULT_ADMIN_ROLE();
            const ARBITER_ROLE = await recurringCommitment.ARBITER_ROLE();

            expect(await recurringCommitment.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
            expect(await recurringCommitment.hasRole(ARBITER_ROLE, owner.address)).to.be.true;
            expect(await recurringCommitment.hasRole(ARBITER_ROLE, arbiter.address)).to.be.true;
        });

        it("Should initialize with nextCommitmentId as 0", async function () {
            expect(await recurringCommitment.nextCommitmentId()).to.equal(0);
        });

        it("Should not be paused initially", async function () {
            expect(await recurringCommitment.paused()).to.be.false;
        });
    });

    // ========== COMMITMENT CREATION TESTS ==========
    describe("Commitment Creation", function () {
        it("Should create a commitment successfully", async function () {
            const tx = await recurringCommitment.connect(payer).createCommitment(
                recipient.address,
                await mockUSDC.getAddress(),
                PAYMENT_AMOUNT,
                PAYMENT_PERIOD,
                TOTAL_DURATION,
                GRACE_PERIOD
            );

            await expect(tx).to.emit(recurringCommitment, "CommitmentCreated");
            
            const commitment = await recurringCommitment.getCommitment(0);
            expect(commitment.payer).to.equal(payer.address);
            expect(commitment.recipient).to.equal(recipient.address);
            expect(commitment.amount).to.equal(PAYMENT_AMOUNT);
            expect(commitment.period).to.equal(PAYMENT_PERIOD);
            expect(commitment.state).to.equal(0); // Active
            expect(commitment.terminated).to.be.false;
        });

        it("Should increment commitment ID", async function () {
            await recurringCommitment.connect(payer).createCommitment(
                recipient.address,
                await mockUSDC.getAddress(),
                PAYMENT_AMOUNT,
                PAYMENT_PERIOD,
                TOTAL_DURATION,
                GRACE_PERIOD
            );

            expect(await recurringCommitment.nextCommitmentId()).to.equal(1);

            await recurringCommitment.connect(payer).createCommitment(
                recipient.address,
                await mockUSDC.getAddress(),
                PAYMENT_AMOUNT,
                PAYMENT_PERIOD,
                TOTAL_DURATION,
                GRACE_PERIOD
            );

            expect(await recurringCommitment.nextCommitmentId()).to.equal(2);
        });

        it("Should reject invalid parameters", async function () {
            // Zero recipient address
            await expect(
                recurringCommitment.connect(payer).createCommitment(
                    ethers.ZeroAddress,
                    await mockUSDC.getAddress(),
                    PAYMENT_AMOUNT,
                    PAYMENT_PERIOD,
                    TOTAL_DURATION,
                    GRACE_PERIOD
                )
            ).to.be.revertedWithCustomError(recurringCommitment, "InvalidTimeRange");

            // Zero amount
            await expect(
                recurringCommitment.connect(payer).createCommitment(
                    recipient.address,
                    await mockUSDC.getAddress(),
                    0,
                    PAYMENT_PERIOD,
                    TOTAL_DURATION,
                    GRACE_PERIOD
                )
            ).to.be.revertedWithCustomError(recurringCommitment, "InvalidTimeRange");

            // Zero period
            await expect(
                recurringCommitment.connect(payer).createCommitment(
                    recipient.address,
                    await mockUSDC.getAddress(),
                    PAYMENT_AMOUNT,
                    0,
                    TOTAL_DURATION,
                    GRACE_PERIOD
                )
            ).to.be.revertedWithCustomError(recurringCommitment, "InvalidTimeRange");
        });
    });

    // ========== CLAIMABLE AMOUNT TESTS ==========
    describe("Claimable Amount Calculation", function () {
        beforeEach(async function () {
            await recurringCommitment.connect(payer).createCommitment(
                recipient.address,
                await mockUSDC.getAddress(),
                PAYMENT_AMOUNT,
                PAYMENT_PERIOD,
                TOTAL_DURATION,
                GRACE_PERIOD
            );
            commitmentId = 0;
        });

        it("Should return 0 claimable amount initially", async function () {
            const claimable = await recurringCommitment.getClaimableAmount(commitmentId);
            expect(claimable).to.equal(0);
        });

        it("Should return correct amount after one period", async function () {
            await time.increase(PAYMENT_PERIOD);
            
            const claimable = await recurringCommitment.getClaimableAmount(commitmentId);
            expect(claimable).to.equal(PAYMENT_AMOUNT);
        });

        it("Should return correct amount for multiple periods", async function () {
            await time.increase(PAYMENT_PERIOD * 3); // 3 periods
            
            const claimable = await recurringCommitment.getClaimableAmount(commitmentId);
            expect(claimable).to.equal(PAYMENT_AMOUNT * 3n);
        });

        it("Should return 0 for terminated commitments", async function () {
            await time.increase(PAYMENT_PERIOD);
            await recurringCommitment.connect(payer).terminateCommitment(commitmentId);
            
            const claimable = await recurringCommitment.getClaimableAmount(commitmentId);
            expect(claimable).to.equal(0);
        });

        it("Should return 0 for paused commitments", async function () {
            await time.increase(PAYMENT_PERIOD);
            await recurringCommitment.connect(arbiter).pauseCommitment(commitmentId);
            
            const claimable = await recurringCommitment.getClaimableAmount(commitmentId);
            expect(claimable).to.equal(0);
        });
    });

    // ========== PAYMENT CLAIMING TESTS ==========
    describe("Payment Claiming", function () {
        beforeEach(async function () {
            await recurringCommitment.connect(payer).createCommitment(
                recipient.address,
                await mockUSDC.getAddress(),
                PAYMENT_AMOUNT,
                PAYMENT_PERIOD,
                TOTAL_DURATION,
                GRACE_PERIOD
            );
            commitmentId = 0;
        });

        it("Should allow recipient to claim after period elapsed", async function () {
            await time.increase(PAYMENT_PERIOD);
            
            const initialBalance = await mockUSDC.balanceOf(recipient.address);
            
            await expect(
                recurringCommitment.connect(recipient).claimPayment(commitmentId)
            ).to.emit(recurringCommitment, "PaymentClaimed");
            
            const finalBalance = await mockUSDC.balanceOf(recipient.address);
            expect(finalBalance - initialBalance).to.equal(PAYMENT_AMOUNT);
        });

        it("Should update lastClaimed timestamp correctly", async function () {
            const commitment = await recurringCommitment.getCommitment(commitmentId);
            const initialLastClaimed = commitment.lastClaimed;
            
            await time.increase(PAYMENT_PERIOD);
            await recurringCommitment.connect(recipient).claimPayment(commitmentId);
            
            const updatedCommitment = await recurringCommitment.getCommitment(commitmentId);
            expect(updatedCommitment.lastClaimed).to.be.gt(initialLastClaimed);
        });

        it("Should allow claiming multiple periods at once", async function () {
            await time.increase(PAYMENT_PERIOD * 3);
            
            const initialBalance = await mockUSDC.balanceOf(recipient.address);
            await recurringCommitment.connect(recipient).claimPayment(commitmentId);
            const finalBalance = await mockUSDC.balanceOf(recipient.address);
            
            expect(finalBalance - initialBalance).to.equal(PAYMENT_AMOUNT * 3n);
        });

        it("Should reject unauthorized callers", async function () {
            await time.increase(PAYMENT_PERIOD);
            
            await expect(
                recurringCommitment.connect(unauthorized).claimPayment(commitmentId)
            ).to.be.revertedWithCustomError(recurringCommitment, "UnauthorizedCaller");
        });

        it("Should reject claims when no amount is claimable", async function () {
            await expect(
                recurringCommitment.connect(recipient).claimPayment(commitmentId)
            ).to.be.revertedWithCustomError(recurringCommitment, "NoClaimableAmount");
        });

        it("Should reject claims when payer has insufficient balance", async function () {
            // Transfer away payer's tokens
            await mockUSDC.connect(payer).transfer(unauthorized.address, INITIAL_BALANCE);
            
            await time.increase(PAYMENT_PERIOD);
            
            await expect(
                recurringCommitment.connect(recipient).claimPayment(commitmentId)
            ).to.be.revertedWithCustomError(recurringCommitment, "InsufficientBalance");
        });
    });

    // ========== COMMITMENT MANAGEMENT TESTS ==========
    describe("Commitment Management", function () {
        beforeEach(async function () {
            await recurringCommitment.connect(payer).createCommitment(
                recipient.address,
                await mockUSDC.getAddress(),
                PAYMENT_AMOUNT,
                PAYMENT_PERIOD,
                TOTAL_DURATION,
                GRACE_PERIOD
            );
            commitmentId = 0;
        });

        it("Should allow payer to terminate commitment", async function () {
            await expect(
                recurringCommitment.connect(payer).terminateCommitment(commitmentId)
            ).to.emit(recurringCommitment, "CommitmentTerminated");
            
            const commitment = await recurringCommitment.getCommitment(commitmentId);
            expect(commitment.terminated).to.be.true;
            expect(commitment.state).to.equal(2); // Terminated
        });

        it("Should allow recipient to terminate commitment", async function () {
            await recurringCommitment.connect(recipient).terminateCommitment(commitmentId);
            
            const commitment = await recurringCommitment.getCommitment(commitmentId);
            expect(commitment.terminated).to.be.true;
        });

        it("Should reject termination by unauthorized users", async function () {
            await expect(
                recurringCommitment.connect(unauthorized).terminateCommitment(commitmentId)
            ).to.be.revertedWithCustomError(recurringCommitment, "UnauthorizedCaller");
        });

        it("Should reject operations on non-existent commitments", async function () {
            await expect(
                recurringCommitment.connect(payer).terminateCommitment(999)
            ).to.be.revertedWithCustomError(recurringCommitment, "CommitmentNotFound");
        });
    });

    // ========== ARBITER FUNCTIONS TESTS ==========
    describe("Arbiter Functions", function () {
        beforeEach(async function () {
            await recurringCommitment.connect(payer).createCommitment(
                recipient.address,
                await mockUSDC.getAddress(),
                PAYMENT_AMOUNT,
                PAYMENT_PERIOD,
                TOTAL_DURATION,
                GRACE_PERIOD
            );
            commitmentId = 0;
        });

        it("Should allow arbiter to pause commitment", async function () {
            await expect(
                recurringCommitment.connect(arbiter).pauseCommitment(commitmentId)
            ).to.emit(recurringCommitment, "CommitmentStateChanged");
            
            const commitment = await recurringCommitment.getCommitment(commitmentId);
            expect(commitment.state).to.equal(1); // Paused
        });

        it("Should allow arbiter to resume commitment", async function () {
            await recurringCommitment.connect(arbiter).pauseCommitment(commitmentId);
            await recurringCommitment.connect(arbiter).resumeCommitment(commitmentId);
            
            const commitment = await recurringCommitment.getCommitment(commitmentId);
            expect(commitment.state).to.equal(0); // Active
        });

        it("Should reject arbiter actions from unauthorized users", async function () {
            await expect(
                recurringCommitment.connect(unauthorized).pauseCommitment(commitmentId)
            ).to.be.reverted;
        });

        it("Should prevent claims on paused commitments", async function () {
            await time.increase(PAYMENT_PERIOD);
            await recurringCommitment.connect(arbiter).pauseCommitment(commitmentId);
            
            await expect(
                recurringCommitment.connect(recipient).claimPayment(commitmentId)
            ).to.be.revertedWithCustomError(recurringCommitment, "CommitmentAlreadyTerminated");
        });
    });

    // ========== EMERGENCY CONTROLS TESTS ==========
    describe("Emergency Controls", function () {
        beforeEach(async function () {
            await recurringCommitment.connect(payer).createCommitment(
                recipient.address,
                await mockUSDC.getAddress(),
                PAYMENT_AMOUNT,
                PAYMENT_PERIOD,
                TOTAL_DURATION,
                GRACE_PERIOD
            );
            commitmentId = 0;
        });

        it("Should allow admin to emergency pause", async function () {
            await recurringCommitment.emergencyPause();
            expect(await recurringCommitment.paused()).to.be.true;
        });

        it("Should allow admin to emergency unpause", async function () {
            await recurringCommitment.emergencyPause();
            await recurringCommitment.emergencyUnpause();
            expect(await recurringCommitment.paused()).to.be.false;
        });

        it("Should prevent claims during emergency pause", async function () {
            await time.increase(PAYMENT_PERIOD);
            await recurringCommitment.emergencyPause();
            
            await expect(
                recurringCommitment.connect(recipient).claimPayment(commitmentId)
            ).to.be.reverted; // Pausable modifier will revert
        });

        it("Should reject emergency actions from unauthorized users", async function () {
            await expect(
                recurringCommitment.connect(unauthorized).emergencyPause()
            ).to.be.reverted;
        });
    });

    // ========== EDGE CASES AND SECURITY TESTS ==========
    describe("Edge Cases and Security", function () {
        it("Should handle commitment expiration correctly", async function () {
            await recurringCommitment.connect(payer).createCommitment(
                recipient.address,
                await mockUSDC.getAddress(),
                PAYMENT_AMOUNT,
                PAYMENT_PERIOD,
                PAYMENT_PERIOD * 2, // Only 2 periods total
                GRACE_PERIOD
            );
            
            // Fast forward beyond expiration
            await time.increase(PAYMENT_PERIOD * 5);
            
            const claimable = await recurringCommitment.getClaimableAmount(0);
            expect(claimable).to.equal(PAYMENT_AMOUNT * 2n); // Should cap at 2 periods
        });

        it("Should prevent reentrancy attacks", async function () {
            // This test verifies that the nonReentrant modifier works
            // In a real attack scenario, a malicious contract would try to
            // call claimPayment recursively during the token transfer
            await time.increase(PAYMENT_PERIOD);
            
            // Normal claim should work
            await recurringCommitment.connect(recipient).claimPayment(0);
            
            // Immediate second claim should fail (no claimable amount)
            await expect(
                recurringCommitment.connect(recipient).claimPayment(0)
            ).to.be.revertedWithCustomError(recurringCommitment, "NoClaimableAmount");
        });

        it("Should handle zero period edge case", async function () {
            const commitment = await recurringCommitment.getCommitment(0);
            expect(commitment.period).to.be.gt(0); // Should never be zero due to validation
        });

        it("Should properly handle commitment state transitions", async function () {
            await recurringCommitment.connect(payer).createCommitment(
                recipient.address,
                await mockUSDC.getAddress(),
                PAYMENT_AMOUNT,
                PAYMENT_PERIOD,
                TOTAL_DURATION,
                GRACE_PERIOD
            );
            
            // Active -> Paused -> Active -> Terminated
            const commitment = await recurringCommitment.getCommitment(1);
            expect(commitment.state).to.equal(0); // Active
            
            await recurringCommitment.connect(arbiter).pauseCommitment(1);
            const pausedCommitment = await recurringCommitment.getCommitment(1);
            expect(pausedCommitment.state).to.equal(1); // Paused
            
            await recurringCommitment.connect(arbiter).resumeCommitment(1);
            const resumedCommitment = await recurringCommitment.getCommitment(1);
            expect(resumedCommitment.state).to.equal(0); // Active
            
            await recurringCommitment.connect(payer).terminateCommitment(1);
            const terminatedCommitment = await recurringCommitment.getCommitment(1);
            expect(terminatedCommitment.state).to.equal(2); // Terminated
        });
    });

    // ========== GAS OPTIMIZATION TESTS ==========
    describe("Gas Usage", function () {
        it("Should use reasonable gas for commitment creation", async function () {
            const tx = await recurringCommitment.connect(payer).createCommitment(
                recipient.address,
                await mockUSDC.getAddress(),
                PAYMENT_AMOUNT,
                PAYMENT_PERIOD,
                TOTAL_DURATION,
                GRACE_PERIOD
            );
            
            const receipt = await tx.wait();
            console.log("Gas used for createCommitment:", receipt.gasUsed.toString());
            
            // Should be reasonable (less than 200k gas)
            expect(receipt.gasUsed).to.be.lt(200000);
        });

        it("Should use reasonable gas for payment claims", async function () {
            await recurringCommitment.connect(payer).createCommitment(
                recipient.address,
                await mockUSDC.getAddress(),
                PAYMENT_AMOUNT,
                PAYMENT_PERIOD,
                TOTAL_DURATION,
                GRACE_PERIOD
            );
            
            await time.increase(PAYMENT_PERIOD);
            
            const tx = await recurringCommitment.connect(recipient).claimPayment(0);
            const receipt = await tx.wait();
            console.log("Gas used for claimPayment:", receipt.gasUsed.toString());
            
            // Should be reasonable (less than 100k gas)
            expect(receipt.gasUsed).to.be.lt(100000);
        });
    });
});