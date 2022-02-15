import { functionDescriptor } from '.';
import { VALUE_TYPE } from '../coreTypes';

const sum: functionDescriptor[] = [
  {
    used: false,
    inputs: [VALUE_TYPE.INT64],
    output: VALUE_TYPE.NEVER,
    code: {
      asm_x86_64: {
        call: (println) => {
          println('pop rdi');
          println('mov rax, 60');
          println('syscall');
        },
      },
    },
  },
];

export default sum;
