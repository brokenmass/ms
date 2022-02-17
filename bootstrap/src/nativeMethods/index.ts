import { VALUE_TYPE } from '../coreTypes';
import print from './print';
import add from './add';
import sub from './sub';
import exit from './exit';
import eq from './eq';
import lt from './lt';
import gt from './gt';
import ge from './ge';
import mod from './mod';
import malloc from './malloc';
import readByte from './readByte';
import writeByte from './writeByte';
import breakpoint from './breakpoint';

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
  sub,
  exit,
  lt,
  gt,
  ge,
  eq,
  mod,
  malloc,
  readByte,
  writeByte,
  breakpoint,
};

export default nativeMethods;
