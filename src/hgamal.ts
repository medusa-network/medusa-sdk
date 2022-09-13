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

export class EVMCipher {
  random: EVMPoint;
  cipher: Uint8Array;
  constructor(r: EVMPoint, c: Uint8Array) {
    this.random = r;
    this.cipher = c;
  }
}
export class Ciphertext<S extends Scalar, P extends Point<S>>
  implements EVMEncoding<EVMCipher>
{
  random: P;
  cipher: Uint8Array;
  constructor(r: P, c: Uint8Array) {
    this.random = r;
    this.cipher = c;
  }

  toEvm(): EVMCipher {
    return new EVMCipher(this.random.toEvm(), this.cipher);
  }

  fromEvm(e: EVMCipher): EncodingRes<this> {
    this.cipher = e.cipher;
    const r = this.random.fromEvm(e.random);
    if (r.isErr()) {
      return err(r.error);
    }
    return ok(this);
  }
}

// I'd like to do this:
// Ciphertext.new(curve).from_evm(evm)
// But that requires me to specify Scalar type (because of Curve) in Ciphertext
// And unfortunately we can't access types from static declaration
// We can't overload constructor as well so I'm using separate function
// newCiphertext(curve).from_evm(evm)
export function newCiphertext<S extends Scalar, P extends Point<S>>(
  c: Curve<S, P>
): Ciphertext<S, P> {
  return new Ciphertext(c.point(), new Uint8Array(1));
}

const HKDF_SIZE = 32;

export default class EncryptionError extends Error {
  statusCode = 400;

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, EncryptionError.prototype);
  }

  getErrorMessage() {
    return "encryption err: " + this.message;
  }
}

export type EncryptionRes<S extends Scalar, P extends Point<S>> = Result<
  Ciphertext<S, P>,
  EncryptionError
>;
export async function encrypt<S extends SecretKey, P extends PublicKey<S>>(
  c: Curve<S, P>,
  recipient: P,
  msg: Uint8Array
): Promise<EncryptionRes<S, P>> {
  if (msg.length !== HKDF_SIZE) {
    return err(new EncryptionError("invalid plaintext size"));
  }
  // { rG, H(rP) ^ m } where P = pG public key recipient
  const fr = c.scalar().random();
  const r = c.point().one().mul(fr);
  const shared = c.point().set(recipient).mul(fr);
  const xorkey = await sharedKey(shared);
  const ciphertext = xor(xorkey, msg);
  const cipher = new Ciphertext(r, ciphertext);
  return ok(cipher);
}
export type DecryptionRes = Result<Uint8Array, EncryptionError>;
export async function decryptReencryption<
  S extends SecretKey,
  P extends PublicKey<S>
>(
  c: Curve<S, P>,
  priv: S,
  proxyPub: P,
  ci: Ciphertext<S, P>
): Promise<DecryptionRes> {
  if (ci.cipher.length !== HKDF_SIZE) {
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
