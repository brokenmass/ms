import { loc } from './tokenizer';
import * as util from 'util';
export const compileError = (
  item: {
    loc: loc;
  },
  error: string,
) => {
  const errorMessage = `${item.loc.file}:${item.loc.line + 1}:${
    item.loc.col + 1
  }: ${error}`;
  console.error(errorMessage);
  throw new Error(errorMessage);
};

export const inspect = (input: unknown) =>
  console.log(
    util.inspect(input, { depth: Infinity, colors: true, compact: false }),
  );
