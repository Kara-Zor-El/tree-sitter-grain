# tree-sitter-grain

The [tree-sitter](https://tree-sitter.github.io/) grammar for the [Grain](https://grain-lang.org/) programming language.

This grammar exists for tree-sitter based tooling (e.g. editors, language servers, syntax highlighters).

## Contributing

The main grammar itself lives in `./grammar.js` and is closely aligned to [grains grammar](https://github.com/grain-lang/grain/blob/main/compiler/src/parsing/parser.mly).

## Generating

In order to build the project you can run:

```sh
npm run build
``` 

or if you want to generate the wasm bindings:

```sh
npm run build-wasm
```

## Testing

A testing script has been setup in `test.mjs`, the tests clone the grain, repo and run the parser against the stdlib checking if any errors exist in the parse tree.

The tests can be run using `npm run test:validate`, it's best to run them locally as they must pass before merging, by default the tests are run against the `main` branch of grain however if you want to run them against a specific version you can run `npm run test:validate --commit=grain-v0.7.2` for example.

As a note this is a quick test of the validity of the parser and ensures that new syntax being introduced and consumed in the stdlib parses correctly however it does not test that the parse tree is being formed correctly or that the grammar aligns perfectly with grains. 