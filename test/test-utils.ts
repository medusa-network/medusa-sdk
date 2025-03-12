import { BigNumber } from '../src/ethers-compat';

/**
 * Converts contract output with bigint values to use our BigNumber compatibility class
 * @param obj The object to convert
 * @returns The converted object
 */
export function convertBigIntToBigNumber(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return BigNumber.from(obj.toString());
  }
  
  if (Array.isArray(obj)) {
    return obj.map(convertBigIntToBigNumber);
  }
  
  if (typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = convertBigIntToBigNumber(obj[key]);
      }
    }
    return result;
  }
  
  return obj;
}

/**
 * Converts BigNumber values to bigint for contract calls
 * @param obj The object to convert
 * @returns The converted object
 */
export function convertBigNumberToBigInt(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (obj instanceof BigNumber) {
    return obj.toBigInt();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(convertBigNumberToBigInt);
  }
  
  if (typeof obj === 'object' && !(obj instanceof BigNumber)) {
    const result: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = convertBigNumberToBigInt(obj[key]);
      }
    }
    return result;
  }
  
  return obj;
} 