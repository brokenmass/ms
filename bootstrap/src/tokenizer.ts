const EMPTY_CHARS = ' \r\n';
const SPECIAL_CHARS = '->!#,.';
const BLOCK_CHARS = '()[]{}';
const NUMBER_CHARS = '01234567890';

export const enum TOKEN_TYPE {
  COMMENT,
  NUMBER,
  STRING,
  WORD,
  SPECIAL,
  BLOCK,
}

export type loc = {
  file: string;
  line: number;
  col: number;
  index: number;
};

export type token = {
  type: TOKEN_TYPE;
  value: string;
  loc: loc;
};
export type tokenizedFile = token[];

type charTypeChecker = (text: string, index: number) => boolean;

const tokenTypeHRNames = {
  [TOKEN_TYPE.COMMENT]: 'COMMENT',
  [TOKEN_TYPE.NUMBER]: 'NUMBER',
  [TOKEN_TYPE.STRING]: 'STRING',
  [TOKEN_TYPE.WORD]: 'WORD',
  [TOKEN_TYPE.SPECIAL]: 'SPECIAL',
  [TOKEN_TYPE.BLOCK]: 'BLOCK',
};

const isEOL: charTypeChecker = (text: string, index: number) =>
  '\n'.includes(text[index]);
const isNotEmpty: charTypeChecker = (text: string, index: number) =>
  !EMPTY_CHARS.includes(text[index]);
const isSpecial: charTypeChecker = (text: string, index: number) =>
  SPECIAL_CHARS.includes(text[index]);
const isBlock: charTypeChecker = (text: string, index: number) =>
  BLOCK_CHARS.includes(text[index]);
const isNumber: charTypeChecker = (text: string, index: number) =>
  NUMBER_CHARS.includes(text[index]);
const isEdgeOfString: charTypeChecker = (text: string, index: number) =>
  text[index] == '"' && text[index - 1] !== '\\';
const isWord: charTypeChecker = (text: string, index: number) =>
  isNotEmpty(text, index) &&
  !isSpecial(text, index) &&
  !isBlock(text, index) &&
  !isEdgeOfString(text, index);

const advanceToEndOf = (
  check: charTypeChecker,
  text: string,
  currentLoc: loc,
) => {
  while (currentLoc.index < text.length && check(text, currentLoc.index + 1)) {
    advanceByOne(text, currentLoc);
  }
};
const advanceTo = (check: charTypeChecker, text: string, currentLoc: loc) => {
  while (currentLoc.index < text.length && !check(text, currentLoc.index)) {
    advanceByOne(text, currentLoc);
  }
};

const advanceByOne = (text: string, currentLoc: loc) => {
  if (text[currentLoc.index] === '\n') {
    currentLoc.col = 0;
    currentLoc.line++;
  } else {
    currentLoc.col++;
  }
  currentLoc.index++;
};

const printToken = (token: token) => {
  console.log(
    `${token.loc.file}:${token.loc.line + 1}:${token.loc.col + 1}: [${
      tokenTypeHRNames[token.type]
    }] ${token.value}`,
  );
};

const tokenizer = (filename: string, text: string): tokenizedFile => {
  console.log(' ---- tokenizer ----');
  // remove all empty trailing spaces
  const currentLoc = {
    file: filename,
    line: 0,
    col: 0,
    index: 0,
  };

  const tokens: tokenizedFile = [];

  advanceTo(isNotEmpty, text, currentLoc);
  while (currentLoc.index < text.length) {
    const start = { ...currentLoc };

    if (text[start.index] === '/' && text[start.index + 1] === '/') {
      advanceTo(isEOL, text, currentLoc);
      const value = text.substring(start.index + 2, currentLoc.index);
      tokens.push({
        type: TOKEN_TYPE.COMMENT,
        loc: start,
        value,
      });
    } else if (isEdgeOfString(text, currentLoc.index)) {
      advanceByOne(text, currentLoc);
      advanceTo(isEdgeOfString, text, currentLoc);
      const value = text.substring(start.index + 1, currentLoc.index);
      tokens.push({
        type: TOKEN_TYPE.STRING,
        loc: start,
        value,
      });
    } else if (isNumber(text, currentLoc.index)) {
      advanceToEndOf(isNumber, text, currentLoc);
      const value = text.substring(start.index, currentLoc.index + 1);
      tokens.push({
        type: TOKEN_TYPE.NUMBER,
        loc: start,
        value,
      });
    } else if (isBlock(text, currentLoc.index)) {
      const value = text.substring(start.index, currentLoc.index + 1);
      tokens.push({
        type: TOKEN_TYPE.BLOCK,
        loc: start,
        value,
      });
    } else if (isSpecial(text, currentLoc.index)) {
      advanceToEndOf(isSpecial, text, currentLoc);
      const value = text.substring(start.index, currentLoc.index + 1);
      tokens.push({
        type: TOKEN_TYPE.SPECIAL,
        loc: start,
        value,
      });
    } else if (isWord(text, currentLoc.index)) {
      advanceToEndOf(isWord, text, currentLoc);
      const value = text.substring(start.index, currentLoc.index + 1);
      tokens.push({
        type: TOKEN_TYPE.WORD,
        loc: start,
        value,
      });
    }

    advanceByOne(text, currentLoc);
    advanceTo(isNotEmpty, text, currentLoc);
  }

  tokens.forEach(printToken);
  return tokens;
};

export default tokenizer;
