import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers } from "hardhat";
import merkle from "../scripts/merkle";

import { Refund } from "../typechain-types";

chai.use(chaiAsPromised);

describe("Contract", function () {
    let refundContract: Refund;

    let owner: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let carol: SignerWithAddress;
    let dan: SignerWithAddress;

    const aliceAmount = "1";
    const bobAmount = "2.5";
    const carolAmount = "0.35";
    const danAmount = "0.002";

    const refundPeriodDuration = 90 * 24 * 60 * 60; // 90 days

    let merkleRoot: string;

    // helpers
    let getProof: (investor: SignerWithAddress) => string[];
    const buildMerkle = (decimals: number, data: Record<string, string>) => {
        const merkleTree = merkle.getMerkle(decimals, data);
        merkleRoot = merkleTree.getHexRoot();

        getProof = (investor: SignerWithAddress) =>
            merkle.getProof(merkleTree, investor.address, data[investor.address], decimals);
    };

    const increaseTime = async (seconds: number) => {
        await ethers.provider.send("evm_increaseTime", [seconds]);
        await ethers.provider.send("evm_mine", []);
    };

    before(async function () {
        [owner, alice, bob, carol, dan] = await ethers.getSigners();

        // build merkle tree
        buildMerkle(18, {
            [alice.address]: aliceAmount,
            [bob.address]: bobAmount,
            [carol.address]: carolAmount,
            [dan.address]: danAmount,
        });
    });

    beforeEach(async function () {
        const RefundFactory = await ethers.getContractFactory("Refund");
        refundContract = (await RefundFactory.deploy(merkleRoot)) as Refund;
        await refundContract.deployed();

        // transfer 3.852 ETH to the contract
        await owner.sendTransaction({
            to: refundContract.address,
            value: ethers.utils.parseEther("3.852"),
        });
    });

    describe("constructor", function () {
        it("should set merkle root", async function () {
            expect(await refundContract.merkleRoot()).to.equal(merkleRoot);
        });

        it("should revert if merkle root is empty", async function () {
            const RefundFactory = await ethers.getContractFactory("Refund");
            await expect(RefundFactory.deploy(ethers.constants.HashZero)).to.be.revertedWith("Merkle root cannot be empty");
        });

        it("should set the owner", async function () {
            expect(await refundContract.owner()).to.equal(owner.address);
        });

        it("should set the refund deadline", async function () {
            const block = await ethers.provider.getBlock("latest");
            expect(await refundContract.refundDeadline()).to.equal(block.timestamp + refundPeriodDuration - 1);
        });
    });

    describe("refund", function () {
        it("should rever if the deadline has passed", async function () {
            await increaseTime(refundPeriodDuration + 1);

            const aliceProof = getProof(alice);
            const weiAliceAmount = ethers.utils.parseEther(aliceAmount)

            await expect(refundContract.connect(alice).claimRefund(aliceProof, weiAliceAmount)).to.be.revertedWith("Refund period over");
        });

        it("should revert if the proof is invalid", async function () {
            const bobProof = getProof(bob);
            const weiAliceAmount = ethers.utils.parseEther(aliceAmount)

            await expect(refundContract.connect(alice).claimRefund(bobProof, weiAliceAmount)).to.be.revertedWith("Invalid proof");
        });

        it("should revert if user already claimed", async function () {
            const aliceProof = getProof(alice);
            const weiAliceAmount = ethers.utils.parseEther(aliceAmount)

            await refundContract.connect(alice).claimRefund(aliceProof, weiAliceAmount);

            await expect(refundContract.connect(alice).claimRefund(aliceProof, weiAliceAmount)).to.be.revertedWith("Already claimed");
        });

        it("should correctly refund the user", async function () {
            const aliceProof = getProof(alice);
            const weiAliceAmount = ethers.utils.parseEther(aliceAmount)

            expect(await refundContract.connect(alice).claimRefund(aliceProof, weiAliceAmount))
                // check that the event is emitted with the correct arguments
                .to.emit(refundContract, "Refunded").withArgs(alice.address, weiAliceAmount)
                // check that the correct amount is refunded
                .to.changeEtherBalance(alice, weiAliceAmount);

            // check that the user is marked as claimed
            expect(await refundContract.claimed(alice.address)).to.equal(true);
        });
    });

    describe("withdraw", function () {
        const amountToWithdraw = ethers.utils.parseEther("0.35");

        it("should revert if the caller is not the owner", async function () {
            await expect(refundContract.connect(alice).withdraw(amountToWithdraw)).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("should revert if the deadline has not passed", async function () {
            await expect(refundContract.connect(owner).withdraw(amountToWithdraw)).to.be.revertedWith("Refund period not over");
        });

        it("should revert if the contract balance is less than _amount", async function () {
            await refundContract.connect(alice).claimRefund(getProof(alice), ethers.utils.parseEther(aliceAmount));
            await refundContract.connect(bob).claimRefund(getProof(bob), ethers.utils.parseEther(bobAmount));
            await refundContract.connect(carol).claimRefund(getProof(carol), ethers.utils.parseEther(carolAmount));
            await refundContract.connect(dan).claimRefund(getProof(dan), ethers.utils.parseEther(danAmount));

            await increaseTime(refundPeriodDuration + 1);

            await expect(refundContract.connect(owner).withdraw(amountToWithdraw)).to.be.revertedWith("Insufficient funds");
        });

        it("should correctly withdraw", async function () {
            await increaseTime(refundPeriodDuration + 1);

            expect(await refundContract.connect(owner).withdraw(amountToWithdraw))
                // check that the event is emitted with the correct arguments
                .to.emit(refundContract, "Withdrawn").withArgs(owner.address, amountToWithdraw)
                // check that the correct amount is withdrawn
                .to.changeEtherBalance(owner, amountToWithdraw);
        });
    });
});
