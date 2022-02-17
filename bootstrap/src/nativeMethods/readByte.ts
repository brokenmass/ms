import { functionDescriptor } from '.';
import { VALUE_TYPE } from '../coreTypes';

const readByte: functionDescriptor[] = [
  {
    used: false,
    inputs: [VALUE_TYPE.POINTER],
    output: VALUE_TYPE.CHAR,
    code: {
      asm_x86_64: {
        call: (println) => {
          println('pop rax');
          println('xor rbx, rbx');
          println('mov bl, [rax]');
          println('push rbx');
        },
      },
    },
  },
];

export default readByte;
