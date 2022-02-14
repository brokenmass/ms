import { writeFileSync } from 'fs';
import * as path from 'path';
import { generateASM } from './asm';
import { generateAST } from './ast';
import tokenizer from './tokenizer';
import { spawnSync } from 'child_process';

const execCommand = (command: string, args: string[] = []) => {
  console.log('-------');
  console.log(command, args.join(' '));
  const out = spawnSync(command, args, {
    encoding: 'utf-8',
    stdio: 'inherit',
  });
  console.log('');
  console.log(`Exited with status code ${out.status}`);

  return out;
};
const compile = (filename: string) => {
  if (!filename) {
    console.error('Missing filename');
    process.exit(1);
  }

  const outdir = path.relative(process.cwd(), path.dirname(filename));
  const extension = path.extname(filename);
  const name = path.basename(filename, extension);

  if (extension !== '.rain') {
    console.error('file extansion must be ".rain"');
  }

  const asmFile = './' + path.join(outdir, `${name}.asm`);
  const executableFile = './' + path.join(outdir, name);

  const text = generateASM(generateAST(tokenizer(filename)));

  writeFileSync(asmFile, text);
  execCommand('fasm', [asmFile, executableFile, '-m', '524288']); // -m 500000 ${executableFile}`);

  execCommand('chmod', ['+x', executableFile]);

  if (process.argv.includes('-r')) {
    process.exit(execCommand(executableFile).status);
  }
};

export { compile };
