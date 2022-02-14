# Rain

**WORK IN PROGRESS**

Rain is my own functional language.
The bootstrapping language is typescript :O

## Objectives

- [x] Compiled to a native instruction set (only x86_64 for now) (compile to AMS and then to executable using FASM)
- [ ] [Turing-complete](./examples/rule110.ms)
- [ ] Statically typed
- [ ] [Self-hosted](<https://en.wikipedia.org/wiki/Self-hosting_(compilers)>)
- [ ] Native automatic chaining ( function `g(f(a, b),c)` can be written as `a->f(b)->g(c)`)
- [ ] Tree shaking (remove unused code)
- [ ] Native partial method application
- [ ] Optimized
- [ ] Remove FASM dependency
- [ ] Crossplatform
