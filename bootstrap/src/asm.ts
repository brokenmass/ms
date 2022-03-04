import { AST, OP, OP_TYPES } from './ast';
import config from './config';
import { INTEGER_FAMILY, types, VALUE_FAMILY } from './coreTypes';
// import { VALUE_FAMILY } from './coreTypes';
import { locToString } from './utils';

const registries = {
  a: { 64: 'rax', 32: 'eax', 16: 'ax', 8: 'al' },
  b: { 64: 'rbx', 32: 'ebx', 16: 'bx', 8: 'bl' },
  c: { 64: 'rcx', 32: 'ecx', 16: 'cx', 8: 'cl' },
  d: { 64: 'rdx', 32: 'edx', 16: 'dx', 8: 'dl' },
  di: { 64: 'rdi', 32: 'edi', 16: 'di', 8: 'dil' },
  si: { 64: 'rsi', 32: 'esi', 16: 'si', 8: 'sil' },
};

const loadIntValue = (
  op: OP,
  registry: keyof typeof registries,
  extraOffset = 0,
) => {
  let valueType = op.valueType;

  if (op.opType === OP_TYPES.USAGE || op.opType === OP_TYPES.ASSIGNMENT) {
    // when loading value from memory use native type, not casted one
    valueType = op.declaration.valueType;
  }
  let comment = '';

  if (op.opType === OP_TYPES.IMMEDIATE) {
    comment = `; ${locToString(op.token.loc)}: [${op.opType}] "${
      op.token.text
    }"\n`;
    return `${comment}mov ${registries[registry][64]}, ${op.value}`;
  }
  comment = `; ${locToString(op.token.loc)}: [result of ${op.opType}] "${
    op.token.text
  }"\n`;
  const source = `[rbp - ${op.stackPos + extraOffset}]`;

  if (valueType.size >= 8) {
    return `${comment}mov ${registries[registry][64]}, QWORD ${source}`;
  }

  const signed = (valueType as INTEGER_FAMILY).signed;
  if (valueType.size === 4) {
    const mov = signed ? 'movsxd' : 'mov';
    return `${comment}${mov} ${registries[registry][64]}, DWORD ${source}`;
  }

  if (valueType.size === 2) {
    const mov = signed ? 'movsx' : 'movzx';
    return `${comment}${mov} ${registries[registry][64]}, WORD ${source}`;
  }

  if (valueType.size === 1) {
    const mov = signed ? 'movsx' : 'movzx';
    return `${comment}${mov} ${registries[registry][64]}, BYTE ${source}`;
  }

  return '';
};

const storeValue = (
  registry: keyof typeof registries,
  op: OP,
  extraOffset = 0,
) => {
  let target = `[rbp - ${op.stackPos + extraOffset}]`;
  const valueType = op.valueType;
  target = `[rbp - ${op.stackPos + extraOffset}]`;

  if (valueType.size >= 8) {
    return `mov ${target}, ${registries[registry][64]}`;
  }

  if (valueType.size === 4) {
    return `mov ${target}, ${registries[registry][32]}`;
  }

  if (valueType.size === 2) {
    return `mov ${target}, ${registries[registry][16]}`;
  }

  if (valueType.size === 1) {
    return `mov ${target}, ${registries[registry][8]}`;
  }

  return '';
};

const prebuiltPrint = [
  'print:',
  '  mov r9, -3689348814741910323',
  '  sub rsp, 40',
  // '  mov BYTE [rsp+31], 10',
  '  lea rcx, [rsp+30]',
  '.L2:',
  '  mov rax, rdi',
  '  lea r8, [rsp+32]',
  '  mul r9',
  '  mov rax, rdi',
  '  sub r8, rcx',
  '  shr rdx, 3',
  '  lea rsi, [rdx+rdx*4]',
  '  add rsi, rsi',
  '  sub rax, rsi',
  '  add eax, 48',
  '  mov BYTE [rcx], al',
  '  mov rax, rdi',
  '  mov rdi, rdx',
  '  mov rdx, rcx',
  '  sub rcx, 1',
  '  cmp rax, 9',
  '  ja  .L2',
  '  lea rax, [rsp+32]',
  '  mov edi, 1',
  '  sub rdx, rax',
  '  xor eax, eax',
  '  lea rsi, [rsp+32+rdx]',
  '  mov rdx, r8',
  '  mov rax, 1',
  '  syscall',
  '  add rsp, 40',
  '  ret',
];

export const generateASM = (ast: AST): string => {
  let stringsCounter = 0;
  let labelCounter = 0;
  const header = [];
  const code = [];
  const data = [];

  const defaultExit = ['  mov rax, 60', '  mov rdi, 0', '  syscall'];

  let stackIndex = 0;
  const format = (str: string): string => {
    return str
      .split('\n')
      .map((s) => {
        if (s.length > 0 && s.indexOf(':') === s.length - 1) {
          return s;
        } else {
          return '  ' + s;
        }
      })
      .join('\n');
  };
  const getNextLabel = () => `addr_${labelCounter++}`;
  const codePrintLn = (str: string) => code.push(format(str));
  const dataPrintLn = (str: string) => data.push(format(str));

  // TODO: keep track of used registries
  const innerGenerator = (ast: AST, innerStack = 0) => {
    ast.forEach((op) => {
      if (op.opType === OP_TYPES.OPEN_SCOPE) {
        if (op.scope.size) {
          const actualSize = (op.scope.size + 7) & -8;
          stackIndex += actualSize;
          codePrintLn('push rbp');
          codePrintLn('mov rbp, rsp');
          Object.values(op.scope.vars).forEach((v) => {
            codePrintLn(
              `; [rbp - ${v.stackPos}] [${v.valueType.name}] ${v.name}`,
            );
          });
          // round to nearest multiple of 8

          codePrintLn(`sub rsp, ${actualSize}`);
        }
      } else if (op.opType === OP_TYPES.CLOSE_SCOPE) {
        if (op.scope.size) {
          const actualSize = (op.scope.size + 7) & -8;
          stackIndex -= actualSize;
          codePrintLn(`add rsp, ${actualSize}`);
        }
      } else if (op.opType === OP_TYPES.IF) {
        codePrintLn(`; ${locToString(op.token.loc)}: [${op.opType}]`);
        const ifEndLabel = getNextLabel();
        const elseEndLabel = getNextLabel();
        innerGenerator(op.condition);

        codePrintLn(loadIntValue(op.condition[op.condition.length - 1], 'a'));
        codePrintLn('test rax, rax');
        codePrintLn('jz ' + ifEndLabel);

        innerGenerator(op.ifBody);
        if (op.elseBody.length) {
          codePrintLn('jmp ' + elseEndLabel);
        }
        codePrintLn(ifEndLabel + ':');
        if (op.elseBody.length) {
          innerGenerator(op.elseBody);
          codePrintLn(elseEndLabel + ':');
        }
      } else if (op.opType === OP_TYPES.WHILE) {
        const whileConditionLabel = getNextLabel();
        const whileEndLabel = getNextLabel();
        codePrintLn(`; ${locToString(op.token.loc)}: [${op.opType}]`);
        codePrintLn(whileConditionLabel + ':');

        innerGenerator(op.condition);

        codePrintLn(loadIntValue(op.condition[op.condition.length - 1], 'a'));
        codePrintLn('test rax, rax');
        codePrintLn('jz ' + whileEndLabel);

        innerGenerator(op.body);

        codePrintLn('jmp ' + whileConditionLabel);
        codePrintLn(whileEndLabel + ':');
      } else if (op.opType === OP_TYPES.DECLARATION) {
        // do nothing
      } else if (op.opType === OP_TYPES.USAGE) {
        // do nothing
      } else if (op.opType === OP_TYPES.ASSIGNMENT) {
        const assignmentOp = op.value[op.value.length - 1];
        if (assignmentOp.opType === OP_TYPES.NATIVE_FUNCTION_CALL) {
          assignmentOp.stackPos = op.stackPos;
        }
        innerGenerator(op.value);
        codePrintLn(
          `; ${locToString(op.token.loc)}: [${op.opType}] "${op.token.text}"`,
        );
        if (
          assignmentOp.opType === OP_TYPES.IMMEDIATE &&
          assignmentOp.valueType === types.string
        ) {
          codePrintLn(`mov rbx, QWORD ${assignmentOp.value}`);
          codePrintLn(`mov [rbp - ${op.stackPos}], rbx`);
          codePrintLn(`mov rbx, QWORD ${assignmentOp.label}`);
          codePrintLn(`mov [rbp - ${op.stackPos + 8}], rbx`);
        } else if (assignmentOp.opType !== OP_TYPES.NATIVE_FUNCTION_CALL) {
          for (let i = 0; i < op.valueType.size; i += 8) {
            codePrintLn(loadIntValue(assignmentOp, 'a', i));
            codePrintLn(storeValue('a', op, i));
          }
        }
      } else if (op.opType === OP_TYPES.IMMEDIATE) {
        if (op.valueType === types.string) {
          const strLabel = `str_${stringsCounter++}`;
          codePrintLn(
            `; ${locToString(op.token.loc)}: [${op.opType}] "${op.token.text}"`,
          );

          const bytes = [...Buffer.from(op.value as string)];
          op.label = strLabel;
          op.value = bytes.length;

          dataPrintLn(`${strLabel}:`);
          dataPrintLn('db ' + bytes.join(', '));
        }
      } else if (op.opType === OP_TYPES.NATIVE_FUNCTION_CALL) {
        innerGenerator(op.parameters, innerStack);

        if (
          op.stackPos === undefined &&
          op.valueType.family !== VALUE_FAMILY.VOID
        ) {
          innerStack += op.valueType.size;
          op.stackPos = stackIndex + innerStack;
        }

        if (op.nativeType === '+') {
          codePrintLn(loadIntValue(op.parameters[0], 'a'));
          codePrintLn(loadIntValue(op.parameters[1], 'b'));
          codePrintLn(
            `; ${locToString(op.token.loc)}: [${op.opType}] "${op.token.text}"`,
          );
          codePrintLn('add rax, rbx');
          codePrintLn(storeValue('a', op));
        }

        if (op.nativeType === '-') {
          codePrintLn(loadIntValue(op.parameters[0], 'a'));
          codePrintLn(loadIntValue(op.parameters[1], 'b'));
          codePrintLn(
            `; ${locToString(op.token.loc)}: [${op.opType}] "${op.token.text}"`,
          );
          codePrintLn('sub rax, rbx');
          codePrintLn(storeValue('a', op));
        }

        if (op.nativeType === '%') {
          codePrintLn(loadIntValue(op.parameters[0], 'a'));
          codePrintLn(loadIntValue(op.parameters[1], 'b'));
          codePrintLn(
            `; ${locToString(op.token.loc)}: [${op.opType}] "${op.token.text}"`,
          );
          codePrintLn('xor edx, edx');
          codePrintLn('div rbx');

          codePrintLn(storeValue('d', op));
        }

        if (op.nativeType === '/') {
          codePrintLn(loadIntValue(op.parameters[0], 'a'));
          codePrintLn(loadIntValue(op.parameters[1], 'b'));
          codePrintLn(
            `; ${locToString(op.token.loc)}: [${op.opType}] "${op.token.text}"`,
          );
          codePrintLn('xor edx, edx');
          codePrintLn('div rbx');

          codePrintLn(storeValue('a', op));
        }

        if (op.nativeType === '*') {
          codePrintLn(loadIntValue(op.parameters[0], 'a'));
          codePrintLn(loadIntValue(op.parameters[1], 'b'));
          codePrintLn(
            `; ${locToString(op.token.loc)}: [${op.opType}] "${op.token.text}"`,
          );
          codePrintLn('mul rbx');

          codePrintLn(storeValue('a', op));
        }

        if (op.nativeType === '==') {
          codePrintLn(loadIntValue(op.parameters[0], 'a'));
          codePrintLn(loadIntValue(op.parameters[1], 'b'));
          codePrintLn(
            `; ${locToString(op.token.loc)}: [${op.opType}] "${op.token.text}"`,
          );
          codePrintLn('mov ecx, 0');
          codePrintLn('mov edx, 1');

          codePrintLn('cmp rax, rbx');
          codePrintLn('cmove ecx, edx');

          codePrintLn(storeValue('c', op));
        }

        if (op.nativeType === '!=') {
          codePrintLn(loadIntValue(op.parameters[0], 'a'));
          codePrintLn(loadIntValue(op.parameters[1], 'b'));
          codePrintLn(
            `; ${locToString(op.token.loc)}: [${op.opType}] "${op.token.text}"`,
          );
          codePrintLn('mov ecx, 0');
          codePrintLn('mov edx, 1');

          codePrintLn('cmp rax, rbx');
          codePrintLn('cmovne ecx, edx');

          codePrintLn(storeValue('c', op));
        }

        if (op.nativeType === '<') {
          codePrintLn(loadIntValue(op.parameters[0], 'a'));
          codePrintLn(loadIntValue(op.parameters[1], 'b'));
          codePrintLn(
            `; ${locToString(op.token.loc)}: [${op.opType}] "${op.token.text}"`,
          );
          codePrintLn('mov ecx, 0');
          codePrintLn('mov edx, 1');

          codePrintLn('cmp rax, rbx');
          codePrintLn('cmovl ecx, edx');

          codePrintLn(storeValue('c', op));
        }

        if (op.nativeType === '<=') {
          codePrintLn(loadIntValue(op.parameters[0], 'a'));
          codePrintLn(loadIntValue(op.parameters[1], 'b'));
          codePrintLn(
            `; ${locToString(op.token.loc)}: [${op.opType}] "${op.token.text}"`,
          );
          codePrintLn('mov ecx, 0');
          codePrintLn('mov edx, 1');

          codePrintLn('cmp rax, rbx');
          codePrintLn('cmovle ecx, edx');

          codePrintLn(storeValue('c', op));
        }

        if (op.nativeType === '>') {
          codePrintLn(loadIntValue(op.parameters[0], 'a'));
          codePrintLn(loadIntValue(op.parameters[1], 'b'));
          codePrintLn(
            `; ${locToString(op.token.loc)}: [${op.opType}] "${op.token.text}"`,
          );
          codePrintLn('mov ecx, 0');
          codePrintLn('mov edx, 1');

          codePrintLn('cmp rax, rbx');
          codePrintLn('cmovg ecx, edx');

          codePrintLn(storeValue('c', op));
        }

        if (op.nativeType === '>=') {
          codePrintLn(loadIntValue(op.parameters[0], 'a'));
          codePrintLn(loadIntValue(op.parameters[1], 'b'));
          codePrintLn(
            `; ${locToString(op.token.loc)}: [${op.opType}] "${op.token.text}"`,
          );
          codePrintLn('mov ecx, 0');
          codePrintLn('mov edx, 1');

          codePrintLn('cmp rax, rbx');
          codePrintLn('cmovge ecx, edx');

          codePrintLn(storeValue('c', op));
        }

        if (op.nativeType === '&') {
          codePrintLn(loadIntValue(op.parameters[0], 'a'));
          codePrintLn(loadIntValue(op.parameters[1], 'b'));
          codePrintLn(
            `; ${locToString(op.token.loc)}: [${op.opType}] "${op.token.text}"`,
          );
          codePrintLn('and rax, rbx');
          codePrintLn(storeValue('a', op));
        }

        if (op.nativeType === '|') {
          codePrintLn(loadIntValue(op.parameters[0], 'a'));
          codePrintLn(loadIntValue(op.parameters[1], 'b'));
          codePrintLn(
            `; ${locToString(op.token.loc)}: [${op.opType}] "${op.token.text}"`,
          );
          codePrintLn('or rax, rbx');
          codePrintLn(storeValue('a', op));
        }

        if (op.nativeType === '<<') {
          codePrintLn(loadIntValue(op.parameters[0], 'a'));
          codePrintLn(loadIntValue(op.parameters[1], 'c'));
          codePrintLn(
            `; ${locToString(op.token.loc)}: [${op.opType}] "${op.token.text}"`,
          );
          codePrintLn('shl rax, cl');
          codePrintLn(storeValue('a', op));
        }

        if (op.nativeType === '>>') {
          codePrintLn(loadIntValue(op.parameters[0], 'a'));
          codePrintLn(loadIntValue(op.parameters[1], 'c'));
          codePrintLn(
            `; ${locToString(op.token.loc)}: [${op.opType}] "${op.token.text}"`,
          );
          codePrintLn('shr rax, cl');
          codePrintLn(storeValue('a', op));
        }

        if (op.nativeType === 'exit') {
          codePrintLn(loadIntValue(op.parameters[0], 'di'));
          codePrintLn(
            `; ${locToString(op.token.loc)}: [${op.opType}] "${op.token.text}"`,
          );
          codePrintLn('mov rax, 60');
          codePrintLn('syscall');
          codePrintLn(storeValue('a', op));
        }

        if (op.nativeType === 'malloc') {
          codePrintLn(loadIntValue(op.parameters[0], 'b'));
          codePrintLn(
            `; ${locToString(op.token.loc)}: [${op.opType}] "${op.token.text}"`,
          );
          codePrintLn('mov rax, [mem_used]'); // rax = used
          codePrintLn('add rax, mem_start'); // rax = used
          codePrintLn(storeValue('a', op));
          codePrintLn('mov rcx, [mem_used]'); // rcx = used
          codePrintLn('add rcx, rbx'); // new used
          codePrintLn('mov [mem_used], rcx'); // update used_memory
        }

        if (op.nativeType === 'writeByte') {
          codePrintLn(loadIntValue(op.parameters[0], 'a'));
          codePrintLn(loadIntValue(op.parameters[1], 'b'));
          codePrintLn(
            `; ${locToString(op.token.loc)}: [${op.opType}] "${op.token.text}"`,
          );

          codePrintLn('mov [rax], bl');
        }

        if (op.nativeType === 'writeQuad') {
          codePrintLn(loadIntValue(op.parameters[0], 'a'));
          codePrintLn(loadIntValue(op.parameters[1], 'b'));
          codePrintLn(
            `; ${locToString(op.token.loc)}: [${op.opType}] "${op.token.text}"`,
          );

          codePrintLn('mov [rax], rbx');
        }

        if (op.nativeType === 'readByte') {
          codePrintLn(loadIntValue(op.parameters[0], 'b'));
          codePrintLn(
            `; ${locToString(op.token.loc)}: [${op.opType}] "${op.token.text}"`,
          );

          codePrintLn('xor rax, rax');
          codePrintLn('mov al, [rbx]');

          codePrintLn(storeValue('a', op));
        }

        if (op.nativeType === 'readQuad') {
          codePrintLn(loadIntValue(op.parameters[0], 'b'));
          codePrintLn(
            `; ${locToString(op.token.loc)}: [${op.opType}] "${op.token.text}"`,
          );

          codePrintLn('xor rax, rax');
          codePrintLn('mov rax, [rbx]');

          codePrintLn(storeValue('a', op));
        }

        if (op.nativeType === 'print') {
          const assignmentOp = op.parameters[0];

          if (assignmentOp.valueType.name === 'char') {
            let offset;
            if (assignmentOp.opType === OP_TYPES.IMMEDIATE) {
              assignmentOp.stackPos = stackIndex + innerStack;

              codePrintLn(loadIntValue(assignmentOp, 'a'));
              codePrintLn(storeValue('a', assignmentOp));
              offset = assignmentOp.stackPos;
            } else if (assignmentOp.opType === OP_TYPES.NATIVE_FUNCTION_CALL) {
              offset = assignmentOp.stackPos;
            } else if (
              assignmentOp.opType === OP_TYPES.ASSIGNMENT ||
              assignmentOp.opType === OP_TYPES.USAGE
            ) {
              offset = assignmentOp.stackPos;
            }

            codePrintLn(
              `; ${locToString(op.token.loc)}: [${op.opType}] "${
                op.token.text
              }"`,
            );
            codePrintLn(`lea rsi, [rbp - ${offset}]`);
            codePrintLn('mov rdx, 1');
            codePrintLn('mov rdi, 1');
            codePrintLn('mov rax, 1');
            codePrintLn('syscall');
          } else if (
            assignmentOp.valueType.family === VALUE_FAMILY.INTEGER ||
            assignmentOp.valueType.family === VALUE_FAMILY.POINTER
          ) {
            codePrintLn(loadIntValue(assignmentOp, 'di'));
            codePrintLn(
              `; ${locToString(op.token.loc)}: [${op.opType}] "${
                op.token.text
              }"`,
            );
            codePrintLn('call print');
          } else if (assignmentOp.valueType === types.string) {
            if (assignmentOp.opType === OP_TYPES.IMMEDIATE) {
              codePrintLn(`mov rdx, ${assignmentOp.value}`);
              codePrintLn(`mov rsi, ${assignmentOp.label}`);
            } else {
              codePrintLn(`mov rdx, [rbp - ${assignmentOp.stackPos}]`);
              codePrintLn(`mov rsi, [rbp - ${assignmentOp.stackPos + 8}]`);
            }
            codePrintLn('mov rdi, 1');
            codePrintLn('mov rax, 1');
            codePrintLn('syscall');
          }
        }
      } else {
        console.error(op);
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
    ...prebuiltPrint,
    '; -- Main --',
    'entry start',
    'start:',
    '  mov rbp, rsp',
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
