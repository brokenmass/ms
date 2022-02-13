import { BLOCK_TYPE, loc, tokenBlock, TOKEN_TYPE, token } from './tokenizer';
import { compileError, inspect, locToString } from './utils';
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
const declarationTypeStringMap = Object.entries(DECLARATION_KEYWORDS).reduce(
  (ret, [k, v]) => ((ret[v] = k), ret),
  {},
);

console.log(declarationTypeStringMap);
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
  label?: string;
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
  const parsed = new Parser(tokenizedFile);

  if (config.debugAST) {
    inspect(parsed.ast);
  }

  return parsed.ast;
};

type scope = {
  [key: string]: DECLARATION_OP;
};

class Parser {
  tokenizedFile: tokenBlock;
  ast: AST;

  blockStack: tokenBlock[] = [];
  currentBlock: tokenBlock;

  scopeStack: scope[] = [{}];

  constructor(tokenizedFile: tokenBlock) {
    this.tokenizedFile = tokenizedFile;
    this.ast = this.parseBlock(tokenizedFile);
  }

  parseBlock = (block: tokenBlock): AST => {
    this.blockStack.push(block);
    this.currentBlock = block;
    const ops: AST = [];

    while (block.contents.length) {
      ops.push(this.parseNextOP());

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

    this.blockStack.pop();
    this.currentBlock = this.blockStack[this.blockStack.length - 1];
    return ops;
  };

  nextToken = () => this.currentBlock.contents.shift();

  parseNextOP = ({ isLH = true } = {}): OP => {
    const item = this.nextToken();

    if (item.type === TOKEN_TYPE.BLOCK) {
      return compileError(
        item,
        'A block cannot contain another unassociated block',
      );
    }

    let out: OP;

    if ((out = this.parseNumber(item))) return out;
    if ((out = this.parseString(item))) return out;
    if ((out = this.parseDeclaration(item, { isLH }))) return out;
    if ((out = this.parseFunctionCall(item))) return out;
    if ((out = this.parseIf(item, { isLH }))) return out;

    return compileError(item, `Could not parse token ${item.value}`);
  };

  parseNumber = (item: token): OP => {
    if (item.type !== TOKEN_TYPE.NUMBER) {
      return null;
    }

    return {
      opType: OP_TYPES.IMMEDIATE,
      name: item.value,
      loc: item.loc,
      valueType: VALUE_TYPE.INT64,
      value: item.value,
    };
  };

  parseString = (item: token): OP => {
    if (item.type !== TOKEN_TYPE.STRING) {
      return null;
    }

    return {
      opType: OP_TYPES.IMMEDIATE,
      name: item.value,
      loc: item.loc,
      valueType: VALUE_TYPE.STRING,
      value: item.value,
    };
  };

  parseFunctionCall = (item: token): OP => {
    if (item.type !== TOKEN_TYPE.WORD || !nativeMethods[item.value]) {
      return null;
    }

    const methods = nativeMethods[item.value];
    const parametersBlock = this.nextToken();
    if (
      parametersBlock.type !== TOKEN_TYPE.BLOCK ||
      parametersBlock.blockType !== BLOCK_TYPE.ROUND
    ) {
      return compileError(item, 'Missing parameters');
    }

    const parameters = this.parseBlock(parametersBlock);

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
  };

  parseDeclaration = (item: token, { isLH = true } = {}): OP => {
    if (
      item.type !== TOKEN_TYPE.WORD ||
      !Object.keys(declarationTypeStringMap).includes(item.value)
    ) {
      return null;
    }

    if (!isLH) {
      return compileError(
        item,
        `Assignments cannot appear on the right side of another assignment`,
      );
    }

    const nameToken = this.nextToken();
    if (nameToken.type !== TOKEN_TYPE.WORD) {
      return compileError(item, `Missing variable name`);
    }
    if (reservedWords.includes(nameToken.value)) {
      return compileError(
        nameToken,
        `Variable name "${nameToken.value}" must be alphanumerical`,
      );
    }
    const existing = this.findVariableDeclarationInScope(nameToken.value);
    if (existing) {
      return compileError(
        nameToken,
        `Variable name "${
          nameToken.value
        }" has already been defined ${locToString(existing.loc)}`,
      );
    }

    const assignmentToken = this.nextToken();
    if (
      assignmentToken.type !== TOKEN_TYPE.SPECIAL ||
      assignmentToken.value !== '='
    ) {
      console.log(assignmentToken);
      return compileError(
        item,
        `Variable "${nameToken.value}" must be assigned using '='`,
      );
    }

    const assignedValue = this.parseNextOP({
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
  };

  parseIf = (item: token, { isLH = true } = {}): OP => {
    if (
      item.type !== TOKEN_TYPE.WORD ||
      item.value !== CONTROL_FLOW_KEYWORDS.IF
    ) {
      return null;
    }

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
    const conditionBlock = this.nextToken();
    if (
      conditionBlock.type !== TOKEN_TYPE.BLOCK ||
      conditionBlock.blockType !== BLOCK_TYPE.ROUND
    ) {
      return compileError(item, 'Missing if condition');
    }

    const condition = this.parseBlock(conditionBlock);
    if (condition.length > 1) {
      return compileError(
        condition[1],
        'condition block cannot contain more than a condition',
      );
    }
    let ifBody: AST;
    let nextToken = this.currentBlock.contents[0];

    if (nextToken.type === TOKEN_TYPE.BLOCK) {
      const ifBodyBlock = this.nextToken() as tokenBlock;
      if (ifBodyBlock.blockType !== BLOCK_TYPE.CURLY) {
        return compileError(
          ifBodyBlock,
          `Only ${BLOCK_TYPE.CURLY} blocks are allowed after an if condition`,
        );
      }
      ifBody = this.parseBlock(ifBodyBlock);
    } else {
      ifBody = [this.parseNextOP()];
    }

    let elseBody: AST;
    nextToken = this.currentBlock.contents[0];
    if (
      nextToken.type === TOKEN_TYPE.WORD &&
      nextToken.value === CONTROL_FLOW_KEYWORDS.ELSE
    ) {
      this.nextToken();
      nextToken = this.currentBlock.contents[0];
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (nextToken.type === TOKEN_TYPE.BLOCK) {
        const elseBodyBlock = this.nextToken() as tokenBlock;
        if (elseBodyBlock.blockType !== BLOCK_TYPE.CURLY) {
          return compileError(
            elseBodyBlock,
            `Only ${BLOCK_TYPE.CURLY} blocks are allowed after an if condition`,
          );
        }
        elseBody = this.parseBlock(elseBodyBlock);
      } else {
        elseBody = [this.parseNextOP()];
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
  };

  findVariableDeclarationInScope = (name: string): DECLARATION_OP => {
    return this.scopeStack.find((scope) => scope[name])?.[name];
  };
}
