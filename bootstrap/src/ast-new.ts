import { TOKEN, TOKEN_TYPE } from './tokenizer-new';
import { PUNCTUATION, KEYWORD, BINARY_OPERATOR } from './tokens';
import { compileError } from './utils';

// TODO: keep track of undefined identifiers and check if they are functions defined later in the code (hoisting)
export enum IDENTIFIER_TYPE {
  FUNCTION = 'function',
  PARAMETER = 'parameter',
  VARIABLE = 'variable',
}

export enum EXPRESSION_TYPE {
  NOP = 'nop',
  STRING = 'string',
  NUMBER = 'number',
  IDENTIFIER = 'identifier',
  ADD = 'add',
  MUL = 'mul',
  DIV = 'div',
  MOD = 'mod',
  NEG = 'neg',
  EQ = 'eq',
  LT = 'lt',
  LE = 'le',
  GT = 'gt', // we might be able to remove this and sintethize (a > b) as (-a < -b)
  GE = 'ge',
  OR = 'or',
  AND = 'and',
  LOOP = 'loop',
  BOR = 'bitwiseOr',
  BXOR = 'bitwiseXor',
  BAND = 'bitwiseAnd',
  LSHIFT = 'leftShift',
  RSHIFT = 'rightShift',
  ADDRESSOF = 'addressOf',
  DEREFERENCE = 'dereference',
  FUNCTION_CALL = 'functionCall',
  COPY = 'copy',
  COMMA = 'comma',
  RETURN = 'return',
}

export type IDENTIFIER = {
  type: IDENTIFIER_TYPE;
  index: number;
  name: string;
  token: TOKEN;
};

type OP_EXPRESSION_TYPE = Exclude<
  EXPRESSION_TYPE,
  EXPRESSION_TYPE.IDENTIFIER | EXPRESSION_TYPE.STRING | EXPRESSION_TYPE.NUMBER
>;

type IDENTIFIER_EXPRESSION = {
  type: EXPRESSION_TYPE.IDENTIFIER;
  value: IDENTIFIER;
  params: EXPRESSION[];
};
type STRING_EXPRESSION = {
  type: EXPRESSION_TYPE.STRING;
  value: string;
  params: EXPRESSION[];
};
type NUMBER_EXPRESSION = {
  type: EXPRESSION_TYPE.NUMBER;
  value: number;
  params: EXPRESSION[];
};

export type VALUE_EXPRESSION =
  | IDENTIFIER_EXPRESSION
  | NUMBER_EXPRESSION
  | STRING_EXPRESSION;

export type OP_EXPRESSION = {
  type: OP_EXPRESSION_TYPE;
  params: EXPRESSION[];
  // For loops the first item is the condition and the rest are the code
  // For fcall, the first parameter is the variable to use as function
};
export type EXPRESSION = OP_EXPRESSION | VALUE_EXPRESSION;

export type FUNCTION = {
  name: string;
  token: TOKEN;
  code: EXPRESSION;
  varsCount: number;
  paramsCount: number;
  isPure: boolean;
  isPureDetermined: boolean;
};

export type CONTEXT = {
  tokens: TOKEN[];
  functions: FUNCTION[];
  scopes: Record<string, IDENTIFIER>[];
  tmp_count: number;
};

const takeToken = (context: CONTEXT) => context.tokens.shift();
const peekToken = (context: CONTEXT) => context.tokens[0];
const takeTokenAssert = (
  context,
  expectedType: TOKEN_TYPE,
  expectedText = '',
): TOKEN => {
  const stack = new Error().stack.split('\n')[2].trim();
  const token = takeToken(context);
  if (token.type !== expectedType) {
    return compileError(
      token,
      `Expected "${expectedText}" [${expectedType}] token but found "${token.text}" [${token.type}] instead - ` +
        stack,
    );
  }
  if (expectedText && token.text !== expectedText) {
    return compileError(
      token,
      `Expected "${expectedText}" [${expectedType}] token but found "${token.text}" [${token.type}] instead - ` +
        stack,
    );
  }
  return token;
};
const takeTokenIf = (
  context,
  expectedType: TOKEN_TYPE,
  expectedText?: string,
): TOKEN => {
  const token = peekToken(context);
  if (token.type !== expectedType) {
    return null;
  }
  if (expectedText && token.text !== expectedText) {
    return null;
  }

  return takeToken(context);
};

export const makeNumberExp = (value: number): NUMBER_EXPRESSION => ({
  type: EXPRESSION_TYPE.NUMBER,
  value,
  params: [],
});
export const makeStringExp = (value: string): STRING_EXPRESSION => ({
  type: EXPRESSION_TYPE.STRING,
  value,
  params: [],
});
export const makeIdentifierExp = (
  value: IDENTIFIER,
): IDENTIFIER_EXPRESSION => ({
  type: EXPRESSION_TYPE.IDENTIFIER,
  value,
  params: [],
});
export const makeOpExp = (
  type: OP_EXPRESSION_TYPE,
  ...params: EXPRESSION[]
): OP_EXPRESSION => ({
  type,
  params,
});

const defineInScope = (
  context: CONTEXT,
  type: IDENTIFIER_TYPE,
  name: string,
  token: TOKEN,
) => {
  const topFunction = context.functions.at(-1);
  const topContext = context.scopes.at(-1);
  let index;
  switch (type) {
    case IDENTIFIER_TYPE.FUNCTION:
      index = context.functions.length;
      break;
    case IDENTIFIER_TYPE.VARIABLE:
      index = topFunction.varsCount++;
      break;
    case IDENTIFIER_TYPE.PARAMETER:
      index = topFunction.paramsCount++;
      break;
  }

  const identifier = {
    type,
    name,
    index,
    token,
  };

  if (topContext[name]) {
    return compileError(token, 'identifier already defined');
  }
  topContext[name] = identifier;

  return identifier;
};
const findInScope = (context: CONTEXT, name: string, token: TOKEN) => {
  for (let i = context.scopes.length - 1; i >= 0; --i) {
    const scope = context.scopes[i];
    if (scope[name]) return scope[name];
  }

  return compileError(token, 'Undefined identifier');
};

const initialScope: Record<string, IDENTIFIER> = {
  print: {
    type: IDENTIFIER_TYPE.FUNCTION,
    index: -1,
    token: null,
    name: 'print',
  },
  malloc: {
    type: IDENTIFIER_TYPE.FUNCTION,
    index: -1,
    token: null,
    name: 'malloc',
  },
  writeByte: {
    type: IDENTIFIER_TYPE.FUNCTION,
    index: -1,
    token: null,
    name: 'writeByte',
  },
  readByte: {
    type: IDENTIFIER_TYPE.FUNCTION,
    index: -1,
    token: null,
    name: 'readByte',
  },
};

export const generateAST = (tokens: TOKEN[]) => {
  // use Recursive Descent Parsing approach
  const context: CONTEXT = {
    tokens,
    scopes: [initialScope, {}],
    tmp_count: 0,
    functions: [],
  };

  while (tokens.length) {
    parseFunction(context);
  }

  return context;
};

const parseFunction = (context: CONTEXT) => {
  const startToken = takeTokenAssert(
    context,
    TOKEN_TYPE.KEYWORD,
    KEYWORD.FUNCTION,
  );
  const nameToken = takeTokenAssert(context, TOKEN_TYPE.IDENTIFIER);
  defineInScope(context, IDENTIFIER_TYPE.FUNCTION, nameToken.text, startToken);
  context.scopes.push({});
  const func: FUNCTION = {
    name: nameToken.text,
    token: startToken,
    code: null,
    isPure: false,
    isPureDetermined: false,
    varsCount: 0,
    paramsCount: 0,
  };
  context.functions.push(func);
  takeTokenAssert(context, TOKEN_TYPE.SYMBOL, PUNCTUATION.PARENS_START);
  while (!takeTokenIf(context, TOKEN_TYPE.SYMBOL, PUNCTUATION.PARENS_END)) {
    const param = takeTokenAssert(context, TOKEN_TYPE.IDENTIFIER);
    defineInScope(context, IDENTIFIER_TYPE.PARAMETER, param.text, param);
    takeTokenIf(context, TOKEN_TYPE.SYMBOL, PUNCTUATION.PARENS_END) ||
      takeTokenAssert(context, TOKEN_TYPE.SYMBOL, BINARY_OPERATOR.COMMA);
  }
  func.code = makeOpExp(
    EXPRESSION_TYPE.COMMA,
    parseStatement(context),
    makeOpExp(EXPRESSION_TYPE.RETURN),
  );
  context.scopes.pop();
};

const parseStatement = (context: CONTEXT): EXPRESSION => {
  if (takeTokenIf(context, TOKEN_TYPE.SYMBOL, PUNCTUATION.COMPOUND_START)) {
    const exp: EXPRESSION = {
      type: EXPRESSION_TYPE.COMMA,
      params: [],
    };
    while (!takeTokenIf(context, TOKEN_TYPE.SYMBOL, PUNCTUATION.COMPOUND_END)) {
      exp.params.push(parseStatement(context));
    }

    return exp;
  }

  if (takeTokenIf(context, TOKEN_TYPE.KEYWORD, KEYWORD.IF)) {
    takeTokenAssert(context, TOKEN_TYPE.SYMBOL, PUNCTUATION.PARENS_START);
    const condition = parseExprs(context);
    takeTokenAssert(context, TOKEN_TYPE.SYMBOL, PUNCTUATION.PARENS_END);
    const ifBody = parseStatement(context);

    if (takeTokenIf(context, TOKEN_TYPE.KEYWORD, KEYWORD.ELSE)) {
      const elseBody = parseStatement(context);

      // synthesize "if(cond) a else b" as "(cond && (a, 1)) || b"
      return makeOpExp(
        EXPRESSION_TYPE.OR,
        makeOpExp(
          EXPRESSION_TYPE.AND,
          condition,
          makeOpExp(EXPRESSION_TYPE.COMMA, ifBody, makeNumberExp(1)),
        ),
        elseBody,
      );
    } else {
      // synthesize "if(cond) a" as "cond && a"
      return makeOpExp(EXPRESSION_TYPE.AND, condition, ifBody);
    }
  }

  if (takeTokenIf(context, TOKEN_TYPE.KEYWORD, KEYWORD.WHILE)) {
    takeTokenAssert(context, TOKEN_TYPE.SYMBOL, PUNCTUATION.PARENS_START);
    const condition = parseExprs(context);
    takeTokenAssert(context, TOKEN_TYPE.SYMBOL, PUNCTUATION.PARENS_END);
    const whileBody = parseStatement(context);

    // synthesize "if(cond) a" as "cond && a"
    return makeOpExp(EXPRESSION_TYPE.LOOP, condition, whileBody);
  }

  if (takeTokenIf(context, TOKEN_TYPE.KEYWORD, KEYWORD.RETURN)) {
    takeTokenAssert(context, TOKEN_TYPE.SYMBOL, PUNCTUATION.PARENS_START);
    const returnExpr = parseExprs(context);
    takeTokenAssert(context, TOKEN_TYPE.SYMBOL, PUNCTUATION.PARENS_END);

    return {
      type: EXPRESSION_TYPE.RETURN,
      params: [returnExpr],
    };
  }

  if (takeTokenIf(context, TOKEN_TYPE.SYMBOL, PUNCTUATION.SEMI)) {
    return {
      type: EXPRESSION_TYPE.NOP,
      params: [],
    };
  }

  const exp = parseExprs(context);

  takeTokenAssert(context, TOKEN_TYPE.SYMBOL, PUNCTUATION.SEMI);

  return exp;
};

const parseExprs = (context: CONTEXT): EXPRESSION => {
  if (
    takeTokenIf(context, TOKEN_TYPE.KEYWORD, KEYWORD.VAR) ||
    takeTokenIf(context, TOKEN_TYPE.KEYWORD, KEYWORD.CONST)
  ) {
    const commaExp: EXPRESSION = {
      type: EXPRESSION_TYPE.COMMA,
      params: [],
    };

    let more = false;
    do {
      const nameToken = takeTokenAssert(context, TOKEN_TYPE.IDENTIFIER);

      const identifierExp = makeIdentifierExp(
        defineInScope(
          context,
          IDENTIFIER_TYPE.VARIABLE,
          nameToken.text,
          nameToken,
        ),
      );
      if (takeTokenIf(context, TOKEN_TYPE.SYMBOL, BINARY_OPERATOR.ASSIGN)) {
        commaExp.params.push(
          makeOpExp(
            EXPRESSION_TYPE.COPY,
            identifierExp,
            parseExpression(context),
          ),
        );
      } else {
        commaExp.params.push(
          makeOpExp(EXPRESSION_TYPE.COPY, identifierExp, makeNumberExp(0)),
        );
      }

      if (takeTokenIf(context, TOKEN_TYPE.SYMBOL, BINARY_OPERATOR.COMMA)) {
        more = true;
      }
    } while (more);

    return commaExp;
  }

  const commaExp: EXPRESSION = {
    type: EXPRESSION_TYPE.COMMA,
    params: [],
  };
  do {
    commaExp.params.push(parseExpression(context));
  } while (takeTokenIf(context, TOKEN_TYPE.SYMBOL, BINARY_OPERATOR.COMMA));

  return commaExp;
};

const parseExpression = (context: CONTEXT): EXPRESSION => {
  // we recursively call expression parsing methods starting from the least priority one
  // if an operator is left associative we call the next priority parser for both the left and right term
  // if an operator is right associative we call the the same priority parser for it's right term instead.
  return parseAssignment(context);
};

const parseAssignment = (context: CONTEXT): EXPRESSION => {
  // right associative
  let expr = parseOr(context);

  while (takeTokenIf(context, TOKEN_TYPE.SYMBOL, BINARY_OPERATOR.ASSIGN)) {
    expr = makeOpExp(EXPRESSION_TYPE.COPY, expr, parseAssignment(context));
  }

  return expr;
};

const parseOr = (context: CONTEXT): EXPRESSION => {
  let expr = parseAnd(context);

  while (takeTokenIf(context, TOKEN_TYPE.SYMBOL, BINARY_OPERATOR.OR)) {
    expr = makeOpExp(EXPRESSION_TYPE.OR, expr, parseAnd(context));
  }

  return expr;
};

const parseAnd = (context: CONTEXT): EXPRESSION => {
  let expr = parseBitwiseOr(context);

  while (takeTokenIf(context, TOKEN_TYPE.SYMBOL, BINARY_OPERATOR.AND)) {
    expr = makeOpExp(EXPRESSION_TYPE.AND, expr, parseBitwiseOr(context));
  }

  return expr;
};

const parseBitwiseOr = (context: CONTEXT): EXPRESSION => {
  let expr = parseBitwiseXor(context);

  while (takeTokenIf(context, TOKEN_TYPE.SYMBOL, BINARY_OPERATOR.BOR)) {
    expr = makeOpExp(EXPRESSION_TYPE.BOR, expr, parseBitwiseXor(context));
  }

  return expr;
};

const parseBitwiseXor = (context: CONTEXT): EXPRESSION => {
  let expr = parseBitwiseAnd(context);

  while (takeTokenIf(context, TOKEN_TYPE.SYMBOL, BINARY_OPERATOR.BXOR)) {
    expr = makeOpExp(EXPRESSION_TYPE.BXOR, expr, parseBitwiseAnd(context));
  }

  return expr;
};

const parseBitwiseAnd = (context: CONTEXT): EXPRESSION => {
  let expr = parseEq(context);

  while (takeTokenIf(context, TOKEN_TYPE.SYMBOL, BINARY_OPERATOR.BAND)) {
    expr = makeOpExp(EXPRESSION_TYPE.BAND, expr, parseEq(context));
  }

  return expr;
};

const parseEq = (context: CONTEXT): EXPRESSION => {
  const expr = parseComparison(context);
  let operationToken: TOKEN;
  while (
    (operationToken =
      takeTokenIf(context, TOKEN_TYPE.SYMBOL, BINARY_OPERATOR.EQ) ||
      takeTokenIf(context, TOKEN_TYPE.SYMBOL, BINARY_OPERATOR.NEQ))
  ) {
    const other = parseComparison(context);

    if (operationToken.text === BINARY_OPERATOR.EQ) {
      return makeOpExp(EXPRESSION_TYPE.EQ, expr, other);
    } else {
      // synthesize "a != b" as "(a==b) == 0"
      return makeOpExp(
        EXPRESSION_TYPE.EQ,
        makeOpExp(EXPRESSION_TYPE.EQ, expr, other),
        makeNumberExp(0),
      );
    }
  }
  return expr;
};

const parseComparison = (context: CONTEXT): EXPRESSION => {
  let expr = parseShift(context);
  let operationToken: TOKEN;
  while (
    (operationToken =
      takeTokenIf(context, TOKEN_TYPE.SYMBOL, BINARY_OPERATOR.GT) ||
      takeTokenIf(context, TOKEN_TYPE.SYMBOL, BINARY_OPERATOR.GE) ||
      takeTokenIf(context, TOKEN_TYPE.SYMBOL, BINARY_OPERATOR.LT) ||
      takeTokenIf(context, TOKEN_TYPE.SYMBOL, BINARY_OPERATOR.LE))
  ) {
    const type = {
      [BINARY_OPERATOR.GT]: EXPRESSION_TYPE.GT,
      [BINARY_OPERATOR.GE]: EXPRESSION_TYPE.GE,
      [BINARY_OPERATOR.LT]: EXPRESSION_TYPE.LT,
      [BINARY_OPERATOR.LE]: EXPRESSION_TYPE.LE,
    }[operationToken.text] as OP_EXPRESSION_TYPE;
    expr = makeOpExp(type, expr, parseShift(context));
  }
  return expr;
};

const parseShift = (context: CONTEXT): EXPRESSION => {
  const expr = parseSum(context);
  let operationToken: TOKEN;
  while (
    (operationToken =
      takeTokenIf(context, TOKEN_TYPE.SYMBOL, BINARY_OPERATOR.LSHIFT) ||
      takeTokenIf(context, TOKEN_TYPE.SYMBOL, BINARY_OPERATOR.RSHIFT))
  ) {
    const type = {
      [BINARY_OPERATOR.LSHIFT]: EXPRESSION_TYPE.LSHIFT,
      [BINARY_OPERATOR.RSHIFT]: EXPRESSION_TYPE.RSHIFT,
    }[operationToken.text] as OP_EXPRESSION_TYPE;
    return makeOpExp(type, expr, parseShift(context));
  }
  return expr;
};

const parseSum = (context: CONTEXT): EXPRESSION => {
  let expr = parseFactor(context);

  let operationToken: TOKEN;
  while (
    (operationToken =
      takeTokenIf(context, TOKEN_TYPE.SYMBOL, BINARY_OPERATOR.ADD) ||
      takeTokenIf(context, TOKEN_TYPE.SYMBOL, BINARY_OPERATOR.SUB))
  ) {
    expr = makeOpExp(EXPRESSION_TYPE.ADD, expr);

    const other = parseFactor(context);

    if (operationToken.text === BINARY_OPERATOR.SUB) {
      // convert "a - b" to "a + (-b)" . will optimise later if needed
      expr.params.push(makeOpExp(EXPRESSION_TYPE.NEG, other));
    } else {
      expr.params.push(other);
    }
  }
  return expr;
};

const parseFactor = (context: CONTEXT): EXPRESSION => {
  let expr = parseUnary(context);
  let operationToken: TOKEN;
  while (
    (operationToken =
      takeTokenIf(context, TOKEN_TYPE.SYMBOL, BINARY_OPERATOR.MUL) ||
      takeTokenIf(context, TOKEN_TYPE.SYMBOL, BINARY_OPERATOR.DIV) ||
      takeTokenIf(context, TOKEN_TYPE.SYMBOL, BINARY_OPERATOR.MOD))
  ) {
    const type = {
      [BINARY_OPERATOR.MUL]: EXPRESSION_TYPE.MUL,
      [BINARY_OPERATOR.DIV]: EXPRESSION_TYPE.DIV,
      [BINARY_OPERATOR.MOD]: EXPRESSION_TYPE.MOD,
    }[operationToken.text] as OP_EXPRESSION_TYPE;

    expr = makeOpExp(type, expr, parseUnary(context));
  }
  return expr;
};
// TODO: add unary operators
const parseUnary = (context: CONTEXT): EXPRESSION => {
  return parseFunctionCall(context);
};

const parseFunctionCall = (context: CONTEXT): EXPRESSION => {
  let expr = parseBrackets(context);
  while (takeTokenIf(context, TOKEN_TYPE.SYMBOL, PUNCTUATION.PARENS_START)) {
    expr = makeOpExp(EXPRESSION_TYPE.FUNCTION_CALL, expr);

    while (!takeTokenIf(context, TOKEN_TYPE.SYMBOL, PUNCTUATION.PARENS_END)) {
      expr.params.push(parseExpression(context));

      takeTokenIf(context, TOKEN_TYPE.SYMBOL, BINARY_OPERATOR.COMMA);
    }
  }

  return expr;
};

const parseBrackets = (context: CONTEXT): EXPRESSION => {
  let expr = parseParens(context);
  while (
    takeTokenIf(context, TOKEN_TYPE.SYMBOL, PUNCTUATION.SUBSCRIPTING_START)
  ) {
    const inner = parseExprs(context);
    expr = makeOpExp(
      EXPRESSION_TYPE.DEREFERENCE,
      makeOpExp(EXPRESSION_TYPE.ADD, expr, inner),
    );

    takeTokenAssert(context, TOKEN_TYPE.SYMBOL, PUNCTUATION.SUBSCRIPTING_END);
  }
  return expr;
};

const parseParens = (context: CONTEXT): EXPRESSION => {
  if (takeTokenIf(context, TOKEN_TYPE.SYMBOL, PUNCTUATION.PARENS_START)) {
    const expr = parseExprs(context);

    takeTokenAssert(context, TOKEN_TYPE.SYMBOL, PUNCTUATION.PARENS_END);

    return expr;
  }
  return parseImmediate(context);
};

const parseImmediate = (context: CONTEXT): EXPRESSION => {
  const token = takeToken(context);

  if (token.type === TOKEN_TYPE.NUM_CONST) {
    return makeNumberExp(token.value);
  } else if (token.type === TOKEN_TYPE.CHAR_CONST) {
    return makeNumberExp(token.value.charCodeAt(0));
  } else if (token.type === TOKEN_TYPE.STRING_CONST) {
    return makeStringExp(token.value);
  } else if (token.type === TOKEN_TYPE.IDENTIFIER) {
    return makeIdentifierExp(findInScope(context, token.text, token));
  } else if (
    token.type === TOKEN_TYPE.KEYWORD &&
    (token.text === KEYWORD.TRUE || token.text === KEYWORD.FALSE)
  ) {
    return makeNumberExp(Number(token.text === KEYWORD.TRUE));
  } else {
    return compileError(token, `Unrecognised token "${token.text}"`);
  }
};
