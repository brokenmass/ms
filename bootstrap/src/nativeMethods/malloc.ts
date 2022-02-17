import { functionDescriptor } from '.';
import { VALUE_TYPE } from '../coreTypes';

const print: functionDescriptor[] = [
  {
    used: false,
    inputs: [VALUE_TYPE.INT64],
    output: VALUE_TYPE.POINTER,
    code: {
      asm_x86_64: {
        call: (println) => {
          println('pop rbx'); //rbx= size
          println('mov rax, [mem_used]'); // rax = used
          println('add rax, mem_start'); // rax = used
          println('push rax'); // rax = used

          println('mov rcx, [mem_used]'); // rcx = used
          println('add rcx, rbx'); // new used
          println('mov [mem_used], rcx'); // update used_memory
        },
      },
    },
  },
];

export default print;
