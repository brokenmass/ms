import { BLOCK_TYPE, loc, token, tokenBlock, TOKEN_TYPE } from './tokenizer';
import { compileError, inspect } from './utils';
import nativeMethods, { functionDescriptor } from './nativeMethods';
import { VALUE_TYPE } from './coreTypes';
import config from './config';
export enum OP_TYPES {
  DECLARATION = 'declaration',
  ASSIGNMENT = 'assignment',
  FUNCTION_CALL = 'functionCall',
  IF = 'if',
  WHILE = 'while',
  IMMEDIATE = 'immediate',
}

export enum SPECIAL_CHARS {
  ASSIGN = '=',
  COMMA = ',',
}

export enum DECLARATION_KEYWORDS {
  VAR = 'var',
  CONST = 'const',
}

export enum CONTROL_FLOW_KEYWORDS {
  IF = 'if',
  ELSE = 'else',
  WHILE = 'while',
}

const reservedWords = [
  ...Object.keys(VALUE_TYPE),
  ...Object.keys(DECLARATION_KEYWORDS),
  ...Object.keys(CONTROL_FLOW_KEYWORDS),
  ...Object.keys(nativeMethods),
];

export type DECLARATION_OP = {
  opType: OP_TYPES.DECLARATION;
  declarationType: DECLARATION_KEYWORDS;
  isLH: boolean;
  name: string;
  loc: loc;
  valueType: VALUE_TYPE;
  value: OP;
};

export type ASSIGNMENT_OP = {
  opType: OP_TYPES.ASSIGNMENT;
  name: string;
  isLH: boolean;
  loc: loc;
  valueType: VALUE_TYPE;
  value: OP;
};

export type FUNCTION_CALL_OP = {
  opType: OP_TYPES.FUNCTION_CALL;
  function: functionDescriptor;
  name: string;
  isLH: boolean;
  loc: loc;
  parameters: AST;
  valueType: VALUE_TYPE;
};

export type IMMEDIATE_OP = {
  opType: OP_TYPES.IMMEDIATE;
  name: string;
  loc: loc;
  valueType: VALUE_TYPE;
  value: string;
};

export type CONTROL_FLOW_IF_OP = {
  opType: OP_TYPES.IF;
  name: string;
  loc: loc;
  condition: AST;
  ifBody: AST;
  elseBody?: AST;
  valueType: VALUE_TYPE.VOID;
};

export type CONTROL_FLOW_WHILE_OP = {
  opType: OP_TYPES.WHILE;
  name: string;
  loc: loc;
  condition: AST;
  body: AST;
  valueType: VALUE_TYPE.VOID;
};

export type OP =
  | DECLARATION_OP
  | ASSIGNMENT_OP
  | FUNCTION_CALL_OP
  | IMMEDIATE_OP
  | CONTROL_FLOW_IF_OP
  | CONTROL_FLOW_WHILE_OP;

export type AST = OP[];
export const generateAST = (tokenizedFile: tokenBlock): AST => {
  const ast = parseBlock(tokenizedFile);

  if (config.debugAST) {
    inspect(ast);
  }

  return ast;
};

const parseBlock = (block: tokenBlock): AST => {
  const ops: AST = [];

  while (block.contents.length) {
    ops.push(parseNextOP(block.contents));

    if (block.blockType === BLOCK_TYPE.ROUND && block.contents.length > 0) {
      if (
        block.contents[0].type !== TOKEN_TYPE.SPECIAL ||
        block.contents[0].value !== SPECIAL_CHARS.COMMA
      ) {
        return compileError(block.contents[0], 'Unexpected instruction');
      } else if (block.contents.length === 1) {
        return compileError(block.contents[0], 'Unexpected trailing comma');
      } else {
        block.contents.shift();
      }
    }
  }

  return ops;
};

const parseNextOP = (
  items: (tokenBlock | token)[],
  { isLH = true } = {},
): OP => {
  const item = items.shift();

  if (item.type === TOKEN_TYPE.BLOCK) {
    return compileError(
      item,
      'A block cannot contain another unassociated block',
    );
  } else if (item.type === TOKEN_TYPE.NUMBER) {
    return {
      opType: OP_TYPES.IMMEDIATE,
      name: item.value,
      loc: item.loc,
      valueType: VALUE_TYPE.INT64,
      value: item.value,
    };
  } else if (item.type === TOKEN_TYPE.STRING) {
    return {
      opType: OP_TYPES.IMMEDIATE,
      name: item.value,
      loc: item.loc,
      valueType: VALUE_TYPE.STRING,
      value: item.value,
    };
  } else if (Object.keys(DECLARATION_KEYWORDS).includes(item.value)) {
    if (!isLH) {
      return compileError(
        item,
        `Assignments cannot appear on the right side of another assignment`,
      );
    }

    const nameToken = items.shift();
    if (nameToken.type !== TOKEN_TYPE.WORD) {
      return compileError(item, `Missing variable name`);
    }
    if (reservedWords.includes(nameToken.value)) {
      return compileError(
        nameToken,
        `Variable name "${nameToken.value}" must be alphanumerical`,
      );
    }

    const assignmentToken = items.shift();
    if (
      assignmentToken.type !== TOKEN_TYPE.SPECIAL ||
      assignmentToken.value !== '='
    ) {
      return compileError(
        item,
        `Variable "${nameToken.value}" must be assigned using '='`,
      );
    }

    const declarationTypeStringMap = {
      var: DECLARATION_KEYWORDS.VAR,
      const: DECLARATION_KEYWORDS.CONST,
    };

    const assignedValue = parseNextOP(items, {
      isLH: false,
    });
    return {
      opType: OP_TYPES.DECLARATION,
      declarationType: declarationTypeStringMap[item.value],
      isLH: true,
      name: nameToken.value,
      loc: item.loc,
      valueType: assignedValue.valueType,
      value: assignedValue,
    };
  } else if (item.value === CONTROL_FLOW_KEYWORDS.IF) {
    if (!isLH) {
      return compileError(
        item,
        `${OP_TYPES.IF} instructions cannot appear on the right side of an assignment`,
      );
    }

    if (
      item.parentBlock.blockType === BLOCK_TYPE.ROUND ||
      item.parentBlock.blockType === BLOCK_TYPE.SQUARE
    ) {
      return compileError(
        item,
        `Cannot use if/else inside ${item.parentBlock.blockType} blocks`,
      );
    }
    const conditionBlock = items.shift();
    if (
      conditionBlock.type !== TOKEN_TYPE.BLOCK ||
      conditionBlock.blockType !== BLOCK_TYPE.ROUND
    ) {
      return compileError(item, 'Missing if condition');
    }

    const condition = parseBlock(conditionBlock);
    if (condition.length > 1) {
      return compileError(
        condition[1],
        'condition block cannot contain more than a condition',
      );
    }
    let ifBody: AST;
    if (items[0].type === TOKEN_TYPE.BLOCK) {
      const ifBodyBlock = items.shift() as tokenBlock;
      if (ifBodyBlock.blockType !== BLOCK_TYPE.CURLY) {
        return compileError(
          ifBodyBlock,
          `Only ${BLOCK_TYPE.CURLY} blocks are allowed after an if condition`,
        );
      }
      ifBody = parseBlock(ifBodyBlock);
    } else {
      ifBody = [parseNextOP(items)];
    }

    let elseBody: AST;
    if (
      items[0].type === TOKEN_TYPE.WORD &&
      items[0].value === CONTROL_FLOW_KEYWORDS.ELSE
    ) {
      items.shift();

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (items[0].type === TOKEN_TYPE.BLOCK) {
        const elseBodyBlock = items.shift() as tokenBlock;
        if (elseBodyBlock.blockType !== BLOCK_TYPE.CURLY) {
          return compileError(
            elseBodyBlock,
            `Only ${BLOCK_TYPE.CURLY} blocks are allowed after an if condition`,
          );
        }
        elseBody = parseBlock(elseBodyBlock);
      } else {
        elseBody = [parseNextOP(items)];
      }
    }

    return {
      opType: OP_TYPES.IF,
      condition,
      name: item.value,
      loc: item.loc,
      ifBody,
      elseBody,
      valueType: VALUE_TYPE.VOID,
    };
  } else if (nativeMethods[item.value]) {
    const methods = nativeMethods[item.value];
    const parametersBlock = items.shift();
    if (
      parametersBlock.type !== TOKEN_TYPE.BLOCK ||
      parametersBlock.blockType !== BLOCK_TYPE.ROUND
    ) {
      return compileError(item, 'Missing parameters');
    }

    const parameters = parseBlock(parametersBlock);

    const parametersTypes = parameters
      .map((param) => param.valueType)
      .join(', ');

    const matchingMethod = methods.find(
      (method) => method.inputs.join(', ') === parametersTypes,
    );

    if (!matchingMethod) {
      return compileError(
        item,
        `Could not find function matching "${item.value}(${parametersTypes})"`,
      );
    }

    return {
      opType: OP_TYPES.FUNCTION_CALL,
      function: matchingMethod,
      isLH: true,
      name: item.value,
      loc: item.loc,
      parameters: parameters,
      valueType: matchingMethod.output,
    };
  } else {
    return compileError(
      item,
      `Could not parse token ${item.value}- Compiler error`,
    );
  }
};
