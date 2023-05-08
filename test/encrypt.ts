import { ethers } from 'hardhat';
import { Scalar, Point } from '../src/algebra';
import { Keypair, Medusa } from '../src';
import { init, Bn254Suite } from '../src/bn254';
import assert from 'assert';
import { HGamalSuite, Label } from '../src/encrypt';
import { reencrypt } from './utils';
/* eslint-disable-next-line camelcase */
import { Playground__factory } from '../typechain';
import { NETWORK_CONFIG } from '../src/config';

describe('medusa encryption', () => {
  const msgStr =
    'None of us is great enough for such a task. But in all circumstances of life, in obscurity or temporary fame, cast in the irons of tyranny or for a time free to express himself, the writer can win the heart of a living community that will justify him, on the one condition that he will accept to the limit of his abilities the two tasks that constitute the greatness of his craft: the service of truth and the service of liberty. Because his task is to unite the greatest possible number of people, his art must not compromise with lies and servitude which, wherever they rule, breed solitude. Whatever our personal weaknesses may be, the nobility of our craft will always be rooted in two commitments, difficult to maintain: the refusal to lie about what one knows and the resistance to oppression.';
  const msgBuff = new TextEncoder().encode(msgStr);
  let curve: Bn254Suite;
  let medusa: Keypair<Scalar, Point<Scalar>>;
  let suite: HGamalSuite<Scalar, Point<Scalar>, Bn254Suite>;
  let bob: Keypair<Scalar, Point<Scalar>>;

  before(async () => {
    curve = await init();
  });

  beforeEach(() => {
    medusa = Medusa.newKeypair(curve);
    suite = new HGamalSuite(curve);
    bob = suite.keyForDecryption();
  });

  it('valid submission onchain', async () => {
    const [owner] = await ethers.getSigners();
    const testContract = await new Playground__factory(owner).deploy();
    // deploy the oracle first so we can use  it _via_ the playground to simulate an app
    await testContract.deployOracle(
      medusa.pubkey.toEvm(),
      NETWORK_CONFIG['localhost'].relayerAddr,
      0,
      0,
    );

    const label = Label.from(
      medusa.pubkey,
      testContract.address,
      owner.address,
    );
    const ciphertext = (
      await suite.encryptToMedusa(msgBuff, medusa.pubkey, label)
    )._unsafeUnwrap();
    // only submit the key, the data is submitted to IPFS or something
    const cipherEVM = ciphertext.encryptedKey.toEvm();
    const link = new TextEncoder().encode('thisisthelink');
    const encryptor = owner.address;

    const txReceipt = await (
      await testContract.submitCiphertextToOracle(cipherEVM, encryptor)
    ).wait();

    const event = txReceipt.events?.find((e) => e.event === 'Ciphertext');
    const cipherId = event?.args?.[0];
    assert.ok(cipherId !== 0);
  });

  it('locally full scheme', async () => {
    const [owner] = await ethers.getSigners();
    const label = Label.from(medusa.pubkey, owner.address, owner.address);
    const c = await suite.encryptToMedusa(msgBuff, medusa.pubkey, label);
    assert.ok(c.isOk());
    const bundle = c._unsafeUnwrap();
    const reencryption = reencrypt(
      curve,
      medusa,
      bob.pubkey,
      bundle.encryptedKey,
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
    canonical = canonical.replaceAll('\0', '');
    assert.strictEqual(msgStr, canonical);
  });
});
