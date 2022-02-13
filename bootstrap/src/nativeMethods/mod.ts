import { functionDescriptor } from '.';
import { VALUE_TYPE } from '../coreTypes';

const mod: functionDescriptor[] = [
  {
    used: false,
    inputs: [VALUE_TYPE.INT64, VALUE_TYPE.INT64],
    output: VALUE_TYPE.INT64,
    code: {
      asm_x86_64: {
        call: (println) => {
          println('xor rdx, rdx');
          println('pop rbx');
          println('pop rax');
          println('div rbx');
          println('push rdx');
        },
      },
    },
  },
];

export default mod;
