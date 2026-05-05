; Markdown / Grain injections for doc comments.

((doc_preamble
  (doc_content_text) @injection.content)
  (#set! injection.language "markdown"))

((doc_param
  (doc_directive_body) @injection.content)
  (#set! injection.language "markdown"))

((doc_returns
  (doc_directive_body) @injection.content)
  (#set! injection.language "markdown"))

((doc_throws
  (doc_directive_body) @injection.content)
  (#set! injection.language "markdown"))

((doc_deprecated
  (doc_directive_body) @injection.content)
  (#set! injection.language "markdown"))

((doc_unknown_tag
  (doc_directive_body) @injection.content)
  (#set! injection.language "markdown"))

((doc_since
  (doc_since_body) @injection.content)
  (#set! injection.language "markdown"))

((doc_history
  (doc_history_body) @injection.content)
  (#set! injection.language "markdown"))

((doc_example
  (doc_directive_body
    (doc_same_line_body) @injection.content))
  (#set! injection.language "grain"))

((doc_example
  (doc_example_body
    (doc_example_body_line
      (doc_example_line_code) @injection.content)))
  (#set! injection.language "grain"))
