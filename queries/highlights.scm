; Highlights for Grain (nvim-treesitter / Helix-compatible captures)
;
; Note: tree-sitter's query language reserves some names as node types, so
; tokens like "continue", "break", and "void" cannot be matched as anonymous
; terminals — use surrounding named nodes instead.

; Neovim: sets 'commentstring' for built-in commenting when treesitter highlights
; are active (:help treesitter-highlight-commentstring).
((program) @_grain (#set! @_grain bo.commentstring "// %s"))

; Comments (`//` line, `/* */` block, `/** */` doc)
(line_comment) @comment @comment.line @spell

(block_comment) @comment @comment.block @spell

(doc_comment) @comment @comment.documentation @spell

(doc_comment_margin) @comment @comment.documentation @spell

; Structured block / doc comments: preamble + `doc_directive` (`@param`, `@since`, …)
(doc_preamble) @spell

(doc_example
  "@example" @keyword.directive)

(doc_since
  "@since" @keyword.directive)

(doc_history
  "@history" @keyword.directive)

(doc_param
  "@param" @keyword.directive)

(doc_returns
  "@returns" @keyword.directive)

(doc_throws
  "@throws" @keyword.directive)

(doc_deprecated
  "@deprecated" @keyword.directive)

(doc_unknown_tag
  (doc_tag_name) @keyword.directive)

(semver_valid) @number

((semver_invalid) @comment.error @error @diagnostic.error @nospell)

; Attributes
(attribute
  "@" @punctuation.special)

(attribute
  (identifier) @attribute)

(attribute
  (special_identifier) @attribute)

; Literals
[
  (number_literal)
  (int8_literal)
  (int16_literal)
  (int32_literal)
  (int64_literal)
  (uint8_literal)
  (uint16_literal)
  (uint32_literal)
  (uint64_literal)
  (wasmi32_literal)
  (wasmi64_literal)
  (bigint_literal)
] @number

[
  (float_literal)
  (float32_literal)
  (float64_literal)
  (wasmf32_literal)
  (wasmf64_literal)
] @number.float

(rational_literal) @number.float

(boolean) @boolean

(void) @constant.builtin

(string) @string
(char) @character
(bytes) @string.special

(string
  (escape_sequence) @string.escape)

(bytes
  (escape_sequence) @string.escape)

(char
  (escape_sequence) @string.escape)

; Identifiers
(identifier) @variable

(upper_identifier) @type

(special_identifier) @variable

; Paths — leading module/type segments (Foo.Bar.baz)
(qualified_identifier
  (upper_identifier) @module)

(qualified_identifier
  .
  (upper_identifier)
  .
  (upper_identifier) @module)

(qualified_type_identifier
  (upper_identifier) @module)

(module_header
  name: (upper_identifier) @module)

; Operators given dedicated nodes
(prefix_operator) @operator
(assignment_operator) @operator
(custom_infix_operator) @operator
(infix_60_operator) @operator
(infix_70_operator) @operator
(infix_100_operator) @operator

(binary_expression
  operator: _ @operator)

(unary_expression
  operator: _ @operator)

; Keywords (anonymous terminals — excludes query-reserved spellings:
; break, continue, void, await, import, …)
[
  "module"
  "let"
  "foreign"
  "wasm"
  "from"
  "primitive"
  "exception"
  "abstract"
  "type"
  "enum"
  "record"
  "mut"
  "rec"
  "and"
  "true"
  "false"
  "is"
  "isnt"
] @keyword

[
  "use"
  "include"
  "provide"
] @keyword.import

[
  "throw"
  "assert"
  "fail"
] @keyword.exception

[
  "if"
  "else"
  "match"
] @keyword.conditional

[
  "while"
  "for"
] @keyword.repeat

(continue_expression) @keyword.repeat
(break_expression) @keyword.repeat

[
  "return"
] @keyword.return

(alias_pattern
  "as" @keyword)

(when_guard
  "when" @keyword.conditional)

(lambda_expression
  "=>" @keyword.function)

(match_branch
  "=>" @keyword.function)

(any_pattern
  "_" @character.special)

(record_get_expression
  field: (_) @variable.member)

(non_punned_record_field
  (qualified_identifier) @variable.member)

(application_argument
  label: (_) @variable.parameter)

(arrow_type
  (identifier) @variable.parameter)

; Punctuation / delimiters
[
  "("
  ")"
  "["
  "]"
  "{"
  "}"
] @punctuation.bracket

; Note: "->" is not matchable here (reserved query syntax).
; "=>" is highlighted via (lambda_expression "=>") as @keyword.function; match arms
; still look fine with that rule.
[
  ","
  ";"
  "."
  ":"
  "|"
  "..."
  ":="
  "="
  "[>"
] @punctuation.delimiter

(type_parameters
  [
    "<"
    ">"
  ] @punctuation.bracket)

(constructor_type
  [
    "<"
    ">"
  ] @punctuation.bracket)
