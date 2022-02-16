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

const escapeString = (str: string): string => str.replace(/\n/g, '\\n');
export const generateASM = (ast: AST): string => {
  let stringsCounter = 0;
  let varCounter = 0;
  let labelCounter = 0;
  const header = [];
  const code = [];
  const data = [];

  const defaultExit = ['  mov rax, 60', '  mov rdi, 0', '  syscall'];

  const getNextLabel = () => `addr_${labelCounter++}`;
  const headerPrintLn = (str: string) => header.push(format(str));
  const codePrintLn = (str: string) => code.push(format(str));
  const dataPrintLn = (str: string) => data.push(format(str));

  const innerGenerator = (ast: AST) => {
    ast.forEach((op) => {
      if (op.opType === OP_TYPES.IF) {
        codePrintLn(`; ${locToString(op.loc)}: [${op.opType}]`);
        const ifEndLabel = getNextLabel();
        const elseEndLabel = getNextLabel();

        innerGenerator(op.condition);

        codePrintLn('pop rax');
        codePrintLn('test rax, rax');
        codePrintLn('jz ' + ifEndLabel);

        innerGenerator(op.ifBody);
        if (op.elseBody) {
          codePrintLn('jmp ' + elseEndLabel);
        }
        codePrintLn(ifEndLabel + ':');
        if (op.elseBody) {
          innerGenerator(op.elseBody);
        }
        codePrintLn(elseEndLabel + ':');
      } else if (op.opType === OP_TYPES.WHILE) {
        codePrintLn(`; ${locToString(op.loc)}: [${op.opType}]`);
        const whileConditionLabel = getNextLabel();
        const whileEndLabel = getNextLabel();

        codePrintLn(whileConditionLabel + ':');

        innerGenerator(op.condition);

        codePrintLn('pop rax');
        codePrintLn('test rax, rax');
        codePrintLn('jz ' + whileEndLabel);

        innerGenerator(op.body);
        codePrintLn('jmp ' + whileConditionLabel);
        codePrintLn(whileEndLabel + ':');
      } else if (op.opType === OP_TYPES.FUNCTION_CALL) {
        innerGenerator(op.parameters);
        if (op.function.code.asm_x86_64.header && !op.function.used) {
          op.function.code.asm_x86_64.header(headerPrintLn, getNextLabel);
        }
        codePrintLn(`; ${locToString(op.loc)}: [${op.opType}] "${op.name}"`);
        op.function.code.asm_x86_64.call(codePrintLn, getNextLabel);
        op.function.used = true;
      } else if (op.opType === OP_TYPES.IMMEDIATE) {
        if (op.valueType === VALUE_TYPE.STRING) {
          const strLabel = `str_${stringsCounter++}`;
          codePrintLn(
            `; ${locToString(op.loc)}: [${op.opType}] "${escapeString(
              op.value,
            )}"`,
          );
          codePrintLn(`push ${strLabel}`);
          const bytes = [...Buffer.from(op.value)];
          dataPrintLn(`${strLabel}:`);
          dataPrintLn('dq ' + bytes.length);
          dataPrintLn('db ' + bytes.join(', '));
        } else if (op.valueType === VALUE_TYPE.CHAR) {
          codePrintLn(`; ${locToString(op.loc)}: [${op.opType}] "${op.value}"`);
          codePrintLn(`push ${op.value.charCodeAt(0)}`);
        } else if (op.valueType === VALUE_TYPE.INT64) {
          codePrintLn(`; ${locToString(op.loc)}: [${op.opType}] "${op.value}"`);
          codePrintLn(`push ${op.value}`);
        }
      } else if (op.opType === OP_TYPES.DECLARATION) {
        const varLabel = `var_${varCounter++}`;
        innerGenerator(op.value);
        codePrintLn(`; ${locToString(op.loc)}: [${op.opType}] "${op.name}"`);
        if (op.value.length) {
          codePrintLn(`pop rax`);
          codePrintLn(`mov [${varLabel}], rax`);
        }

        if (!op.isLH) {
          codePrintLn(`push rax`);
        }

        dataPrintLn(`${varLabel}:`);
        dataPrintLn(`rq 1`);

        op.label = varLabel;
      } else if (op.opType === OP_TYPES.USAGE) {
        const varLabel = op.declaration.label;
        codePrintLn(`; ${locToString(op.loc)}: [${op.opType}] "${op.name}"`);
        codePrintLn(`xor rax, rax`);
        codePrintLn(`mov rax, [${varLabel}]`);

        if (!op.isLH) {
          codePrintLn(`push rax`);
        }
      } else if (op.opType === OP_TYPES.ASSIGNMENT) {
        const varLabel = op.declaration.label;
        innerGenerator(op.value);
        codePrintLn(`; ${locToString(op.loc)}: [${op.opType}] "${op.name}"`);
        codePrintLn(`pop rax`);
        codePrintLn(`mov [${varLabel}], rax`);

        if (!op.isLH) {
          codePrintLn(`push rax`);
        }
      }
    });
  };

  innerGenerator(ast);
  // default exit code
  const text = [
    'format ELF64 executable 3',
    'segment readable executable',
    '; -- Header --',
    ...header,
    '; -- Main --',
    'entry start',
    'start:',
    ...code,
    ...defaultExit,
    '; -- Data --',
    'segment readable writable',
    ...data,
  ].join('\n');

  if (config.debugASMCode) {
    console.log(text);
  }
  return text;
};
