import { VALUE_TYPE } from '../coreTypes';
import print from './print';
import add from './add';
import exit from './exit';
import eq from './eq';
import lt from './lt';
import mod from './mod';

export type codePrinter = (input: string) => void;
export type labelGenerator = () => string;
export type codeGenerator = (
  print: codePrinter,
  nextLabel: codePrinter,
) => void;

export type functionDescriptor = {
  used: boolean;
  inputs: VALUE_TYPE[];
  output: VALUE_TYPE;
  code: {
    asm_x86_64: {
      header?: codeGenerator;
      call?: codeGenerator;
      footer?: codeGenerator;
    };
  };
};
export type functionList = {
  [key: string]: functionDescriptor[];
};
const nativeMethods: functionList = {
  print,
  add,
  exit,
  lt,
  eq,
  mod,
};

export default nativeMethods;
