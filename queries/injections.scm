; Markdown on prose fragments only (margins excluded via grammar).

((doc_preamble
  (doc_content_text) @injection.content)
  (#set! injection.language "markdown"))

((doc_param
  (doc_body_multiline
    (doc_content_text) @injection.content))
  (#set! injection.language "markdown"))

((doc_returns
  (doc_body_multiline
    (doc_content_text) @injection.content))
  (#set! injection.language "markdown"))

((doc_throws
  (doc_body_multiline
    (doc_content_text) @injection.content))
  (#set! injection.language "markdown"))

((doc_deprecated
  (doc_body_multiline
    (doc_content_text) @injection.content))
  (#set! injection.language "markdown"))

((doc_unknown_tag
  (doc_body_multiline
    (doc_content_text) @injection.content))
  (#set! injection.language "markdown"))

((doc_example
  (doc_example_inline_code) @injection.content)
  (#set! injection.language "grain"))

((doc_example_body_line
  (doc_example_line_code) @injection.content)
  (#set! injection.language "grain"))
