import { functionDescriptor } from '.';
import { VALUE_TYPE } from '../coreTypes';

const print: functionDescriptor[] = [
  {
    used: false,
    inputs: [VALUE_TYPE.INT64],
    output: null,
    code: {
      asm_x86_64: {
        header: (println) => {
          println('print:');
          println('mov r9, -3689348814741910323');
          println('sub rsp, 40');
          println('mov BYTE [rsp+31], 10');
          println('lea rcx, [rsp+30]');
          println('.L2:');
          println('mov rax, rdi');
          println('lea r8, [rsp+32]');
          println('mul r9');
          println('mov rax, rdi');
          println('sub r8, rcx');
          println('shr rdx, 3');
          println('lea rsi, [rdx+rdx*4]');
          println('add rsi, rsi');
          println('sub rax, rsi');
          println('add eax, 48');
          println('mov BYTE [rcx], al');
          println('mov rax, rdi');
          println('mov rdi, rdx');
          println('mov rdx, rcx');
          println('sub rcx, 1');
          println('cmp rax, 9');
          println('ja  .L2');
          println('lea rax, [rsp+32]');
          println('mov edi, 1');
          println('sub rdx, rax');
          println('xor eax, eax');
          println('lea rsi, [rsp+32+rdx]');
          println('mov rdx, r8');
          println('mov rax, 1');
          println('syscall');
          println('add rsp, 40');
          println('ret');
        },
        call: (println) => {
          println('pop rdi');
          println('call print');
        },
      },
    },
  },
  {
    used: false,
    inputs: [VALUE_TYPE.STRING],
    output: null,
    code: {
      asm_x86_64: {
        call: (println) => {
          println('pop rax');
          println('mov rdx, [rax]');
          println('add rax, 8');
          println('mov rsi, rax');
          println('mov rdi, 1');
          println('mov rax, 1');
          println('syscall');
        },
      },
    },
  },
];

export default print;
