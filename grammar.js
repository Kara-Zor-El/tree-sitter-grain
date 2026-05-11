/// <reference types="tree-sitter-cli/dsl" />

// --- Helpers ---

function sep1(separator, rule) {
  return seq(rule, repeat(seq(separator, rule)));
}

function commaSep(rule) {
  return optional(commaSep1(rule));
}

function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)));
}

// Integer patterns (dec, hex, oct, bin)
const DEC_INT = /[0-9][0-9_]*/;
const HEX_INT = /0[xX][0-9a-fA-F][0-9a-fA-F_]*/;
const OCT_INT = /0[oO][0-7][0-7_]*/;
const BIN_INT = /0[bB][01][01_]*/;
const INT_PATTERN = choice(DEC_INT, HEX_INT, OCT_INT, BIN_INT);

const DEC_FLOAT_EXP = /[eE][+-]?[0-9][0-9_]*/;
const HEX_FLOAT_EXP = /[pP][+-]?[0-9][0-9_]*/;
const FLOAT_PATTERN = choice(
  seq(HEX_INT, /\.[0-9a-fA-F]+/, HEX_FLOAT_EXP),
  seq(HEX_INT, HEX_FLOAT_EXP),
  seq(/[0-9][0-9_]*/, /\.[0-9][0-9_]*/, optional(DEC_FLOAT_EXP)),
  seq(/[0-9][0-9_]*/, DEC_FLOAT_EXP),
  choice("Infinity", "NaN"),
);

const PREC = {
  SEMI: 1,
  ASSIGN: 2,
  INFIX_30: 3,
  INFIX_40: 4,
  INFIX_50: 5,
  PIPE_PAT: 5,
  INFIX_60: 6,
  INFIX_70: 7,
  INFIX_80: 8,
  INFIX_90: 9,
  INFIX_100: 10,
  INFIX_110: 11,
  INFIX_120: 12,
  PREFIX: 15,
  CALL: 16,
  ACCESS: 17,
  ANNOTATE: 18,
};

export default grammar({
  name: "grain",

  extras: ($) => [/\s/, $.line_comment, $.block_comment, $.doc_comment],

  word: ($) => $.identifier,

  supertypes: ($) => [
    $._expression,
    $._pattern,
    $._type,
    $._toplevel_statement,
  ],

  conflicts: ($) => [
    [$.module_header, $._module_body],
    [$._simple_expression, $.constant_pattern],
    [$.variable_pattern, $.qualified_identifier],
    [$.list_expression, $.list_pattern],
    [$.array_expression, $.array_pattern],
    [$.identifier_expression, $.punned_record_field],
    [$.identifier_expression, $.non_punned_record_field],
    [$.identifier_expression, $.punned_record_field, $._record_pattern_field],
    [
      $.identifier_expression,
      $.non_punned_record_field,
      $._record_pattern_field,
    ],
    [$.punned_record_field, $._record_pattern_field],
    [$.lambda_argument, $.tuple_pattern],
    [$.lambda_argument, $.parenthesized_pattern],
    [$.application_argument, $.qualified_identifier],
    [$._arrow_type_argument, $.tuple_type],
    [$._arrow_type_argument, $.parenthesized_type],
    [$.lambda_expression, $._id_str],
  ],

  rules: {
    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L714
    program: ($) =>
      choice(
        prec(
          2,
          seq(
            optional($.attributes),
            $.module_header,
            optional($._toplevel_statements),
          ),
        ),
        // TODO: This should not be a choice
        prec(1, repeat1($._toplevel_statement)),
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L711
    module_header: ($) => seq("module", field("name", $.upper_identifier)),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L708
    _toplevel_statements: ($) =>
      seq(
        $._toplevel_statement,
        repeat(seq(optional(";"), $._toplevel_statement)),
        optional(";"),
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L694
    _toplevel_statement: ($) =>
      // TODO: Handle attributes here
      choice(
        $.let_declaration,
        $.data_declaration_statements,
        $.foreign_declaration,
        $.include_declaration,
        $.module_declaration,
        $.primitive_declaration,
        $.provide_declaration,
        $.exception_declaration,
        $.expression_statement,
      ),

    // --- Provide ---

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L377
    provide_declaration: ($) =>
      choice(
        seq(
          optional($.attributes),
          "provide",
          "let",
          optional("rec"),
          optional("mut"),
          $.value_bindings,
        ),
        seq(optional($.attributes), "provide", $._foreign_body),
        seq(optional($.attributes), "provide", $._primitive_body),
        seq(optional($.attributes), "provide", $._exception_body),
        seq(optional($.attributes), "provide", $.provide_shape),
        seq(optional($.attributes), "provide", $._module_body),
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L374
    provide_shape: ($) => seq("{", optional($._provide_items), "}"),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L371
    _provide_items: ($) => seq(commaSep1($.provide_item), optional(",")),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L365
    provide_item: ($) =>
      choice(
        seq("type", $._aliasable_uid),
        seq("module", $._aliasable_uid),
        seq("exception", $._aliasable_uid),
        $._aliasable_lid,
      ),

    // TODO: It would be nice if we could make this match the parser a bit more
    _aliasable_uid: ($) =>
      seq($.upper_identifier, optional(seq("as", $.upper_identifier))),

    // TODO: It would be nice if we could make this match the parser a bit more
    _aliasable_lid: ($) => seq($._id_str, optional(seq("as", $._id_str))),

    // --- Let ---

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L695-L698
    let_declaration: ($) =>
      seq(
        optional($.attributes),
        "let",
        optional("rec"),
        optional("mut"),
        $.value_bindings,
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L531
    let_expression: ($) =>
      seq(
        optional($.attributes),
        "let",
        optional("rec"),
        optional("mut"),
        $.value_bindings,
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L326
    value_bindings: ($) => sep1("and", $.value_binding),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L323
    value_binding: ($) =>
      seq(field("pattern", $._pattern), "=", field("value", $._expression)),

    // --- Data declarations ---
    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L362
    data_declaration_statements: ($) =>
      seq(optional($.attributes), sep1("and", $._data_declaration_statement)),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L357
    _data_declaration_statement: ($) =>
      choice(
        seq("abstract", $._data_declaration),
        seq("provide", $._data_declaration),
        $._data_declaration,
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L415
    _data_declaration: ($) =>
      choice($.type_alias, $.enum_declaration, $.record_type_declaration),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L416
    type_alias: ($) =>
      seq(
        "type",
        optional("rec"),
        field("name", $.upper_identifier),
        optional($.type_parameters),
        "=",
        $._type,
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L417
    enum_declaration: ($) =>
      seq(
        "enum",
        optional("rec"),
        field("name", $.upper_identifier),
        optional($.type_parameters),
        $.enum_body,
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L418
    record_type_declaration: ($) =>
      seq(
        "record",
        optional("rec"),
        field("name", $.upper_identifier),
        optional($.type_parameters),
        $.data_constructor_record,
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L409
    type_parameters: ($) =>
      seq("<", commaSep1($.type_variable), optional(","), ">"),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L406
    type_variable: ($) => $.identifier,

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L393
    enum_body: ($) => seq("{", commaSep1($.enum_variant), optional(","), "}"),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L388
    enum_variant: ($) =>
      seq(
        field("name", $.upper_identifier),
        optional(choice($.data_constructor_tuple, $.data_constructor_record)),
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L400
    data_constructor_tuple: ($) =>
      seq("(", commaSep1($._type), optional(","), ")"),
    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L403
    data_constructor_record: ($) =>
      seq("{", commaSep1($.record_field_declaration), optional(","), "}"),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L396
    record_field_declaration: ($) =>
      seq(
        optional("mut"),
        field("name", $._id_str),
        ":",
        field("type", $._type),
      ),

    // --- Foreign ---

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L700
    foreign_declaration: ($) => seq(optional($.attributes), $._foreign_body),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L676
    _foreign_body: ($) =>
      seq(
        "foreign",
        "wasm",
        field("name", $._id_str),
        ":",
        field("type", $._type),
        // TODO: It would be nice if we had an `as_prefix` helper like the parser
        optional(seq("as", field("alias", $._id_str))),
        "from",
        field("module", $.string),
      ),

    // --- Include ---

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L701
    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L354
    include_declaration: ($) =>
      seq(
        optional($.attributes),
        "from",
        field("path", $.string),
        "include",
        field("module", $.qualified_type_identifier),
        optional(seq("as", field("alias", $.qualified_type_identifier))),
      ),

    // --- Use ---

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L348
    // TODO: Get rid of use_tail make this match the parser better
    use_expression: ($) => seq("use", $.upper_identifier, ".", $._use_tail),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L348
    _use_tail: ($) =>
      choice(seq($.upper_identifier, ".", $._use_tail), $.use_shape),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L344
    use_shape: ($) => choice("*", seq("{", optional($._use_items), "}")),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L341
    _use_items: ($) => seq(commaSep1($.use_item), optional(",")),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L335
    use_item: ($) =>
      choice(
        seq("type", $._aliasable_uid),
        seq("module", $._aliasable_uid),
        seq("exception", $._aliasable_uid),
        $._aliasable_lid,
      ),

    // --- Module ---

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L702
    module_declaration: ($) => seq(optional($.attributes), $._module_body),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L691
    _module_body: ($) =>
      seq(
        "module",
        field("name", $.upper_identifier),
        "{",
        optional($._toplevel_statements),
        "}",
      ),

    // --- Primitive ---

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L703
    primitive_declaration: ($) =>
      seq(optional($.attributes), $._primitive_body),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L682
    _primitive_body: ($) =>
      seq(
        "primitive",
        field("name", choice($._id_str, $._primitive_name)),
        "=",
        field("value", $.string),
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L463
    _primitive_name: ($) => choice("assert", "throw", "fail"),

    // --- Exception ---

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L686
    exception_declaration: ($) =>
      seq(optional($.attributes), $._exception_body),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L686
    _exception_body: ($) =>
      prec.left(
        choice(
          seq("exception", field("name", $.upper_identifier)),
          seq(
            "exception",
            field("name", $.upper_identifier),
            "(",
            optional(seq(commaSep1($._type), optional(","))),
            ")",
          ),
          seq(
            "exception",
            field("name", $.upper_identifier),
            $.data_constructor_record,
          ),
        ),
      ),

    // --- Expressions ---

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L704
    expression_statement: ($) => $._expression,

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L234
    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L229
    _expression: ($) =>
      choice(
        $.binary_expression,
        $.annotated_expression,
        // TODO: I'm not 100% sure that this is right if you check the parser
        $.lambda_expression,
        $.assign_expression,
        $._non_assign_expression,
        $._statement_expression,
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L577
    _statement_expression: ($) =>
      choice(
        $.throw_expression,
        $.assert_expression,
        $.fail_expression,
        $.return_expression,
        $.continue_expression,
        $.break_expression,
        $.use_expression,
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L578
    throw_expression: ($) => prec.right(seq("throw", $._expression)),
    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L579
    assert_expression: ($) => prec.right(seq("assert", $._expression)),
    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L580
    fail_expression: ($) => prec.right(seq("fail", $._expression)),
    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L582
    return_expression: ($) =>
      prec.right(seq("return", optional($._expression))),
    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L583
    continue_expression: ($) => "continue",
    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L584
    break_expression: ($) => "break",

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L238
    annotated_expression: ($) =>
      // TODO: Checking the parser i'm not 100% sure that this is right
      prec(PREC.ANNOTATE, seq($._expression, ":", $._type)),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L242
    binary_expression: ($) => {
      // TODO: Link to this table
      const table = [
        [PREC.INFIX_30, choice("||", "??")],
        [PREC.INFIX_40, "&&"],
        [PREC.INFIX_50, "|"],
        [PREC.INFIX_60, $.infix_60_operator],
        [PREC.INFIX_70, $.infix_70_operator],
        [PREC.INFIX_80, choice("==", "!=", "is", "isnt")],
        [PREC.INFIX_90, choice("<", ">")],
        [PREC.INFIX_100, $.infix_100_operator],
        [PREC.INFIX_110, choice("+", "-")],
        [PREC.INFIX_120, choice("*", "/", "%")],
      ];
      return choice(
        ...table.map(([prec_val, op]) =>
          prec.left(
            prec_val,
            seq(
              field("left", $._expression),
              field("operator", op),
              field("right", $._expression),
            ),
          ),
        ),
        prec.left(
          PREC.INFIX_50,
          seq(
            field("left", $._expression),
            field("operator", $.custom_infix_operator),
            field("right", $._expression),
          ),
        ),
      );
    },

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L597
    _non_assign_expression: ($) =>
      choice(
        $._left_accessor_expression,
        $.unary_expression,
        $.if_expression,
        $.while_expression,
        $.for_expression,
        $.match_expression,
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L605
    _left_accessor_expression: ($) =>
      choice(
        $.application_expression,
        $.constructor_expression,
        $._simple_expression,
        $.array_get_expression,
        $.record_get_expression,
        $.parenthesized_expression,
        // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L502
        $.block_expression,
        $.record_expression,
        $.list_expression,
        $.array_expression,
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L436
    constructor_expression: ($) =>
      prec.dynamic(
        1,
        prec.left(
          PREC.CALL,
          choice(
            seq(
              field("constructor", $.qualified_type_identifier),
              "(",
              optional(seq(commaSep1($._expression), optional(","))),
              ")",
            ),
            seq(
              field("constructor", $.qualified_type_identifier),
              "{",
              commaSep1($._record_field),
              optional(","),
              "}",
            ),
            field("constructor", $.qualified_type_identifier),
          ),
        ),
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L497
    _simple_expression: ($) =>
      choice($._constant, $.tuple_expression, $.identifier_expression),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L493
    identifier_expression: ($) => $.qualified_identifier,

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L197
    _constant: ($) =>
      choice(
        $.number_literal,
        $.float_literal,
        $.int8_literal,
        $.int16_literal,
        $.int32_literal,
        $.int64_literal,
        $.uint8_literal,
        $.uint16_literal,
        $.uint32_literal,
        $.uint64_literal,
        $.float32_literal,
        $.float64_literal,
        $.wasmi32_literal,
        $.wasmi64_literal,
        $.wasmf32_literal,
        $.wasmf64_literal,
        $.bigint_literal,
        $.rational_literal,
        $.boolean,
        $.void,
        $.string,
        $.bytes,
        $.char,
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L423
    parenthesized_expression: ($) => seq("(", $._expression, ")"),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L623
    tuple_expression: ($) =>
      seq(
        "(",
        $._expression,
        ",",
        commaSep1($._expression),
        optional(","),
        ")",
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L503
    block_expression: ($) => seq("{", $._block_body, "}"),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L663
    _block_body: ($) =>
      seq(
        $._block_body_expression,
        repeat(seq(optional(";"), $._block_body_expression)),
        optional(";"),
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L616
    _block_body_expression: ($) => choice($.let_expression, $._expression),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L504
    record_expression: ($) =>
      seq("{", commaSep1($._record_field), optional(","), "}"),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L657
    _record_field: ($) =>
      choice(
        $.punned_record_field,
        $.non_punned_record_field,
        $.spread_record_field,
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L643
    punned_record_field: ($) => $.qualified_identifier,
    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L646
    non_punned_record_field: ($) =>
      seq($.qualified_identifier, ":", $._expression),
    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L649
    spread_record_field: ($) => seq("...", $._expression),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L430
    application_expression: ($) =>
      prec.left(
        PREC.CALL,
        seq(
          $._left_accessor_expression,
          "(",
          optional(seq(commaSep1($.application_argument), optional(","))),
          ")",
        ),
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L426
    application_argument: ($) =>
      choice(
        $._expression,
        seq(field("label", $._id_str), "=", field("value", $._expression)),
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L515
    lambda_expression: ($) =>
      prec.right(
        choice(
          seq(
            "(",
            optional(seq(commaSep1($.lambda_argument), optional(","))),
            ")",
            "=>",
            field("body", $._expression),
          ),
          seq(
            field("parameter", $.identifier),
            "=>",
            field("body", $._expression),
          ),
        ),
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L509
    lambda_argument: ($) => seq($._pattern, optional(seq("=", $._expression))),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L420
    unary_expression: ($) =>
      prec(
        PREC.PREFIX,
        seq(
          field("operator", $.prefix_operator),
          field("operand", $._non_assign_expression),
        ),
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L540
    if_expression: ($) =>
      prec.right(
        seq(
          "if",
          "(",
          field("condition", $._expression),
          ")",
          field("consequence", $._expression),
          optional(seq("else", field("alternative", $._expression))),
        ),
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L543
    while_expression: ($) =>
      seq(
        "while",
        "(",
        field("condition", $._expression),
        ")",
        field("body", $._expression),
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L550
    for_expression: ($) =>
      seq(
        "for",
        "(",
        optional($._block_body_expression),
        ";",
        optional($._expression),
        ";",
        optional($._expression),
        ")",
        field("body", $._expression),
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L562
    match_expression: ($) =>
      seq(
        "match",
        "(",
        field("value", $._expression),
        ")",
        "{",
        commaSep1($.match_branch),
        optional(","),
        "}",
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L556
    match_branch: ($) =>
      seq(
        field("pattern", $._pattern),
        optional($.when_guard),
        "=>",
        field("body", $._expression),
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L553
    when_guard: ($) => seq("when", $._expression),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L569
    list_expression: ($) =>
      choice(
        seq("[", "]"),
        seq("[", commaSep1($._list_item), optional(","), "]"),
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L565
    _list_item: ($) => choice($.spread_expression, $._expression),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L566
    spread_expression: ($) => seq("...", $._expression),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L573
    array_expression: ($) =>
      choice(
        seq("[>", "]"),
        seq("[>", commaSep1($._expression), optional(","), "]"),
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L627
    array_get_expression: ($) =>
      prec(
        PREC.ACCESS,
        seq(
          $._left_accessor_expression,
          token.immediate("["),
          $._expression,
          "]",
        ),
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L633
    record_get_expression: ($) =>
      prec(
        PREC.ACCESS,
        seq($._left_accessor_expression, ".", field("field", $._id_str)),
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L590
    assign_expression: ($) =>
      prec.right(
        PREC.ASSIGN,
        choice(
          seq($._left_accessor_expression, ":=", $._expression),
          seq($.identifier_expression, "=", $._expression),
          seq($.identifier_expression, $.assignment_operator, $._expression),
          seq(
            $._left_accessor_expression,
            ".",
            $._id_str,
            choice("=", $.assignment_operator),
            $._expression,
          ),
          seq(
            $._left_accessor_expression,
            token.immediate("["),
            $._expression,
            "]",
            choice("=", $.assignment_operator),
            $._expression,
          ),
        ),
      ),

    // --- Types ---

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L297
    _type: ($) =>
      choice(
        $.arrow_type,
        $.tuple_type,
        $.parenthesized_type,
        $.type_variable_ref,
        $.constructor_type,
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L298-L300
    arrow_type: ($) =>
      prec.right(
        1,
        seq(
          choice(
            seq(
              "(",
              optional(seq(commaSep1($._arrow_type_argument), optional(","))),
              ")",
            ),
            $.constructor_type,
            $.type_variable_ref,
          ),
          "=>",
          $._type,
        ),
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L306
    _arrow_type_argument: ($) =>
      choice(
        seq($.identifier, ":", $._type),
        seq("?", $.identifier, ":", $._type),
        $._type,
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L320
    tuple_type: ($) =>
      seq("(", $._type, ",", commaSep1($._type), optional(","), ")"),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L302
    parenthesized_type: ($) => seq("(", $._type, ")"),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L303
    type_variable_ref: ($) => $.identifier,

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L292
    constructor_type: ($) =>
      prec.left(
        1,
        choice(
          // Prefer consuming generic arguments when present (`Array<a>`),
          // instead of letting `<`/`>` get reinterpreted as binary operators.
          prec(
            2,
            seq(
              $.qualified_type_identifier,
              "<",
              commaSep1($._type),
              optional(","),
              ">",
            ),
          ),
          $.qualified_type_identifier,
        ),
      ),

    // --- Patterns ---

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L249
    _pattern: ($) =>
      choice(
        $.any_pattern,
        $.constant_pattern,
        $.variable_pattern,
        $.tuple_pattern,
        $.array_pattern,
        $.parenthesized_pattern,
        $.record_pattern,
        $.constructor_pattern,
        $.list_pattern,
        $.or_pattern,
        $.alias_pattern,
        $.typed_pattern,
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L251
    any_pattern: ($) => "_",

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L252
    constant_pattern: ($) => $._constant,

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L255-L257
    variable_pattern: ($) => choice($._id_str, $._primitive_name),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L258
    tuple_pattern: ($) =>
      seq("(", $._pattern, ",", commaSep1($._pattern), optional(","), ")"),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L259-L260
    array_pattern: ($) =>
      choice(
        seq("[>", commaSep1($._pattern), optional(","), "]"),
        seq("[>", "]"),
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L261
    parenthesized_pattern: ($) => seq("(", $._pattern, ")"),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L261-L262
    record_pattern: ($) =>
      seq("{", commaSep1($._record_pattern_field), optional(","), "}"),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L287
    _record_pattern_field: ($) =>
      choice(
        "_",
        seq($.qualified_identifier, ":", $._pattern),
        $.qualified_identifier,
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L263-L265
    constructor_pattern: ($) =>
      prec(
        1,
        choice(
          seq(
            $.qualified_type_identifier,
            "(",
            optional(seq(commaSep1($._pattern), optional(","))),
            ")",
          ),
          seq(
            $.qualified_type_identifier,
            "{",
            commaSep1($._record_pattern_field),
            optional(","),
            "}",
          ),
          $.qualified_type_identifier,
        ),
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L266-L267
    list_pattern: ($) =>
      choice(
        seq("[", "]"),
        seq("[", commaSep1($._list_pattern_item), optional(","), "]"),
      ),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L271
    _list_pattern_item: ($) => choice(seq("...", $._pattern), $._pattern),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L268
    or_pattern: ($) =>
      prec.left(PREC.PIPE_PAT, seq($._pattern, "|", $._pattern)),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L269
    alias_pattern: ($) => seq($._pattern, "as", $._id_str),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L250
    typed_pattern: ($) => prec.right(seq($._pattern, ":", $._type)),

    // --- Attributes ---

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L528
    attributes: ($) => repeat1($.attribute),

    // https://github.com/grain-lang/grain/blob/0dcc049f636d11bc857b158465c53c3831dc543e/compiler/src/parsing/parser.mly#L525
    attribute: ($) =>
      seq("@", $._id_str, optional(seq("(", commaSep($.string), ")"))),

    // --- Operators ---

    // TODO: Link to where these come from

    prefix_operator: ($) => "!",

    assignment_operator: ($) => choice("+=", "-=", "*=", "/=", "%="),

    custom_infix_operator: ($) =>
      token(
        choice(
          /\+[+\-*/%$&|^!?<>=:.]*/,
          /-[+\-*/%$&|^!?<>=:.]*/,
          /\*[+\-*/%$&|^!?<>=:.]*/,
          // Exclude `//` and `/*` prefixes so comments win lexing.
          /\/[+\-%$&|^!?<>=:.]*/,
          /%[+\-*/%$&|^!?<>=:.]*/,
          /\^[+\-*/%$&|^!?<>=:]*/,
          /&[+\-*/%$&|^!?<>=:.]*/,
          /\|[+\-*/%$&|^!?<>=:.]*/,
          /==[+\-*/%$&|^!?<>=:.]+/,
          /!=[+\-*/%$&|^!?<>=:.]+/,
          /<<[+\-*/%$&|^!?<>=:]*/,
          />>[+\-*/%$&|^!?<>=:.]*/,
          />[+\-*/%$&=^|!?<:]+/,
          /<[+\-*/%$&=^|!?>:.]+/,
        ),
      ),

    infix_60_operator: ($) => token(seq("^", /[+\-*/%$&|^!?<>=:]*/)),
    infix_70_operator: ($) => token(seq("&", /[+\-*/%$&|^!?<>=:.]*/)),
    infix_100_operator: ($) =>
      choice(
        token(seq("<<", /[+\-*/%$&|^!?<>=:]*/)),
        token(seq(">>", /[+\-*/%$&=^|!?<:.]*/)),
      ),

    // --- Identifiers ---

    _id_str: ($) => choice($.identifier, $.special_identifier),

    special_identifier: ($) => seq("(", $._operator, ")"),

    _operator: ($) =>
      choice(
        $.custom_infix_operator,
        $.infix_60_operator,
        $.infix_70_operator,
        $.infix_100_operator,
        "!",
        "||",
        "??",
        "&&",
        "==",
        "!=",
        "is",
        "isnt",
        "+",
        "*",
        "/",
        "-",
        "%",
        "|",
        "<",
        ">",
      ),

    qualified_identifier: ($) =>
      choice(
        // One-module path: `WasmI32.fromGrain`
        prec(1, seq($.upper_identifier, ".", $._id_str)),
        // Multi-module path: `Foo.Bar.baz`
        prec(
          1,
          seq(
            $.upper_identifier,
            ".",
            $.upper_identifier,
            repeat(seq(".", $.upper_identifier)),
            ".",
            $._id_str,
          ),
        ),
        $._id_str,
      ),

    module_path: ($) => prec.right(sep1(".", $.upper_identifier)),

    qualified_type_identifier: ($) => prec.right(sep1(".", $.upper_identifier)),

    // --- Literals ---

    // TODO: Link to where these come from

    number_literal: ($) => token(seq(optional("-"), INT_PATTERN)),
    float_literal: ($) => token(seq(optional("-"), FLOAT_PATTERN)),
    int8_literal: ($) => token(seq(optional("-"), INT_PATTERN, "s")),
    int16_literal: ($) => token(seq(optional("-"), INT_PATTERN, "S")),
    int32_literal: ($) => token(seq(optional("-"), INT_PATTERN, "l")),
    int64_literal: ($) => token(seq(optional("-"), INT_PATTERN, "L")),
    uint8_literal: ($) => token(seq(optional("-"), INT_PATTERN, "us")),
    uint16_literal: ($) => token(seq(optional("-"), INT_PATTERN, "uS")),
    uint32_literal: ($) => token(seq(optional("-"), INT_PATTERN, "ul")),
    uint64_literal: ($) => token(seq(optional("-"), INT_PATTERN, "uL")),
    float32_literal: ($) => token(seq(optional("-"), FLOAT_PATTERN, "f")),
    float64_literal: ($) => token(seq(optional("-"), FLOAT_PATTERN, "d")),
    wasmi32_literal: ($) => token(seq(optional("-"), INT_PATTERN, "n")),
    wasmi64_literal: ($) => token(seq(optional("-"), INT_PATTERN, "N")),
    wasmf32_literal: ($) => token(seq(optional("-"), FLOAT_PATTERN, "w")),
    wasmf64_literal: ($) => token(seq(optional("-"), FLOAT_PATTERN, "W")),
    bigint_literal: ($) => token(seq(optional("-"), INT_PATTERN, "t")),
    rational_literal: ($) =>
      token(
        seq(optional("-"), INT_PATTERN, "/", optional("-"), INT_PATTERN, "r"),
      ),

    boolean: ($) => choice("true", "false"),
    void: ($) => "void",

    string: ($) =>
      seq('"', repeat(choice($.escape_sequence, $.string_content)), '"'),

    string_content: ($) => token.immediate(prec(1, /[^"\\]+/)),

    bytes: ($) =>
      seq('b"', repeat(choice($.escape_sequence, $.bytes_content)), '"'),

    bytes_content: ($) => token.immediate(prec(1, /[^"\\]+/)),

    char: ($) => seq("'", choice($.escape_sequence, $.char_content), "'"),

    char_content: ($) => token.immediate(prec(1, /[^'\\]+/)),

    escape_sequence: ($) =>
      token.immediate(
        seq(
          "\\",
          choice(
            /[\\'"nrtbfv0]/,
            "/",
            /x[0-9a-fA-F]{1,2}/,
            /u\{[0-9a-fA-F]{1,6}\}/,
            /u[0-9a-fA-F]{4}/,
            /[0-7]{1,3}/,
          ),
        ),
      ),

    identifier: ($) => /[a-z_\u0080-\uFFFF][0-9A-Za-z_\u0080-\uFFFF]*/,
    upper_identifier: ($) => /[A-Z]\w*/,

    // --- Comments ---

    // TODO: Link to where these come from

    line_comment: ($) => token(seq("//", /.*/)),

    _doc_margin_star_prefix: ($) => token(prec(2, /\r?\n[ \t]+\*/)),

    doc_comment_margin: ($) =>
      choice(
        prec(3, seq($._doc_margin_star_prefix, token(/\r?\n/))),
        prec(3, seq($._doc_margin_star_prefix, token(/[ \t]+/))),
        prec(2, $._doc_margin_star_prefix),
      ),

    doc_content_text: ($) =>
      choice(
        token(/\r?\n[ \t]*\r?\n/),
        token(/[^@\r\n*]+/),
        token(/\*[^/]/),
        token(/\r?\n/),
      ),

    _doc_comment_line: ($) => choice($.doc_comment_margin, $.doc_content_text),

    doc_preamble: ($) => repeat1($._doc_comment_line),

    doc_tag_name: ($) => token(/[a-zA-Z_][a-zA-Z0-9_-]*/),
    semver_valid: ($) =>
      token(
        /v?[0-9]+\.[0-9]+\.[0-9]+(?:-(?:[0-9.\-]|[\x41-\x7a])*(?:\+(?:[0-9\-]|[\x41-\x7a])*)?)?/,
      ),

    semver_invalid: ($) => token(/[^\s\r\n:][^\r\n:]*/),

    doc_blank_continuation_line: ($) => token(/\r?\n[ \t]+\*[ \t]*/),

    doc_multiline_suffix: ($) =>
      repeat1(
        choice(
          $.doc_blank_continuation_line,
          token(
            /\r?\n[ \t]+\*[ \t]*(?:[^@\s\r\n][^\r\n]*|@[^A-Za-z_\r\n][^\r\n]*)/,
          ),
        ),
      ),

    doc_same_line_body: ($) => token(/([^*\/\r\n]+|\*[^/]|\/[^*])+/),

    doc_directive_body: ($) =>
      choice(
        seq(
          field("same_line", $.doc_same_line_body),
          optional(field("continued", $.doc_multiline_suffix)),
        ),
        field("continued", $.doc_multiline_suffix),
      ),

    doc_since_body: ($) =>
      seq(
        optional(token(/[ \t]+/)),
        field("version", choice($.semver_valid, $.semver_invalid)),
        optional(field("continued", $.doc_multiline_suffix)),
      ),

    doc_history_body: ($) =>
      seq(
        optional(token(/[ \t]+/)),
        field("version", choice($.semver_valid, $.semver_invalid)),
        optional(
          seq(":", optional(field("description", $.doc_same_line_body))),
        ),
        optional(field("continued", $.doc_multiline_suffix)),
      ),

    doc_example_line_code: ($) => token(/[^@\r\n][^\r\n]*/),

    doc_example_body_line: ($) =>
      seq($.doc_comment_margin, optional($.doc_example_line_code)),

    doc_example_body: ($) => repeat1($.doc_example_body_line),

    doc_example: ($) =>
      choice(
        seq("@example", field("body", $.doc_example_body)),
        seq("@example", field("body", $.doc_directive_body)),
        "@example",
      ),

    doc_since: ($) =>
      choice(seq("@since", field("body", $.doc_since_body)), "@since"),

    doc_history: ($) =>
      choice(seq("@history", field("body", $.doc_history_body)), "@history"),

    doc_param: ($) =>
      choice(seq("@param", field("body", $.doc_directive_body)), "@param"),

    doc_returns: ($) =>
      choice(seq("@returns", field("body", $.doc_directive_body)), "@returns"),

    doc_throws: ($) =>
      choice(seq("@throws", field("body", $.doc_directive_body)), "@throws"),

    doc_deprecated: ($) =>
      choice(
        seq("@deprecated", field("body", $.doc_directive_body)),
        "@deprecated",
      ),

    doc_unknown_tag: ($) =>
      choice(
        seq(
          "@",
          field("name", $.doc_tag_name),
          field("body", $.doc_directive_body),
        ),
        seq("@", field("name", $.doc_tag_name)),
      ),

    // Hidden rule so `doc_comment` children are a flat list: optional preamble, then directives.
    _doc_any_directive: ($) =>
      choice(
        $.doc_example,
        $.doc_since,
        $.doc_history,
        $.doc_param,
        $.doc_returns,
        $.doc_throws,
        $.doc_deprecated,
        $.doc_unknown_tag,
      ),

    _doc_block_content: ($) =>
      choice(
        repeat1($._doc_any_directive),
        seq($.doc_preamble, repeat($._doc_any_directive)),
      ),

    block_comment: ($) =>
      seq("/*", optional($._doc_block_content), token(prec(10, "*/"))),

    doc_comment: ($) =>
      prec(
        1,
        seq("/**", optional($._doc_block_content), token(prec(10, "*/"))),
      ),
  },
});
