import { functionDescriptor } from '.';
import { VALUE_TYPE } from '../coreTypes';

const code = {
  asm_x86_64: {
    call: (println) => {
      println('pop rbx');
      println('pop rax');
      println('sub rax, rbx');
      println('push rax');
    },
  },
};

const add: functionDescriptor[] = [
  {
    used: false,
    inputs: [VALUE_TYPE.CHAR, VALUE_TYPE.CHAR],
    output: VALUE_TYPE.CHAR,
    code,
  },
  {
    used: false,
    inputs: [VALUE_TYPE.CHAR, VALUE_TYPE.INT64],
    output: VALUE_TYPE.CHAR,
    code,
  },
  {
    used: false,
    inputs: [VALUE_TYPE.INT64, VALUE_TYPE.INT64],
    output: VALUE_TYPE.INT64,
    code,
  },
  {
    used: false,
    inputs: [VALUE_TYPE.INT64, VALUE_TYPE.CHAR],
    output: VALUE_TYPE.INT64,
    code,
  },
  {
    used: false,
    inputs: [VALUE_TYPE.POINTER, VALUE_TYPE.POINTER],
    output: VALUE_TYPE.INT64,
    code,
  },
  {
    used: false,
    inputs: [VALUE_TYPE.POINTER, VALUE_TYPE.INT64],
    output: VALUE_TYPE.POINTER,
    code,
  },
];

export default add;
