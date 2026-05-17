# tree-sitter-grain

[tree-sitter](https://tree-sitter.github.io/) grammar for the [Grain](https://grain-lang.org/) programming language.

## How to generate

```sh
npm run build
```

or for wasm:
```sh
npm run build-wasm
```

## Grain stdlib validation

Clones the [grain-lang/grain](https://github.com/grain-lang/grain) repository, then parses every `.gr` file under `stdlib/` with this grammar. This is the same check CI runs.

With nix:

```sh
nix develop -c npm run test:validate
```

Without nix just make sure you have the correct dependencies and run
```sh
npm run test:validate
```

By default the script resolves the Grain ref to the latest GitHub release tag. If that lookup fails locally, it falls back to `main`.

To use a specific Grain ref (tag, branch, or commit):

(omit `nix develop -c` if not using nix)
```sh
nix develop -c npm run test:validate -- --grain-ref main
# or
GRAIN_REF=main nix develop -c npm run test:validate
```

Use an existing Grain checkout instead of cloning:

(omit `nix develop -c` if not using nix)
```sh
GRAIN_ROOT=/path/to/grain nix develop -c npm run test:validate
```

`--grain-ref` overrides `GRAIN_ROOT` and `GRAIN_REF`. A shallow clone is written to `grain/` in the repo root.