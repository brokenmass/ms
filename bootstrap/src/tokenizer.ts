const EMPTY_CHARS = ' \r\n';
const SPECIAL_CHARS = '->!#,.';
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
  WORD = 'word',
  SPECIAL = 'special',
  BLOCK = 'char',
}

export type loc = {
  file: string;
  line: number;
  col: number;
  index: number;
};

export type token = {
  type: Exclude<TOKEN_TYPE, TOKEN_TYPE.BLOCK>;
  value: string;
  start: loc;
};
export type tokenBlock = {
  type: TOKEN_TYPE.BLOCK;
  blockType: BLOCK_TYPE;
  contents: (tokenBlock | token)[];
  start: loc;
  end?: loc;
};

type charTypeChecker = (text: string, index: number) => boolean;

const blockTypesChars = {
  '{': BLOCK_TYPE.CURLY,
  '}': BLOCK_TYPE.CURLY,
  '(': BLOCK_TYPE.ROUND,
  ')': BLOCK_TYPE.ROUND,
  '[': BLOCK_TYPE.SQUARE,
  ']': BLOCK_TYPE.SQUARE,
};

const isEOL: charTypeChecker = (text: string, index: number) =>
  '\n'.includes(text[index]);
const isNotEmpty: charTypeChecker = (text: string, index: number) =>
  !EMPTY_CHARS.includes(text[index]);
const isSpecial: charTypeChecker = (text: string, index: number) =>
  SPECIAL_CHARS.includes(text[index]);
const isBlockOpening: charTypeChecker = (text: string, index: number) =>
  BLOCK_OPENING_CHARS.includes(text[index]);
const isBlockClosing: charTypeChecker = (text: string, index: number) =>
  BLOCK_CLOSING_CHARS.includes(text[index]);
const isNumber: charTypeChecker = (text: string, index: number) =>
  NUMBER_CHARS.includes(text[index]);
const isEdgeOfString: charTypeChecker = (text: string, index: number) =>
  text[index] == '"' && text[index - 1] !== '\\';
const isWord: charTypeChecker = (text: string, index: number) =>
  isNotEmpty(text, index) &&
  !isSpecial(text, index) &&
  !isBlockOpening(text, index) &&
  !isBlockClosing(text, index) &&
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

const locToString = (loc: loc) => `${loc.file}:${loc.line + 1}:${loc.col + 1}`;

const printTokenized = (tokenizedFile: tokenBlock) => {
  const innerPrint = (block: tokenBlock, indent = '') => {
    console.log(
      indent + `${locToString(block.start)}: block ${block.blockType}`,
    );
    block.contents.forEach((item) => {
      if (item.type === TOKEN_TYPE.BLOCK) {
        innerPrint(item, indent + '  ');
      } else {
        console.log(
          indent + `- ${locToString(item.start)}: ${item.type} ${item.value}`,
        );
      }
    });
  };
  innerPrint(tokenizedFile);
};

const tokenizer = (filename: string, text: string): tokenBlock => {
  console.log(' ---- tokenizer ----');
  // remove all empty trailing spaces
  const currentLoc = {
    file: filename,
    line: 0,
    col: 0,
    index: 0,
  };

  const tokenizedFile: tokenBlock = {
    type: TOKEN_TYPE.BLOCK,
    blockType: BLOCK_TYPE.FILE,
    start: { ...currentLoc },
    contents: [],
  };
  const blockStack: tokenBlock[] = [tokenizedFile];

  advanceTo(isNotEmpty, text, currentLoc);
  while (currentLoc.index < text.length) {
    const start = { ...currentLoc };
    const currentBlock = blockStack[blockStack.length - 1];
    if (text[start.index] === '/' && text[start.index + 1] === '/') {
      advanceTo(isEOL, text, currentLoc);
      const value = text.substring(start.index + 2, currentLoc.index);
      currentBlock.contents.push({
        type: TOKEN_TYPE.COMMENT,
        start: start,
        value,
      });
    } else if (isEdgeOfString(text, currentLoc.index)) {
      advanceByOne(text, currentLoc);
      advanceTo(isEdgeOfString, text, currentLoc);
      const value = text.substring(start.index + 1, currentLoc.index);
      currentBlock.contents.push({
        type: TOKEN_TYPE.STRING,
        start: start,
        value,
      });
    } else if (isNumber(text, currentLoc.index)) {
      advanceToEndOf(isNumber, text, currentLoc);
      const value = text.substring(start.index, currentLoc.index + 1);
      currentBlock.contents.push({
        type: TOKEN_TYPE.NUMBER,
        start: start,
        value,
      });
    } else if (isBlockOpening(text, currentLoc.index)) {
      const value = text.substring(start.index, currentLoc.index + 1);
      const newBlock: tokenBlock = {
        type: TOKEN_TYPE.BLOCK,
        blockType: blockTypesChars[value],
        start: start,
        contents: [],
      };
      currentBlock.contents.push(newBlock);
      blockStack.push(newBlock);
    } else if (isBlockClosing(text, currentLoc.index)) {
      const value = text.substring(start.index, currentLoc.index + 1);
      const blockType = blockTypesChars[value];
      if (currentBlock.blockType !== blockType) {
        console.error(
          locToString(currentBlock.start),
          'Block not correctly closed',
        );
        // error
      } else {
        // close current block
        currentBlock.end = start;
        blockStack.pop();
      }
    } else if (isSpecial(text, currentLoc.index)) {
      advanceToEndOf(isSpecial, text, currentLoc);
      const value = text.substring(start.index, currentLoc.index + 1);
      currentBlock.contents.push({
        type: TOKEN_TYPE.SPECIAL,
        start: start,
        value,
      });
    } else if (isWord(text, currentLoc.index)) {
      advanceToEndOf(isWord, text, currentLoc);
      const value = text.substring(start.index, currentLoc.index + 1);
      currentBlock.contents.push({
        type: TOKEN_TYPE.WORD,
        start: start,
        value,
      });
    }

    advanceByOne(text, currentLoc);
    advanceTo(isNotEmpty, text, currentLoc);
  }

  if (blockStack.length !== 1) {
    // the blockStack is not empty that means that some brackets has not been correctly closed
    console.error(
      locToString(blockStack[0].start),
      'Block not correctly closed',
    );
  }
  printTokenized(tokenizedFile);
  return tokenizedFile;
};

export default tokenizer;
