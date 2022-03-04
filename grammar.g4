grammar rain;

WS : [ \t\r\n]+ -> skip ; // skip spaces, tabs, newlines
IDENTIFIER: [a-zA-Z_][a-zA-Z0-9_]+;
NUMCONST: [0-9]+;
CHARCONST: '\'' . '\'';
STRINGCONST: '"' [^"] '"';
oneOrMoreID: IDENTIFIER (',' IDENTIFIER)*;

function: 'function' IDENTIFIER '(' oneOrMoreID? ')' '{' statement '}';

statement: '{' statement* '}'
 | 'if' '(' exprs ')'  statement ('else' statement )?
 | 'while' '(' exprs ')' statement
 | 'return' '(' exprs ')' ';'
 | exprs ';'
 | ';';

exprs:  'var' IDENTIFIER ('=' expression)? (',' IDENTIFIER ('=' expression)?)*
  | 'const' IDENTIFIER '=' expression (',' IDENTIFIER '=' expression)*
  | expression (',' expression)*;

expression: NUMCONST
  | CHARCONST
  | STRINGCONST
  | IDENTIFIER
  | '(' exprs ')'
  | '[' exprs ']'
  | expression '(' (expression (',' expression)* )? ')'
  | ('++' | '--' | '!' | '@' | '#' ) expression
  | expression ('++' | '--')
  | expression ('*'|'/' | '%') expression
  | expression ('+'|'-') expression
  | expression ('<<'|'>>') expression
  | expression ('<'|'<=' | '>' | '>=') expression
  | expression ('=='|'!=') expression
  | expression ('&') expression
  | expression ('^') expression
  | expression ('|') expression
  | expression ('&&') expression
  | expression ('||') expression
  | expression '=' expression;