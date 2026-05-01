{
  "targets": [
    {
      "target_name": "tree_sitter_grain_binding",
      "dependencies": [
        "<!(node -p \"require('node-addon-api').targets\"):node_addon_api_except",
      ],
      "include_dirs": [
        "src",
      ],
      "sources": [
        "bindings/node/binding.cc",
        "src/parser.c",
      ],
      "cflags_c": [
        "-std=c11",
        "-Wno-unused-value",
      ],
      "xcode_settings": {
        "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
        "OTHER_CFLAGS": [
          "-Wno-unused-value",
        ],
      },
    },
  ],
}
