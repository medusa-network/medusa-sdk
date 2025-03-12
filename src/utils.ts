/* eslint-disable @typescript-eslint/ban-ts-comment */
import { BigNumber, utils } from './ethers-compat';
import { ChaCha } from 'ffjavascript';
import crypto from 'crypto';

export function randHex(n: number): string {
  return utils.hexlify(utils.randomBytes(n));
}

export function onlyZero(b: Uint8Array): boolean {
  return b.filter((x) => x !== 0).length === 0;
}

export function bnToArray(
  big: BigNumber,
  reverse = false,
  padToLength = 0,
): Uint8Array {
  let hex = big.toHexString();
  // remove 0x
  hex = hex.substring(2);
  // pad to even length
  if (hex.length % 2 === 1) {
    hex = '0' + hex;
  }
  // pad to required length
  const length = padToLength * 2; // 2 hex digits = 1 byte
  if (length > 0 && hex.length < length) {
    hex = hex.padStart(length, '0');
  }
  let res = utils.arrayify('0x' + hex);
  if (reverse) {
    res = res.slice().reverse();
  }
  return res;
}

export function arrayToBn(a: Uint8Array, reverse = false): BigNumber {
  let arr = a;
  if (reverse) {
    arr = arr.slice().reverse();
  }
  return BigNumber.from(utils.hexlify(arr));
}

// taken from https://github.com/iden3/ffjavascript/blob/d5c1243eef385b69ce17084d7c9bede648c84bdb/src/random.js#L33
export function getRandomBytes(n: number): Uint8Array {
  const array = new Uint8Array(n);
  // @ts-ignore
  if (process.browser) {
    // Browser
    if (typeof globalThis.crypto !== 'undefined') {
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

let threadRng: ChaCha;

export function getThreadRng(): ChaCha {
  if (threadRng) return threadRng;
  threadRng = new ChaCha(getRandomSeed());
  return threadRng;
}
