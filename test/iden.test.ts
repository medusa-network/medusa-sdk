import assert from "assert";
import { BigNumber } from "ethers";
import { FFIScalar, buildBn128, WasmCurve, WasmField } from "ffjavascript";
import { random } from "ffjavascript";
import { ethers } from "hardhat";
import { bnToArray } from "../src/utils";
import { Playground__factory } from "../typechain";
import { suite as BNSuite, init } from "../src/bn254_iden";

describe("use ident", async () => {
    let suite: WasmCurve;
    let group: WasmCurve;
    let field: WasmField;
    beforeEach(async () => {
        suite = await buildBn128();
        group = suite.G1;
        field = suite.Fr;
    });

    it("suite serialization works", async () => {
        await init();
        const p1 = BNSuite.point().random();
        const buff = p1.serialize();
        const p2 = BNSuite.point().deserialize(buff);
        assert.ok(p2.isOk(), "suite serialization doesn't work");

        const f1 = BNSuite.scalar().random();
        const bufff = f1.serialize();
        const f2 = BNSuite.scalar().deserialize(bufff);
        assert.ok(f2.isOk());
    }).timeout(1000000);


    it("scalar work", async () => {
        let s1 = field.one;
        let s2 = field.one;
        let s3 = field.add(s1, s2);
        let s4 = field.neg(s3)
        // a + (-a) = 0
        let s5 = field.add(s3, s4);
        assert.ok(field.isZero(s5));
    });

    it("point work", async () => {
        let g1 = group.g;
        let f1 = field.random();
        let g2 = group.timesScalar(g1, f1);
        let g3 = group.neg(g2);
        let g4 = group.add(g2, g3);
        assert.ok(group.isZero(g4));
    });

    function pointToEvm(p) {
        let obj = group.toObject(group.toAffine(p));
        return { x: BigNumber.from(obj[0]), y: BigNumber.from(obj[1]) }
    }
    function evmToPoint(e) {
        return group.fromObject([e.x.toBigInt(), e.y.toBigInt()]);
    }

    function scalarToEvm(s) {
        return BigNumber.from(field.toObject(s));
    }
    function evmToScalar(e) {
        return field.fromObject(e.toBigInt());
    }

    it("is compatible with EVM", async () => {
        const [owner] = await ethers.getSigners();
        const testContract = await new Playground__factory(owner).deploy();
        let f = field.random();
        let g = group.timesScalar(group.g, f);
        let evmRes = await testContract.identity(pointToEvm(g));
        let decoded = evmToPoint(evmRes);
        assert.ok(group.eq(decoded, g), "identity check fail");


        // scalar mult
        let gf = group.timesFr(group.g, f);
        evmRes = await testContract.scalarMul(pointToEvm(group.g), scalarToEvm(f))
        decoded = evmToPoint(evmRes);
        assert.ok(group.eq(decoded, gf), "scalar mult failing");

        // point addition 
        let sum = group.add(decoded, decoded);
        let sumEvm = pointToEvm(sum);
        evmRes = await testContract.pointAdd(pointToEvm(decoded), pointToEvm(decoded));
        decoded = evmToPoint(evmRes);
        assert.ok(group.eq(decoded, sum), "point addition fail");


        // id scalar
        evmRes = await testContract.idScalar(scalarToEvm(f));
        decoded = evmToScalar(evmRes);
        assert.ok(field.eq(f, decoded));
    });

    it("suite works as expected", async () => {
        await init();
        const [owner] = await ethers.getSigners();
        const testContract = await new Playground__factory(owner).deploy();
        let p1 = BNSuite.point().random();
        let evmRes = await testContract.identity(p1.toEvm());
        assert.ok(p1, BNSuite.point().fromEvm(evmRes)._unsafeUnwrap(), "suite identity fail");

        let p2 = BNSuite.point().random();
        let p3 = BNSuite.point().set(p2).add(p1);
        evmRes = await testContract.pointAdd(p1.toEvm(), p2.toEvm());
        let decoded = BNSuite.point().fromEvm(evmRes)._unsafeUnwrap();
        assert.ok(p3.equal(decoded), "suite point addition doesn't work");

        let f = BNSuite.scalar().random();
        let p4 = BNSuite.point().set(p1).mul(f);
        evmRes = await testContract.scalarMul(p1.toEvm(), f.toEvm());
        decoded = BNSuite.point().fromEvm(evmRes)._unsafeUnwrap();
        assert.ok(p4.equal(decoded), "scalar mul not working");
    });
});