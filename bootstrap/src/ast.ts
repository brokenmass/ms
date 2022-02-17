import { BLOCK_TYPE, loc, tokenBlock, TOKEN_TYPE, token } from './tokenizer';
import { compileError, inspect, locToString } from './utils';
import nativeMethods, { functionDescriptor } from './nativeMethods';
import { VALUE_TYPE } from './coreTypes';
import config from './config';
export enum OP_TYPES {
  DECLARATION = 'declaration',
  ASSIGNMENT = 'assignment',
  USAGE = 'usage',
  NATIVE_FUNCTION_CALL = 'nativeFunctionCall',
  IF = 'if',
  WHILE = 'while',
  IMMEDIATE = 'immediate',
}

export enum SPECIAL_CHARS {
  ASSIGN = '=',
  COMMA = ',',
}

export enum DECLARATION_KEYWORDS {
  LET = 'let',
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
  isInitialised: boolean;
  name: string;
  loc: loc;
  valueType: VALUE_TYPE;
  value: AST;
  memPos?: number;
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

export type NATIVE_FUNCTION_CALL_OP = {
  opType: OP_TYPES.NATIVE_FUNCTION_CALL;
  function: functionDescriptor;
  name: string;
  isLH: boolean;
  loc: loc;
  parameters: AST;
  valueType: VALUE_TYPE;
};

export type IMMEDIATE_OP = {
  opType: OP_TYPES.IMMEDIATE;
  isLH: boolean;
  loc: loc;
  valueType: VALUE_TYPE;
  value: string;
};

export type CONTROL_FLOW_IF_OP = {
  opType: OP_TYPES.IF;
  loc: loc;
  condition: AST;
  ifBody: AST;
  elseBody?: AST;
  valueType: VALUE_TYPE.VOID;
};

export type CONTROL_FLOW_WHILE_OP = {
  opType: OP_TYPES.WHILE;
  loc: loc;
  condition: AST;
  body: AST;
  valueType: VALUE_TYPE.VOID;
};

export type OP =
  | DECLARATION_OP
  | ASSIGNMENT_OP
  | USAGE_OP
  | NATIVE_FUNCTION_CALL_OP
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

  takeNextToken = () => this.currentBlock.contents.shift();
  peekNextToken = () => this.currentBlock.contents[0];

  parseBlock = (block: tokenBlock): AST => {
    this.blockStack.push(block);
    const ops: AST = [];

    while (block.contents.length) {
      ops.push(
        this.parseNextOP({
          isLH:
            block.blockType === BLOCK_TYPE.CURLY ||
            block.blockType === BLOCK_TYPE.FILE,
        }),
      );

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
    const token = this.takeNextToken();

    if (token.type === TOKEN_TYPE.BLOCK) {
      return compileError(
        token,
        'A block cannot contain another unassociated block',
      );
    }

    let out: OP;

    if ((out = this.parseNumber(token))) return out;
    if ((out = this.parseString(token))) return out;
    if ((out = this.parseChar(token))) return out;
    if ((out = this.parseCast(token, { isLH }))) return out;
    if ((out = this.parseDeclaration(token, { isLH }))) return out;
    if ((out = this.parseUsage(token, { isLH }))) return out;
    if ((out = this.parseAssignment(token, { isLH }))) return out;
    if ((out = this.parseFunctionCall(token, { isLH }))) return out;
    if ((out = this.parseIf(token, { isLH }))) return out;
    if ((out = this.parseWhile(token, { isLH }))) return out;

    return compileError(token, `Could not parse token ${token.value}`);
  };

  parseNumber = (token: token, { isLH = true } = {}): IMMEDIATE_OP => {
    if (token.type !== TOKEN_TYPE.NUMBER) {
      return null;
    }

    return {
      opType: OP_TYPES.IMMEDIATE,
      isLH: isLH,
      loc: token.loc,
      valueType: VALUE_TYPE.INT64,
      value: token.value,
    };
  };

  parseString = (token: token, { isLH = true } = {}): IMMEDIATE_OP => {
    if (token.type !== TOKEN_TYPE.STRING) {
      return null;
    }

    return {
      opType: OP_TYPES.IMMEDIATE,
      isLH: isLH,
      loc: token.loc,
      valueType: VALUE_TYPE.STRING,
      value: token.value,
    };
  };

  parseChar = (token: token, { isLH = true } = {}): IMMEDIATE_OP => {
    if (token.type !== TOKEN_TYPE.CHAR) {
      return null;
    }

    return {
      opType: OP_TYPES.IMMEDIATE,
      isLH: isLH,
      loc: token.loc,
      valueType: VALUE_TYPE.CHAR,
      value: token.value,
    };
  };

  parseCast = (token: token, { isLH = true } = {}): OP => {
    if (
      token.type !== TOKEN_TYPE.WORD ||
      !Object.values(VALUE_TYPE).includes(token.value as VALUE_TYPE)
    ) {
      return null;
    }

    const parametersBlock = this.takeNextToken();
    if (
      parametersBlock.type !== TOKEN_TYPE.BLOCK ||
      parametersBlock.blockType !== BLOCK_TYPE.ROUND
    ) {
      return compileError(token, 'Missing parameters');
    }

    const item = this.parseBlock(parametersBlock);

    if (item.length > 1) {
      return compileError(item[1], 'Too many parameters');
    }

    const op = item[0] as Exclude<
      OP,
      CONTROL_FLOW_IF_OP | CONTROL_FLOW_WHILE_OP
    >;

    op.valueType = token.value as VALUE_TYPE;
    op.isLH = isLH;

    return op;
  };

  parseFunctionCall = (
    token: token,
    { isLH = true } = {},
  ): NATIVE_FUNCTION_CALL_OP => {
    if (token.type !== TOKEN_TYPE.WORD || !nativeMethods[token.value]) {
      return null;
    }

    const methods = nativeMethods[token.value];
    const parametersBlock = this.takeNextToken();
    if (
      parametersBlock.type !== TOKEN_TYPE.BLOCK ||
      parametersBlock.blockType !== BLOCK_TYPE.ROUND
    ) {
      return compileError(token, 'Missing parameters');
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
        token,
        `Could not find function matching "${token.value}(${parametersTypes})"`,
      );
    }

    matchingMethod.used = false;
    return {
      opType: OP_TYPES.NATIVE_FUNCTION_CALL,
      function: matchingMethod,
      isLH: isLH,
      name: token.value,
      loc: token.loc,
      parameters: parameters,
      valueType: matchingMethod.output,
    };
  };

  parseDeclaration = (token: token, { isLH = true } = {}): DECLARATION_OP => {
    if (
      token.type !== TOKEN_TYPE.WORD ||
      !Object.keys(declarationTypeStringMap).includes(token.value)
    ) {
      return null;
    }

    const typeToken: token = this.takeNextToken();
    let nameToken: token;
    let type: VALUE_TYPE;
    if (typeToken.type !== TOKEN_TYPE.WORD) {
      return compileError(token, `Missing variable name`);
    }

    if (Object.values(VALUE_TYPE).includes(typeToken.value as VALUE_TYPE)) {
      type = typeToken.value as VALUE_TYPE;

      nameToken = this.takeNextToken();

      while (
        nameToken.type === TOKEN_TYPE.BLOCK &&
        nameToken.blockType === BLOCK_TYPE.SQUARE
      ) {
        this.parseBlock(nameToken);
        nameToken = this.takeNextToken();
      }
      // type
    } else {
      nameToken = typeToken;
    }

    if (nameToken.type !== TOKEN_TYPE.WORD) {
      return compileError(token, `Missing variable name`);
    }

    if (reservedWords.includes(nameToken.value)) {
      return compileError(
        nameToken,
        `Variable name "${nameToken.value}" must not used a reserved word`,
      );
    }
    const existing = this.findVariableDeclarationInScope(nameToken.value);

    if (existing) {
      return compileError(
        nameToken,
        `Variable name "${
          nameToken.value
        }" has already been defined at ${locToString(existing.loc)}`,
      );
    }

    const assignmentToken = this.peekNextToken();

    let value: AST = [];
    if (
      assignmentToken?.type !== TOKEN_TYPE.SPECIAL ||
      assignmentToken?.value !== '='
    ) {
      if (!type) {
        return compileError(
          token,
          `Implicitly typed variable "${nameToken.value}" must be assigned using '='`,
        );
      }
    } else {
      this.takeNextToken();
      const assignmentOp = this.parseNextOP({
        isLH: false,
      });

      if (type && assignmentOp.valueType !== type) {
        return compileError(
          assignmentOp,
          `Cannot assign value of type "${assignmentOp.valueType}" to variable of type ${type}`,
        );
      }

      type = assignmentOp.valueType;
      value = [assignmentOp];
    }

    const op: DECLARATION_OP = {
      opType: OP_TYPES.DECLARATION,
      declarationType: declarationTypeStringMap[token.value],
      isInitialised: value.length > 0,
      isLH,
      name: nameToken.value,
      loc: token.loc,
      valueType: type,
      value: value,
    };

    this.currentScope[op.name] = op;

    return op;
  };

  parseUsage = (token: token, { isLH = true } = {}): USAGE_OP => {
    if (token.type !== TOKEN_TYPE.WORD) {
      return null;
    }

    const nextToken = this.peekNextToken();
    if (
      nextToken &&
      nextToken.type === TOKEN_TYPE.SPECIAL &&
      nextToken.value === '='
    ) {
      // this is an assignment
      return null;
    }

    const variableDeclaration = this.findVariableDeclarationInScope(
      token.value,
    );
    if (!variableDeclaration) {
      return null;
    }
    if (!variableDeclaration.isInitialised) {
      return compileError(
        token,
        `Cannot use uninitialised variable "${token.value}"`,
      );
    }
    const op: USAGE_OP = {
      opType: OP_TYPES.USAGE,
      declaration: variableDeclaration,
      name: token.value,
      isLH: isLH,
      loc: token.loc,
      valueType: variableDeclaration.valueType,
    };

    return op;
  };

  parseAssignment = (token: token, { isLH = true } = {}): ASSIGNMENT_OP => {
    if (token.type !== TOKEN_TYPE.WORD) {
      return null;
    }

    const nextToken = this.peekNextToken();
    if (nextToken?.type !== TOKEN_TYPE.SPECIAL || nextToken?.value !== '=') {
      // this is an assignment
      return null;
    }
    this.takeNextToken();
    const variableDeclaration = this.findVariableDeclarationInScope(
      token.value,
    );
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

    variableDeclaration.isInitialised = true;

    const op: ASSIGNMENT_OP = {
      opType: OP_TYPES.ASSIGNMENT,
      declaration: variableDeclaration,
      isLH: isLH,
      name: token.value,
      loc: token.loc,
      valueType: assignedValue.valueType,
      value: [assignedValue],
    };

    return op;
  };

  parseIf = (token: token, { isLH = true } = {}): CONTROL_FLOW_IF_OP => {
    if (
      token.type !== TOKEN_TYPE.WORD ||
      token.value !== CONTROL_FLOW_KEYWORDS.IF
    ) {
      return null;
    }

    if (!isLH) {
      return compileError(
        token,
        `${OP_TYPES.IF} instructions cannot appear on the right side of an assignment`,
      );
    }

    if (
      token.parentBlock.blockType === BLOCK_TYPE.ROUND ||
      token.parentBlock.blockType === BLOCK_TYPE.SQUARE
    ) {
      return compileError(
        token,
        `Cannot use if/else inside ${token.parentBlock.blockType} blocks`,
      );
    }
    const conditionBlock = this.takeNextToken();
    if (
      conditionBlock.type !== TOKEN_TYPE.BLOCK ||
      conditionBlock.blockType !== BLOCK_TYPE.ROUND
    ) {
      return compileError(token, 'Missing if condition');
    }
    // PARSE CONDITION

    this.pushScope();
    const condition = this.parseBlock(conditionBlock);
    if (condition.length > 1) {
      return compileError(
        condition[1],
        'condition block cannot contain more than a condition',
      );
    }
    if (condition[0].valueType !== VALUE_TYPE.BOOL) {
      return compileError(condition[0], 'condition must return a boolean');
    }

    // PARSE IF BODY
    let ifBody: AST;
    let nextToken = this.peekNextToken();

    this.pushScope();
    if (nextToken.type === TOKEN_TYPE.BLOCK) {
      const ifBodyBlock = this.takeNextToken() as tokenBlock;
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
    this.popScope();

    // PARSE ELSE BODY
    let elseBody: AST;
    nextToken = this.peekNextToken();
    if (
      nextToken &&
      nextToken.type === TOKEN_TYPE.WORD &&
      nextToken.value === CONTROL_FLOW_KEYWORDS.ELSE
    ) {
      this.pushScope();
      this.takeNextToken();
      nextToken = this.peekNextToken();

      if (nextToken.type === TOKEN_TYPE.BLOCK) {
        const elseBodyBlock = this.takeNextToken() as tokenBlock;
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

      this.popScope();
    }

    this.popScope();
    return {
      opType: OP_TYPES.IF,
      condition,
      loc: token.loc,
      ifBody,
      elseBody,
      valueType: VALUE_TYPE.VOID,
    };
  };

  parseWhile = (token: token, { isLH = true } = {}): CONTROL_FLOW_WHILE_OP => {
    if (
      token.type !== TOKEN_TYPE.WORD ||
      token.value !== CONTROL_FLOW_KEYWORDS.WHILE
    ) {
      return null;
    }

    if (!isLH) {
      return compileError(
        token,
        `${OP_TYPES.WHILE} instructions cannot appear on the right side of an assignment`,
      );
    }

    if (
      token.parentBlock.blockType === BLOCK_TYPE.ROUND ||
      token.parentBlock.blockType === BLOCK_TYPE.SQUARE
    ) {
      return compileError(
        token,
        `Cannot use while inside ${token.parentBlock.blockType} blocks`,
      );
    }

    this.pushScope();
    const conditionBlock = this.takeNextToken();
    if (
      conditionBlock.type !== TOKEN_TYPE.BLOCK ||
      conditionBlock.blockType !== BLOCK_TYPE.ROUND
    ) {
      return compileError(token, 'Missing while condition');
    }

    const condition = this.parseBlock(conditionBlock);
    if (condition.length > 1) {
      return compileError(
        condition[1],
        'condition block cannot contain more than a condition',
      );
    }
    if (condition[0].valueType !== VALUE_TYPE.BOOL) {
      return compileError(condition[0], 'condition must return a boolean');
    }
    let body: AST;
    const nextToken = this.peekNextToken();

    if (nextToken.type === TOKEN_TYPE.BLOCK) {
      const bodyBlock = this.takeNextToken() as tokenBlock;
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
    this.popScope();
    return {
      opType: OP_TYPES.WHILE,
      condition,
      loc: token.loc,
      body,
      valueType: VALUE_TYPE.VOID,
    };
  };

  findVariableDeclarationInScope = (name: string): DECLARATION_OP => {
    return this.scopeStack.find((scope) => scope[name])?.[name];
  };
  pushScope = () => this.scopeStack.push({});
  popScope = () => this.scopeStack.pop();
}
