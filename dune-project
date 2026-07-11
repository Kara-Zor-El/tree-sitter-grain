(lang dune 3.0)
(name tree-sitter-grain)
(version 0.1.0)

(generate_opam_files false)

(package
 (name tree-sitter-grain)
 (synopsis "Grain grammar for tree-sitter")
 (depends
  (ocaml
   (>= 5.1))
  dune
  tree-sitter))
