import * as fs from 'fs';
import config from './config';
import { BINARY_OPERATOR, KEYWORD, UNARY_OPERATOR } from './tokens';
import { compileError, locToString } from './utils';

export type loc = {
  file: string;
  line: number;
  col: number;
  index: number;
};

export enum TOKEN_TYPE {
  NUM_CONST = 'number',
  CHAR_CONST = 'char',
  STRING_CONST = 'string',
  IDENTIFIER = 'identifier',
  KEYWORD = 'keyword',
  SYMBOL = 'symbol',
}

export type CONST_TOKEN =
  | {
      type: TOKEN_TYPE.CHAR_CONST | TOKEN_TYPE.STRING_CONST;
      value: string;
      text: string;
      loc: loc;
    }
  | {
      type: TOKEN_TYPE.NUM_CONST;
      value: number;
      text: string;
      loc: loc;
    };

export type IDENTIFIER_TOKEN = {
  type: TOKEN_TYPE.IDENTIFIER;
  text: string;
  loc: loc;
};

export type KEYWORD_TOKEN = {
  type: TOKEN_TYPE.KEYWORD;
  text: string;
  loc: loc;
};

export type SYMBOL_TOKEN = {
  type: TOKEN_TYPE.SYMBOL;
  text: string;
  loc: loc;
};

export type TOKEN =
  | CONST_TOKEN
  | IDENTIFIER_TOKEN
  | KEYWORD_TOKEN
  | SYMBOL_TOKEN;

const NUMBER_CHARS = '01234567890';
const HEX_CHARS = '01234567890ABCDEFabcdef';
const ALPHA_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_';
const APLHANUM_CHARS = ALPHA_CHARS + NUMBER_CHARS;
const DUALCHARS_OPERATORS = [
  ...Object.values(BINARY_OPERATOR),
  ...Object.values(UNARY_OPERATOR),
].filter((op) => op.length == 2);

const shouldInsertSemicolon = (token: TOKEN) =>
  token.type === TOKEN_TYPE.IDENTIFIER ||
  (token.type === TOKEN_TYPE.KEYWORD && ['return'].includes(token.text)) ||
  (token.type === TOKEN_TYPE.SYMBOL && ['--', '++'].includes(token.text));

const isWhiteSpace = (char: string) => ' \r\t\v'.includes(char);
const isNewline = (char: string) => char === '\n';
const isDecNumber = (char: string) => NUMBER_CHARS.includes(char);
const isHexNumber = (char: string) => HEX_CHARS.includes(char);
const isBinaryNumber = (char: string) => '01'.includes(char);
const isAlpha = (char: string) => ALPHA_CHARS.includes(char);
const isAlphaNum = (char: string) => APLHANUM_CHARS.includes(char);
const isDualCharOperator = (chars: string) =>
  DUALCHARS_OPERATORS.includes(chars as BINARY_OPERATOR | UNARY_OPERATOR);

const printTokenized = (tokens: TOKEN[]) => {
  tokens.forEach((item) => {
    console.log(`${locToString(item.loc)}: [${item.type}] "${item.text}"`);
  });
};

const tokenizer = (filename: string): TOKEN[] => {
  const currenLoc: loc = {
    file: filename,
    col: 0,
    line: 0,
    index: 0,
  };

  const tokens: TOKEN[] = [];
  const text = fs.readFileSync(filename, 'utf-8');

  const advance = () => {
    if (isNewline(text[currenLoc.index])) {
      currenLoc.line++;
      currenLoc.col = 0;
    } else {
      currenLoc.col++;
    }

    currenLoc.index++;
  };

  const isEOF = () => currenLoc.index >= text.length;

  while (currenLoc.index < text.length) {
    const currentChar = text[currenLoc.index];
    const nextChar = text[currenLoc.index + 1];
    const next2Chars = currentChar + nextChar;

    if (isWhiteSpace(currentChar)) {
      // ignore
    } else if (isNewline(currentChar)) {
      if (tokens.length > 0 && shouldInsertSemicolon(tokens.at(-1))) {
        // TODO: define ASI logic
        // tokens.push({
        //   type: TOKEN_TYPE.SYMBOL,
        //   loc: { ...currenLoc },
        //   text: ';',
        // });
      }
    } else if (isDecNumber(currentChar)) {
      const start = { ...currenLoc };
      if (currentChar === '0' && nextChar === 'b') {
        // binary
        while (isBinaryNumber(text[currenLoc.index + 1])) advance();
      } else if (currentChar === '0' && nextChar === 'x') {
        // binary
        while (isHexNumber(text[currenLoc.index + 1])) advance();
      } else {
        // decimal
        while (isDecNumber(text[currenLoc.index + 1])) advance();
      }

      const num = text.substring(start.index, currenLoc.index + 1);
      tokens.push({
        type: TOKEN_TYPE.NUM_CONST,
        loc: start,
        text: num,
        value: parseInt(num),
      });
    } else if (currentChar === '"') {
      const start = { ...currenLoc };
      let escape = false;
      let tokenText = '';
      advance();
      while (!isEOF() && (text[currenLoc.index] !== '"' || escape)) {
        if (escape) {
          tokenText += JSON.parse(`"\\${text[currenLoc.index]}"`);
          escape = false;
        } else if (text[currenLoc.index] === '\\') {
          escape = true;
        } else {
          tokenText += text[currenLoc.index];
        }
        advance();
      }

      if (isEOF()) {
        return compileError({ loc: start }, 'Unterminated string');
      }

      tokens.push({
        type: TOKEN_TYPE.STRING_CONST,
        loc: start,
        text: text
          .substring(start.index + 1, currenLoc.index)
          .replace(/\n/g, '\\n'),
        value: tokenText,
      });
    } else if (currentChar === "'") {
      const start = { ...currenLoc };
      let escape = false;
      let tokenText = '';
      advance();
      while (!isEOF() && (text[currenLoc.index] !== "'" || escape)) {
        if (escape) {
          tokenText += JSON.parse(`"\\${text[currenLoc.index]}"`);
          escape = false;
        } else if (text[currenLoc.index] === '\\') {
          escape = true;
        } else {
          tokenText += text[currenLoc.index];
        }
        advance();
      }

      if (isEOF()) {
        return compileError({ loc: start }, 'Unterminated char');
      }

      if (tokenText.length > 1) {
        return compileError(
          { loc: start },
          'Char values can be only one char long',
        );
      }

      tokens.push({
        type: TOKEN_TYPE.CHAR_CONST,
        loc: start,
        text: text.substring(start.index + 1, currenLoc.index),
        value: tokenText,
      });
    } else if (isAlpha(currentChar)) {
      const start = { ...currenLoc };
      while (isAlphaNum(text[currenLoc.index + 1])) advance();

      const tokenText = text.substring(start.index, currenLoc.index + 1);

      if (Object.values(KEYWORD).includes(tokenText as KEYWORD)) {
        tokens.push({
          type: TOKEN_TYPE.KEYWORD,
          loc: start,
          text: tokenText,
        });
      } else {
        tokens.push({
          type: TOKEN_TYPE.IDENTIFIER,
          loc: start,
          text: tokenText,
        });
      }
    } else if (next2Chars === '//') {
      // ignore line comments
      while (!isNewline(text[currenLoc.index + 1])) advance();
    } else if (isDualCharOperator(next2Chars)) {
      tokens.push({
        type: TOKEN_TYPE.SYMBOL,
        loc: { ...currenLoc },
        text: next2Chars,
      });
      advance();
    } else {
      tokens.push({
        type: TOKEN_TYPE.SYMBOL,
        loc: { ...currenLoc },
        text: currentChar,
      });
    }

    advance();
  }

  if (config.debugTokenizer) {
    printTokenized(tokens);
  }

  return tokens;
};

export default tokenizer;
