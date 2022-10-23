import assert from "assert";
import { artifacts, ethers } from "hardhat";
import { init, suite } from "../src/bn254_iden";
import * as sha256 from "fast-sha256";
import { newKeypair } from "../src/index";
import { hexlify, arrayify } from "ethers/lib/utils";
import { ShaTranscript } from "../src/transcript";
import { prove, verify } from "../src/dleq";
import { Playground, Playground__factory } from "../typechain";
import { ABIString, ABIAddress, ABIBytes32, ABIUint256 } from "../src/encoding";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Label } from "../src/encrypt";
import { BigNumber } from "ethers";

describe("dleq proof", () => {

    let owner: SignerWithAddress;
    let testContract: Playground;
    before(async () => {
        await init();
    });

    beforeEach(async () => {
        const [a1] = await ethers.getSigners();
        owner = a1;
        testContract = await new Playground__factory(owner).deploy();
    })
    it("typescript verification", () => {
        let secret = suite.scalar().random();
        let b2 = suite.base2();
        let rg2 = suite.base2().mul(secret);
        let rg1 = suite.base1().mul(secret);
        let prover_transcript = new ShaTranscript();
        let proof = prove(suite, prover_transcript, secret, rg1, rg2);
        let verifier_transcript = new ShaTranscript();
        let valid = verify(suite, verifier_transcript, rg1, rg2, proof);
        assert.ok(valid);

        proof.toEvm();

        proof.f = suite.scalar().random();
        assert.ok(!verify(suite, new ShaTranscript(), rg1, rg2, proof));

        let invalid_transcript = new ShaTranscript();
        invalid_transcript.append(ABIString("fiat shamir is the weakness"));
        assert.ok(!verify(suite, invalid_transcript, rg1, rg2, proof));
    });

    it("onchain transcript verification", async () => {
        console.log(await artifacts.getArtifactPaths());
        const labelP = suite.point().random();
        const hashP = suite.point().random();
        const myAddr = await owner.getAddress();
        const evmVersion = await testContract.shathis(labelP.toEvm(), myAddr, hashP.toEvm());
        console.log(evmVersion);
        //const label = ethers.utils.soliditySha256(["address", "uint256", "uint256"], [myAddr, evmP.x, evmP.y]);//ethers.utils.toUtf8Bytes(myAddr));
        const label = new ShaTranscript().append(ABIAddress(myAddr)).append(labelP).digest();
        const finalSha = new ShaTranscript().append(ABIBytes32(label)).append(hashP).digest();
        console.log(finalSha);
        assert.strictEqual(evmVersion, finalSha);
    });

    it("onchain dleq proof verification", async () => {
        let secret = suite.scalar().random();
        let rg1 = suite.base1().mul(secret);
        let rg2 = suite.base2().mul(secret);
        // fake label
        let label = Label.from(rg1, owner.address, owner.address);
        //const label = new BigNumber.from(100);
        //const labelABI = ABIUint256(label);
        let prover_transcript = new ShaTranscript().append(label);
        let proof = prove(suite, prover_transcript, secret, rg1, rg2);
        // verify still locally
        let verifier_transcript = new ShaTranscript().append(label);
        let valid = verify(suite, verifier_transcript, rg1, rg2, proof);
        assert.ok(valid, "local verification fails");
        // verify onchain
        const check = await testContract.verifyDLEQProof(rg1.toEvm(), rg2.toEvm(), proof.toEvm(), label.toEvm());
        assert.ok(check, "smart contract verification fail");
        /// challenge
        //const challenge = await testContract.verifyDLEQProof(rg1.toEvm(), rg2.toEvm(), proof.toEvm(), label.toEvm());
        //console.log("challenge evm = ", challenge);
        //console.log("challenge proof: ", proof.e);
        /// w1 = fG1 + r
        //const g1fe = await testContract.verifyDLEQProof(rg1.toEvm(), rg2.toEvm(), proof.toEvm(), label);
        //const chal = suite.scalar().fromEvm(g1fe)._unsafeUnwrap();
        //console.log("chal from evm: ", g1fe.toHexString());
        //const w2 = suite.point().fromEvm(g1fe)._unsafeUnwrap();
        //console.log("w2 from evm: ", w2.toEvm().x.toString());
        // normalization via serialization
        // const g1fl = suite.point().deserialize(suite.base1().mul(proof.f).serialize())._unsafeUnwrap();
        // FALSE !?
        //console.log("are g1f equal?", suite.point().fromEvm(g1fe)._unsafeUnwrap().equal(g1fl));
        /// proof.f
        //const evmF = await testContract.verifyDLEQProof(rg1.toEvm(), rg2.toEvm(), proof.toEvm(), label.toEvm());
        //const F = proof.f;
        // -> TRUE
        //console.log("are f equal?", suite.scalar().fromEvm(evmF)._unsafeUnwrap().equal(F));
        /// g1
        //const evmG1 = await testContract.verifyDLEQProof(rg1.toEvm(), rg2.toEvm(), proof.toEvm(), label.toEvm());
        //const G1 = suite.base1();
        ///// -> TRUE
        //console.log("are g1f equal?", suite.point().fromEvm(evmG1)._unsafeUnwrap().equal(G1));

        /// algebra local
        //const a = suite.point().random();
        //const b = suite.point().set(a).neg();
        //const c = a.add(b);
        //console.log(" (local) addition a + (-a) = 0", c.equal(suite.point().zero()));
        ///// identity example OK
        //const pp = suite.point().random();
        //const ppContractEvm = await testContract.identity(pp.toEvm());
        //const ppContract = suite.point().fromEvm(ppContractEvm)._unsafeUnwrap();
        //console.log(" identity evm (point) -> point give same result as local ? ", ppContract.equal(pp));

        ////// scalarmul example FALSE
        //const r = suite.scalar().random();
        //const p = suite.point().random();
        //const res = p.mul(r);
        //const resEvm = await testContract.scalarMul(p.toEvm(), r.toEvm());
        //const decRes = suite.point().fromEvm(resEvm)._unsafeUnwrap();
        //console.log(" scalarmultiply evm (point,scalar) -> scalar*point give same result as local ? ", decRes.equal(res));

        //// point add example FALSE
        //const p1 = suite.point().random();
        //const p2 = suite.point().random();
        //const resAdd = p1.add(p2);
        //const resAddEVM = await testContract.pointAdd(p1.toEvm(), p2.toEvm());
        //const decAddRes = suite.point().fromEvm(resAddEVM)._unsafeUnwrap();
        //console.log(" point add evm (p1,p2) -> p1+p2 give same result as local ? ", decAddRes.equal(resAdd));
        //console.log(" point add --> evmresult.x ", hexlify(decAddRes.toEvm().x));
        //console.log(" point add --> localresult.x ", hexlify(resAdd.toEvm().x));

    });



});