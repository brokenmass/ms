import { generateAST } from './ast';
import tokenizer from './tokenizer';

const compile = (filename: string) => {
  if (!filename) {
    console.error('Missing filename');
    process.exit(1);
  }

  try {
    generateAST(tokenizer(filename));
  } catch (error) {
    console.error(`Error while trying to read file '${filename}' ${error}`);
    process.exit(1);
  }
};

export { compile };
