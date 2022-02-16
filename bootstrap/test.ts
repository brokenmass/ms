#!/usr/bin/env -S node -r "ts-node/register"

import { compile, execCommand } from './src/index';
import { readdirSync } from 'fs';
import * as path from 'path';

const testFolder = process.argv[2];
try {
  const files = readdirSync(testFolder);
  files.filter(name => name.endsWith('.rain'))
    .forEach(name => {
      const filename = path.join(testFolder, name);
      const executableFile = compile(filename);

      execCommand(executableFile, [] ,{exitOnError: false})

    })

} catch (err) {
  console.error(err);
}
