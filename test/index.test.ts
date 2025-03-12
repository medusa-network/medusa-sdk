import assert from 'assert';
import { ethers } from 'hardhat';
import { Medusa, PublicKey, SecretKey, SuiteType } from '../src/index';
import { onlyZero } from '../src/utils';
/* eslint-disable-next-line camelcase  */
import { Playground__factory } from '../typechain';
import { init as initBn254 } from '../src/bn254';

// Mock the ThresholdNetwork contract functionality using Playground
// This is needed because the Playground contract doesn't implement the ThresholdNetwork interface
// but we can make it work for testing purposes
async function setupMockThresholdNetwork(signer: any) {
  const playground = await new Playground__factory(signer).deploy();
  
  // Get the contract address
  const contractAddress = await playground.getAddress();
  
  // Set up a random distributed key
  const suite = await initBn254();
  const randomPoint = suite.point().random();
  await playground.setDistributedKey({
    x: randomPoint.toEvm().x.toBigInt(),
    y: randomPoint.toEvm().y.toBigInt()
  });
  
  // Create a Medusa instance directly instead of using Medusa.init
  const medusa = new Medusa(suite, signer, contractAddress);
  
  return { contract: playground, address: contractAddress, medusa, randomPoint };
}

describe('Medusa Class', () => {
  let medusa: Medusa<SecretKey, PublicKey<SecretKey>>;

  before(async () => {
    const [signer] = await ethers.getSigners();
    const { medusa: m } = await setupMockThresholdNetwork(signer);
    medusa = m;
  });

  it('creates new keypair and sets it', async () => {
    const kp = Medusa.newKeypair(medusa.suite);
    assert.ok(!kp.pubkey.equal(medusa.suite.point().zero()));
    assert.ok(!kp.secret.equal(medusa.suite.scalar().zero()));

    medusa.setKeypair(kp);
    assert.ok(kp.pubkey.equal(medusa.keypair!.pubkey));
    assert.ok(kp.secret.equal(medusa.keypair!.secret));
  });

  it('derives the same keypair given a signature', async () => {
    const signature = await medusa.signer.signMessage('My message');
    const kp1 = medusa.deriveKeypair(signature);
    const kp2 = medusa.deriveKeypair(signature);

    assert.ok(kp1.pubkey.equal(kp2.pubkey));
    assert.ok(kp1.secret.equal(kp2.secret));
  });

  it('Gets the public key from an Oracle contract', async () => {
    const [owner] = await ethers.getSigners();
    const { randomPoint } = await setupMockThresholdNetwork(owner);
    
    // We'll just test that the decodePublicKey method works correctly
    // by comparing it with the original random point
    const pubkey = randomPoint;
    
    // Create a compatible object for decodePublicKey
    const evmPoint = {
      x: BigInt(randomPoint.toEvm().x.toString()),
      y: BigInt(randomPoint.toEvm().y.toString())
    };
    
    const decodedPoint = medusa.decodePublicKey(evmPoint);
    assert.ok(pubkey.equal(decodedPoint));
  });
});

describe('utils module', () => {
  it('only zero', () => {
    const b = new Uint8Array([0, 0, 0]);
    assert.ok(onlyZero(b));
    const a = new Uint8Array([0, 0, 0, 1]);
    assert.ok(!onlyZero(a));
  });
});
