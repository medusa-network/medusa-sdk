import { Curve, Point, Scalar } from "./algebra";
import { KeyPair, PublicKey, SecretKey } from "./index";
import { ok, err, Result } from "neverthrow";
import * as crypto from "crypto";
import assert from "assert";


export interface Ciphertext<P> {
    random: P;
    cipher: Uint8Array;
}

const HKDF_SIZE = 32;

export type ReencryptedCipher<P> = Ciphertext<P>;

export class EncryptionError extends Error {
    statusCode = 400;
  
    constructor(message: string) {
      super(message);
      Object.setPrototypeOf(this, EncryptionError.prototype);
    }
  
    getErrorMessage() {
      return 'encryption err: ' + this.message;
    }
  }
  

export type EncryptionRes<P> = Result<Ciphertext<P>,EncryptionError>
export function encrypt<S extends SecretKey, P extends PublicKey<S>>(c: Curve<S,P>, p: P, msg: Uint8Array): EncryptionRes<P> {
    if (msg.length != HKDF_SIZE) {
        return err(new EncryptionError("invalid plaintext size"));
    }
    // { rG, H(rP) ^ m } where P = pG public key recipient
    const fr = c.scalar().random();
    const r = c.point().mul(fr);
    const shared = p.mul(fr);
    const xorkey = hkdf(shared);
    const ciphertext = xor(xorkey,msg);
    const cipher : Ciphertext<P> =  {
        random: r,
        cipher: ciphertext,
    }
    return ok(cipher);
}
export type DecryptionRes = Result<Uint8Array,EncryptionError>;
export function decrypt_reencryption<S extends SecretKey, P extends PublicKey<S>>(c: Curve<S,P>,priv: S, proxyPub: P,ci: ReencryptedCipher<P>): DecryptionRes {
    if (ci.cipher.length != HKDF_SIZE) {
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
    const negShared = proxyPub.mul(priv).neg();
    const shared = ci.random.add(negShared);
    const xorkey = hkdf(shared);
    const plain = xor(xorkey,ci.cipher);
    return ok(plain);
}

// TODO should it use async version ?
function hkdf<S extends Scalar, P extends Point<S>>(p: P): Uint8Array { 
    const h = crypto.createHash("sha256");
    const data = p.serialize();
    h.update(data);
    return h.digest();
}

function xor(key: Uint8Array,msg: Uint8Array): Uint8Array {
    assert(key.length == msg.length);
    return key.map((k,i) => k ^ msg[i]);
}