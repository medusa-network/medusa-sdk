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
  proof: dleq.EVMProof;
  constructor(r: EVMPoint, c: Uint8Array, proof: dleq.EVMProof) {
    this.random = r;
    this.cipher = c;
    this.proof = proof;
  }
}
export class Ciphertext<S extends Scalar, P extends Point<S>>
  implements EVMEncoding<EVMCipher>
{
  random: P;
  cipher: Uint8Array;
  proof: dleq.Proof<S>;
  constructor(r: P, c: Uint8Array, proof: dleq.Proof<S>) {
    this.random = r;
    this.cipher = c;
    this.proof = proof;
  }

  static default<S extends Scalar, P extends Point<S>>(c: Curve<S,P>): Ciphertext<S,P> {
    return new Ciphertext(c.point(),new Uint8Array(), dleq.Proof.default(c));
  }

  toEvm(): EVMCipher {
    return new EVMCipher(this.random.toEvm(), this.cipher, this.proof.toEvm());
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
  transcript: Transcript<S>,
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
  const proof = dleq.prove(suite,transcript,r);
  const cipher = new Ciphertext(rg, ciphertext, proof);
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
  ci: Ciphertext<S, P>,
  transcript: Transcript<S>
): Promise<DecryptionRes> {
  if (ci.cipher.length !== HKDF_SIZE) {
    return err(new EncryptionError("invalid cipher size"));
  }
  dleq.verify(suite,transcript,ci.random
  // P=pG proxy public key
  // B=bG recipient public key
  // input is
  // { rpG + pbG , H(rP) ^ m }
  // { p(rG + B) , H(rP) ^ m }
  // to decrypt, compute
  // p(rG + B) - bP = prG + pbG - bpG = prG = rP
  // then decrypt: H(rP)^m
  const negShared = c.point().set(proxyPub).mul(priv).neg();
  const shared = negShared.add(ci.random);
  console.log("DECRYPT SHARED KEY -> ", shared.toEvm());
  const xorkey = await sharedKey(shared);
  const plain = xor(xorkey, ci.cipher);
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
