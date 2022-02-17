import { functionDescriptor } from '.';
import { VALUE_TYPE } from '../coreTypes';

const readByte: functionDescriptor[] = [
  {
    used: false,
    inputs: [VALUE_TYPE.POINTER, VALUE_TYPE.CHAR],
    output: VALUE_TYPE.VOID,
    code: {
      asm_x86_64: {
        call: (println) => {
          println('pop rbx');
          println('pop rax');
          println('mov [rax], bl');
        },
      },
    },
  },
];

export default readByte;
