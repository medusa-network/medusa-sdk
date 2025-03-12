declare module 'ffjavascript' {
  export function buildBn128(): Promise<any>;
  
  export interface WasmField1 {
    zero: any;
    one: any;
    random(): any;
    add(a: any, b: any): any;
    mul(a: any, b: any): any;
    neg(a: any): any;
    inv(a: any): any;
    eq(a: any, b: any): boolean;
    toRprLE(buff: Uint8Array, offset: number, a: any): void;
    fromRprLE(buff: Uint8Array, offset: number): any;
    toObject(a: any): any;
    fromObject(obj: string | string[]): any;
  }
  
  export interface WasmCurve {
    g: any;
    zero: any;
    add(a: any, b: any): any;
    timesFr(a: any, b: any): any;
    neg(a: any): any;
    eq(a: any, b: any): boolean;
    toRprCompressed(buff: Uint8Array, offset: number, a: any): void;
    fromRprCompressed(buff: Uint8Array, offset: number): any;
    toAffine(a: any): any;
    toObject(a: any): any[];
    fromObject(obj: string[]): any;
    isValid(a: any): boolean;
  }
}

declare global {
  var ffCurve: any;
}

// Type declarations for the hgamal module
declare module './hgamal' {
  import { Scalar, Point } from './algebra';
  import { Result } from 'neverthrow';
  
  export class EncryptionError extends Error {}
  
  export type EncryptionRes<S, P> = Result<Ciphertext<S, P>, EncryptionError>;
  export type DecryptionRes = Result<Uint8Array, EncryptionError>;
  
  export class Ciphertext<S, P> {
    random: P;
    cipher: Uint8Array;
    random2: P;
    dleq: any;
  }
  
  export class MedusaReencryption<S, P> {
    // Add properties as needed
  }
} 