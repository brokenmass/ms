import { AST, OP_TYPES } from './ast';
import config from './config';
import { VALUE_TYPE } from './coreTypes';
import { locToString } from './utils';

const format = (str: string): string => {
  if (str.length > 0 && str.indexOf(':') === str.length - 1) {
    return str;
  } else {
    return '  ' + str;
  }
};

export const generateASM = (ast: AST): string => {
  let stringsCounter = 0;
  const header = [];
  const code = [];
  const data = [];

  const defaultExit = ['  mov rax, 60', '  mov rdi, 0', '  syscall'];

  const headerPrintLn = (str: string) => header.push(format(str));
  const codePrintLn = (str: string) => code.push(format(str));
  const dataPrintLn = (str: string) => data.push(format(str));
  const innerGenerator = (ast: AST) => {
    ast.forEach((op) => {
      if (op.opType === OP_TYPES.FUNCTION_CALL) {
        innerGenerator(op.parameters);
        if (op.function.code.asm_x86_64.header && !op.function.used) {
          op.function.code.asm_x86_64.header(headerPrintLn);
        }
        codePrintLn(`;; ${locToString(op.loc)}: ${op.name}`);
        op.function.code.asm_x86_64.call(codePrintLn);
        op.function.used = true;
      } else if (op.opType === OP_TYPES.IMMEDIATE) {
        if (op.valueType === VALUE_TYPE.STRING) {
          codePrintLn(`;; ${locToString(op.loc)}: ${op.name}`);
          codePrintLn(`push str_${stringsCounter}`);
          const bytes = [...Buffer.from(op.value)];
          dataPrintLn(`str_${stringsCounter}:`);
          dataPrintLn('dq ' + (bytes.length - 2));
          dataPrintLn('db ' + bytes.join(', '));
          stringsCounter++;
        } else if (op.valueType === VALUE_TYPE.INT64) {
          codePrintLn(`;; ${locToString(op.loc)}: ${op.name}`);
          // codePrintLn(`mov rax, ${op.value}`);
          codePrintLn(`push ${op.value}`);
        }
      }
    });
  };

  innerGenerator(ast);
  const text = [
    'format ELF64 executable 3',
    'segment readable executable',
    ';; -- Header --',
    ...header,
    ';; -- Main --',
    'entry start',
    'start:',
    ...code,
    ...defaultExit,
    ';; -- Data --',
    'segment readable writable',
    ...data,
  ].join('\n');

  if (config.debugASMCode) {
    // console.log(text);
  }
  return text;
};
