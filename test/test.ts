import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { MerkleTree } from 'merkletreejs'
import keccak256 from 'keccak256'

describe("SmartSBT contract", function () {
    type Node = {
        address: string,
        amount: number,
        group: number
    }
    const createTree = (allowList: Node[]) => {
      const leaves = allowList.map(node => ethers.utils.solidityKeccak256(['address', 'uint256', 'uint256'],
        [node.address, node.amount, node.group]))
      return new MerkleTree(leaves, keccak256, { sortPairs: true })
    }

    async function fixture() {  
      const [owner, account, ...others] = await ethers.getSigners()
      const getcontract = await ethers.getContractFactory("SmartSBT")
      const myContract = await getcontract.connect(owner).deploy()

      const [addr1, addr2, addr3, addr4] = others

      // マークルツリー作成
      const tree = createTree([{ address: addr1.address,amount:1,group:0},
                                { address: addr2.address,amount:2,group:0},
                                { address: addr3.address,amount:5,group:0},
                                { address: addr4.address,amount:10,group:0}]);
      await myContract.connect(owner).setMerkleRoot(tree.getHexRoot());
  
      return { myContract, owner,account, others,addr1, addr2, addr3, addr4,tree }
    }

    it("Mint normal and claim is over max amount", async function() {
        const { myContract, owner, account, others,addr1, addr2, addr3, addr4,tree } = await loadFixture(fixture)
        
        await myContract.connect(owner).pause(false);

        // addr1のマークルリーフ作成
        let proof = tree.getHexProof(ethers.utils.solidityKeccak256(
          ['address','uint256','uint256'], [addr1.address,1,0]));
        await expect(myContract.connect(addr1).alMint(1,1,0,proof)).not.to.be.reverted;
        await expect(myContract.connect(addr1).alMint(1,1,0,proof)).to.be.revertedWith("claim is over max amount")

        proof = tree.getHexProof(ethers.utils.solidityKeccak256(
          ['address','uint256','uint256'], [addr2.address,2,0]));
        await expect(myContract.connect(addr2).alMint(2,2,0,proof)).not.to.be.reverted;
        await expect(myContract.connect(addr2).alMint(1,2,0,proof)).to.be.revertedWith("claim is over max amount")

        proof = tree.getHexProof(ethers.utils.solidityKeccak256(
          ['address','uint256','uint256'], [addr3.address,5,0]));
        await expect(myContract.connect(addr3).alMint(5,5,0,proof)).not.to.be.reverted;
        await expect(myContract.connect(addr3).alMint(1,5,0,proof)).to.be.revertedWith("claim is over max amount")

        proof = tree.getHexProof(ethers.utils.solidityKeccak256(
          ['address','uint256','uint256'], [addr4.address,10,0]));
        await expect(myContract.connect(addr4).alMint(10,10,0,proof)).not.to.be.reverted;
        await expect(myContract.connect(addr4).alMint(1,10,0,proof)).to.be.revertedWith("claim is over max amount")
    });

    it("Mint mint is paused!", async function() {
      const { myContract, owner, account, others,addr1, addr2, addr3, addr4,tree } = await loadFixture(fixture)
      let proof = tree.getHexProof(ethers.utils.solidityKeccak256(
        ['address','uint256','uint256'], [addr1.address,1,0]));
      await expect(myContract.connect(addr1).alMint(1,1,0,proof)).to.be.revertedWith("mint is paused")
    });

    it("Mint You don't have a whitelist", async function() {
      const { myContract, owner, account, others,addr1, addr2, addr3, addr4,tree } = await loadFixture(fixture)

      await myContract.connect(owner).pause(false);

      let proof = tree.getHexProof(ethers.utils.solidityKeccak256(
        ['address','uint256','uint256'], [addr1.address,1,0]));
      await expect(myContract.connect(addr1).alMint(1,2,0,proof)).to.be.revertedWith("You don't have a whitelist")

      proof = tree.getHexProof(ethers.utils.solidityKeccak256(
        ['address','uint256','uint256'], [addr2.address,2,0]));
      await expect(myContract.connect(addr3).alMint(1,2,0,proof)).to.be.revertedWith("You don't have a whitelist")
    });

    it("Mint over max supply", async function() {
      const { myContract, owner, account, others,addr1, addr2, addr3, addr4,tree } = await loadFixture(fixture)

      await myContract.connect(owner).pause(false);
      await myContract.connect(owner).setMaxSupply(16);

      let proof = tree.getHexProof(ethers.utils.solidityKeccak256(
        ['address','uint256','uint256'], [addr1.address,1,0]));
      await expect(myContract.connect(addr1).alMint(1,1,0,proof)).not.to.be.reverted;

      proof = tree.getHexProof(ethers.utils.solidityKeccak256(
        ['address','uint256','uint256'], [addr2.address,2,0]));
      await expect(myContract.connect(addr2).alMint(2,2,0,proof)).not.to.be.reverted;

      proof = tree.getHexProof(ethers.utils.solidityKeccak256(
        ['address','uint256','uint256'], [addr3.address,5,0]));
      await expect(myContract.connect(addr3).alMint(5,5,0,proof)).not.to.be.reverted;

      await expect(myContract.connect(addr1).burn(1)).not.to.be.reverted; // burnしてもmaxSupplyの判定に影響がない確認のため

      proof = tree.getHexProof(ethers.utils.solidityKeccak256(
        ['address','uint256','uint256'], [addr4.address,10,0]));
      await expect(myContract.connect(addr4).alMint(8,10,0,proof)).not.to.be.reverted;
      await expect(myContract.connect(addr4).alMint(1,10,0,proof)).to.be.revertedWith("over max supply")
    });

    it("Mint Al Repeat", async function() {
      const { myContract, owner, account, others,addr1, addr2, addr3, addr4,tree } = await loadFixture(fixture)
      
      await myContract.connect(owner).pause(false);

      // addr1のマークルリーフ作成
      let proof = tree.getHexProof(ethers.utils.solidityKeccak256(
        ['address','uint256','uint256'], [addr1.address,1,0]));
      await expect(myContract.connect(addr1).alMint(1,1,0,proof)).not.to.be.reverted;
      await expect(myContract.connect(addr1).alMint(1,1,0,proof)).to.be.revertedWith("claim is over max amount")

      proof = tree.getHexProof(ethers.utils.solidityKeccak256(
        ['address','uint256','uint256'], [addr2.address,2,0]));
      await expect(myContract.connect(addr2).alMint(2,2,0,proof)).not.to.be.reverted;
      await expect(myContract.connect(addr2).alMint(1,2,0,proof)).to.be.revertedWith("claim is over max amount")

      // 次回ミントのために、クリア（2回目）
      await myContract.connect(owner).pause(true);
      await myContract.connect(owner).incAlcount();
      await myContract.connect(owner).pause(false);

      proof = tree.getHexProof(ethers.utils.solidityKeccak256(
        ['address','uint256','uint256'], [addr1.address,1,0]));
      await expect(myContract.connect(addr1).alMint(1,1,0,proof)).not.to.be.reverted;
      await expect(myContract.connect(addr1).alMint(1,1,0,proof)).to.be.revertedWith("claim is over max amount")

      proof = tree.getHexProof(ethers.utils.solidityKeccak256(
        ['address','uint256','uint256'], [addr2.address,2,0]));
      await expect(myContract.connect(addr2).alMint(2,2,0,proof)).not.to.be.reverted;
      await expect(myContract.connect(addr2).alMint(1,2,0,proof)).to.be.revertedWith("claim is over max amount")

      // 次回ミントのために、クリア（3回目）
      await myContract.connect(owner).pause(true);
      await myContract.connect(owner).incAlcount();
      await myContract.connect(owner).pause(false);

      proof = tree.getHexProof(ethers.utils.solidityKeccak256(
        ['address','uint256','uint256'], [addr1.address,1,0]));
      await expect(myContract.connect(addr1).alMint(1,1,0,proof)).not.to.be.reverted;
      await expect(myContract.connect(addr1).alMint(1,1,0,proof)).to.be.revertedWith("claim is over max amount")

      proof = tree.getHexProof(ethers.utils.solidityKeccak256(
        ['address','uint256','uint256'], [addr2.address,2,0]));
      await expect(myContract.connect(addr2).alMint(2,2,0,proof)).not.to.be.reverted;
      await expect(myContract.connect(addr2).alMint(1,2,0,proof)).to.be.revertedWith("claim is over max amount")
  });

  it("over max supply check", async function() {
      const { myContract, owner, account, others,addr1, addr2, addr3, addr4,tree } = await loadFixture(fixture)
      
      await myContract.connect(owner).setMaxSupply(10);
      await myContract.connect(owner).pause(false);

      // addr1のマークルリーフ作成
      let proof = tree.getHexProof(ethers.utils.solidityKeccak256(
        ['address','uint256','uint256'], [addr1.address,1,0]));
      await expect(myContract.connect(addr1).alMint(1,1,0,proof)).not.to.be.reverted;

      proof = tree.getHexProof(ethers.utils.solidityKeccak256(
        ['address','uint256','uint256'], [addr2.address,2,0]));
      await expect(myContract.connect(addr2).alMint(2,2,0,proof)).not.to.be.reverted;

      proof = tree.getHexProof(ethers.utils.solidityKeccak256(
        ['address','uint256','uint256'], [addr3.address,5,0]));
      await expect(myContract.connect(addr3).alMint(5,5,0,proof)).not.to.be.reverted;

      proof = tree.getHexProof(ethers.utils.solidityKeccak256(
        ['address','uint256','uint256'], [addr4.address,10,0]));
      await expect(myContract.connect(addr4).alMint(3,10,0,proof)).to.be.revertedWith("over max supply")
  });

  it("over max supply check(burn)", async function() {
    const { myContract, owner, account, others,addr1, addr2, addr3, addr4,tree } = await loadFixture(fixture)
      
    await myContract.connect(owner).setMaxSupply(10);
    await myContract.connect(owner).pause(false);

    // addr1のマークルリーフ作成
    let proof = tree.getHexProof(ethers.utils.solidityKeccak256(
      ['address','uint256','uint256'], [addr1.address,1,0]));
    await expect(myContract.connect(addr1).alMint(1,1,0,proof)).not.to.be.reverted;

    proof = tree.getHexProof(ethers.utils.solidityKeccak256(
      ['address','uint256','uint256'], [addr2.address,2,0]));
    await expect(myContract.connect(addr2).alMint(2,2,0,proof)).not.to.be.reverted;

    proof = tree.getHexProof(ethers.utils.solidityKeccak256(
      ['address','uint256','uint256'], [addr3.address,5,0]));
    await expect(myContract.connect(addr3).alMint(5,5,0,proof)).not.to.be.reverted;

    expect(await myContract.ownerOf(1)).to.equal(addr1.address);

    // burn
    await expect(myContract.connect(addr2).burn(1)).to.be.revertedWith("Only the owner can burn")
    await expect(myContract.connect(addr1).burn(1)).not.to.be.reverted;
    await expect(myContract.connect(addr3).burn(6)).not.to.be.reverted;

    await expect(myContract.ownerOf(1)).to.be.reverted

    proof = tree.getHexProof(ethers.utils.solidityKeccak256(
      ['address','uint256','uint256'], [addr4.address,10,0]));
    await expect(myContract.connect(addr4).alMint(3,10,0,proof)).to.be.revertedWith("over max supply")

  });

  it("burn→tokenId check", async function() {
    const { myContract, owner, account, others,addr1, addr2, addr3, addr4,tree } = await loadFixture(fixture)
      
    await myContract.connect(owner).setMaxSupply(10);
    await myContract.connect(owner).pause(false);

    // addr1のマークルリーフ作成
    let proof = tree.getHexProof(ethers.utils.solidityKeccak256(
      ['address','uint256','uint256'], [addr1.address,1,0]));
    await expect(myContract.connect(addr1).alMint(1,1,0,proof)).not.to.be.reverted;

    proof = tree.getHexProof(ethers.utils.solidityKeccak256(
      ['address','uint256','uint256'], [addr2.address,2,0]));
    await expect(myContract.connect(addr2).alMint(2,2,0,proof)).not.to.be.reverted;

    proof = tree.getHexProof(ethers.utils.solidityKeccak256(
      ['address','uint256','uint256'], [addr3.address,5,0]));
    await expect(myContract.connect(addr3).alMint(5,5,0,proof)).not.to.be.reverted;

    // burn
    await expect(myContract.connect(addr2).burn(1)).to.be.revertedWith("Only the owner can burn")
    await expect(myContract.connect(addr1).burn(1)).not.to.be.reverted;
    await expect(myContract.connect(addr3).burn(6)).not.to.be.reverted;

    proof = tree.getHexProof(ethers.utils.solidityKeccak256(
      ['address','uint256','uint256'], [addr4.address,10,0]));
    await expect(myContract.connect(addr4).alMint(2,10,0,proof)).not.to.be.reverted;
    expect (await myContract.tokensOfOwner(addr4.address)).to.deep.equals([9,10]);
  });
    

});