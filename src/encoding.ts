import { BigNumber } from 'ethers';
import { Result } from 'neverthrow';

// taken from https://bobbyhadz.com/blog/typescript-extend-error-class
export class EncodingError extends Error {
  statusCode = 400;

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, EncodingError.prototype);
  }

  getErrorMessage(): string {
    return 'encoding err: ' + this.message;
  }
}

export type EncodingRes<T> = Result<T, EncodingError>;

export interface EVMEncoding<T> {
  toEvm(): T;
  fromEvm(t: T): EncodingRes<this>;
}

export type ABIEncodedLabels = Array<
  'uint256' | 'address' | 'bytes32' | 'string'
>;
export type ABIEncodedValues = Array<BigNumber | string>;
export type ABIEncoded = [ABIEncodedLabels, ABIEncodedValues];

export interface ABIEncoder {
  abiEncode(): ABIEncoded;
}

export function ABIString(v: string): EVMTypeWrapper {
  return new EVMTypeWrapper(v, 'string');
}

export function ABIAddress(v: string): EVMTypeWrapper {
  return new EVMTypeWrapper(v, 'address');
}

export function ABIUint256(b: BigNumber): EVMTypeWrapper {
  return new EVMTypeWrapper(b, 'uint256');
}

export function ABIBytes32(b: BigNumber | string): EVMTypeWrapper {
  if (b instanceof BigNumber) {
    return new EVMTypeWrapper(b, 'bytes32');
  } else {
    return new EVMTypeWrapper(BigNumber.from(b), 'bytes32');
  }
}

class EVMTypeWrapper implements ABIEncoder {
  // type to notify to the abi encoding
  t: ABIEncodedLabels[0];
  // actual value
  v: ABIEncodedValues[1];

  constructor(value: ABIEncodedValues[0], t: ABIEncodedLabels[0]) {
    this.v = value;
    this.t = t;
  }

  abiEncode(): ABIEncoded {
    return [[this.t], [this.v]];
  }
}
