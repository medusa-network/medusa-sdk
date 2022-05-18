import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Contract, Signer } from 'ethers';
import { OracleFactory,OracleFactory__factory } from "/home/nalos/prog/medusa-hardhat/contracts/typechain";

describe('Deploy factory', function () {
  let mover: Contract, nft: Contract;
  let alice: Signer, bob: Signer;
  it("test passing", async () => {
        expect(2).eq(2);
        const [owner, _] = await ethers.getSigners();
        let factory = await new OracleFactory__factory(owner).deploy();
        const dkgAddr = await factory.startNewOracle();
        expect(dkgAddr).to.not.be.eq("0")
  });
})
