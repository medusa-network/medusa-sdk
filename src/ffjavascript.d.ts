// Type definitions for the ffjavascript library. Types are not complete and primarily match our use of the library
declare module 'ffjavascript' {
  function buildBn128(): Promise<BN254>;

  class WasmCurve {
    zero: Uint8Array;
    g: Uint8Array;

    add(a: Uint8Array, b: Uint8Array): Uint8Array;
    timesFr(a: Uint8Array, fr: WasmField1): Uint8Array;
    timesScalar(a: Uint8Array, scalar: WasmField1): Uint8Array;
    neg(a: Uint8Array): Uint8Array;
    eq(a: Uint8Array, b: Uint8Array): boolean;

    isValid(a: Uint8Array): boolean;
    isZero(a: Uint8Array): boolean;

    fromObject([x, y]: [BigInt, BigInt]): Uint8Array;
    toObject(a: Uint8Array): [Uint8Array, Uint8Array];

    toAffine(a: Uint8Array): Uint8Array;

    toRprCompressed(a: Uint8Array, offset: number, affine: Uint8Array): void;
    fromRprCompressed(a: Uint8Array, offset: number): Uint8Array;
  }

  class WasmField1 {
    zero: WasmField1;
    one: WasmField1;

    add: (a: WasmField1, b: WasmField1) => WasmField1;
    mul: (a: WasmField1, b: WasmField1) => WasmField1;
    neg: (a: WasmField1) => WasmField1;
    inv: (a: WasmField1) => WasmField1;
    eq(a: WasmField1, b: WasmField1): boolean;

    isZero(a: WasmField1): boolean;
    random: () => WasmField1;

    fromObject(a: BigInt): WasmField1;
    toObject(a: WasmField1): BigInt;

    fromRprLE(a: Uint8Array, offset: number): WasmField1;
    toRprLE(buff: Uint8Array, offset: number, f: WasmField1): void;
  }

  class BN254 {
    G1: WasmCurve;
    Fr: WasmField1;
  }

  class ChaCha {
    constructor(_seed: number[]);
  }

  export { buildBn128, BN254, WasmField1, WasmCurve, ChaCha };
}
