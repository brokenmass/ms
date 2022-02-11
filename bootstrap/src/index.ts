import * as fs from 'fs';
import tokenizer from './tokenizer';

const compile = (filename: string) => {
  if (!filename) {
    console.error('Missing filename');
    process.exit(1);
  }

  try {
    const text = fs.readFileSync(filename, 'utf-8');

    console.log(text);

    tokenizer(filename, text);
  } catch (error) {
    console.error(`Error while trying to read file '${filename}' ${error}`);
    process.exit(1);
  }
};

export { compile };
