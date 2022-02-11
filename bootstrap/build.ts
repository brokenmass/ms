#!/usr/bin/env -S node -r "ts-node/register"

import { compile } from './src/index';

compile(process.argv[2]);
