import assert from "assert";
import { ethers, artifacts } from "hardhat";
import { init, suite } from "../src/bn254";
import * as sha256 from "fast-sha256";
import { newKeypair } from "../src/index";
import { hexlify, arrayify } from "ethers/lib/utils";
import { ShaTranscript } from "../src/transcript";
import { prove, verify } from "../src/dleq";
import { Playground, Playground__factory } from "../typechain";
import { ABIString, ABIAddress, ABIBytes32 } from "../src/encoding";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { Label } from "../src/encrypt";

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
        let rg1 = suite.base1().mul(secret);
        let rg2 = suite.base2().mul(secret);
        let prover_transcript = new ShaTranscript();
        let proof = prove(suite, prover_transcript, secret, rg1, rg2);
        let verifier_transcript = new ShaTranscript();
        let valid = verify(suite, verifier_transcript, rg1, rg2, proof);
        assert.ok(valid);

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
        let prover_transcript = new ShaTranscript().append(label);
        let proof = prove(suite, prover_transcript, secret, rg1, rg2);
        // verify still locally
        let verifier_transcript = new ShaTranscript().append(label);
        let valid = verify(suite, verifier_transcript, rg1, rg2, proof);
        assert.ok(valid);
        // verify onchain
        //const check = await testContract.verifyDLEQProof(rg1.toEvm(), rg2.toEvm(), proof.toEvm(), label.toEvm());
        //assert.ok(check);
        //const w1 = await testContract.DLEQDe(rg1.toEvm(), proof.toEvm());
        //console.log("from contract: w1.x :", w1.x.toString());

    });



});