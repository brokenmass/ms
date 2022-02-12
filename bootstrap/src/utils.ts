import { loc } from './tokenizer';
import * as util from 'util';
export const locToString = (loc: loc): string =>
  `${loc.file}:${loc.line + 1}:${loc.col + 1}`;

export const compileError = (
  item: {
    loc: loc;
  },
  error: string,
) => {
  const errorMessage = `${locToString(item.loc)}: ${error}`;
  console.error(errorMessage);
  throw new Error(errorMessage);
};

export const inspect = (input: unknown) =>
  console.log(
    util.inspect(input, { depth: Infinity, colors: true, compact: false }),
  );
