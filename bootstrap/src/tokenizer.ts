import * as fs from 'fs';
import config from './config';
import { compileError } from './utils';

const EMPTY_CHARS = ' \r\n';
// const SPECIAL_CHARS = '|.,;';

const BLOCK_OPENING_CHARS = '([{';
const BLOCK_CLOSING_CHARS = ')]}';
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz_';
const NUMBER_CHARS = '01234567890';
const NON_SPECIAL_CHARS =
  ALPHABET + ALPHABET.toUpperCase() + NUMBER_CHARS + EMPTY_CHARS;
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
  BLOCK = 'block',
}

export type loc = {
  file: string;
  line: number;
  col: number;
  index: number;
};

export type tokenElement = {
  type: Exclude<TOKEN_TYPE, TOKEN_TYPE.BLOCK>;
  value: string;
  loc: loc;
  parentBlock: tokenBlock;
};
export type tokenBlock = {
  type: TOKEN_TYPE.BLOCK;
  blockType: BLOCK_TYPE;
  contents: token[];
  loc: loc;
};

export type token = tokenElement | tokenBlock;
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
const isSpecial: charTypeChecker = (text: string, index = 0) =>
  !NON_SPECIAL_CHARS.includes(text[index]);
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
  !isSpecial(text, index) &&
  !isBlockOpening(text, index) &&
  !isBlockClosing(text, index) &&
  !isEdgeOfString(text, index) &&
  !isEdgeOfChar(text, index);

const locToString = (loc: loc) => `${loc.file}:${loc.line + 1}:${loc.col + 1}`;

const printTokenized = (tokenizedFile: tokenBlock) => {
  const innerPrint = (block: tokenBlock, indent = '') => {
    console.log(
      indent + `- ${locToString(block.loc)}: block ${block.blockType}`,
    );
    block.contents.forEach((item) => {
      if (item.type === TOKEN_TYPE.BLOCK) {
        innerPrint(item, indent + '  ');
      } else {
        console.log(
          indent + `- ${locToString(item.loc)}: ${item.type} ${item.value}`,
        );
      }
    });
  };
  innerPrint(tokenizedFile);
};

const tokenizer = (filename: string): tokenBlock => {
  const reader = new FileReader(filename);

  const tokenizedFile: tokenBlock = {
    type: TOKEN_TYPE.BLOCK,
    blockType: BLOCK_TYPE.FILE,
    loc: { ...reader.loc },
    contents: [],
  };
  const blockStack: tokenBlock[] = [tokenizedFile];

  reader.advanceTo(isNotEmpty);
  while (!reader.isEOF) {
    const start = { ...reader.loc };
    const currentBlock = blockStack[blockStack.length - 1];
    if (reader.currentChar === '/' && reader.nextChar === '/') {
      reader.advanceTo(isEOL);
      // const value = reader.getToken(start.index + 2, reader.loc.index);
      // currentBlock.contents.push({
      //   type: TOKEN_TYPE.COMMENT,
      //   loc: start,
      //   value,
      // });
    } else if (isEdgeOfString(reader.currentChar)) {
      reader.advanceByOne();
      reader.advanceTo(isEdgeOfString);
      const value = unescapeString(
        reader.getToken(start.index + 1, reader.loc.index),
      );
      currentBlock.contents.push({
        type: TOKEN_TYPE.STRING,
        loc: start,
        value,
        parentBlock: blockStack[blockStack.length - 1],
      });
    } else if (isEdgeOfChar(reader.currentChar)) {
      reader.advanceByOne();
      reader.advanceTo(isEdgeOfChar);
      const value = unescapeString(
        reader.getToken(start.index + 1, reader.loc.index),
      );

      if (value.length > 1) {
        return compileError(
          { loc: start },
          'chars can only be one character long',
        );
      }
      currentBlock.contents.push({
        type: TOKEN_TYPE.CHAR,
        loc: start,
        value,
        parentBlock: blockStack[blockStack.length - 1],
      });
    } else if (isNumber(reader.currentChar)) {
      reader.advanceToEndOf(isNumber);
      const value = reader.getToken(start.index, reader.loc.index + 1);
      currentBlock.contents.push({
        type: TOKEN_TYPE.NUMBER,
        loc: start,
        value,
        parentBlock: blockStack[blockStack.length - 1],
      });
    } else if (isBlockOpening(reader.currentChar)) {
      const value = reader.getToken(start.index, reader.loc.index + 1);
      const newBlock: tokenBlock = {
        type: TOKEN_TYPE.BLOCK,
        blockType: blockTypesChars[value],
        loc: start,
        contents: [],
      };
      currentBlock.contents.push(newBlock);
      blockStack.push(newBlock);
    } else if (isBlockClosing(reader.currentChar)) {
      const value = reader.getToken(start.index, reader.loc.index + 1);
      const blockType = blockTypesChars[value];
      if (currentBlock.blockType !== blockType) {
        return compileError(currentBlock, 'Block not correctly closed');
      } else {
        blockStack.pop();
      }
    } else if (isSpecial(reader.currentChar)) {
      reader.advanceToEndOf(isSpecial);
      const value = reader.getToken(start.index, reader.loc.index + 1);
      currentBlock.contents.push({
        type: TOKEN_TYPE.SPECIAL,
        loc: start,
        value,
        parentBlock: blockStack[blockStack.length - 1],
      });
    } else if (isWord(reader.currentChar)) {
      reader.advanceToEndOf(isWord);
      const value = reader.getToken(start.index, reader.loc.index + 1);
      currentBlock.contents.push({
        type: TOKEN_TYPE.WORD,
        loc: start,
        value,
        parentBlock: blockStack[blockStack.length - 1],
      });
    }

    reader.advanceByOne();
    reader.advanceTo(isNotEmpty);
  }

  if (blockStack.length !== 1) {
    // the blockStack is not empty that means that some brackets has not been correctly closed
    compileError(blockStack[1], 'Block not correctly closed');
  }

  if (config.debugTokenizer) {
    printTokenized(tokenizedFile);
  }

  return tokenizedFile;
};

export default tokenizer;
