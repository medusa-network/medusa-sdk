import { ethers } from 'ethers';

export const MINIMUM_BASE_FEE = ethers.utils.parseUnits('1.5', 'gwei');
export const GAS_UNIT_BUFFER = 10000;
