import { BLOCK_TYPE, TOKEN_TYPE, token, loc } from './tokenizer';
import { compileError, inspect, locToString } from './utils';
import { genericPointer, types, VALUE_FAMILY, VALUE_TYPE } from './coreTypes';
import config from './config';
export enum OP_TYPES {
  DECLARATION = 'declaration',
  ASSIGNMENT = 'assignment',
  USAGE = 'usage',
  NATIVE_FUNCTION_CALL = 'nativeFunctionCall',
  IF = 'if',
  WHILE = 'while',
  IMMEDIATE = 'immediate',
  OPEN_SCOPE = 'openScope',
  CLOSE_SCOPE = 'closeScope',
}

export enum NATIVE_OPERATORS {
  '+' = '+',
  '-' = '-',
  '%' = '%',
  '<' = '<',
  '<=' = '<=',
  '>' = '>',
  '>=' = '>=',
  '==' = '==',
  '&' = '&',
  '|' = '|',
  '<<' = '<<',
  '>>' = '>>',
}

export enum NATIVE_PRINT {
  'print' = 'print',
}

export enum NATIVE_TOOLS {
  'exit' = 'exit',
  'malloc' = 'malloc',
}

export enum NATIVE_MEMORY_WRITE {
  'writeByte' = 'writeByte',
  'writeQuad' = 'writeQuad',
}

export enum NATIVE_MEMORY_READ {
  'readByte' = 'readByte',
  'readQuad' = 'readQuad',
}

export type NATIVE_FUNCTION_TYPE =
  | keyof typeof NATIVE_OPERATORS
  | keyof typeof NATIVE_PRINT
  | keyof typeof NATIVE_TOOLS
  | keyof typeof NATIVE_MEMORY_WRITE
  | keyof typeof NATIVE_MEMORY_READ;

//   {},
//   NATIVE_ALGEBRIC,
//   NATIVE_PRINT,
//   NATIVE_TOOLS,
//   NATIVE_MEMORY_WRITE,
//   NATIVE_MEMORY_READ,
// );

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

const typesKeyword = Object.keys(types);

const reservedWords = [
  ...typesKeyword,
  ...Object.keys(DECLARATION_KEYWORDS),
  ...Object.keys(CONTROL_FLOW_KEYWORDS),
];

export type DECLARATION_OP = {
  opType: OP_TYPES.DECLARATION;
  declarationType: DECLARATION_KEYWORDS;
  isLH: boolean;
  name: string;
  token: token;
  valueType: VALUE_TYPE;
  stackPos: number;
};

export type ASSIGNMENT_OP = {
  opType: OP_TYPES.ASSIGNMENT;
  declaration: DECLARATION_OP;
  name: string;
  isLH: boolean;
  token: token;
  valueType: VALUE_TYPE;
  value: OP[];
  stackPos: number;
};

export type USAGE_OP = {
  opType: OP_TYPES.USAGE;
  declaration: DECLARATION_OP;
  isLH: boolean;
  name: string;
  token: token;
  valueType: VALUE_TYPE;
  stackPos: number;
};

export type NATIVE_FUNCTION_CALL_OP = {
  opType: OP_TYPES.NATIVE_FUNCTION_CALL;
  nativeType: NATIVE_FUNCTION_TYPE;
  isLH: boolean;
  token: token;
  parameters: OP[];
  valueType: VALUE_TYPE;
  stackPos?: number;
};

export type IMMEDIATE_OP = {
  opType: OP_TYPES.IMMEDIATE;
  isLH: boolean;
  token: token;
  valueType: VALUE_TYPE;
  value: string | number;
  stackPos?: number;
  label?: string;
};

export type CONTROL_FLOW_IF_OP = {
  opType: OP_TYPES.IF;
  token: token;
  condition: OP[];
  ifBody: AST;
  elseBody: AST;
  valueType: VALUE_TYPE;
};

export type CONTROL_FLOW_WHILE_OP = {
  opType: OP_TYPES.WHILE;
  token: token;
  condition: OP[];
  body: AST;
  valueType: VALUE_TYPE;
};

export type OPEN_SCOPE = {
  opType: OP_TYPES.OPEN_SCOPE;
  scope: scope;
};

export type CLOSE_SCOPE = {
  opType: OP_TYPES.CLOSE_SCOPE;
  scope: scope;
};

export type OP =
  | DECLARATION_OP
  | ASSIGNMENT_OP
  | USAGE_OP
  | NATIVE_FUNCTION_CALL_OP
  | IMMEDIATE_OP;
export type CONTROL_OP =
  | OPEN_SCOPE
  | CLOSE_SCOPE
  | CONTROL_FLOW_IF_OP
  | CONTROL_FLOW_WHILE_OP;

export type AST = (OP | CONTROL_OP)[];

export const generateAST = (tokens: token[]): AST => {
  const parsed = new Parser(tokens);

  if (config.debugAST) {
    inspect(parsed.ast);
  }

  return parsed.ast;
};

type scope = {
  size: number;
  vars: {
    [key: string]: DECLARATION_OP;
  };
};

export const algebricOutput = (
  name: keyof typeof NATIVE_OPERATORS,
  parameters: OP[],
): VALUE_TYPE => {
  if (parameters.length === 2) {
    if (
      parameters[0].valueType.family === VALUE_FAMILY.INTEGER &&
      parameters[1].valueType.family === VALUE_FAMILY.INTEGER
    ) {
      return parameters[0].valueType.size > parameters[1].valueType.size
        ? parameters[0].valueType
        : parameters[0].valueType;
    } else if (
      name === '+' &&
      parameters[0].valueType.family === VALUE_FAMILY.POINTER &&
      parameters[1].valueType.family === VALUE_FAMILY.INTEGER
    ) {
      return parameters[0].valueType;
    } else if (
      name === '-' &&
      parameters[0].valueType.family === VALUE_FAMILY.POINTER &&
      parameters[1].valueType.family === VALUE_FAMILY.INTEGER
    ) {
      return parameters[0].valueType;
    } else if (
      name === '-' &&
      parameters[0].valueType.family === VALUE_FAMILY.POINTER &&
      parameters[1].valueType.family === VALUE_FAMILY.POINTER
    ) {
      return types.int;
    }
  }

  return null;
};

class Parser {
  tokens: token[];
  ast: AST;

  scopeStack: scope[] = [];
  get currentScope() {
    return this.scopeStack[this.scopeStack.length - 1];
  }

  constructor(tokens: token[]) {
    this.tokens = tokens;
    this.ast = [];

    this.ast.push({
      opType: OP_TYPES.OPEN_SCOPE,
      scope: this.pushScope(),
    });

    this.parseBlock(this.ast);

    this.ast.push({
      opType: OP_TYPES.CLOSE_SCOPE,
      scope: this.popScope(),
    });
  }

  ASTerror = (token: { loc: loc }, message: string) => {
    if (config.debugAST) {
      inspect(this.ast);
    }

    return compileError(token, '[AST] ' + message);
  };

  putBackToken = (token: token) => this.tokens.unshift(token);
  takeNextToken = () => this.tokens.shift();
  peekNextToken = () => this.tokens[0];

  parseBlock = (ast: AST): void => {
    const block = this.takeNextToken();

    if (block.type !== TOKEN_TYPE.BLOCK_START) {
      return this.ASTerror(block, `Unexpected ${block.type} token`);
    }
    if (
      block.blockType !== BLOCK_TYPE.CURLY &&
      block.blockType !== BLOCK_TYPE.FILE
    ) {
      return this.ASTerror(block, `Unexpected ${block.blockType} block`);
    }

    while (
      !(
        this.tokens[0].type === TOKEN_TYPE.BLOCK_END &&
        this.tokens[0].blockType === block.blockType
      )
    ) {
      this.parseNextOpOrControl(ast);
    }

    // discard block end
    this.takeNextToken();
  };

  parseOpsBlock = (ast: AST): void => {
    const block = this.takeNextToken();

    if (block.type !== TOKEN_TYPE.BLOCK_START) {
      return this.ASTerror(block, `Unexpected ${block.type} token`);
    }
    if (block.blockType !== BLOCK_TYPE.ROUND) {
      return this.ASTerror(block, `Unexpected ${block.blockType} block`);
    }

    while (
      !(
        this.tokens[0].type === TOKEN_TYPE.BLOCK_END &&
        this.tokens[0].blockType === block.blockType
      )
    ) {
      this.parseNextOP(ast, {
        isLH: false,
      });

      if (
        block.blockType === BLOCK_TYPE.ROUND &&
        this.tokens[0].type !== TOKEN_TYPE.BLOCK_END
      ) {
        if (
          this.tokens[0].type !== TOKEN_TYPE.SPECIAL ||
          this.tokens[0].text !== SPECIAL_CHARS.COMMA
        ) {
          return this.ASTerror(this.tokens[0], 'Unexpected instruction');
        } else if (
          this.tokens[1].type === TOKEN_TYPE.BLOCK_END &&
          this.tokens[1].blockType !== block.blockType
        ) {
          return this.ASTerror(block, 'Unexpected trailing comma');
        } else {
          // discard comma
          this.takeNextToken();
        }
      }
    }

    // discard block end
    this.takeNextToken();
  };

  parseNextOpOrControl = (ast: AST) => {
    this.parseIf(ast) ||
      this.parseWhile(ast) ||
      this.parseNextOP(ast, { isLH: true });
  };

  parseNextOP = (
    ast: AST,
    { isLH = true, allowChain = true } = {},
    chain?: OP,
  ) => {
    const token = this.takeNextToken();
    let usedChain = false;

    if (!token) return false;
    if (token.type === TOKEN_TYPE.BLOCK_START) {
      return this.ASTerror(
        token,
        'A block cannot contain another unassociated block',
      );
    }

    let op: OP;
    if (token.type === TOKEN_TYPE.NUMBER) {
      op = {
        opType: OP_TYPES.IMMEDIATE,
        isLH: isLH,
        token,
        valueType: types.int,
        value: token.value,
      };
    } else if (token.type === TOKEN_TYPE.STRING) {
      op = {
        opType: OP_TYPES.IMMEDIATE,
        isLH: isLH,
        token,
        valueType: types.string,
        value: token.value,
      };
    } else if (token.type === TOKEN_TYPE.CHAR) {
      op = {
        opType: OP_TYPES.IMMEDIATE,
        isLH: isLH,
        token,
        valueType: types.char,
        value: token.value,
      };
    }

    // varibale declaration
    else if (
      token.type === TOKEN_TYPE.WORD &&
      Object.keys(declarationTypeStringMap).includes(token.text)
    ) {
      const typeToken: token = this.takeNextToken();
      let nameToken: token;
      let type: VALUE_TYPE;

      if (typeToken.type !== TOKEN_TYPE.WORD) {
        return this.ASTerror(token, `Missing variable name`);
      }

      if (typesKeyword.includes(typeToken.text)) {
        type = types[typeToken.text];

        nameToken = this.takeNextToken();

        // while (
        //   nameToken.type === TOKEN_TYPE.BLOCK_START &&
        //   nameToken.blockType === BLOCK_TYPE.SQUARE
        // ) {
        //   this.parseBlock(nameToken);
        //   nameToken = this.takeNextToken();
        // }
        // type
      } else {
        nameToken = typeToken;
      }

      if (nameToken.type !== TOKEN_TYPE.WORD) {
        return this.ASTerror(token, `Missing variable name`);
      }

      if (reservedWords.includes(nameToken.text)) {
        return this.ASTerror(
          nameToken,
          `Variable "${nameToken.text}" must not be a reserved word`,
        );
      }

      const existing = this.findVariableDeclarationInScope(nameToken.text);

      if (existing) {
        return this.ASTerror(
          nameToken,
          `Variable name "${
            nameToken.text
          }" has already been defined at ${locToString(existing.token.loc)}`,
        );
      }

      const assignmentToken = this.peekNextToken();

      if (
        assignmentToken?.type === TOKEN_TYPE.SPECIAL &&
        assignmentToken?.text === '<-'
      ) {
        // pushing back the name so it can be parsed for an assignment
        this.putBackToken(nameToken);
      } else {
        if (!type) {
          return this.ASTerror(
            token,
            `Implicitly typed variable "${nameToken.text}" must be assigned using '<-'`,
          );
        }
      }

      op = {
        opType: OP_TYPES.DECLARATION,
        declarationType: declarationTypeStringMap[token.text],
        isLH,
        name: nameToken.text,
        token,
        valueType: type,
        stackPos: this.currentScope.size - 1,
      };

      this.currentScope.vars[op.name] = op;
      if (type) {
        op.stackPos += type.size;
        this.currentScope.size += type.size;
      }
    }

    // variables usage or assignment
    else if (
      token.type === TOKEN_TYPE.WORD &&
      this.findVariableDeclarationInScope(token.text)
    ) {
      const variableDeclaration = this.findVariableDeclarationInScope(
        token.text,
      );

      const nextToken = this.peekNextToken();
      if (
        nextToken &&
        nextToken.type === TOKEN_TYPE.SPECIAL &&
        nextToken.text === '<-'
      ) {
        // this is an assignment

        this.takeNextToken();

        const assignedValue: OP[] = [];

        this.parseNextOP(assignedValue, {
          isLH: false,
        });

        if (assignedValue.length > 1) {
          return this.ASTerror(
            assignedValue[1].token,
            'Unexpected instruction',
          );
        }

        if (!variableDeclaration.valueType) {
          variableDeclaration.stackPos += assignedValue[0].valueType.size;
          this.currentScope.size += assignedValue[0].valueType.size;
          variableDeclaration.valueType = assignedValue[0].valueType;
        }

        if (
          assignedValue[0].valueType.family !==
          variableDeclaration.valueType.family
        ) {
          return this.ASTerror(
            assignedValue[0].token,
            `Cannot assign value of type "${assignedValue[0].valueType.name}" to variable of type "${variableDeclaration.valueType.name}"`,
          );
        }

        assignedValue[0].valueType = variableDeclaration.valueType;

        op = {
          opType: OP_TYPES.ASSIGNMENT,
          declaration: variableDeclaration,
          isLH: isLH,
          name: token.text,
          token,
          valueType: variableDeclaration.valueType,
          value: assignedValue,
          stackPos: variableDeclaration.stackPos,
        };
      } else {
        // this is usage

        op = {
          opType: OP_TYPES.USAGE,
          declaration: variableDeclaration,
          name: token.text,
          isLH: isLH,
          token,
          valueType: variableDeclaration.valueType,
          stackPos: variableDeclaration.stackPos,
        };
      }
    }
    // native methods
    else if (token.type === TOKEN_TYPE.WORD && NATIVE_OPERATORS[token.text]) {
      const parametersBlock = this.peekNextToken();

      const parameters: OP[] = [];
      if (
        parametersBlock.type === TOKEN_TYPE.BLOCK_START &&
        parametersBlock.blockType === BLOCK_TYPE.ROUND
      ) {
        this.parseOpsBlock(parameters);
      } else {
        this.parseNextOP(parameters, { isLH: false, allowChain: false });
      }

      // } else {
      //   return this.ASTerror(token, 'Missing parameters');
      // }

      if (chain) {
        parameters.unshift(chain);
        usedChain = true;
      }
      const outputType = algebricOutput(
        token.text as keyof typeof NATIVE_OPERATORS,
        parameters,
      );
      if (!outputType) {
        return this.ASTerror(
          token,
          `Could not find function matching "${token.text} (${parameters.map(
            (p) => p.valueType.name,
          )})"`,
        );
      }

      op = {
        opType: OP_TYPES.NATIVE_FUNCTION_CALL,
        nativeType: NATIVE_OPERATORS[token.text],
        isLH: isLH,
        token,
        parameters: parameters,
        valueType: outputType,
      };
    } else if (token.type === TOKEN_TYPE.WORD && token.text === 'exit') {
      const parametersBlock = this.peekNextToken();
      if (
        parametersBlock.type !== TOKEN_TYPE.BLOCK_START ||
        parametersBlock.blockType !== BLOCK_TYPE.ROUND
      ) {
        return this.ASTerror(token, 'Missing parameters');
      }

      const parameters: OP[] = [];
      this.parseOpsBlock(parameters);
      if (chain) {
        parameters.unshift(chain);
        usedChain = true;
      }
      if (
        parameters.length !== 1 ||
        parameters[0].valueType.family !== VALUE_FAMILY.INTEGER
      ) {
        return this.ASTerror(
          token,
          `Could not find function matching "${token.text} (${parameters.map(
            (p) => p.valueType.name,
          )})"`,
        );
      }

      op = {
        opType: OP_TYPES.NATIVE_FUNCTION_CALL,
        nativeType: NATIVE_TOOLS[token.text],
        isLH: isLH,
        token,
        parameters: parameters,
        valueType: types.void,
      };
    } else if (token.type === TOKEN_TYPE.WORD && token.text === 'malloc') {
      const parametersBlock = this.peekNextToken();
      if (
        parametersBlock.type !== TOKEN_TYPE.BLOCK_START ||
        parametersBlock.blockType !== BLOCK_TYPE.ROUND
      ) {
        return this.ASTerror(token, 'Missing parameters');
      }

      const parameters: OP[] = [];
      this.parseOpsBlock(parameters);
      if (chain) {
        parameters.unshift(chain);
        usedChain = true;
      }
      if (
        parameters.length !== 1 ||
        parameters[0].valueType.family !== VALUE_FAMILY.INTEGER
      ) {
        return this.ASTerror(
          token,
          `Could not find function matching "${token.text} (${parameters.map(
            (p) => p.valueType.name,
          )})"`,
        );
      }

      op = {
        opType: OP_TYPES.NATIVE_FUNCTION_CALL,
        nativeType: NATIVE_TOOLS[token.text],
        isLH: isLH,
        token,
        parameters: parameters,
        valueType: { ...genericPointer },
      };
    } else if (
      token.type === TOKEN_TYPE.WORD &&
      NATIVE_MEMORY_WRITE[token.text]
    ) {
      const parametersBlock = this.peekNextToken();
      if (
        parametersBlock.type !== TOKEN_TYPE.BLOCK_START ||
        parametersBlock.blockType !== BLOCK_TYPE.ROUND
      ) {
        return this.ASTerror(token, 'Missing parameters');
      }

      const parameters: OP[] = [];
      this.parseOpsBlock(parameters);
      if (chain) {
        parameters.unshift(chain);
        usedChain = true;
      }
      if (
        parameters.length !== 2 ||
        parameters[0].valueType.family !== VALUE_FAMILY.POINTER ||
        (parameters[1].valueType.family !== VALUE_FAMILY.INTEGER &&
          parameters[1].valueType.family !== VALUE_FAMILY.POINTER)
      ) {
        return this.ASTerror(
          token,
          `Could not find function matching "${token.text} (${parameters.map(
            (p) => p.valueType.name,
          )})"`,
        );
      }

      op = {
        opType: OP_TYPES.NATIVE_FUNCTION_CALL,
        nativeType: NATIVE_MEMORY_WRITE[token.text],
        isLH: isLH,
        token,
        parameters: parameters,
        valueType: types.void,
      };
    } else if (
      token.type === TOKEN_TYPE.WORD &&
      NATIVE_MEMORY_READ[token.text]
    ) {
      const parametersBlock = this.peekNextToken();
      if (
        parametersBlock.type !== TOKEN_TYPE.BLOCK_START ||
        parametersBlock.blockType !== BLOCK_TYPE.ROUND
      ) {
        return this.ASTerror(token, 'Missing parameters');
      }

      const parameters: OP[] = [];
      this.parseOpsBlock(parameters);
      if (chain) {
        parameters.unshift(chain);
        usedChain = true;
      }
      if (
        parameters.length !== 1 ||
        parameters[0].valueType.family !== VALUE_FAMILY.POINTER
      ) {
        return this.ASTerror(
          token,
          `Could not find function matching "${token.text} (${parameters.map(
            (p) => p.valueType.name,
          )})"`,
        );
      }

      const outputType: Record<NATIVE_MEMORY_READ, VALUE_TYPE> = {
        readByte: types.char,
        readQuad: types.int,
      };

      op = {
        opType: OP_TYPES.NATIVE_FUNCTION_CALL,
        nativeType: NATIVE_MEMORY_READ[token.text],
        isLH: isLH,
        token,
        parameters: parameters,
        valueType: outputType[token.text],
      };
    } else if (token.type === TOKEN_TYPE.WORD && token.text === 'print') {
      const parametersBlock = this.peekNextToken();
      if (
        parametersBlock.type !== TOKEN_TYPE.BLOCK_START ||
        parametersBlock.blockType !== BLOCK_TYPE.ROUND
      ) {
        return this.ASTerror(token, 'Missing parameters');
      }

      const parameters: OP[] = [];
      this.parseOpsBlock(parameters);
      if (chain) {
        parameters.unshift(chain);
        usedChain = true;
      }

      if (
        parameters.length > 1 ||
        (parameters[0].valueType.family !== VALUE_FAMILY.INTEGER &&
          parameters[0].valueType.family !== VALUE_FAMILY.POINTER &&
          parameters[0].valueType !== types.string)
      ) {
        return this.ASTerror(
          token,
          `Could not find function matching "${token.text} (${parameters.map(
            (p) => p.valueType.name,
          )})"`,
        );
      }

      op = {
        opType: OP_TYPES.NATIVE_FUNCTION_CALL,
        nativeType: NATIVE_PRINT[token.text],
        isLH: isLH,
        token,
        parameters: parameters,
        valueType: types.void,
      };
    } else if (token.type === TOKEN_TYPE.WORD && types[token.text]) {
      const parametersBlock = this.peekNextToken();
      if (
        parametersBlock.type !== TOKEN_TYPE.BLOCK_START ||
        parametersBlock.blockType !== BLOCK_TYPE.ROUND
      ) {
        return this.ASTerror(token, 'Missing parameters');
      }

      const items: OP[] = [];
      this.parseOpsBlock(items);

      if (items.length > 1) {
        return this.ASTerror(items[1].token, 'Too many parameters');
      }
      if (items.length < 1) {
        return this.ASTerror(token, 'Not enough parameters');
      }

      op = items[0];

      op.valueType = types[token.text];
      op.isLH = isLH;
    } else {
      return this.ASTerror(token, `Could not parse token ${token.text}`);
    }

    if (chain && !usedChain) {
      return this.ASTerror(op.token, `Could not chain ${op.token.text}`);
    }

    const nextToken = this.peekNextToken();
    if (
      allowChain &&
      nextToken &&
      nextToken.type === TOKEN_TYPE.SPECIAL &&
      nextToken.text === '->'
    ) {
      this.takeNextToken();
      op.isLH = false;
      this.parseNextOP(ast, { isLH }, op);
    } else if (
      allowChain &&
      nextToken &&
      nextToken.type === TOKEN_TYPE.WORD &&
      NATIVE_OPERATORS[nextToken.text]
    ) {
      op.isLH = false;
      this.parseNextOP(ast, { isLH }, op);
    } else {
      ast.push(op);
    }

    return true;
  };

  // parseCast = (token: token, { isLH = true } = {}): OP => {
  //
  // };

  parseIf = (ast: AST): boolean => {
    const token = this.takeNextToken();

    if (
      token.type !== TOKEN_TYPE.WORD ||
      token.text !== CONTROL_FLOW_KEYWORDS.IF
    ) {
      this.putBackToken(token);
      return false;
    }

    const conditionBlock = this.peekNextToken();
    if (
      conditionBlock.type !== TOKEN_TYPE.BLOCK_START ||
      conditionBlock.blockType !== BLOCK_TYPE.ROUND
    ) {
      return this.ASTerror(token, 'Missing if condition');
    }
    // PARSE CONDITION

    const condition: OP[] = [];
    this.parseOpsBlock(condition);
    if (condition.length > 1) {
      return this.ASTerror(
        condition[1].token,
        'condition block cannot contain more than a condition',
      );
    }
    if (condition[0].valueType.family !== VALUE_FAMILY.INTEGER) {
      return this.ASTerror(
        condition[0].token,
        'condition must return a boolean (or compatible type)',
      );
    }

    // PARSE IF BODY
    const ifBody: AST = [];
    let nextToken = this.peekNextToken();

    if (nextToken.type === TOKEN_TYPE.BLOCK_START) {
      this.parseBlock(ifBody);
    } else {
      this.parseNextOpOrControl(ifBody);
    }

    // PARSE ELSE BODY
    const elseBody: AST = [];
    nextToken = this.peekNextToken();
    if (
      nextToken &&
      nextToken.type === TOKEN_TYPE.WORD &&
      nextToken.text === CONTROL_FLOW_KEYWORDS.ELSE
    ) {
      this.takeNextToken();
      nextToken = this.peekNextToken();

      if (nextToken.type === TOKEN_TYPE.BLOCK_START) {
        this.parseBlock(elseBody);
      } else {
        this.parseNextOpOrControl(elseBody);
      }
    }

    ast.push({
      opType: OP_TYPES.IF,
      condition,
      token,
      ifBody,
      elseBody,
      valueType: types.void,
    });

    return true;
  };

  parseWhile = (ast: AST): boolean => {
    const token = this.takeNextToken();
    if (
      token.type !== TOKEN_TYPE.WORD ||
      token.text !== CONTROL_FLOW_KEYWORDS.WHILE
    ) {
      this.putBackToken(token);
      return null;
    }

    const conditionBlock = this.peekNextToken();
    if (
      conditionBlock.type !== TOKEN_TYPE.BLOCK_START ||
      conditionBlock.blockType !== BLOCK_TYPE.ROUND
    ) {
      return this.ASTerror(token, 'Missing while condition');
    }

    const condition: OP[] = [];
    this.parseOpsBlock(condition);
    if (condition.length > 1) {
      return this.ASTerror(
        condition[1].token,
        'condition block cannot contain more than a condition',
      );
    }
    if (condition[0].valueType.family !== VALUE_FAMILY.INTEGER) {
      return this.ASTerror(
        condition[0].token,
        'condition must return a boolean',
      );
    }
    const body: AST = [];
    const nextToken = this.peekNextToken();

    if (nextToken.type === TOKEN_TYPE.BLOCK_START) {
      this.parseBlock(body);
    } else {
      this.parseNextOpOrControl(body);
    }

    ast.push({
      opType: OP_TYPES.WHILE,
      condition,
      token,
      body,
      valueType: types.void,
    });

    return true;
  };

  findVariableDeclarationInScope = (name: string): DECLARATION_OP => {
    return this.scopeStack.find((scope) => scope.vars[name])?.vars[name];
  };
  pushScope = (): scope => {
    const newScope: scope = { size: 0, vars: {} };
    this.scopeStack.push(newScope);

    return newScope;
  };
  popScope = (): scope => this.scopeStack.pop();
}
