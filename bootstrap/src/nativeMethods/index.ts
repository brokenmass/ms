import { VALUE_TYPE } from '../coreTypes';
import print from './print';
import sum from './sum';

export type functionDescriptor = {
  inputs: VALUE_TYPE[];
  output: VALUE_TYPE;
  code: any;
};
export type functionList = {
  [key: string]: functionDescriptor[];
};
const nativeMethods: functionList = {
  print,
  sum,
};

export default nativeMethods;
