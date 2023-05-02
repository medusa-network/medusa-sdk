/* eslint-disable no-var */
import { BN254 } from 'ffjavascript';

declare global {
  // rome-ignore lint: declare as var because it's a global variable
  var ffCurve: BN254;
}
