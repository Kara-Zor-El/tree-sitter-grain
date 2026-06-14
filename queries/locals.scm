; Scopes
(program) @local.scope
(block_expression) @local.scope
(lambda_expression) @local.scope
(for_expression) @local.scope
(while_expression) @local.scope
(match_branch) @local.scope
(match_body) @local.scope
(module_declaration) @local.scope

; Definitions
(variable_pattern) @local.definition.var

(record_pattern
  (qualified_identifier) @local.definition.var)

(foreign_declaration name: (_) @local.definition.var)
(foreign_declaration alias: (_) @local.definition.var)
(primitive_declaration name: (_) @local.definition.var)

(type_alias name: (upper_identifier) @local.definition.type)
(enum_declaration name: (upper_identifier) @local.definition.type)
(record_type_declaration name: (upper_identifier) @local.definition.type)
(exception_declaration name: (upper_identifier) @local.definition.type)
(type_variable) @local.definition.type

(module_declaration name: (upper_identifier) @local.definition.namespace)
(module_header name: (upper_identifier) @local.definition.namespace)
(include_declaration alias: (qualified_type_identifier) @local.definition.namespace)

; References
(identifier_expression) @local.reference
(punned_record_field) @local.reference

(type_variable_ref) @local.reference
(qualified_type_identifier) @local.reference
