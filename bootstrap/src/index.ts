import { writeFileSync } from 'fs';
import * as path from 'path';
import { generateASM } from './asm';
import { generateAST } from './ast';
import tokenizer from './tokenizer';
import { execSync } from 'child_process';
const compile = (filename: string) => {
  if (!filename) {
    console.error('Missing filename');
    process.exit(1);
  }

  const text = generateASM(generateAST(tokenizer(filename)));
  const outdir = path.relative(process.cwd(), path.dirname(filename));
  const extension = path.extname(filename);
  const name = path.basename(filename, extension);

  const asmFile = './' + path.join(outdir, `${name}.asm`);
  const executableFile = './' + path.join(outdir, name);

  writeFileSync(asmFile, text);
  console.log(`fasm ${asmFile} -m 500000 ${executableFile}`);
  console.log(
    execSync(`fasm ${asmFile} -m 500000 ${executableFile}`, {
      encoding: 'utf-8',
    }),
  );
  console.log(`chmod +x ${executableFile}`);
  console.log(
    execSync(`chmod +x ${executableFile}`, {
      encoding: 'utf-8',
    }),
  );
};

export { compile };
