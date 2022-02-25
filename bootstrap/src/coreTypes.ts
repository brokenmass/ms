export enum VALUE_FAMILY {
  INTEGER = 'int',
  STRUCT = 'struct',
  POINTER = 'pointer',
  VOID = 'void',
}

type BASIC_VALUE = {
  family: VALUE_FAMILY;
  size: number;
  name: string;
};

export type INTEGER_FAMILY = BASIC_VALUE & {
  family: VALUE_FAMILY.INTEGER;
  signed: boolean;
};

export type STRUCT_FAMILY = BASIC_VALUE & {
  family: VALUE_FAMILY.STRUCT;
  fields: {
    offset: number;
    name: string;
    type: VALUE_TYPE;
  }[];
};

export type POINTER_FAMILY = BASIC_VALUE & {
  family: VALUE_FAMILY.POINTER;
  type: VALUE_TYPE;
};

export type VOID_FAMILY = BASIC_VALUE & {
  family: VALUE_FAMILY.VOID;
};

export type VALUE_TYPE =
  | INTEGER_FAMILY
  | STRUCT_FAMILY
  | POINTER_FAMILY
  | VOID_FAMILY;

const myVoid: VOID_FAMILY = {
  family: VALUE_FAMILY.VOID,
  size: 0,
  name: 'void',
};
const int: INTEGER_FAMILY = {
  family: VALUE_FAMILY.INTEGER,
  size: 8,
  name: 'int',
  signed: true,
};
const bool: INTEGER_FAMILY = {
  family: VALUE_FAMILY.INTEGER,
  size: 1,
  name: 'bool',
  signed: false,
};
const char: INTEGER_FAMILY = {
  family: VALUE_FAMILY.INTEGER,
  size: 1,
  name: 'char',
  signed: false,
};

const genericPointer: POINTER_FAMILY = {
  family: VALUE_FAMILY.POINTER,
  size: 8,
  name: 'pointer',
  type: myVoid,
};

const string: STRUCT_FAMILY = {
  family: VALUE_FAMILY.STRUCT,
  size: 16,
  name: 'string',
  fields: [
    {
      name: 'length',
      offset: 0,
      type: int,
    },
    {
      name: 'buffer',
      offset: 8,
      type: {
        ...genericPointer,
        type: char,
      },
    },
  ],
};

export { genericPointer };

export const types: Record<string, VALUE_TYPE> = {
  int,
  bool,
  char,
  string,
  void: myVoid,
};
