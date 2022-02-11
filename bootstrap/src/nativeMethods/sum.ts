import { VALUE_TYPE } from '../coreTypes';

export default [
  {
    inputsCount: 2,
    inputs: [VALUE_TYPE.INT64, VALUE_TYPE.INT64],
    output: VALUE_TYPE.INT64,
    code: {
      fasm_x86_64: {
        code: (println) => {
          println('pop rax');
          println('pop rbx');
          println('add rax, rbx');
          println('push rax');
        },
      },
    },
  },
];
