import { BLOCK_TYPE, loc, tokenBlock, TOKEN_TYPE, token } from './tokenizer';
import { compileError, inspect, locToString } from './utils';
import nativeMethods, { functionDescriptor } from './nativeMethods';
import { VALUE_TYPE } from './coreTypes';
import config from './config';
export enum OP_TYPES {
  DECLARATION = 'declaration',
  ASSIGNMENT = 'assignment',
  USAGE = 'usage',
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
  value: AST;
  label?: string;
};

export type ASSIGNMENT_OP = {
  opType: OP_TYPES.ASSIGNMENT;
  declaration: DECLARATION_OP;
  name: string;
  isLH: boolean;
  loc: loc;
  valueType: VALUE_TYPE;
  value: AST;
};

export type USAGE_OP = {
  opType: OP_TYPES.USAGE;
  declaration: DECLARATION_OP;
  isLH: boolean;
  name: string;
  loc: loc;
  valueType: VALUE_TYPE;
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
  | USAGE_OP
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
  get currentBlock() {
    return this.blockStack[this.blockStack.length - 1];
  }

  scopeStack: scope[] = [{}];
  get currentScope() {
    return this.scopeStack[this.scopeStack.length - 1];
  }

  constructor(tokenizedFile: tokenBlock) {
    this.tokenizedFile = tokenizedFile;
    this.ast = this.parseBlock(tokenizedFile);
  }

  nextToken = () => this.currentBlock.contents.shift();

  parseBlock = (block: tokenBlock): AST => {
    this.blockStack.push(block);
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
    return ops;
  };

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
    if ((out = this.parseUsage(item, { isLH }))) return out;
    if ((out = this.parseAssignment(item, { isLH }))) return out;
    if ((out = this.parseFunctionCall(item))) return out;
    if ((out = this.parseIf(item, { isLH }))) return out;
    if ((out = this.parseWhile(item, { isLH }))) return out;

    return compileError(item, `Could not parse token ${item.value}`);
  };

  parseNumber = (item: token): IMMEDIATE_OP => {
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

  parseString = (item: token): IMMEDIATE_OP => {
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

  parseFunctionCall = (item: token): FUNCTION_CALL_OP => {
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

  parseDeclaration = (item: token, { isLH = true } = {}): DECLARATION_OP => {
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
    console.log(nameToken.value, this.scopeStack);
    if (existing) {
      return compileError(
        nameToken,
        `Variable name "${
          nameToken.value
        }" has already been defined at ${locToString(existing.loc)}`,
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

    const op: DECLARATION_OP = {
      opType: OP_TYPES.DECLARATION,
      declarationType: declarationTypeStringMap[item.value],
      isLH: true,
      name: nameToken.value,
      loc: item.loc,
      valueType: assignedValue.valueType,
      value: [assignedValue],
    };

    this.currentScope[op.name] = op;

    return op;
  };

  parseUsage = (item: token, { isLH = true } = {}): USAGE_OP => {
    if (item.type !== TOKEN_TYPE.WORD) {
      return null;
    }

    const nextToken = this.currentBlock.contents[0];
    console.log(item, nextToken);
    if (
      nextToken &&
      nextToken.type === TOKEN_TYPE.SPECIAL &&
      nextToken.value === '='
    ) {
      // this is an assignment
      return null;
    }

    console.log('aaaaa');
    const variableDeclaration = this.findVariableDeclarationInScope(item.value);
    if (!variableDeclaration) {
      return null;
    }

    const op: USAGE_OP = {
      opType: OP_TYPES.USAGE,
      declaration: variableDeclaration,
      name: item.value,
      isLH: isLH,
      loc: item.loc,
      valueType: variableDeclaration.valueType,
    };

    return op;
  };

  parseAssignment = (item: token, { isLH = true } = {}): ASSIGNMENT_OP => {
    if (item.type !== TOKEN_TYPE.WORD) {
      return null;
    }

    console.log('bbbbb', item);
    if (
      this.currentBlock.contents[0].type !== TOKEN_TYPE.SPECIAL ||
      this.currentBlock.contents[0].value !== '='
    ) {
      // this is an assignment
      return null;
    }
    this.nextToken();
    console.log('bbbbb');
    const variableDeclaration = this.findVariableDeclarationInScope(item.value);
    if (!variableDeclaration) {
      return null;
    }

    const assignedValue = this.parseNextOP({
      isLH: false,
    });

    if (assignedValue.valueType !== variableDeclaration.valueType) {
      return compileError(
        assignedValue,
        `Cannot assign value of type "${assignedValue.valueType}" to variable of type ${variableDeclaration.valueType}`,
      );
    }

    const op: ASSIGNMENT_OP = {
      opType: OP_TYPES.ASSIGNMENT,
      declaration: variableDeclaration,
      isLH: isLH,
      name: item.value,
      loc: item.loc,
      valueType: assignedValue.valueType,
      value: [assignedValue],
    };

    return op;
  };

  parseIf = (item: token, { isLH = true } = {}): CONTROL_FLOW_IF_OP => {
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

  parseWhile = (item: token, { isLH = true } = {}): CONTROL_FLOW_WHILE_OP => {
    if (
      item.type !== TOKEN_TYPE.WORD ||
      item.value !== CONTROL_FLOW_KEYWORDS.WHILE
    ) {
      return null;
    }

    if (!isLH) {
      return compileError(
        item,
        `${OP_TYPES.WHILE} instructions cannot appear on the right side of an assignment`,
      );
    }

    if (
      item.parentBlock.blockType === BLOCK_TYPE.ROUND ||
      item.parentBlock.blockType === BLOCK_TYPE.SQUARE
    ) {
      return compileError(
        item,
        `Cannot use while inside ${item.parentBlock.blockType} blocks`,
      );
    }
    const conditionBlock = this.nextToken();
    if (
      conditionBlock.type !== TOKEN_TYPE.BLOCK ||
      conditionBlock.blockType !== BLOCK_TYPE.ROUND
    ) {
      return compileError(item, 'Missing while condition');
    }

    const condition = this.parseBlock(conditionBlock);
    if (condition.length > 1) {
      return compileError(
        condition[1],
        'condition block cannot contain more than a condition',
      );
    }
    let body: AST;
    const nextToken = this.currentBlock.contents[0];

    if (nextToken.type === TOKEN_TYPE.BLOCK) {
      const bodyBlock = this.nextToken() as tokenBlock;
      if (bodyBlock.blockType !== BLOCK_TYPE.CURLY) {
        return compileError(
          bodyBlock,
          `Only ${BLOCK_TYPE.CURLY} blocks are allowed after a while condition`,
        );
      }
      body = this.parseBlock(bodyBlock);
    } else {
      body = [this.parseNextOP()];
    }

    return {
      opType: OP_TYPES.WHILE,
      condition,
      name: item.value,
      loc: item.loc,
      body,
      valueType: VALUE_TYPE.VOID,
    };
  };

  findVariableDeclarationInScope = (name: string): DECLARATION_OP => {
    return this.scopeStack.find((scope) => scope[name])?.[name];
  };
}
