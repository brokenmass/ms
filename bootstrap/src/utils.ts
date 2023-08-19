import { loc } from './tokenizer';
import * as util from 'util';
import { EXPRESSION, EXPRESSION_TYPE, FUNCTION } from './ast';
import * as chalk from 'chalk';
export const locToString = (loc: loc, fileColor = 'bold'): string =>
  `${chalk[fileColor].bold(loc.file)}:${chalk.yellow.bold(
    loc.line + 1,
  )}:${chalk.yellow.bold(loc.col + 1)}`;

export const compileError = (
  item: {
    loc: loc;
  },
  error: string,
) => {
  const errorMessage = `${locToString(item.loc, 'redBright')}: ${error}`;
  console.error(errorMessage);
  throw new Error(errorMessage);
  // throw new Error(errorMessage);
};

export const inspect = (input: unknown) =>
  console.log(util.inspect(input, { depth: Infinity, colors: true }));

const IND_NODE = '│  ';
const IND_END_NODE = '└─ ';
const IND_LEAF_NODE = '├─ ';
const IND_EMPTY_SPACE = '   ';

export const printAstTree = (context: { functions: FUNCTION[] }) => {
  return context.functions
    .map(
      (func) =>
        `Function: "${func.name}" | Parameters: ${
          func.paramsCount
        } | Variables: ${func.varsCount} | Pure: ${
          func.isPureDetermined ? (func.isPure ? 'yes' : 'no') : 'unknown'
        }\n${printAstTreeNode(func.code)}`,
    )
    .join('\n');
};
export const printAstTreeNode = (
  expression: EXPRESSION,
  indents: string[] = [],
  isLast = true,
) => {
  const treeIndicator = isLast ? IND_END_NODE : IND_LEAF_NODE;
  const indentation = chalk.greenBright(`${indents.join('')}${treeIndicator}`);
  const res = `${indentation}${chalk.bold(expression.type)}`;

  if (expression.type === EXPRESSION_TYPE.IDENTIFIER) {
    const info = chalk.dim(
      ` ${expression.value.type} ${expression.value.name}`,
    );
    return res + info + '\n';
  } else if (expression.type === EXPRESSION_TYPE.NUMBER) {
    const info = chalk.dim(` ${expression.value}`);
    return res + info + '\n';
  } else if (expression.type === EXPRESSION_TYPE.STRING) {
    const info = chalk.dim(` "${expression.value.replace(/\n/g, '\\n')}"`);
    return res + info + '\n';
  } else {
    const nextIndicator = isLast ? IND_EMPTY_SPACE : IND_NODE;
    return (
      res +
      '\n' +
      expression.params
        .map((p, i) =>
          printAstTreeNode(
            p,
            [...indents, nextIndicator],
            i === expression.params.length - 1,
          ),
        )
        .join('')
    );
  }
};
