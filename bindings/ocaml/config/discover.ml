module C = Configurator.V1

let () =
  C.main ~name:"tree-sitter-grain" (fun c ->
    match C.Pkg_config.get c with
    | None -> C.die "pkg-config is required (opam package conf-pkg-config)"
    | Some pc -> (
        match C.Pkg_config.query pc ~package:"tree-sitter" with
        | None ->
            C.die
              "pkg-config could not find tree-sitter. Install the Tree-sitter \
               library and its pkg-config file."
        | Some { cflags; libs } ->
            C.Flags.write_sexp "cflags.sexp" cflags;
            C.Flags.write_sexp "clibs.sexp" libs))
