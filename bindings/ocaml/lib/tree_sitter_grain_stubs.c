#include <caml/alloc.h>
#include <caml/memory.h>
#include <caml/mlvalues.h>

#include <tree_sitter/api.h>

const TSLanguage *tree_sitter_grain(void);

CAMLprim value caml_tree_sitter_grain_language(value unit) {
  CAMLparam1(unit);
  const TSLanguage *lang = tree_sitter_grain();
  CAMLreturn(caml_copy_nativeint((intnat)lang));
}
