# Type system

## native types

int64
int8 (alias: char, byte, bool)
string

void
never
pointer

## define type

```
type name = {
  a: type,
  b: type
}
```

## type casting

const myvalue :myType = @myType

## generics and reflectivity
