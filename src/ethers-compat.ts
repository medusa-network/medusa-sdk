import { ethers } from 'ethers';

// BigNumber compatibility for ethers v6
export class BigNumber {
  private _value: bigint;

  constructor(value: string | number | bigint) {
    if (typeof value === 'string') {
      this._value = BigInt(value);
    } else if (typeof value === 'number') {
      this._value = BigInt(value);
    } else {
      this._value = value;
    }
  }

  // Common BigNumber methods
  toString(): string {
    return this._value.toString();
  }

  toHexString(): string {
    return '0x' + this._value.toString(16);
  }

  toNumber(): number {
    return Number(this._value);
  }

  toBigInt(): bigint {
    return this._value;
  }

  // Static methods
  static from(value: string | number | bigint): BigNumber {
    return new BigNumber(value);
  }

  // Operators
  add(other: BigNumber | string | number | bigint): BigNumber {
    const otherValue = other instanceof BigNumber ? other._value : BigInt(other.toString());
    return new BigNumber(this._value + otherValue);
  }

  sub(other: BigNumber | string | number | bigint): BigNumber {
    const otherValue = other instanceof BigNumber ? other._value : BigInt(other.toString());
    return new BigNumber(this._value - otherValue);
  }

  mul(other: BigNumber | string | number | bigint): BigNumber {
    const otherValue = other instanceof BigNumber ? other._value : BigInt(other.toString());
    return new BigNumber(this._value * otherValue);
  }

  div(other: BigNumber | string | number | bigint): BigNumber {
    const otherValue = other instanceof BigNumber ? other._value : BigInt(other.toString());
    return new BigNumber(this._value / otherValue);
  }

  eq(other: BigNumber | string | number | bigint): boolean {
    const otherValue = other instanceof BigNumber ? other._value : BigInt(other.toString());
    return this._value === otherValue;
  }

  lt(other: BigNumber | string | number | bigint): boolean {
    const otherValue = other instanceof BigNumber ? other._value : BigInt(other.toString());
    return this._value < otherValue;
  }

  lte(other: BigNumber | string | number | bigint): boolean {
    const otherValue = other instanceof BigNumber ? other._value : BigInt(other.toString());
    return this._value <= otherValue;
  }

  gt(other: BigNumber | string | number | bigint): boolean {
    const otherValue = other instanceof BigNumber ? other._value : BigInt(other.toString());
    return this._value > otherValue;
  }

  gte(other: BigNumber | string | number | bigint): boolean {
    const otherValue = other instanceof BigNumber ? other._value : BigInt(other.toString());
    return this._value >= otherValue;
  }
}

// Utils compatibility for ethers v6
export const utils = {
  isAddress(address: string): boolean {
    return ethers.isAddress(address);
  },
  
  parseUnits(value: string, unitName?: string | number): bigint {
    return ethers.parseUnits(value, unitName);
  },
  
  formatUnits(value: bigint | string | number, unitName?: string | number): string {
    return ethers.formatUnits(value, unitName);
  },
  
  soliditySha256(types: string[], values: any[]): string {
    // Convert BigNumber to bigint for ethers v6
    const convertedValues = values.map(value => {
      if (value instanceof BigNumber) {
        return value.toBigInt();
      }
      return value;
    });
    return ethers.solidityPackedKeccak256(types, convertedValues);
  },
  
  arrayify(hex: string): Uint8Array {
    return ethers.getBytes(hex);
  },
  
  hexlify(value: Uint8Array | string): string {
    if (typeof value === 'string') {
      return value.startsWith('0x') ? value : '0x' + value;
    }
    return ethers.hexlify(value);
  },
  
  hexZeroPad(value: string, length: number): string {
    return ethers.zeroPadValue(value, length);
  },
  
  randomBytes(length: number): Uint8Array {
    return ethers.randomBytes(length);
  },
  
  keccak256(value: string | Uint8Array): string {
    if (typeof value === 'string') {
      if (!value.startsWith('0x')) {
        value = ethers.toUtf8Bytes(value);
      }
    }
    return ethers.keccak256(value);
  }
}; 