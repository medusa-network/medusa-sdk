import * as hgamal from "../src/hgamal";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { newKeypair, KeyPair } from "../src";
import { init, suite as curve, G1 } from "../src/bn254_iden";
import { Scalar, Point, Curve } from "../src/algebra";
import assert from "assert";
import { hexlify, arrayify } from "ethers/lib/utils";
import { arrayToBn, bnToArray } from "../src/utils";
import { HGamalSuite, Label } from "../src/encrypt";
import { ShaTranscript } from "../src/transcript";
import { reencrypt } from "./utils";
import * as sha256 from "fast-sha256";
import { BN254EncryptionOracle__factory, Playground__factory } from "../typechain";


describe("medusa encryption", () => {
  const msgStr =
    "None of us is great enough for such a task. But in all circumstances of life, in obscurity or temporary fame, cast in the irons of tyranny or for a time free to express himself, the writer can win the heart of a living community that will justify him, on the one condition that he will accept to the limit of his abilities the two tasks that constitute the greatness of his craft: the service of truth and the service of liberty. Because his task is to unite the greatest possible number of people, his art must not compromise with lies and servitude which, wherever they rule, breed solitude. Whatever our personal weaknesses may be, the nobility of our craft will always be rooted in two commitments, difficult to maintain: the refusal to lie about what one knows and the resistance to oppression.";
  const msgBuff = new TextEncoder().encode(msgStr);
  let medusa;
  let suite;
  let bob;
  before(async () => {
    await init();
  });
  beforeEach(() => {
    medusa = newKeypair(curve);
    suite = new HGamalSuite(curve);
    bob = suite.keyForDecryption();
  });

  it("valid submission onchain", async () => {
    const [owner] = await ethers.getSigners();
    const testContract = await new Playground__factory(owner).deploy();
    // deploy the oracle first so we can use  it _via_ the playground to simulate an app
    const oracleAddress = await testContract.deployOracle(medusa.pubkey.toEvm());
    const label = Label.from(medusa.pubkey, testContract.address, owner.address);
    const ciphertext = (await suite.encryptToMedusa(msgBuff, medusa.pubkey, label))._unsafeUnwrap();
    // only submit the key, the data is submitted to IPFS or something
    const cipherEVM = ciphertext.encryptedKey.toEvm();
    const link = new TextEncoder().encode("thisisthelink");
    const encryptor = owner.address;
    const request_id = await testContract.submitCiphertextToOracle(cipherEVM, link, encryptor);
    assert.ok(request_id != 0);
  });

  it("locally full scheme", async () => {
    const [owner] = await ethers.getSigners();
    const label = Label.from(medusa.pubkey, owner.address, owner.address);
    const c = await suite.encryptToMedusa(msgBuff, medusa.pubkey, label);
    assert.ok(c.isOk());
    const bundle = c._unsafeUnwrap();
    const reencryption = reencrypt(
      curve,
      medusa,
      bob.pubkey,
      bundle.encryptedKey
    );
    const m = await suite.decryptFromMedusa(
      bob.secret,
      medusa.pubkey,
      bundle,
      reencryption,
    );
    assert.ok(m.isOk());
    const found = m._unsafeUnwrap();
    let canonical: string = new TextDecoder().decode(found);
    canonical = canonical.replaceAll("\0", "");
    assert.strictEqual(msgStr, canonical);
  });
});
