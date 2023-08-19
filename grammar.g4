grammar rain;

WS : [ \t\v\r\n]+ -> skip ; // skip spaces, tabs, newlines
IDENTIFIER: [a-zA-Z_][a-zA-Z0-9_]+;
NUMCONST: [0-9]+ | '0x'[0-9A-Fa-f]+ | '0b'[01]+;
CHARCONST: '\'' . '\'';
STRINGCONST: '"' [^"] '"';
oneOrMoreID: IDENTIFIER (':' IDENTIFIER '[]'*) (',' IDENTIFIER (':' IDENTIFIER '[]'*))*;

type: IDENTIFIER ('[' expression ']')*;
function: 'function' IDENTIFIER '(' oneOrMoreID? ')' '{' statement '}';

statement: '{' statement* '}'
 | 'if' '(' expressionOrDeclaration ')'  statement ('else' statement )?
 | 'while' '(' expressionOrDeclaration ')' statement
 | 'return' '(' expressionOrDeclaration ')' ';'
 | expressionOrDeclaration ';'
 | ';';

expressionOrDeclaration:  'var' IDENTIFIER (':' type)? ('=' expression)? (',' IDENTIFIER (':' type)? ('=' expression)?)*
  | 'const' IDENTIFIER (':' type)? '=' expression (',' IDENTIFIER (':' type)? '=' expression)*
  | expression (',' expression)*;

expression: NUMCONST
  | CHARCONST
  | STRINGCONST
  | IDENTIFIER
  | '(' expressionOrDeclaration ')'
  | '[' expressionOrDeclaration ']'
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
  | expression ('=') expression;