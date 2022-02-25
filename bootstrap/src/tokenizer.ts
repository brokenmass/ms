import * as fs from 'fs';
import config from './config';
import { compileError } from './utils';

const EMPTY_CHARS = ' \r\n';
const SPECIAL_CHARS = '.,';

const BLOCK_OPENING_CHARS = '([{';
const BLOCK_CLOSING_CHARS = ')]}';
const NUMBER_CHARS = '01234567890';

export enum BLOCK_TYPE {
  FILE = 'file',
  CURLY = '{}',
  ROUND = '()',
  SQUARE = '[]',
}

export enum TOKEN_TYPE {
  COMMENT = 'comment',
  NUMBER = 'number',
  STRING = 'string',
  CHAR = 'char',
  WORD = 'word',
  SPECIAL = 'special',
  BLOCK_START = 'block start',
  BLOCK_END = 'block end',
}

export type loc = {
  file: string;
  line: number;
  col: number;
  index: number;
};

export type tokenValue = {
  type: TOKEN_TYPE.STRING | TOKEN_TYPE.NUMBER | TOKEN_TYPE.CHAR;
  text: string;
  value: string | number;
  loc: loc;
};
export type tokenElement = {
  type: TOKEN_TYPE.WORD | TOKEN_TYPE.SPECIAL;
  text: string;
  loc: loc;
};
export type tokenBlock = {
  type: TOKEN_TYPE.BLOCK_START | TOKEN_TYPE.BLOCK_END;
  text: string;
  blockType: BLOCK_TYPE;
  loc: loc;
};

export type token = tokenElement | tokenBlock | tokenValue;
class FileReader {
  loc: loc;
  text: string;

  constructor(filename: string) {
    this.loc = {
      file: filename,
      line: 0,
      col: 0,
      index: 0,
    };

    this.text = fs.readFileSync(filename, 'utf-8');
  }

  advanceToEndOf = (check: charTypeChecker) => {
    while (
      this.loc.index < this.text.length &&
      check(this.text, this.loc.index + 1)
    ) {
      this.advanceByOne();
    }
  };
  advanceTo = (check: charTypeChecker) => {
    while (
      this.loc.index < this.text.length &&
      !check(this.text, this.loc.index)
    ) {
      this.advanceByOne();
    }
  };

  advanceByOne = () => {
    if (this.text[this.loc.index] === '\n') {
      this.loc.col = 0;
      this.loc.line++;
    } else {
      this.loc.col++;
    }
    this.loc.index++;
  };

  getToken = (start: number, end: number) => {
    return this.text.substring(start, end);
  };

  get currentChar() {
    return this.text[this.loc.index];
  }
  get prevChar() {
    return this.text[this.loc.index - 1];
  }
  get nextChar() {
    return this.text[this.loc.index + 1];
  }

  get isEOF() {
    return this.loc.index > this.text.length - 1;
  }
}
const unescapeString = (str: string): string => {
  const mapping = {
    n: '\n',
    '\\': '\\',
    r: '\r',
    t: '\t',
  };
  let out = '';
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '\\' && mapping[str[i + 1]]) {
      out += mapping[str[i + 1]];
      i++;
    } else {
      out += str[i];
    }
  }

  return out;
};
type charTypeChecker = (text: string, index?: number) => boolean;

const blockTypesChars = {
  '{': BLOCK_TYPE.CURLY,
  '}': BLOCK_TYPE.CURLY,
  '(': BLOCK_TYPE.ROUND,
  ')': BLOCK_TYPE.ROUND,
  '[': BLOCK_TYPE.SQUARE,
  ']': BLOCK_TYPE.SQUARE,
};

const isEscape: charTypeChecker = (text: string, index = 0) =>
  text[index] === '\\' && !isEscape(text, index - 1);
const isEOL: charTypeChecker = (text: string, index = 0) =>
  '\n'.includes(text[index]);
const isNotEmpty: charTypeChecker = (text: string, index = 0) =>
  !EMPTY_CHARS.includes(text[index]);
const isSpecialChar: charTypeChecker = (text: string, index = 0) =>
  SPECIAL_CHARS.includes(text[index]);
const isArrow: charTypeChecker = (text: string, index = 0) => {
  const t = text[index] + text[index + 1];
  return (t === '->' || t === '<-') && !isEscape(text, index - 1);
};
const isBlockOpening: charTypeChecker = (text: string, index = 0) =>
  BLOCK_OPENING_CHARS.includes(text[index]);
const isBlockClosing: charTypeChecker = (text: string, index = 0) =>
  BLOCK_CLOSING_CHARS.includes(text[index]);
const isNumber: charTypeChecker = (text: string, index = 0) =>
  NUMBER_CHARS.includes(text[index]);
const isEdgeOfString: charTypeChecker = (text: string, index = 0) =>
  text[index] == '"' && !isEscape(text, index - 1);
const isEdgeOfChar: charTypeChecker = (text: string, index = 0) =>
  text[index] == "'" && !isEscape(text, index - 1);
const isWord: charTypeChecker = (text: string, index = 0) =>
  isNotEmpty(text, index) &&
  !isEscape(text, index) &&
  !isSpecialChar(text, index) &&
  !isArrow(text, index) &&
  !isBlockOpening(text, index) &&
  !isBlockClosing(text, index) &&
  !isEdgeOfString(text, index) &&
  !isEdgeOfChar(text, index);

const locToString = (loc: loc) => `${loc.file}:${loc.line + 1}:${loc.col + 1}`;

const printTokenized = (tokens: token[]) => {
  let indent = 0;
  tokens.forEach((item) => {
    if (item.type === TOKEN_TYPE.BLOCK_END) {
      indent -= 2;
    }

    console.log(
      `${' '.repeat(indent)}  - ${locToString(item.loc)}: [${item.type}] "${
        item.text
      }"`,
    );
    if (item.type === TOKEN_TYPE.BLOCK_START) {
      indent += 2;
    }
  });
};

const escapeString = (str: string): string => str.replace(/\n/g, '\\n');

const tokenizer = (filename: string): token[] => {
  const reader = new FileReader(filename);

  const tokenizedFile: token[] = [
    {
      type: TOKEN_TYPE.BLOCK_START,
      blockType: BLOCK_TYPE.FILE,
      text: filename,
      loc: { ...reader.loc },
    },
  ];

  const blockStack: tokenBlock[] = [];
  reader.advanceTo(isNotEmpty);
  while (!reader.isEOF) {
    const start = { ...reader.loc };

    if (reader.currentChar === '/' && reader.nextChar === '/') {
      reader.advanceTo(isEOL);
      // const value = reader.getToken(start.index + 2, reader.loc.index);
      // tokenizedFile.push({
      //   type: TOKEN_TYPE.COMMENT,
      //   loc: start,
      //   value,
      // });
    } else if (isEdgeOfString(reader.currentChar)) {
      reader.advanceByOne();
      reader.advanceTo(isEdgeOfString);
      const token = reader.getToken(start.index + 1, reader.loc.index);
      const text = escapeString(token);
      const value = unescapeString(token);
      tokenizedFile.push({
        type: TOKEN_TYPE.STRING,
        loc: start,
        text,
        value,
      });
    } else if (isEdgeOfChar(reader.currentChar)) {
      reader.advanceByOne();
      reader.advanceTo(isEdgeOfChar);
      const token = reader.getToken(start.index + 1, reader.loc.index);
      const text = escapeString(token);
      const value = unescapeString(token);
      if (value.length > 1) {
        return compileError(
          { loc: start },
          'chars can only be one character long',
        );
      }

      tokenizedFile.push({
        type: TOKEN_TYPE.CHAR,
        loc: start,
        text,
        value: value.charCodeAt(0),
      });
    } else if (isNumber(reader.currentChar)) {
      reader.advanceToEndOf(isNumber);
      const text = reader.getToken(start.index, reader.loc.index + 1);
      tokenizedFile.push({
        type: TOKEN_TYPE.NUMBER,
        loc: start,
        text,
        value: Number(text),
      });
    } else if (isBlockOpening(reader.currentChar)) {
      const value = reader.getToken(start.index, reader.loc.index + 1);
      const newBlock: tokenBlock = {
        type: TOKEN_TYPE.BLOCK_START,
        blockType: blockTypesChars[value],
        text: blockTypesChars[value],
        loc: start,
      };
      tokenizedFile.push(newBlock);
      blockStack.push(newBlock);
    } else if (isBlockClosing(reader.currentChar)) {
      const value = reader.getToken(start.index, reader.loc.index + 1);
      const blockType = blockTypesChars[value];
      if (blockStack[blockStack.length - 1].blockType !== blockType) {
        return compileError(
          blockStack[blockStack.length - 1],
          'Block not correctly closed',
        );
      } else {
        blockStack.pop();
      }
      tokenizedFile.push({
        type: TOKEN_TYPE.BLOCK_END,
        blockType: blockTypesChars[value],
        text: blockTypesChars[value],
        loc: start,
      });
    } else if (isSpecialChar(reader.text, reader.loc.index)) {
      const text = reader.getToken(start.index, reader.loc.index + 1);
      tokenizedFile.push({
        type: TOKEN_TYPE.SPECIAL,
        loc: start,
        text,
      });
    } else if (isArrow(reader.text, reader.loc.index)) {
      reader.advanceByOne();
      // double headed arrows <->
      if (isArrow(reader.text, reader.loc.index)) reader.advanceByOne();
      const text = reader.getToken(start.index, reader.loc.index + 1);
      tokenizedFile.push({
        type: TOKEN_TYPE.SPECIAL,
        loc: start,
        text,
      });
    } else if (isWord(reader.currentChar)) {
      reader.advanceToEndOf(isWord);
      const text = reader.getToken(start.index, reader.loc.index + 1);
      tokenizedFile.push({
        type: TOKEN_TYPE.WORD,
        loc: start,
        text,
      });
    }

    reader.advanceByOne();
    reader.advanceTo(isNotEmpty);
  }

  if (blockStack.length > 0) {
    // the blockStack is not empty that means that some brackets has not been correctly closed
    compileError(blockStack[0], 'Block not correctly closed');
  }

  tokenizedFile.push({
    type: TOKEN_TYPE.BLOCK_END,
    blockType: BLOCK_TYPE.FILE,
    text: filename,
    loc: { ...reader.loc },
  });

  if (config.debugTokenizer) {
    printTokenized(tokenizedFile);
  }

  return tokenizedFile;
};

export default tokenizer;
