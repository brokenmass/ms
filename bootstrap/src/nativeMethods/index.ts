import { VALUE_TYPE } from '../coreTypes';
import print from './print';
import sum from './sum';

export type functionDescriptor = {
  used: boolean;
  inputs: VALUE_TYPE[];
  output: VALUE_TYPE;
  code: {
    asm_x86_64: {
      header?: (print: (input: string) => void) => void;
      call?: (print: (input: string) => void) => void;
      footer?: (print: (input: string) => void) => void;
    };
  };
};
export type functionList = {
  [key: string]: functionDescriptor[];
};
const nativeMethods: functionList = {
  print,
  sum,
};

export default nativeMethods;
