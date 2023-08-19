import { writeFileSync } from 'fs';
import * as path from 'path';
// import { generateASM } from './asm';
import { generateAST } from './ast';
import tokenizer from './tokenizer';
import { spawnSync } from 'child_process';
import optimiseAst from './optimiseAst';

export const execCommand = (
  command: string,
  args: string[] = [],
  { exitOnError = true } = {},
) => {
  console.log('-------');
  console.log(command, args.join(' '));
  const out = spawnSync(command, args, {
    encoding: 'utf-8',
    stdio: 'inherit',
  });
  console.log('');
  console.log(`Exited with status code ${out.status}`);

  if (out.status !== 0 && exitOnError) {
    process.exit(out.status);
  }
  return out;
};
const compile = (filename: string) => {
  process.stdout.write('\u001b[3J\u001b[2J\u001b[1J');
  console.clear();

  console.log(`Compiling ${filename}`);
  if (!filename) {
    console.error('Missing filename');
    process.exit(1);
  }

  const outdir = path.relative(process.cwd(), path.dirname(filename));
  const extension = path.extname(filename);
  const name = path.basename(filename, extension);

  if (extension !== '.rain') {
    console.error(
      `file extension must be ".rain" but got "${extension}" instead`,
    );
  }

  const asmFile = './' + path.join(outdir, `${name}.asm`);
  const executableFile = './' + path.join(outdir, name);

  const text = optimiseAst(generateAST(tokenizer(filename))).toString();
  writeFileSync(asmFile, text);
  // execCommand('fasm', [asmFile, executableFile, '-m', '524288']); // -m 500000 ${executableFile}`);

  execCommand('chmod', ['+x', executableFile]);

  return executableFile;
};

export { compile };
