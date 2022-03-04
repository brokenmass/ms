export enum KEYWORD {
  WHILE = 'while',
  IF = 'if',
  ELSE = 'else',
  RETURN = 'return',
  FUNCTION = 'function',
  VAR = 'var',
  CONST = 'const',
  TRUE = 'true',
  FALSE = 'false',
}

export enum PUNCTUATION {
  COMPOUND_START = '{',
  COMPOUND_END = '}',
  PARENS_START = '(',
  PARENS_END = ')',
  SUBSCRIPTING_START = '[',
  SUBSCRIPTING_END = ']',
  SEMI = ';',
}

export enum BINARY_OPERATOR {
  ASSIGN = '=',
  ADD = '+',
  SUB = '-',
  DIV = '/',
  MUL = '*',
  MOD = '%',
  LT = '<',
  LE = '<=',
  GT = '>',
  GE = '>=',
  EQ = '==',
  NEQ = '!=',
  AND = '&&',
  OR = '||',
  BAND = '&',
  BXOR = '^',
  BOR = '|',
  LSHIFT = '<<',
  RSHIFT = '>>',
  COMMA = ',',
}

export enum UNARY_OPERATOR {
  NEG = '-',
  NOT = '!',
  INC = '++',
  DEC = '--',
  DEREFERENCE = '@',
  ADDRESSOF = '#',
}
