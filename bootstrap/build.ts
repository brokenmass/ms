#!/usr/bin/env -S node -r "ts-node/register"

import fs from 'fs';
import {exit} from 'process';

console.log(process.argv);

const filename = process.argv[3];

if (!filename) {
  console.error('Missing filename');
  process.exit(1);
}

try {
  fs.readFileSync
}
