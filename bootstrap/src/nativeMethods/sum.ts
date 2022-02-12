import { functionDescriptor } from '.';
import { VALUE_TYPE } from '../coreTypes';

const sum: functionDescriptor[] = [
  {
    used: false,
    inputs: [VALUE_TYPE.INT64, VALUE_TYPE.INT64],
    output: VALUE_TYPE.INT64,
    code: {
      asm_x86_64: {
        call: (println) => {
          println('pop rax');
          println('pop rbx');
          println('add rax, rbx');
          println('push rax');
        },
      },
    },
  },
];

export default sum;
