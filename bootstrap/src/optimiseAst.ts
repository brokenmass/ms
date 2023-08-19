import {
  CONTEXT,
  EXPRESSION,
  EXPRESSION_TYPE,
  FUNCTION,
  IDENTIFIER_TYPE,
  makeNumberExp,
  makeOpExp,
  VALUE_EXPRESSION,
} from './ast';
import { printAstTree } from './utils';

// FindPureFunctions()
// {
//     // Reset the information
//     for(auto& f: func_list) f.pure_known = f.pure = false;
//     // Loop until the algorithm can't find new functions to identify as pure/impure
//     do {} while(std::count_if(func_list.begin(), func_list.end(), [&](function& f)
//     {
//         if(f.pure_known) return false;
//         //std::cerr << "Identifying " << f.name << '\n';
//         // The function has side-effects, if there is _any_ pointer dereference
//         // in the LHS side of an assign operator, or if the function calls
//         // some other function that is known to have n.
//         bool unknown_functions = false;
//         bool side_effects      = for_all_expr(f.code, true, [&](const expression& exp)
//         {
//             if(is_copy(exp)) { return for_all_expr(exp.params.back(), true, is_deref); }
//             if(is_fcall(exp))
//             {
//                 const auto& e = exp.params.front();
//                 // Indirect function calls are always considered impure
//                 if(!e.is_compiletime_expr()) return true;
//                 // Identify the function that was called
//                 const auto& u = func_list[e.ident.index];
//                 if(u.pure_known && !u.pure) return true; // An impure function called
//                 if(!u.pure_known && e.ident.index != std::size_t(&f - func_list.data())) // Recursion is ignored
//                 {
//                     //std::cerr << "Function " << f.name << " calls unknown function " << u.name << '\n';
//                     unknown_functions = true; // An unknown function called
//                 }
//             }
//             return false;
//         });
//         // If found side-effects, mark impure. If nothing of that sort was found
//         // and all called functions were known pure, mark this function also pure.
//         if(side_effects || !unknown_functions)
//         {
//             f.pure_known = true;
//             f.pure       = !side_effects;
//             //std::cerr << "Function " << f.name << (f.pure ? " is pure\n" : " may have side-effects\n");
//             return true; // improvements found; restart the do-while loop
//         }
//         return false;
//     }));
//     for(auto& f: func_list)
//         if(!f.pure_known)
//             std::cerr << "Could not figure out whether " << f.name << " is a pure function\n";
// }

const forEachExpression = (
  expression: EXPRESSION,
  inclusive: boolean,
  fn: (EXPRESSION) => unknown,
) => {
  // DFS callback execution on all the subtree
  return (
    expression.params.some((param) => forEachExpression(param, true, fn)) ||
    (inclusive && fn(expression))
  );
};

const isPure = (
  context: CONTEXT,
  expression: EXPRESSION,
  evaluateParameters = true,
): boolean => {
  // if any parameter is not pure, the expression is not pure
  if (
    evaluateParameters &&
    expression.params.some((p) => !isPure(context, p))
  ) {
    return false;
  }

  switch (expression.type) {
    case EXPRESSION_TYPE.FUNCTION_CALL:
      {
        const callParam = expression.params[0];
        const isFunctionIdentifier =
          callParam.type === EXPRESSION_TYPE.IDENTIFIER &&
          callParam.value.type === IDENTIFIER_TYPE.FUNCTION;

        // exclude native 'functions' (they all have side effects)
        if (isFunctionIdentifier && callParam.value.index >= 0) {
          const func = context.functions[callParam.value.index];

          if (func.isPure && func.isPureDetermined) {
            return true;
          }
        }

        return false;
      }
      break;
    case EXPRESSION_TYPE.COPY:
    case EXPRESSION_TYPE.RETURN:
    case EXPRESSION_TYPE.LOOP:
      return false;
    default:
      return true;
  }
};

const equalExpressions = (a: EXPRESSION, b: EXPRESSION) =>
  a &&
  b &&
  a.type === b.type &&
  a.params.length === b.params.length &&
  a.params.every((_, i) => equalExpressions(a.params[i], b.params[i])) &&
  (a as VALUE_EXPRESSION).value === (b as VALUE_EXPRESSION).value;

const simplifyExpression = (
  context: CONTEXT,
  expression: EXPRESSION,
  func: FUNCTION,
) => {
  // adopt parameters of child operations of the same type
  if (
    expression.type === EXPRESSION_TYPE.ADD ||
    expression.type === EXPRESSION_TYPE.MUL ||
    expression.type === EXPRESSION_TYPE.DIV ||
    expression.type === EXPRESSION_TYPE.AND ||
    expression.type === EXPRESSION_TYPE.OR ||
    expression.type === EXPRESSION_TYPE.COMMA
  ) {
    for (let i = 0; i < expression.params.length; i++) {
      if (expression.params[i].type === expression.type)
        expression.params.splice(i, 1, ...expression.params[i].params);
    }
  }

  switch (expression.type) {
    case EXPRESSION_TYPE.AND:
      {
        expression.params = expression.params.filter(
          (p) => p.type !== EXPRESSION_TYPE.NUMBER || p.value === 0,
        );

        const fixerIndex = expression.params.findIndex(
          (p) => p.type === EXPRESSION_TYPE.NUMBER && p.value === 0,
        );
        if (fixerIndex !== -1) {
          // Find the last non-pure param before that constant
          let lastNonPureIndex = fixerIndex - 1;
          while (
            lastNonPureIndex >= 0 &&
            isPure(context, expression.params[lastNonPureIndex])
          ) {
            lastNonPureIndex--;
          }

          expression.params = expression.params.filter(
            (_, i) => i <= lastNonPureIndex,
          );

          // replace with comma with fixed output: "a && b && 0 && c" => (a && b, 0)

          Object.assign(
            expression,
            makeOpExp(
              EXPRESSION_TYPE.COMMA,
              { ...expression },
              makeNumberExp(0),
            ),
          );
        }
      }
      break;
    case EXPRESSION_TYPE.OR:
      {
        expression.params = expression.params.filter(
          (p) => p.type !== EXPRESSION_TYPE.NUMBER || p.value !== 0,
        );

        const fixerIndex = expression.params.findIndex(
          (p) => p.type === EXPRESSION_TYPE.NUMBER && p.value !== 0,
        );

        if (fixerIndex !== -1) {
          // Find the last non-pure param before that constant
          let lastNonPureIndex = fixerIndex;
          while (
            lastNonPureIndex >= 0 &&
            isPure(context, expression.params[lastNonPureIndex])
          ) {
            lastNonPureIndex--;
          }

          expression.params = expression.params.filter(
            (_, i) => i <= lastNonPureIndex,
          );

          // replace with comma with fixed output: "a && b && 0 && c" => (a && b, 0)
          Object.assign(
            expression,
            makeOpExp(EXPRESSION_TYPE.COMMA, expression, makeNumberExp(1)),
          );
        }
      }
      break;
    case EXPRESSION_TYPE.EQ:
      {
        if (equalExpressions(expression.params[0], expression.params[1])) {
          Object.assign(expression, makeNumberExp(1));
        } else if (
          expression.params[0].type === expression.params[1].type &&
          [EXPRESSION_TYPE.STRING, EXPRESSION_TYPE.NUMBER].includes(
            expression.params[0].type,
          )
        ) {
          Object.assign(
            expression,
            makeNumberExp(
              Number(
                (expression.params[0] as VALUE_EXPRESSION).value ===
                  (expression.params[1] as VALUE_EXPRESSION).value,
              ),
            ),
          );
        }
      }
      break;
    case EXPRESSION_TYPE.MUL:
      {
        let literalMul = 1;
        // filter and accumulate numerical literals
        expression.params = expression.params.filter((p) => {
          if (p.type === EXPRESSION_TYPE.NUMBER) {
            literalMul *= p.value;
            return false;
          }

          return true;
        });
        // if product of literal is not 1 then add it back to the mul parameters
        if (literalMul !== 1) expression.params.push(makeNumberExp(literalMul));
      }
      break;
    case EXPRESSION_TYPE.DIV:
      {
        let literalDiv = 1;
        // filter and accumulate numerical literals
        expression.params = expression.params.filter((p, index) => {
          if (index > 0 && p.type === EXPRESSION_TYPE.NUMBER) {
            literalDiv *= p.value;
            return false;
          }

          return true;
        });

        if (expression.params[0].type === EXPRESSION_TYPE.NUMBER) {
          // if first digit is number then divide it by the accumated literal
          expression.params[0].value = Math.floor(
            expression.params[0].value / literalDiv,
          );
        } else if (literalDiv !== 1)
          // if product of literal is not one add it back to the div parameters
          expression.params.push(makeNumberExp(literalDiv));
      }
      break;
    case EXPRESSION_TYPE.ADD:
      {
        let literalSum = 0;
        // filter and sum numerical literals
        expression.params = expression.params.filter((p) => {
          if (p.type === EXPRESSION_TYPE.NUMBER) {
            literalSum += p.value;
            return false;
          }

          return true;
        });
        // if sum of literal is not zero add it back to the sum parameters
        if (literalSum !== 0) expression.params.push(makeNumberExp(literalSum));

        // Adopt all negated sums
        for (let i = 0; i < expression.params.length; i++) {
          if (
            expression.params[i].type === EXPRESSION_TYPE.NEG &&
            expression.params[i].params[0].type === EXPRESSION_TYPE.ADD
          ) {
            expression.params.splice(
              i,
              1,
              ...expression.params[i].params[0].params.map((p) =>
                makeOpExp(EXPRESSION_TYPE.NEG, p),
              ),
            );
          }
        }

        // reverse sum is count of neg parameters is greater than count on non negated
        if (
          expression.params.filter((p) => p.type === EXPRESSION_TYPE.NEG)
            .length >
          expression.params.length / 2
        ) {
          expression.type = EXPRESSION_TYPE.NEG;
          const newParams = expression.params.map((p) =>
            makeOpExp(EXPRESSION_TYPE.NEG, p),
          );

          expression.params = [makeOpExp(EXPRESSION_TYPE.ADD, ...newParams)];
        }
      }
      break;
    case EXPRESSION_TYPE.NEG:
      if (expression.params[0].type === EXPRESSION_TYPE.NUMBER) {
        // If the parameter is a literal number negate it
        expression.params[0].value = -expression.params[0].value;
        Object.assign(expression, expression.params[0]);
      } else if (expression.params[0].type === EXPRESSION_TYPE.NEG) {
        // if negate parameter is another negate remove boths
        Object.assign(expression, expression.params[0].params[0]);
      }
      break;
    case EXPRESSION_TYPE.COMMA:
      // for all params BUT the last one (that must be always preserved)
      for (let i = 0; i < expression.params.length - 1; ) {
        const param = expression.params[i];
        if (isPure(context, param)) {
          // if param is pure we can remove it completely
          expression.params.splice(i, 1);
        } else if (
          param.type !== EXPRESSION_TYPE.AND &&
          param.type !== EXPRESSION_TYPE.OR &&
          isPure(context, param, false)
        ) {
          // if operation is pure but parameters are not we can remove operation and adopt its parameters
          // AND and OR must be preserved as they execute code conditionally
          expression.params.splice(i, 1, ...expression.params[i].params);
        } else {
          i++;
        }
      }

      break;
    case EXPRESSION_TYPE.COPY:
      break;
  }

  // arithmetic ops and commas with only one parameters can be reduced to the parameter itself
  if (
    expression.params.length === 1 &&
    [
      EXPRESSION_TYPE.ADD,
      EXPRESSION_TYPE.MUL,
      EXPRESSION_TYPE.DIV,
      EXPRESSION_TYPE.MOD,
      EXPRESSION_TYPE.COMMA,
    ].includes(expression.type)
  ) {
    Object.assign(expression, expression.params[0]);
  }

  // logical ops with only one parameters can be reduced to the parameter itself (Casted as boolean) "&&(a) => a != 0 => ((a == 0) == 0)"
  if (
    expression.params.length === 1 &&
    [EXPRESSION_TYPE.AND, EXPRESSION_TYPE.OR].includes(expression.type)
  ) {
    Object.assign(
      expression,
      makeOpExp(
        EXPRESSION_TYPE.EQ,
        makeOpExp(
          EXPRESSION_TYPE.EQ,
          { ...expression.params[0] },
          makeNumberExp(0),
        ),
        makeNumberExp(0),
      ),
    );
  }

  // arithmetic ops and or with zero parameters can be reduced to 0
  if (
    expression.params.length === 0 &&
    [
      EXPRESSION_TYPE.ADD,
      EXPRESSION_TYPE.MUL,
      EXPRESSION_TYPE.DIV,
      EXPRESSION_TYPE.MOD,
      EXPRESSION_TYPE.OR,
    ].includes(expression.type)
  ) {
    Object.assign(expression, makeNumberExp(0));
  }
  // AND with zero parameters can be reduced to 1
  if (
    expression.params.length === 0 &&
    [EXPRESSION_TYPE.AND].includes(expression.type)
  ) {
    Object.assign(expression, makeNumberExp(1));
  }

  func;
};

const optimiseAst = (context: CONTEXT): CONTEXT => {
  let status = printAstTree(context);
  let newStatus = status;
  let passes = 0;

  do {
    console.log('-------');
    console.log(`Pass ${passes} status`);
    console.log(newStatus);
    passes++;
    status = newStatus;

    context.functions.forEach((f) => {
      forEachExpression(f.code, true, (e: EXPRESSION) =>
        simplifyExpression(context, e, f),
      );
    });
    newStatus = printAstTree(context);
  } while (status !== newStatus);

  console.log('-------');
  console.log('Final status');
  console.log(newStatus);

  console.log(`Optimised after ${passes} passes`);
  return context;
};

export default optimiseAst;
