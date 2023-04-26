import * as hgamal from '../src/hgamal';
import { Medusa } from '../src';
import { init, G1, Bn254Suite } from '../src/bn254';
import * as dleq from '../src/dleq';
import assert from 'assert';
import { hexlify, arrayify } from 'ethers/lib/utils';
import { arrayToBn, bnToArray } from '../src/utils';
import { ShaTranscript } from '../src/transcript';
import { reencrypt } from './utils';

describe('hgamal', () => {
  let suite: Bn254Suite;

  before(async () => {
    suite = await init();
  });

  function transcript(): ShaTranscript {
    return new ShaTranscript();
  }

  function compareEqual(p1: G1, p2: G1): boolean {
    return p1.equal(p2);
  }

  function pointFromXY(x: string, y: string): G1 {
    // We reverse manually first here because EVM etherjs will read in bigendian
    // so the fromEVM calls already reverse the array. Therefore we need to give it
    // in a reversed form first, (the hex from Rust comes in littleendian), so we need
    // to give it in big endian form.
    const xa = arrayToBn(arrayify(x), true);
    const ya = arrayToBn(arrayify(y), true);
    const p = suite.point().fromEvm({ x: xa, y: ya });
    assert(p.isOk());
    return p._unsafeUnwrap();
  }

  it('decryption of medusa reencryption', async () => {
    const proxy = Medusa.newKeypair(suite);
    const bob = Medusa.newKeypair(suite);
    const msgStr = 'Hello Bob';
    const msgBuff = new TextEncoder().encode(msgStr.padEnd(32, '\0'));
    const c = await hgamal.encrypt(suite, proxy.pubkey, msgBuff, transcript());
    assert.ok(c.isOk());
    const ciphertext = c._unsafeUnwrap();
    const reencryption = reencrypt(suite, proxy, bob.pubkey, ciphertext);
    const m = await hgamal.decryptReencryption(
      suite,
      bob.secret,
      proxy.pubkey,
      ciphertext,
      reencryption,
    );
    assert.ok(m.isOk());
    const found = m._unsafeUnwrap();
    let canonical: string = new TextDecoder().decode(found);
    canonical = canonical.replaceAll('\0', '');
    assert.strictEqual(msgStr, canonical);
  });

  it('binary representation', async () => {
    const shared = {
      x: '0x75015f523997c6deb7fd8d503bb847fbfe00c1a863648c25d36b554a1a4a5a26',
      y: '0x5d87b6bdb98fa44aa25efc56042fd9e70ed7097640f1bb639a7a6aebd34bc029',
    };
    const point = pointFromXY(shared.x, shared.y);
    const evm = point.toEvm();
    const xhex = hexlify(bnToArray(evm.x, true));
    assert.strictEqual(xhex, shared.x);
  });

  it('compatible with rust implementation', async () => {
    const data = {
      random_priv:
        '0x533b92c2289cb67fef2e6457dd1429a5127eaae165744d7cf01263d7b2e17a1f',
      shared: {
        x: '0x75015f523997c6deb7fd8d503bb847fbfe00c1a863648c25d36b554a1a4a5a26',
        y: '0x5d87b6bdb98fa44aa25efc56042fd9e70ed7097640f1bb639a7a6aebd34bc029',
      },
      xshared:
        '0x75015f523997c6deb7fd8d503bb847fbfe00c1a863648c25d36b554a1a4a5a26',
      yshared:
        '0x5d87b6bdb98fa44aa25efc56042fd9e70ed7097640f1bb639a7a6aebd34bc029',
      hkdf: '0x278f066a563573c78fc7d3fb06af2b9ff64c7f0f8a20d4484d71620f900e8724',
      proxypub: {
        x: '0xb76840af165661ddf1b2874b1adfad3111c53d1f8132143fe007c149b1891414',
        y: '0x99ab76e1f9535e0438e659f18845ed34a3069b49b0cbe16d6f4cf382ca247303',
      },
      proxypriv:
        '0x19749e386e28e6ddcc945dc642390b1070baed9ebd1830575de205b6270fa116',
      bobpub: {
        x: '0x41ae968383737febdee14bf685684c71de072a519f8dd798a9153c86673e0e1d',
        y: '0xb5299a2d022bc3e5f0151832ccb8d0d8627793d27905bf0cd3e4961dd47a452a',
      },
      bobpriv:
        '0x7324c3337140306c29e180032b9e77b56d8f9774d91c5e9dcb74c25e7cead003',
      cipher: {
        random: {
          x: '0xec8b7865fdd25711806a4dfbe5a825d2cbaeddd58d6096ba89f853f0a2701221',
          y: '0x770fc09b28257cd05d9767895b49a169fe95d57d4f73e4fe6d2e22c2e6fc5628',
        },
        cipher:
          '0x6ea86b4a385a07e7e9a8a1db69dd0bfe912d1661f954f868391e427bf86ba747',
      },
      reenccipher: {
        random: {
          x: '0x4f4da8c0b75fd3a7c1c5fb9554d33e1e24f5eb1af290fc9c3fb2e4aea2cedf2f',
          y: '0x9b7859d838c3be89227bf35af7259bd7e5a10bd8803a98f150e9575da6fae12d',
        },
        cipher:
          '0x6ea86b4a385a07e7e9a8a1db69dd0bfe912d1661f954f868391e427bf86ba747',
      },
      reencneg: {
        x: '0xaec279146ed3f65b2daff7ab7370d569ac7d96aa6a7795847fbe8f971680ce15',
        y: '0xc2347a0547d2361a14f109cf77520718b5adf9189fd0186938be25eda53cf70f',
      },
      reencfneg: {
        x: '0x75015f523997c6deb7fd8d503bb847fbfe00c1a863648c25d36b554a1a4a5a26',
        y: '0x5d87b6bdb98fa44aa25efc56042fd9e70ed7097640f1bb639a7a6aebd34bc029',
      },
      fhashed:
        '0x278f066a563573c78fc7d3fb06af2b9ff64c7f0f8a20d4484d71620f900e8724',
      plain:
        '0x49276d206e6f7420666f72206f7220616761696e73742c20746f207468652063',
    };

    // First check if the proxy keys are correctly decoded
    const proxyPub = pointFromXY(data.proxypub.x, data.proxypub.y);
    const proxyPriv = suite
      .scalar()
      .fromEvm(arrayToBn(arrayify(data.proxypriv), true))
      ._unsafeUnwrap();
    const expProxyPub = suite.point().one().mul(proxyPriv);
    assert.ok(compareEqual(expProxyPub, proxyPub));

    const bobpriv = suite
      .scalar()
      .fromEvm(arrayToBn(arrayify(data.bobpriv), true))
      ._unsafeUnwrap();
    const bobpub = suite.point().one().mul(suite.scalar().set(bobpriv));
    const bobpubFound = pointFromXY(data.bobpub.x, data.bobpub.y);
    assert.ok(compareEqual(bobpub, bobpubFound));

    // Then check if reconstructing the shared key gives the same as expected
    const shared = pointFromXY(data.shared.x, data.shared.y);
    const tmpPriv = suite
      .scalar()
      .fromEvm(arrayToBn(arrayify(data.random_priv), true))
      ._unsafeUnwrap();
    const expShared = suite.point().set(proxyPub).mul(tmpPriv);
    assert.ok(compareEqual(shared, expShared));

    // Then check if the HKDF step is done in a similar fashion in JS and rust
    // for the encryption - note during the reencryption it doesn't change
    //
    const hkdfComputed = await hgamal.sharedKey(shared);
    const hkdfFound = arrayify(data.hkdf);
    assert.strictEqual(hexlify(hkdfComputed), hexlify(hkdfFound));

    // Then check if reencrypting yourself gives expected result
    const random = pointFromXY(data.cipher.random.x, data.cipher.random.y);
    const cipher = new hgamal.Ciphertext(
      random,
      arrayify(data.cipher.cipher),
      /// give random dleq elements because it's not what we are interested in here
      suite.point(),
      dleq.Proof.default(suite),
    );
    // we compute the reencryption
    const reencExp = reencrypt(
      suite,
      { secret: proxyPriv, pubkey: suite.point().set(proxyPub) },
      bobpub,
      cipher,
    );
    // and check with what is expected from rust side
    const reencRandom = pointFromXY(
      data.reenccipher.random.x,
      data.reenccipher.random.y,
    );
    const reencFound = new hgamal.MedusaReencryption(reencRandom);
    assert.ok(compareEqual(reencFound.random, reencExp.random));

    // Then tries to check computation of the decryption for reencryption
    // intermediate elements
    // First -(proxyPub * bobpriv)
    const negComputed = suite.point().set(proxyPub).mul(bobpriv).neg();
    const negFound = pointFromXY(data.reencneg.x, data.reencneg.y);
    assert.ok(compareEqual(negComputed, negFound));
    // Then add that to the random component proxyPub*randomScalar + proxyPriv*bobPub
    const fnegComputed = negComputed.add(reencExp.random);
    const fnegExp = pointFromXY(data.reencfneg.x, data.reencfneg.y);
    assert.ok(compareEqual(fnegComputed, fnegExp));

    // Then check again the hkdf and then decoding

    // First check what is given as input to the hash function
    // const xsharedFound = arrayify(data.xshared);
    // const xsharedComputed = bnToArray(shared.toEvm().x);
    // assert.strictEqual(hexlify(xsharedComputed), hexlify(xsharedFound));

    assert.ok(compareEqual(fnegComputed, shared));
    assert.strictEqual(data.fhashed, data.hkdf);
    const fhashedComputed = await hgamal.sharedKey(fnegComputed);
    const fhashedFound = arrayify(data.fhashed);
    // const fhashedComputed = await hgamal.sharedKey(shared);
    // const fhashedFound = arrayify(data.hkdf);

    assert.strictEqual(hexlify(fhashedComputed), hexlify(fhashedFound));

    // Then tries to decrypt for yourself
    const m = await hgamal.decryptReencryption(
      suite,
      bobpriv,
      proxyPub,
      cipher,
      reencFound,
    );
    assert.ok(m.isOk());
    const p = m._unsafeUnwrap();
    assert.strictEqual(data.plain, hexlify(p));
  });
});
