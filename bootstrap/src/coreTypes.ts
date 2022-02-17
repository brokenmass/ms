export enum VALUE_TYPE {
  VOID = 'void',
  NEVER = 'never',
  INT64 = 'int64',
  STRING = 'string',
  CHAR = 'char',
  POINTER = 'pointer',
  BOOL = 'boolean',
}

export type itemType = {
  name: string;
  length?: number;
  attributes?: {
    [key: string]: itemType & { offset: number };
  };
};

// const int64: itemType = {
//   name: 'int64',
//   length: 8,
// }

// const char: itemType = {
//   name: 'char',
//   length: 1,
// }

// const int64: itemType = {
//   name: 'int64',
//   length: 8,
// }
