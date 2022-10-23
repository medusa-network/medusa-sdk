import { Result } from "neverthrow";
import * as ethers from "ethers";

// taken from https://bobbyhadz.com/blog/typescript-extend-error-class
export class EncodingError extends Error {
  statusCode = 400;

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, EncodingError.prototype);
  }

  getErrorMessage(): string {
    return "encoding err: " + this.message;
  }
}

export type EncodingRes<T> = Result<T, EncodingError>;

export interface ABIEncoder {
  abiEncode(): [Array<string>, Array<any>];
}

export interface EVMEncoding<T> {
  toEvm(): T;
  fromEvm(t: T): EncodingRes<this>;
}

export function ABIString(v: string): EVMTypeWrapper {
  return new EVMTypeWrapper(v, "string");
}
export function ABIAddress(v: string): EVMTypeWrapper {
  return new EVMTypeWrapper(v, "address");
}
export function ABIUint256(b: ethers.BigNumber): EVMTypeWrapper {
  return new EVMTypeWrapper(b, "uint256");
}
export function ABIBytes32(b: ethers.BigNumber | string): EVMTypeWrapper {
  if (b instanceof ethers.BigNumber) {
    return new EVMTypeWrapper(b, "bytes32");
  } else {
    return new EVMTypeWrapper(ethers.BigNumber.from(b), "bytes32");
  }
}

class EVMTypeWrapper implements ABIEncoder {
  // type to notify to the abi encoding
  t: string;
  // actual value
  v: any;

  constructor(value: any, t: string) {
    this.v = value;
    this.t = t;
  }

  abiEncode(): [Array<string>, Array<any>] {
    return [[this.t], [this.v]];
  }
}
