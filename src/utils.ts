import { hexlify, hexZeroPad, randomBytes } from "ethers/lib/utils";

export function randHex(n: number): string {
  return hexlify(randomBytes(n));
}

export function onlyZero(b: Uint8Array): boolean {
  return b.filter((x) => x != 0).length == 0;
}
