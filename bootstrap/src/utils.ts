import { token } from './tokenizer';

export const printTokenError = (token: token, error: string) => {
  console.error(
    `${token.loc.file}:${token.loc.line + 1}:${token.loc.col + 1}: ${error}`,
  );
};
