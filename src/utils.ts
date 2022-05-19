import { BigNumber } from "ethers";
import { arrayify, hexlify, hexZeroPad, randomBytes } from "ethers/lib/utils";

export function randHex(n: number): string {
  return hexlify(randomBytes(n));
}

export function onlyZero(b: Uint8Array): boolean {
  return b.filter((x) => x != 0).length == 0;
}

export function bnToArray(big: BigNumber): Uint8Array {
  return arrayify(big.toHexString());
}

export function arrayToBn(a: Uint8Array): BigNumber {
  return BigNumber.from(a);
}
