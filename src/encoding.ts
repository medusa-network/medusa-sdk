import { Result } from "neverthrow";
import { arrayify } from "ethers/lib/utils";
import { BigNumber as BN } from "ethers";
import { isBigNumberish } from "@ethersproject/bignumber/lib/bignumber";
// from https://bobbyhadz.com/blog/typescript-extend-error-class
export type EncodingRes<T> = Result<T, EncodingError>;
export class EncodingError extends Error {
  statusCode = 400;

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, EncodingError.prototype);
  }

  getErrorMessage() {
    return "encoding err: " + this.message;
  }
}
export interface EVMEncoding<T> {
  toEvm(): T;
  fromEvm(t: T): EncodingRes<this>;
}

