/// <reference types="tree-sitter-cli/dsl" />

// --- Helpers ---

function sep1(separator, rule) {
  return seq(rule, repeat(seq(separator, rule)));
}

function commaSep(rule) {
  return optional(commaSep1(rule));
}

function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)));
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
  choice('Infinity', 'NaN'),
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

module.exports = grammar({
  name: 'grain',

  extras: $ => [
    /\s/,
    $.line_comment,
    $.block_comment,
    $.doc_comment,
  ],

  word: $ => $.identifier,

  supertypes: $ => [
    $._expression,
    $._pattern,
    $._type,
    $._toplevel_statement,
  ],

  conflicts: $ => [
    [$._simple_expression, $.constant_pattern],
    [$.variable_pattern, $.qualified_identifier],
    [$.list_expression, $.list_pattern],
    [$.array_expression, $.array_pattern],
    [$.identifier_expression, $.punned_record_field],
    [$.identifier_expression, $.non_punned_record_field],
    [$.identifier_expression, $.punned_record_field, $._record_pattern_field],
    [$.identifier_expression, $.non_punned_record_field, $._record_pattern_field],
    [$.punned_record_field, $._record_pattern_field],
    [$.lambda_argument, $.tuple_pattern],
    [$.lambda_argument, $.parenthesized_pattern],
    [$.application_argument, $.qualified_identifier],
    [$._arrow_type_argument, $.tuple_type],
    [$._arrow_type_argument, $.parenthesized_type],
    [$.lambda_expression, $._id_str],
    [$._left_accessor_expression, $._application_callee],
  ],

  rules: {
    program: $ => seq(
      optional($.attributes),
      $.module_header,
      optional($._toplevel_statements),
    ),

    module_header: $ => seq('module', field('name', $.upper_identifier)),

    _toplevel_statements: $ => seq(
      $._toplevel_statement,
      repeat(seq(optional(';'), $._toplevel_statement)),
      optional(';'),
    ),

    _toplevel_statement: $ => choice(
      $.let_declaration,
      $.data_declaration_statement,
      $.foreign_declaration,
      $.include_declaration,
      $.module_declaration,
      $.primitive_declaration,
      $.provide_declaration,
      $.exception_declaration,
      $.expression_statement,
    ),

    // --- Provide ---

    provide_declaration: $ => choice(
      seq(
        optional($.attributes),
        'provide',
        'let',
        optional('rec'),
        optional('mut'),
        $.value_bindings,
      ),
      seq(
        optional($.attributes),
        'provide',
        $._foreign_body,
      ),
      seq(
        optional($.attributes),
        'provide',
        $._primitive_body,
      ),
      seq(
        optional($.attributes),
        'provide',
        $._exception_body,
      ),
      seq(
        optional($.attributes),
        'provide',
        $.provide_shape,
      ),
      seq(
        optional($.attributes),
        'provide',
        $._module_body,
      ),
    ),

    provide_shape: $ => seq(
      '{',
      optional(seq(commaSep1($.provide_item), optional(','))),
      '}',
    ),

    provide_item: $ => choice(
      seq('type', $._aliasable_uid),
      seq('module', $._aliasable_uid),
      seq('exception', $._aliasable_uid),
      $._aliasable_lid,
    ),

    _aliasable_uid: $ => seq(
      $.upper_identifier,
      optional(seq('as', $.upper_identifier)),
    ),

    _aliasable_lid: $ => seq(
      $._id_str,
      optional(seq('as', $._id_str)),
    ),

    // --- Let ---

    let_declaration: $ => seq(
      optional($.attributes),
      'let',
      optional('rec'),
      optional('mut'),
      $.value_bindings,
    ),

    let_expression: $ => seq(
      optional($.attributes),
      'let',
      optional('rec'),
      optional('mut'),
      $.value_bindings,
    ),

    value_bindings: $ => sep1('and', $.value_binding),

    value_binding: $ => seq(
      field('pattern', $._pattern),
      '=',
      field('value', $._expression),
    ),

    // --- Data declarations ---

    data_declaration_statement: $ => seq(
      optional($.attributes),
      sep1('and', $._data_declaration),
    ),

    _data_declaration: $ => choice(
      $.type_alias,
      $.enum_declaration,
      $.record_type_declaration,
    ),

    type_alias: $ => seq(
      optional(choice('provide', 'abstract')),
      'type',
      optional('rec'),
      field('name', $.upper_identifier),
      optional($.type_parameters),
      '=',
      $._type,
    ),

    enum_declaration: $ => seq(
      optional(choice('provide', 'abstract')),
      'enum',
      optional('rec'),
      field('name', $.upper_identifier),
      optional($.type_parameters),
      $.enum_body,
    ),

    record_type_declaration: $ => seq(
      optional(choice('provide', 'abstract')),
      'record',
      optional('rec'),
      field('name', $.upper_identifier),
      optional($.type_parameters),
      $.record_declaration_body,
    ),

    type_parameters: $ => seq('<', commaSep1($.type_variable), optional(','), '>'),

    type_variable: $ => $.identifier,

    enum_body: $ => seq(
      '{',
      commaSep1($.enum_variant),
      optional(','),
      '}',
    ),

    enum_variant: $ => seq(
      field('name', $.upper_identifier),
      optional(choice(
        $.data_constructor_tuple,
        $.data_constructor_record,
      )),
    ),

    data_constructor_tuple: $ => seq('(', commaSep1($._type), optional(','), ')'),
    data_constructor_record: $ => seq('{', commaSep1($.record_field_declaration), optional(','), '}'),

    record_field_declaration: $ => seq(
      optional('mut'),
      field('name', $._id_str),
      ':',
      field('type', $._type),
    ),

    record_declaration_body: $ => seq(
      '{',
      commaSep1($.record_field_declaration),
      optional(','),
      '}',
    ),

    // --- Foreign ---

    foreign_declaration: $ => seq(
      optional($.attributes),
      $._foreign_body,
    ),

    _foreign_body: $ => seq(
      'foreign',
      'wasm',
      field('name', $._id_str),
      ':',
      field('type', $._type),
      optional(seq('as', field('alias', $._id_str))),
      'from',
      field('module', $.string),
    ),

    // --- Include ---

    include_declaration: $ => seq(
      optional($.attributes),
      'from',
      field('path', $.string),
      'include',
      field('module', $.qualified_type_identifier),
      optional(seq('as', field('alias', $.qualified_type_identifier))),
    ),

    // --- Use ---

    use_expression: $ => seq(
      'use',
      $.upper_identifier,
      '.',
      $._use_tail,
    ),

    _use_tail: $ => choice(
      seq($.upper_identifier, '.', $._use_tail),
      $.use_shape,
    ),

    use_shape: $ => choice(
      '*',
      seq('{', optional(seq(commaSep1($.use_item), optional(','))), '}'),
    ),

    use_item: $ => choice(
      seq('type', $._aliasable_uid),
      seq('module', $._aliasable_uid),
      seq('exception', $._aliasable_uid),
      $._aliasable_lid,
    ),

    // --- Module ---

    module_declaration: $ => seq(
      optional($.attributes),
      $._module_body,
    ),

    _module_body: $ => seq(
      'module',
      field('name', $.upper_identifier),
      '{',
      optional($._toplevel_statements),
      '}',
    ),

    // --- Primitive ---

    primitive_declaration: $ => seq(
      optional($.attributes),
      $._primitive_body,
    ),

    _primitive_body: $ => seq(
      'primitive',
      field('name', choice($._id_str, $._primitive_name)),
      '=',
      field('value', $.string),
    ),

    _primitive_name: $ => choice('assert', 'throw', 'fail'),

    // --- Exception ---

    exception_declaration: $ => seq(
      optional($.attributes),
      $._exception_body,
    ),

    _exception_body: $ => prec.left(choice(
      seq('exception', field('name', $.upper_identifier)),
      seq(
        'exception',
        field('name', $.upper_identifier),
        '(',
        optional(seq(commaSep1($._type), optional(','))),
        ')',
      ),
      seq(
        'exception',
        field('name', $.upper_identifier),
        $.data_constructor_record,
      ),
    )),

    // --- Expressions ---

    expression_statement: $ => $._expression,

    _expression: $ => choice(
      $.binary_expression,
      $.annotated_expression,
      $.lambda_expression,
      $.assign_expression,
      $._non_assign_expression,
      $._statement_expression,
    ),

    _statement_expression: $ => choice(
      $.throw_expression,
      $.assert_expression,
      $.fail_expression,
      $.return_expression,
      $.continue_expression,
      $.break_expression,
      $.use_expression,
    ),

    throw_expression: $ => prec.right(seq('throw', $._expression)),
    assert_expression: $ => prec.right(seq('assert', $._expression)),
    fail_expression: $ => prec.right(seq('fail', $._expression)),
    return_expression: $ => prec.right(seq('return', optional($._expression))),
    continue_expression: $ => 'continue',
    break_expression: $ => 'break',

    annotated_expression: $ => prec(PREC.ANNOTATE, seq(
      $._expression,
      ':',
      $._type,
    )),

    binary_expression: $ => {
      const table = [
        [PREC.INFIX_30, choice('||', '??')],
        [PREC.INFIX_40, '&&'],
        [PREC.INFIX_50, '|'],
        [PREC.INFIX_60, $.infix_60_operator],
        [PREC.INFIX_70, $.infix_70_operator],
        [PREC.INFIX_80, choice('==', '!=', 'is', 'isnt')],
        [PREC.INFIX_90, choice('<', '>')],
        [PREC.INFIX_100, $.infix_100_operator],
        [PREC.INFIX_110, choice('+', '-')],
        [PREC.INFIX_120, choice('*', '/', '%')],
      ];
      return choice(
        ...table.map(([prec_val, op]) =>
          prec.left(prec_val, seq(
            field('left', $._expression),
            field('operator', op),
            field('right', $._expression),
          ))
        ),
        prec.left(PREC.INFIX_50, seq(
          field('left', $._expression),
          field('operator', $.custom_infix_operator),
          field('right', $._expression),
        )),
      );
    },

    _non_assign_expression: $ => choice(
      $._left_accessor_expression,
      $.unary_expression,
      $.if_expression,
      $.while_expression,
      $.for_expression,
      $.match_expression,
    ),

    _left_accessor_expression: $ => choice(
      $.application_expression,
      $.constructor_expression,
      $._simple_expression,
      $.array_get_expression,
      $.record_get_expression,
      $.parenthesized_expression,
      $.block_expression,
      $.record_expression,
      $.list_expression,
      $.array_expression,
    ),

    constructor_expression: $ => prec.dynamic(1, prec.left(PREC.CALL, choice(
      seq(
        field('constructor', $.qualified_type_identifier),
        '(',
        optional(seq(commaSep1($._expression), optional(','))),
        ')',
      ),
      seq(
        field('constructor', $.qualified_type_identifier),
        '{',
        commaSep1($._record_field),
        optional(','),
        '}',
      ),
      field('constructor', $.qualified_type_identifier),
    ))),

    _simple_expression: $ => choice(
      $._constant,
      $.tuple_expression,
      $.identifier_expression,
    ),

    identifier_expression: $ => $.qualified_identifier,

    _constant: $ => choice(
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

    parenthesized_expression: $ => seq('(', $._expression, ')'),

    tuple_expression: $ => seq(
      '(',
      $._expression,
      ',',
      commaSep1($._expression),
      optional(','),
      ')',
    ),

    block_expression: $ => seq(
      '{',
      $._block_body,
      '}',
    ),

    _block_body: $ => seq(
      $._block_body_expression,
      repeat(seq(optional(';'), $._block_body_expression)),
      optional(';'),
    ),

    _block_body_expression: $ => choice(
      $.let_expression,
      $._expression,
    ),

    record_expression: $ => seq(
      '{',
      commaSep1($._record_field),
      optional(','),
      '}',
    ),

    _record_field: $ => choice(
      $.punned_record_field,
      $.non_punned_record_field,
      $.spread_record_field,
    ),

    punned_record_field: $ => $.qualified_identifier,
    non_punned_record_field: $ => seq($.qualified_identifier, ':', $._expression),
    spread_record_field: $ => seq('...', $._expression),

    _application_callee: $ => choice(
      $.constructor_expression,
      $._simple_expression,
      $.array_get_expression,
      $.record_get_expression,
      $.parenthesized_expression,
      $.block_expression,
      $.record_expression,
      $.list_expression,
      $.array_expression,
    ),

    application_expression: $ => prec(PREC.CALL, seq(
      $._application_callee,
      '(',
      optional(seq(commaSep1($.application_argument), optional(','))),
      ')',
    )),

    application_argument: $ => choice(
      $._expression,
      seq(field('label', $._id_str), '=', field('value', $._expression)),
    ),

    lambda_expression: $ => prec.right(choice(
      seq(
        '(',
        optional(seq(commaSep1($.lambda_argument), optional(','))),
        ')',
        '=>',
        field('body', $._expression),
      ),
      seq(
        field('parameter', $.identifier),
        '=>',
        field('body', $._expression),
      ),
    )),

    lambda_argument: $ => seq(
      $._pattern,
      optional(seq('=', $._expression)),
    ),

    unary_expression: $ => prec(PREC.PREFIX, seq(
      field('operator', $.prefix_operator),
      field('operand', $._non_assign_expression),
    )),

    if_expression: $ => prec.right(seq(
      'if',
      '(',
      field('condition', $._expression),
      ')',
      field('consequence', $._expression),
      optional(seq('else', field('alternative', $._expression))),
    )),

    while_expression: $ => seq(
      'while',
      '(',
      field('condition', $._expression),
      ')',
      field('body', $._expression),
    ),

    for_expression: $ => seq(
      'for',
      '(',
      optional($._block_body_expression),
      ';',
      optional($._expression),
      ';',
      optional($._expression),
      ')',
      field('body', $._expression),
    ),

    match_expression: $ => seq(
      'match',
      '(',
      field('value', $._expression),
      ')',
      '{',
      commaSep1($.match_branch),
      optional(','),
      '}',
    ),

    match_branch: $ => seq(
      field('pattern', $._pattern),
      optional($.when_guard),
      '=>',
      field('body', $._expression),
    ),

    when_guard: $ => seq('when', $._expression),

    list_expression: $ => choice(
      seq('[', ']'),
      seq('[', commaSep1($._list_item), optional(','), ']'),
    ),

    _list_item: $ => choice(
      $.spread_expression,
      $._expression,
    ),

    spread_expression: $ => seq('...', $._expression),

    array_expression: $ => choice(
      seq('[>', ']'),
      seq('[>', commaSep1($._expression), optional(','), ']'),
    ),

    array_get_expression: $ => prec(PREC.ACCESS, seq(
      $._left_accessor_expression,
      '[',
      $._expression,
      ']',
    )),

    record_get_expression: $ => prec(PREC.ACCESS, seq(
      $._left_accessor_expression,
      '.',
      field('field', $._id_str),
    )),

    assign_expression: $ => prec.right(PREC.ASSIGN, choice(
      seq($._left_accessor_expression, ':=', $._expression),
      seq($.identifier_expression, '=', $._expression),
      seq($.identifier_expression, $.assignment_operator, $._expression),
      seq($._left_accessor_expression, '.', $._id_str, choice('=', $.assignment_operator), $._expression),
      seq($._left_accessor_expression, '[', $._expression, ']', choice('=', $.assignment_operator), $._expression),
    )),

    // --- Types ---

    _type: $ => choice(
      $.arrow_type,
      $.tuple_type,
      $.parenthesized_type,
      $.type_variable_ref,
      $.constructor_type,
    ),

    arrow_type: $ => prec.right(1, seq(
      choice(
        seq('(', optional(seq(commaSep1($._arrow_type_argument), optional(','))), ')'),
        $.constructor_type,
        $.type_variable_ref,
      ),
      '=>',
      $._type,
    )),

    _arrow_type_argument: $ => choice(
      seq($.identifier, ':', $._type),
      seq('?', $.identifier, ':', $._type),
      $._type,
    ),

    tuple_type: $ => seq(
      '(',
      $._type,
      ',',
      commaSep1($._type),
      optional(','),
      ')',
    ),

    parenthesized_type: $ => seq('(', $._type, ')'),

    type_variable_ref: $ => $.identifier,

    constructor_type: $ => prec.left(1, choice(
      // Prefer consuming generic arguments when present (`Array<a>`),
      // instead of letting `<`/`>` get reinterpreted as binary operators.
      prec(2, seq(
        $.qualified_type_identifier,
        '<',
        commaSep1($._type),
        optional(','),
        '>',
      )),
      $.qualified_type_identifier,
    )),

    // --- Patterns ---

    _pattern: $ => choice(
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

    any_pattern: $ => '_',

    constant_pattern: $ => $._constant,

    variable_pattern: $ => choice($._id_str, $._primitive_name),

    tuple_pattern: $ => seq(
      '(',
      $._pattern,
      ',',
      commaSep1($._pattern),
      optional(','),
      ')',
    ),

    array_pattern: $ => choice(
      seq('[>', commaSep1($._pattern), optional(','), ']'),
      seq('[>', ']'),
    ),

    parenthesized_pattern: $ => seq('(', $._pattern, ')'),

    record_pattern: $ => seq(
      '{',
      commaSep1($._record_pattern_field),
      optional(','),
      '}',
    ),

    _record_pattern_field: $ => choice(
      '_',
      seq($.qualified_identifier, ':', $._pattern),
      $.qualified_identifier,
    ),

    constructor_pattern: $ => prec(1, choice(
      seq(
        $.qualified_type_identifier,
        '(',
        optional(seq(commaSep1($._pattern), optional(','))),
        ')',
      ),
      seq(
        $.qualified_type_identifier,
        '{',
        commaSep1($._record_pattern_field),
        optional(','),
        '}',
      ),
      $.qualified_type_identifier,
    )),

    list_pattern: $ => choice(
      seq('[', ']'),
      seq('[', commaSep1($._list_pattern_item), optional(','), ']'),
    ),

    _list_pattern_item: $ => choice(
      seq('...', $._pattern),
      $._pattern,
    ),

    or_pattern: $ => prec.left(PREC.PIPE_PAT, seq($._pattern, '|', $._pattern)),

    alias_pattern: $ => seq($._pattern, 'as', $._id_str),

    typed_pattern: $ => prec.right(seq($._pattern, ':', $._type)),

    // --- Attributes ---

    attributes: $ => repeat1($.attribute),

    attribute: $ => seq(
      '@',
      $._id_str,
      optional(seq('(', commaSep($.string), ')')),
    ),

    // --- Operators ---

    prefix_operator: $ => '!',

    assignment_operator: $ => choice('+=', '-=', '*=', '/=', '%='),

    custom_infix_operator: $ => token(choice(
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
    )),

    infix_60_operator: $ => token(seq('^', /[+\-*/%$&|^!?<>=:]*/)),
    infix_70_operator: $ => token(seq('&', /[+\-*/%$&|^!?<>=:.]*/)),
    infix_100_operator: $ => choice(
      token(seq('<<', /[+\-*/%$&|^!?<>=:]*/)),
      token(seq('>>', /[+\-*/%$&=^|!?<:.]*/)),
    ),

    // --- Identifiers ---

    _id_str: $ => choice(
      $.identifier,
      $.special_identifier,
    ),

    special_identifier: $ => seq(
      '(',
      $._operator,
      ')',
    ),

    _operator: $ => choice(
      $.custom_infix_operator,
      $.infix_60_operator,
      $.infix_70_operator,
      $.infix_100_operator,
      '!',
      '||', '??', '&&',
      '==', '!=', 'is', 'isnt',
      '+', '*', '/', '-', '%', '|', '<', '>',
    ),

    qualified_identifier: $ => choice(
      // One-module path: `WasmI32.fromGrain`
      prec(1, seq($.upper_identifier, '.', $._id_str)),
      // Multi-module path: `Foo.Bar.baz`
      prec(1, seq(
        $.upper_identifier,
        '.',
        $.upper_identifier,
        repeat(seq('.', $.upper_identifier)),
        '.',
        $._id_str,
      )),
      $._id_str,
    ),

    module_path: $ => prec.right(sep1('.', $.upper_identifier)),

    qualified_type_identifier: $ => prec.right(sep1('.', $.upper_identifier)),

    // --- Literals ---

    number_literal: $ => token(seq(optional('-'), INT_PATTERN)),
    float_literal: $ => token(seq(optional('-'), FLOAT_PATTERN)),
    int8_literal: $ => token(seq(optional('-'), INT_PATTERN, 's')),
    int16_literal: $ => token(seq(optional('-'), INT_PATTERN, 'S')),
    int32_literal: $ => token(seq(optional('-'), INT_PATTERN, 'l')),
    int64_literal: $ => token(seq(optional('-'), INT_PATTERN, 'L')),
    uint8_literal: $ => token(seq(optional('-'), INT_PATTERN, 'us')),
    uint16_literal: $ => token(seq(optional('-'), INT_PATTERN, 'uS')),
    uint32_literal: $ => token(seq(optional('-'), INT_PATTERN, 'ul')),
    uint64_literal: $ => token(seq(optional('-'), INT_PATTERN, 'uL')),
    float32_literal: $ => token(seq(optional('-'), FLOAT_PATTERN, 'f')),
    float64_literal: $ => token(seq(optional('-'), FLOAT_PATTERN, 'd')),
    wasmi32_literal: $ => token(seq(optional('-'), INT_PATTERN, 'n')),
    wasmi64_literal: $ => token(seq(optional('-'), INT_PATTERN, 'N')),
    wasmf32_literal: $ => token(seq(optional('-'), FLOAT_PATTERN, 'w')),
    wasmf64_literal: $ => token(seq(optional('-'), FLOAT_PATTERN, 'W')),
    bigint_literal: $ => token(seq(optional('-'), INT_PATTERN, 't')),
    rational_literal: $ => token(seq(
      optional('-'), INT_PATTERN, '/', optional('-'), INT_PATTERN, 'r',
    )),

    boolean: $ => choice('true', 'false'),
    void: $ => 'void',

    string: $ => seq(
      '"',
      repeat(choice(
        $.escape_sequence,
        $.string_content,
      )),
      '"',
    ),

    string_content: $ => token.immediate(prec(1, /[^"\\]+/)),

    bytes: $ => seq(
      'b"',
      repeat(choice(
        $.escape_sequence,
        $.bytes_content,
      )),
      '"',
    ),

    bytes_content: $ => token.immediate(prec(1, /[^"\\]+/)),

    char: $ => seq(
      "'",
      choice(
        $.escape_sequence,
        $.char_content,
      ),
      "'",
    ),

    char_content: $ => token.immediate(prec(1, /[^'\\]+/)),

    escape_sequence: $ => token.immediate(seq(
      '\\',
      choice(
        /[\\'"nrtbfv0]/,
        '/',
        /x[0-9a-fA-F]{1,2}/,
        /u\{[0-9a-fA-F]{1,6}\}/,
        /u[0-9a-fA-F]{4}/,
        /[0-7]{1,3}/,
      ),
    )),

    identifier: $ => /[a-z_\u0080-\uFFFF][0-9A-Za-z_\u0080-\uFFFF]*/,
    upper_identifier: $ => /[A-Z]\w*/,

    // --- Comments ---

    line_comment: $ => token(seq('//', /.*/)),

    _comment_body: $ => repeat1(choice(
      $.documentation_tag,
      token(/[^@*]+/),
      token(/\*[^/]/),
    )),

    documentation_tag: $ => token(choice(
      '@param',
      '@returns',
      '@throws',
      '@example',
      '@since',
      '@history',
      '@deprecated',
    )),

    block_comment: $ => seq('/*', optional($._comment_body), '*/'),
    doc_comment: $ => prec(1, seq('/**', optional($._comment_body), '*/')),
  },
});
