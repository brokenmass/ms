import { functionDescriptor } from '.';
import { VALUE_TYPE } from '../coreTypes';

const lt: functionDescriptor[] = [
  {
    used: false,
    inputs: [VALUE_TYPE.INT64, VALUE_TYPE.INT64],
    output: VALUE_TYPE.INT64,
    code: {
      asm_x86_64: {
        call: (println) => {
          println('mov rcx, 0');
          println('mov rdx, 1');
          println('pop rbx');
          println('pop rax');
          println('cmp rax, rbx');
          println('cmovl rcx, rdx');
          println('push rcx');
        },
      },
    },
  },
];

export default lt;
