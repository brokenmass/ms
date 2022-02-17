import { AST, DECLARATION_OP, OP_TYPES } from './ast';
import config from './config';
import { VALUE_TYPE } from './coreTypes';
import { locToString } from './utils';

const escapeString = (str: string): string => str.replace(/\n/g, '\\n');
export const generateASM = (ast: AST): string => {
  let stringsCounter = 0;
  let labelCounter = 0;
  const header = [];
  const code = [];
  const data = [];

  const defaultExit = ['  mov rax, 60', '  mov rdi, 0', '  syscall'];

  let stackIndex = 0;
  const format = (str: string): string => {
    if (str.startsWith('push')) {
      stackIndex += 8;
    }
    if (str.startsWith('pop')) {
      stackIndex -= 8;
    }
    if (str.length > 0 && str.indexOf(':') === str.length - 1) {
      return str;
    } else {
      return '  ' + str;
    }
  };
  const getNextLabel = () => `addr_${labelCounter++}`;
  const headerPrintLn = (str: string) => header.push(format(str));
  const codePrintLn = (str: string) => code.push(format(str));
  const dataPrintLn = (str: string) => data.push(format(str));

  const mapDeclarations = (ast: AST) => {
    const declarations = ast.filter(
      (op) => op.opType === OP_TYPES.DECLARATION,
    ) as DECLARATION_OP[];

    if (declarations.length) {
      declarations.forEach(
        (op) => ((op.memPos = stackIndex), (stackIndex += 8)),
      );
      codePrintLn(`; allocate local variable space ${declarations.length * 8}`);
      codePrintLn(`sub rsp, ${declarations.length * 8}`);
    }
  };

  const unMapDeclarations = (ast: AST) => {
    const declarations = ast.filter(
      (op) => op.opType === OP_TYPES.DECLARATION,
    ) as DECLARATION_OP[];
    if (declarations.length) {
      codePrintLn(`; cleanup local variable space ${declarations.length * 8}`);
      codePrintLn(`add rsp, ${declarations.length * 8}`);
      stackIndex -= declarations.length * 8;
    }
  };
  const innerGenerator = (ast: AST) => {
    ast.forEach((op) => {
      if (op.opType === OP_TYPES.IF) {
        codePrintLn(`; ${locToString(op.loc)}: [${op.opType}]`);
        const ifEndLabel = getNextLabel();
        const elseEndLabel = getNextLabel();
        mapDeclarations(op.condition);
        innerGenerator(op.condition);

        codePrintLn('pop rax');
        codePrintLn('test rax, rax');
        codePrintLn('jz ' + ifEndLabel);

        mapDeclarations(op.ifBody);
        innerGenerator(op.ifBody);
        unMapDeclarations(op.ifBody);
        if (op.elseBody) {
          codePrintLn('jmp ' + elseEndLabel);
        }
        codePrintLn(ifEndLabel + ':');
        if (op.elseBody) {
          mapDeclarations(op.elseBody);
          innerGenerator(op.elseBody);
          unMapDeclarations(op.elseBody);
          codePrintLn(elseEndLabel + ':');
        }

        unMapDeclarations(op.condition);
      } else if (op.opType === OP_TYPES.WHILE) {
        const whileConditionLabel = getNextLabel();
        const whileEndLabel = getNextLabel();
        codePrintLn(`; ${locToString(op.loc)}: [${op.opType}]`);
        codePrintLn(whileConditionLabel + ':');

        mapDeclarations(op.condition);
        innerGenerator(op.condition);

        codePrintLn('pop rax');
        codePrintLn('test rax, rax');
        codePrintLn('jz ' + whileEndLabel);

        mapDeclarations(op.body);
        innerGenerator(op.body);

        unMapDeclarations([...op.condition, ...op.body]);

        codePrintLn('jmp ' + whileConditionLabel);
        codePrintLn(whileEndLabel + ':');
      } else if (op.opType === OP_TYPES.NATIVE_FUNCTION_CALL) {
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
          codePrintLn(
            `; ${locToString(op.loc)}: [${op.opType}] "${escapeString(
              op.value,
            )}"`,
          );
          codePrintLn(`push ${op.value.charCodeAt(0)}`);
        } else if (op.valueType === VALUE_TYPE.INT64) {
          codePrintLn(`; ${locToString(op.loc)}: [${op.opType}] "${op.value}"`);
          codePrintLn(`push ${op.value}`);
        }
      } else if (op.opType === OP_TYPES.DECLARATION) {
        innerGenerator(op.value);
        codePrintLn(`; ${locToString(op.loc)}: [${op.opType}] "${op.name}"`);
        if (op.value.length) {
          codePrintLn(`pop rax`);
          const delta = stackIndex - op.memPos;
          codePrintLn(`mov [rsp + ${delta}], rax`);
        }

        if (!op.isLH) {
          codePrintLn(`pop rax`);
          codePrintLn(`push rax`);
          codePrintLn(`push rax`);
        }
      } else if (op.opType === OP_TYPES.USAGE) {
        codePrintLn(`; ${locToString(op.loc)}: [${op.opType}] "${op.name}"`);
        codePrintLn(`xor rax, rax`);
        const delta = stackIndex - op.declaration.memPos;
        codePrintLn(`mov rax, [rsp + ${delta}]`);

        if (!op.isLH) {
          codePrintLn(`push rax`);
        }
      } else if (op.opType === OP_TYPES.ASSIGNMENT) {
        innerGenerator(op.value);
        codePrintLn(`; ${locToString(op.loc)}: [${op.opType}] "${op.name}"`);
        codePrintLn(`pop rax`);
        const delta = stackIndex - op.declaration.memPos;
        codePrintLn(`mov [rsp + ${delta}], rax`);

        if (!op.isLH) {
          codePrintLn(`push rax`);
        }
      } else {
        console.error(op);
      }
    });
  };
  mapDeclarations(ast);
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
    'mem_used:',
    '  dq 0',
    'mem_start:',
    '  rb 131072',
  ].join('\n');

  if (config.debugASMCode) {
    console.log(text);
  }
  return text;
};
