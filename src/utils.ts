import { BigNumber } from "ethers";
import { arrayify, hexlify, hexZeroPad, randomBytes } from "ethers/lib/utils";

export function randHex(n: number): string {
  return hexlify(randomBytes(n));
}

export function onlyZero(b: Uint8Array): boolean {
  return b.filter((x) => x !== 0).length === 0;
}

export function bnToArray(big: BigNumber, reverse?: Boolean): Uint8Array {
  const arr = arrayify(big.toHexString());
  if (typeof reverse !== "undefined" && reverse === true) {
    return arr.reverse();
  }
  return arr;
}

export function arrayToBn(a: Uint8Array, reverse?: Boolean): BigNumber {
  if (typeof reverse !== "undefined" && reverse === true) {
    return BigNumber.from(a.reverse());
  }
  return BigNumber.from(a);
}