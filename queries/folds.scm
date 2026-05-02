; Folding regions for Grain

[
  ; Nested modules and blocks
  (module_declaration)
  (block_expression)

  ; Control flow
  (if_expression)
  (while_expression)
  (for_expression)
  (match_expression)

  ; Closures
  (lambda_expression)

  ; Calls with explicit argument lists
  (application_expression)

  ; Aggregate literals
  (record_expression)
  (tuple_expression)
  (list_expression)
  (array_expression)

  ; Types with bodies
  (enum_declaration)
  (record_type_declaration)
  (data_constructor_record)

  ; Export / import shapes `{ ... }`
  (provide_shape)

  ; Patterns (match arms, destructuring)
  (record_pattern)
  (tuple_pattern)
  (list_pattern)
  (array_pattern)

  ; Doc / block comments
  (block_comment)
  (doc_comment)

  ; Repeated `@prefix`'s on one declaration
  (attributes)
] @fold
