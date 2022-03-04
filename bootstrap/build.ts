#!/usr/bin/env -S node -r "ts-node/register"

import { compile, execCommand } from './src/index';

const executableFile = compile(process.argv[2]);

if (process.argv.includes('-r')) {
  process.exit(execCommand(executableFile).status);
}
