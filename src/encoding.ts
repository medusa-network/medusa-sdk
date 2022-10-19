import { Result } from "neverthrow";

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

export interface EVMSerialization {
  toEVMBytes(): Uint8Array;
}

export interface EVMEncoding<T> {
  toEvm(): T;
  fromEvm(t: T): EncodingRes<this>;
}
