import { Curve, EVMPoint, Point, Scalar } from "./algebra";
import { KeyPair, PublicKey, SecretKey } from "./index";
import { ok, err, Result } from "neverthrow";
import * as crypto from "crypto";
import assert from "assert";
import { BigNumber } from "ethers";
import { EncodingRes, EVMEncoding } from "./encoding";
import hkdf from "js-crypto-hkdf";
import { arrayify } from "ethers/lib/utils";
import { bnToArray } from "./utils";
import { Transcript } from "./transcript";
import * as dleq from "./dleq";

export class EVMCipher {
  random: EVMPoint;
  cipher: Uint8Array;
  // random element on the second base r*G2
  // used by the DLEQ proof.
  random2: EVMPoint;
  proof: dleq.EVMProof;
  constructor(r: EVMPoint, c: Uint8Array, rg2: EVMPoint, proof: dleq.EVMProof) {
    this.random = r;
    this.cipher = c;
    this.random2 = rg2;
    this.proof = proof;
  }
}
export class Ciphertext<S extends Scalar, P extends Point<S>>
  implements EVMEncoding<EVMCipher>
{
  random: P;
  cipher: Uint8Array;
  random2: P;
  proof: dleq.Proof<S>;

  constructor(r: P, c: Uint8Array, rg2: P, proof: dleq.Proof<S>) {
    this.random = r;
    this.cipher = c;
    this.random2 = rg2;
    this.proof = proof;
  }

  static default<S extends Scalar, P extends Point<S>>(c: Curve<S,P>): Ciphertext<S,P> {
    return new Ciphertext(c.point(),new Uint8Array(), c.point(), dleq.Proof.default(c));
  }

  toEvm(): EVMCipher {
    return new EVMCipher(
        this.random.toEvm(), 
        this.cipher, 
        this.random2.toEvm(), 
        this.proof.toEvm());
  }

  fromEvm(e: EVMCipher): EncodingRes<this> {
    this.cipher = e.cipher;
    return this.random.fromEvm(e.random).andThen((r) => {
      this.random = r;
      return this.proof.fromEvm(e.proof);
    }).andThen((proof) => {
      this.proof = proof;
      return ok(this);
    });
  }
}


/// Ciphertext that Medusa emits to the smart contract
export class MedusaReencryption<S extends Scalar, P extends Point<S>> 
  implements EVMEncoding<EVMMedusaReencryption> {
  random: P;

  constructor(r: P) {
    this.random = r;
  }

  static default<S extends Scalar, P extends Point<S>>(c: Curve<S,P>): MedusaReencryption<S,P> {
    return new MedusaReencryption(c.point());
  }

  toEvm(): EVMMedusaReencryption {
    throw new Error("This method should never be called?");
  }
  
  fromEvm(t: EVMMedusaReencryption): EncodingRes<this> {
    return this.random.fromEvm(t.random).andThen((v) => {
      this.random = v;
      return ok(this);
    });
  }

}

export class EVMMedusaReencryption {
  random: EVMPoint;
  constructor(r: EVMPoint) {
    this.random = r; 
  }
}

const HKDF_SIZE = 32;

export class EncryptionError extends Error {
  statusCode = 400;

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, EncryptionError.prototype);
  }

  getErrorMessage(): string {
    return "encryption err: " + this.message;
  }
}

export type EncryptionRes<S extends Scalar, P extends Point<S>> = Result<
  Ciphertext<S, P>,
  EncryptionError
>;
export async function encrypt<S extends SecretKey, P extends PublicKey<S>>(
  suite: dleq.DleqSuite<S, P>,
  recipient: P,
  msg: Uint8Array,
  transcript: Transcript,
): Promise<EncryptionRes<S, P>> {
  if (msg.length !== HKDF_SIZE) {
    return err(new EncryptionError("invalid plaintext size"));
  }
  // { rG, H(rP) ^ m } where P = pG public key recipient
  const r = suite.scalar().random();
  const rg = suite.point().one().mul(r);
  const shared = suite.point().set(recipient).mul(r);
  const xorkey = await sharedKey(shared);
  const ciphertext = xor(xorkey, msg);
  // make the dleq proof to prove encryptor has the corresponding
  // secret "r" (so it is CCA compliant) and most importantly bind
  // the ciphertext to the transcript. THe transcript can contain
  // for example the address of the smart contract, etc.
  // -- we need to manually create rg2 here because that dleq proof
  // is meant to show dleq equality between two points -> so we need to provide
  // the two points even though the second one is not part of the encryption per se.
  const rg2 = suite.base2().mul(r);
  const proof = dleq.prove(suite,transcript,r,rg,rg2);
  const cipher = new Ciphertext(rg, ciphertext, rg2, proof);
  return ok(cipher);
}
export type DecryptionRes = Result<Uint8Array, EncryptionError>;
export async function decryptReencryption<
  S extends SecretKey,
  P extends PublicKey<S>
>(
  suite: dleq.DleqSuite<S, P>,
  priv: S,
  proxyPub: P,
  original: Ciphertext<S, P>,
  reencrypted: MedusaReencryption<S,P>,
): Promise<DecryptionRes> {
  // XXX not really needed since smart contract does it
  // TODO place this when we read all submitted ciperthext, 
  // we must verify if they are legit
  if (original.cipher.length !== HKDF_SIZE) {
    return err(new EncryptionError("invalid cipher size"));
  }
  // P=pG proxy public key
  // B=bG recipient public key
  // input is
  // { rpG + pbG , H(rP) ^ m }
  // { p(rG + B) , H(rP) ^ m }
  // to decrypt, compute
  // p(rG + B) - bP = prG + pbG - bpG = prG = rP
  // then decrypt: H(rP)^m
  const negShared = suite.point().set(proxyPub).mul(priv).neg();
  const shared = negShared.add(reencrypted.random);
  const xorkey = await sharedKey(shared);
  const plain = xor(xorkey, original.cipher);
  return ok(plain);
}

// TODO should it use async version ?
export async function sharedKey<S extends Scalar, P extends Point<S>>(
  p: P
): Promise<Uint8Array> {
  const h = crypto.createHash("sha256");
  const data = p.toEvm();
  h.update(bnToArray(data.x, true));
  h.update(bnToArray(data.y, true));
  return h.digest();
  // TODO for now we keep it a simple hash - because we might
  // want to verify it in a solidity contract so hkdf might be too
  // expensive or not available -> given it's a random key each
  // time it should be fine.
  // const masterSecret = h.digest();
  /// / const masterSecret = p.serialize();
  // const hash = "SHA-256";
  // const length = 32; // derived key length
  // const info = ""; // information specified in rfc5869
  // const salt = new Uint8Array([]);
  // const res = await hkdf.compute(masterSecret, hash, length, info, salt);
  // return res.key;
}

function xor(key: Uint8Array, msg: Uint8Array): Uint8Array {
  assert(key.length === msg.length);
  return key.map((k, i) => k ^ msg[i]);
}
