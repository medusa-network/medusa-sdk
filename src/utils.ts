/* eslint-disable @typescript-eslint/ban-ts-comment */
import { BigNumber } from "ethers";
import { arrayify, hexlify, hexZeroPad, randomBytes } from "ethers/lib/utils";
// @ts-ignore
import { ChaCha } from "ffjavascript";
import crypto from "crypto";

export function randHex(n: number): string {
  return hexlify(randomBytes(n));
}

export function onlyZero(b: Uint8Array): boolean {
  return b.filter((x) => x !== 0).length === 0;
}

export function bnToArray(
  big: BigNumber,
  reverse = false,
  padToLength = 0
): Uint8Array {
  const arr = arrayify(
    padToLength > 0
      ? hexZeroPad(big.toHexString(), padToLength)
      : big.toHexString()
  );

  if (reverse) {
    return arr.reverse();
  }

  return arr;
}

export function arrayToBn(a: Uint8Array, reverse = false): BigNumber {
  if (reverse) {
    return BigNumber.from(a.reverse());
  }
  return BigNumber.from(a);
}

// taken from https://github.com/iden3/ffjavascript/blob/d5c1243eef385b69ce17084d7c9bede648c84bdb/src/random.js#L33
export function getRandomBytes(n: number): Uint8Array {
  const array = new Uint8Array(n);
  // @ts-ignore
  if (process.browser) {
    // Browser
    if (typeof globalThis.crypto !== "undefined") {
      // Supported
      globalThis.crypto.getRandomValues(array);
    } else {
      // fallback
      for (let i = 0; i < n; i++) {
        array[i] = (Math.random() * 4294967296) >>> 0;
      }
    }
  } else {
    // NodeJS
    crypto.randomFillSync(array);
  }
  return array;
}

export function getRandomSeed(): number[] {
  const arr = getRandomBytes(32);
  const arrV = new Uint32Array(arr.buffer);
  const seed = [];
  for (let i = 0; i < 8; i++) {
    seed.push(arrV[i]);
  }
  return seed;
}

let threadRng: any = null;

export function getThreadRng() {
  if (threadRng) return threadRng;
  threadRng = new ChaCha(getRandomSeed());
  return threadRng;
}
