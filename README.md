# MS

**WORK IN PROGRESS**

MS is my own functional language.
The bootstrapping language is typescript :O

## Objectives

- [x] Compiled to a native instruction set (only x86_64 for now) (compile to AMS and then to executable using FASM)
- [ ] [Turing-complete](./examples/rule110.ms)
- [ ] Statically typed
- [ ] [Self-hosted](<https://en.wikipedia.org/wiki/Self-hosting_(compilers)>)
- [ ] Tree shaking (remove unused code)
- [ ] Native automatic chaining ( function `f(a, b)` can be written as `a->f(type b)`)
- [ ] Native partial method application
- [ ] Optimized
- [ ] Remove FASM dependency
- [ ] Crossplatform
