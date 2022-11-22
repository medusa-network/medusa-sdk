import assert from "assert";
import { ethers } from "hardhat";
import { Medusa, PublicKey, SecretKey } from "../src/index";
import { onlyZero } from "../src/utils";
/* eslint-disable-next-line camelcase  */
import { Playground__factory } from "../typechain";

describe("Medusa Class", () => {
  let medusa: Medusa<SecretKey, PublicKey<SecretKey>>;

  before(async () => {
    const [signer] = await ethers.getSigners();

    const medusaAddress = (await new Playground__factory(signer).deploy())
      .address;
    medusa = await Medusa.init(medusaAddress, signer);
  });

  it("creates new keypair and sets it", async () => {
    const kp = Medusa.newKeypair(medusa.suite);
    assert.ok(!kp.pubkey.equal(medusa.suite.point().zero()));
    assert.ok(!kp.secret.equal(medusa.suite.scalar().zero()));

    medusa.setKeypair(kp);
    assert.ok(kp.pubkey.equal(medusa.keypair!.pubkey));
    assert.ok(kp.secret.equal(medusa.keypair!.secret));
  });

  it("derives the same keypair given a signature", async () => {
    const signature = await medusa.signer.signMessage("My message");
    const kp1 = medusa.deriveKeypair(signature);
    const kp2 = medusa.deriveKeypair(signature);

    assert.ok(kp1.pubkey.equal(kp2.pubkey));
    assert.ok(kp1.secret.equal(kp2.secret));
  });

  it("Gets the public key from an Oracle contract", async () => {
    const [owner] = await ethers.getSigners();
    const testContract = await new Playground__factory(owner).deploy();
    const m = new Medusa(medusa.suite, medusa.signer, testContract.address);
    const pubkey = await m.fetchPublicKey();

    const expectedPubkey = medusa.decodePublicKey(
      await testContract.distributedKey()
    );
    assert.ok(pubkey.equal(expectedPubkey));
  });
});

describe("utils module", () => {
  it("only zero", () => {
    const b = new Uint8Array([0, 0, 0]);
    assert.ok(onlyZero(b));
    const a = new Uint8Array([0, 0, 0, 1]);
    assert.ok(!onlyZero(a));
  });
});
