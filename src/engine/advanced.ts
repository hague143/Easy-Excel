import {
  CalcError,
  fail,
  flatten,
  matrix,
  numeric,
  numbers,
  type CalcContext,
  type FunctionDef,
  type InputDef,
} from './types';
import {
  boundedSize,
  cellError,
  cmp,
  collapse,
  columnLetters,
  demoProvider,
  evaluateOperation,
  integer,
  lookupIndex,
  matchesCriterion,
  missingLookup,
  NA,
  parameterNames,
  referenceValues,
  resolveReference,
  scalarResult,
  transpose,
  validName,
  vector,
} from './advanced-helpers';

export { demoProvider } from './advanced-helpers';

const field = (
  key: string,
  label: string,
  type: InputDef['type'] = 'data',
  value?: any,
  options?: InputDef['options'],
): InputDef => ({
  key,
  label,
  type,
  required: value === undefined,
  ...(value === undefined ? {} : { default: value }),
  ...(options ? { options } : {}),
});
const data = (key = 'data', label = 'Data range') => field(key, label, 'matrix');
const define = (
  name: string,
  friendlyName: string,
  category: string,
  description: string,
  inputs: InputDef[],
  calculate: FunctionDef['calculate'],
  args: Record<string, any>,
  expected: any,
  compatibility: string[] = [],
  context?: CalcContext,
): FunctionDef => ({
  name,
  friendlyName,
  categories: [category],
  aliases: [
    friendlyName.toLowerCase(),
    ...(name.includes('LOOKUP') || name.includes('MATCH')
      ? ['search employee', 'talash', 'record lookup', 'dhoondo']
      : category === 'Database'
        ? ['database', 'shart', 'records']
        : category === 'Dynamic arrays'
          ? ['array', 'rows', 'columns', 'tarteeb']
          : []),
  ],
  description,
  inputs,
  output: 'Value or array',
  defaults: Object.fromEntries(
    inputs.filter((i) => i.default !== undefined).map((i) => [i.key, i.default]),
  ),
  calculate,
  example: { args, expected, ...(context ? { context } : {}) },
  compatibility: compatibility.length
    ? compatibility
    : [
        'Deterministic local calculation using the selected range. Positions are 1-based; array results are exported as values.',
      ],
  testRefs: [`tests/advanced.test.ts > ${name}`],
});
const lookupModes = () => [
  field('matchMode', 'Match mode', 'select', 0, [
    { label: 'Exact', value: 0 },
    { label: 'Exact or next smaller', value: -1 },
    { label: 'Exact or next larger', value: 1 },
    { label: 'Wildcard (* ? ~)', value: 2 },
  ]),
  field('searchMode', 'Search order', 'select', 1, [
    { label: 'First to last', value: 1 },
    { label: 'Last to first', value: -1 },
    { label: 'Binary, ascending (sorted)', value: 2 },
    { label: 'Binary, descending (sorted)', value: -2 },
  ]),
];
const missingFields = () => [
  field('duplicates', 'Duplicate policy', 'select', 'first', ['first', 'last', 'all', 'error']),
  field('missing', 'Missing value', 'select', 'error', ['error', 'blank', 'custom']),
  field('ifNotFound', 'Custom missing result', 'text', ''),
];
const matchAt = (a: any, mode?: number, search?: number) =>
  lookupIndex(
    a.value,
    vector(a.lookup),
    mode ?? integer(a.matchMode ?? 0),
    search ?? integer(a.searchMode ?? 1),
    a.duplicates || 'first',
  );
const lookupFunctions: FunctionDef[] = [
  define(
    'XLOOKUP',
    'Find a matching record',
    'Lookup & references',
    'Match a value in one row or column and return corresponding records. Choose matching, duplicate and missing-value policies.',
    [
      field('value', 'Search value', 'text'),
      data('lookup', 'Lookup row or column'),
      data('returns', 'Return range'),
      ...lookupModes(),
      ...missingFields(),
    ],
    (a) => {
      const keys = matrix(a.lookup),
        values = matrix(a.returns),
        indices = matchAt(a);
      if (!indices.length)
        return missingLookup({
          ...a,
          ifNotFound: a.missing === 'custom' ? a.ifNotFound : undefined,
        });
      if (keys.length > 1 || keys[0].length === 1) {
        if (values.length !== keys.length)
          fail('#VALUE!', 'Lookup and return ranges must have the same number of rows.');
        return collapse(indices.map((i) => values[i]));
      }
      if (values[0].length !== keys[0].length)
        fail(
          '#VALUE!',
          'Horizontal lookup and return ranges must have the same number of columns.',
        );
      return collapse(values.map((row) => indices.map((i) => row[i])));
    },
    {
      value: 'E02',
      lookup: [['E01'], ['E02']],
      returns: [
        ['Amina', 120],
        ['Bilal', 180],
      ],
    },
    [['Bilal', 180]],
    [
      'Text matching is case-insensitive. Duplicate policy all is a SheetPilot extension. Binary modes validate sorting before calculating.',
    ],
  ),
  ...(['VLOOKUP', 'HLOOKUP'] as const).map((name) =>
    define(
      name,
      name === 'VLOOKUP' ? 'Find in a table column' : 'Find in a table row',
      'Lookup & references',
      'Find a value in the first column or row and return a selected field.',
      [
        field('value', 'Search value', 'text'),
        data('table', 'Lookup table'),
        field('index', 'Return column or row number', 'number', 2),
        field('approximate', 'Approximate match (sorted ascending)', 'boolean', true),
      ],
      (a) => {
        const table = name === 'HLOOKUP' ? transpose(matrix(a.table)) : matrix(a.table),
          index = integer(a.index ?? 2);
        if (index < 1 || index > table[0].length)
          fail('#REF!', 'Return field is outside the lookup table.');
        const keys = table.map((r) => r[0]),
          approximate = a.approximate ?? true;
        if (approximate)
          for (let i = 1; i < keys.length; i++)
            if (cmp(keys[i - 1], keys[i]) > 0)
              fail('#N/A', 'Approximate lookup requires the first lookup field sorted ascending.');
        const found = lookupIndex(
          a.value,
          keys,
          approximate ? -1 : 2,
          1,
          approximate ? 'last' : 'first',
        );
        return found.length ? table[found[0]][index - 1] : fail('#N/A', 'No matching record.');
      },
      name === 'VLOOKUP'
        ? {
            value: 15,
            table: [
              [0, 'Low'],
              [10, 'Medium'],
              [20, 'High'],
            ],
            index: 2,
          }
        : {
            value: 15,
            table: [
              [0, 10, 20],
              ['Low', 'Medium', 'High'],
            ],
            index: 2,
          },
      'Medium',
      [
        'Approximate mode explicitly rejects unsorted lookup keys instead of returning unreliable results.',
      ],
    ),
  ),
  define(
    'LOOKUP',
    'Find nearest value in a sorted list',
    'Lookup & references',
    'Find the largest lookup value less than or equal to the search value in an ascending sorted vector.',
    [
      field('value', 'Search value', 'text'),
      data('lookup', 'Sorted lookup vector'),
      data('returns', 'Return vector'),
    ],
    (a) => {
      const keys = vector(a.lookup),
        values = vector(a.returns);
      if (keys.length !== values.length)
        fail('#VALUE!', 'Lookup and return vectors must be the same size.');
      for (let i = 1; i < keys.length; i++)
        if (cmp(keys[i - 1], keys[i]) > 0) fail('#N/A', 'LOOKUP requires ascending sorted keys.');
      const found = lookupIndex(a.value, keys, -1, 1, 'last');
      return found.length
        ? values[found[0]]
        : fail('#N/A', 'Search value is smaller than all lookup values.');
    },
    { value: 15, lookup: [0, 10, 20], returns: ['Low', 'Medium', 'High'] },
    'Medium',
    ['Vector form; select an explicit return vector. Sorted input is required and checked.'],
  ),
  define(
    'INDEX',
    'Return a value at a position',
    'Lookup & references',
    'Choose a value, full row, or full column by its 1-based position in a range.',
    [
      data(),
      field('row', 'Row number (0 for all)', 'number', 1),
      field('column', 'Column number (0 for all)', 'number', 1),
    ],
    (a) => {
      const m = matrix(a.data),
        r = integer(a.row ?? 1),
        c = integer(a.column ?? 1);
      if (r < 0 || c < 0 || r > m.length || c > m[0].length)
        fail('#REF!', 'Position is outside the selected range.');
      return r === 0 && c === 0
        ? m
        : r === 0
          ? m.map((row) => [row[c - 1]])
          : c === 0
            ? [m[r - 1]]
            : m[r - 1][c - 1];
    },
    {
      data: [
        [10, 20],
        [30, 40],
      ],
      row: 2,
      column: 1,
    },
    30,
  ),
  define(
    'MATCH',
    'Find a position in a list',
    'Lookup & references',
    'Return a 1-based position using exact or sorted approximate matching.',
    [
      field('value', 'Search value', 'text'),
      data('lookup', 'Lookup row or column'),
      field('matchType', 'Match type', 'select', 1, [
        { label: 'Exact (wildcards allowed)', value: 0 },
        { label: 'Next smaller, ascending sorted', value: 1 },
        { label: 'Next larger, descending sorted', value: -1 },
      ]),
    ],
    (a) => {
      const type = integer(a.matchType ?? 1),
        keys = vector(a.lookup);
      if (![0, -1, 1].includes(type)) fail('#VALUE!', 'Match type must be -1, 0 or 1.');
      if (type)
        for (let i = 1; i < keys.length; i++)
          if (cmp(keys[i - 1], keys[i]) * type > 0)
            fail('#N/A', 'Approximate MATCH requires correctly sorted data.');
      const result = lookupIndex(a.value, keys, type === 0 ? 2 : -type, 1, type ? 'last' : 'first');
      return result.length ? result[0] + 1 : fail('#N/A', 'No matching position.');
    },
    { value: 25, lookup: [10, 20, 30], matchType: 1 },
    2,
    ['Approximate matching checks ascending or descending order.'],
  ),
  define(
    'XMATCH',
    'Find a position with flexible matching',
    'Lookup & references',
    'Return a position with exact, wildcard or nearest matching and forward or reverse search.',
    [
      field('value', 'Search value', 'text'),
      data('lookup', 'Lookup row or column'),
      ...lookupModes(),
    ],
    (a) => {
      const found = matchAt(a);
      return found.length ? found[0] + 1 : fail('#N/A', 'No matching position.');
    },
    { value: 'b*', lookup: ['Anna', 'Bilal', 'Bina'], matchMode: 2, searchMode: -1 },
    3,
  ),
  define(
    'CHOOSE',
    'Choose from a list',
    'Lookup & references',
    'Return a value from the given choices using a 1-based index.',
    [field('index', 'Choice number', 'number', 1), data('values', 'Choices')],
    (a) => {
      const choices = flatten(a.values),
        i = integer(a.index ?? 1);
      if (i < 1 || i > choices.length || i > 254)
        fail('#VALUE!', 'Choice number is outside the available choices (maximum 254).');
      return choices[i - 1];
    },
    { index: 2, values: ['Red', 'Green', 'Blue'] },
    'Green',
  ),
];

const referenceContext: CalcContext = {
  sheetId: 'address-sample',
  workbook: {
    id: 'address-book',
    name: 'Address example',
    sheets: [
      {
        id: 'address-sample',
        name: 'Sales',
        columns: [
          { id: 'a', name: 'Units', type: 'number' },
          { id: 'b', name: 'Amount', type: 'number' },
        ],
        rows: [
          [10, 20],
          [30, 40],
          [50, 60],
        ],
      },
    ],
  },
};
const referenceFields = () => [
  field('reference', 'Worksheet reference', 'text', 'A1'),
  field('sheet', 'Worksheet', 'sheet', ''),
];
const refContext = (a: any, context: CalcContext): CalcContext =>
  a.sheet
    ? {
        ...context,
        sheetId:
          context.workbook?.sheets.find((s) => s.id === a.sheet || s.name === a.sheet)?.id ??
          a.sheet,
      }
    : context;
const referenceFunctions: FunctionDef[] = [
  define(
    'INDIRECT',
    'Read a worksheet reference',
    'Lookup & references',
    'Resolve a selected reference against the actual workbook and return its stored values.',
    [
      ...referenceFields(),
      field('style', 'Reference style', 'select', 'A1', ['A1', 'R1C1']),
      field('anchorRow', 'Relative R1C1 anchor row', 'number', 1),
      field('anchorColumn', 'Relative R1C1 anchor column', 'number', 1),
    ],
    (a, c) =>
      collapse(
        referenceValues(
          resolveReference(
            a.reference,
            refContext(a, c),
            a.style || 'A1',
            integer(a.anchorRow ?? 1),
            integer(a.anchorColumn ?? 1),
          ),
        ),
      ),
    { reference: 'Sales!B2' },
    20,
    [
      'Worksheet row 1 contains column headers; data starts at row 2. No named ranges or external workbook links.',
    ],
    referenceContext,
  ),
  define(
    'ADDRESS',
    'Create a worksheet address',
    'Lookup & references',
    'Create an A1 or R1C1 address with the selected absolute/relative style.',
    [
      field('row', 'Row number', 'number', 1),
      field('column', 'Column number', 'number', 1),
      field('absNum', 'Absolute style', 'select', 1, [
        { label: '$A$1', value: 1 },
        { label: 'A$1', value: 2 },
        { label: '$A1', value: 3 },
        { label: 'A1', value: 4 },
      ]),
      field('a1', 'Use A1 notation', 'boolean', true),
      field('sheet', 'Optional sheet name', 'text', ''),
    ],
    (a) => {
      const r = integer(a.row),
        c = integer(a.column),
        abs = integer(a.absNum ?? 1);
      if (r < 1 || r > 1048576 || c < 1 || c > 16384 || ![1, 2, 3, 4].includes(abs))
        fail('#VALUE!', 'Choose valid row, column and absolute style.');
      const absoluteRow = abs === 1 || abs === 2,
        absoluteColumn = abs === 1 || abs === 3;
      const address =
        a.a1 === false
          ? `R${absoluteRow ? r : `[${r}]`}C${absoluteColumn ? c : `[${c}]`}`
          : `${absoluteColumn ? '$' : ''}${columnLetters(c)}${absoluteRow ? '$' : ''}${r}`;
      return a.sheet ? `'${String(a.sheet).replace(/'/g, "''")}'!${address}` : address;
    },
    { row: 5, column: 28, absNum: 4, sheet: 'Annual Sales' },
    "'Annual Sales'!AB5",
  ),
  ...(['ROW', 'COLUMN'] as const).map((name) =>
    define(
      name,
      name === 'ROW' ? 'Get worksheet row numbers' : 'Get worksheet column numbers',
      'Lookup & references',
      'Return the actual workbook positions for the selected cell or range.',
      referenceFields(),
      (a, c) => {
        const ref = resolveReference(a.reference || 'A1', refContext(a, c));
        return name === 'ROW'
          ? ref.height === 1
            ? ref.row
            : Array.from({ length: ref.height }, (_, i) => [ref.row + i])
          : ref.width === 1
            ? ref.column
            : [Array.from({ length: ref.width }, (_, i) => ref.column + i)];
      },
      { reference: name === 'ROW' ? 'A2:B3' : 'B1:C2' },
      name === 'ROW' ? [[2], [3]] : [[2, 3]],
      ['Worksheet row 1 contains column headers; data starts at row 2.'],
      referenceContext,
    ),
  ),
  ...(['ROWS', 'COLUMNS'] as const).map((name) =>
    define(
      name,
      name === 'ROWS' ? 'Count rows' : 'Count columns',
      'Lookup & references',
      'Count the rows or columns in a rectangular range.',
      [data()],
      (a) => (name === 'ROWS' ? matrix(a.data).length : matrix(a.data)[0].length),
      {
        data: [
          [1, 2, 3],
          [4, 5, 6],
        ],
      },
      name === 'ROWS' ? 2 : 3,
    ),
  ),
  define(
    'OFFSET',
    'Read a shifted worksheet range',
    'Lookup & references',
    'Move a reference by the chosen rows and columns and optionally change its size.',
    [
      ...referenceFields(),
      field('rows', 'Shift rows', 'number', 0),
      field('columns', 'Shift columns', 'number', 0),
      field('height', 'Result height (blank = original)', 'text', ''),
      field('width', 'Result width (blank = original)', 'text', ''),
    ],
    (a, c) => {
      const ref = resolveReference(a.reference || 'A1', refContext(a, c));
      ref.row += integer(a.rows ?? 0);
      ref.column += integer(a.columns ?? 0);
      ref.height = a.height === '' || a.height === undefined ? ref.height : integer(a.height);
      ref.width = a.width === '' || a.width === undefined ? ref.width : integer(a.width);
      if (
        ref.row < 1 ||
        ref.column < 1 ||
        ref.height < 1 ||
        ref.width < 1 ||
        ref.row + ref.height - 1 > 1048576 ||
        ref.column + ref.width - 1 > 16384
      )
        fail('#REF!', 'Shifted range is outside the worksheet.');
      return collapse(referenceValues(ref));
    },
    { reference: 'A1', rows: 1, columns: 1, height: 2, width: 1 },
    [[20], [40]],
    [
      'Worksheet row 1 contains column headers; data starts at row 2. Empty cells resolve to blank, not zero.',
    ],
    referenceContext,
  ),
];

const arrayFunctions: FunctionDef[] = [
  define(
    'FILTER',
    'Keep matching rows or columns',
    'Dynamic arrays',
    'Filter a range using a matching boolean include column or row.',
    [
      data(),
      data('include', 'Include flags (TRUE/FALSE or 1/0)'),
      field('ifEmpty', 'When no matches (blank = error)', 'text', ''),
    ],
    (a) => {
      const m = matrix(a.data),
        flags = matrix(a.include);
      flatten(flags).forEach(cellError);
      const flag = (v: any) =>
        typeof v === 'boolean' || typeof v === 'number'
          ? Boolean(v)
          : fail('#VALUE!', 'Include values must be booleans or numbers.');
      let result: any[][];
      if (flags[0].length === 1 && flags.length === m.length)
        result = m.filter((_, i) => flag(flags[i][0]));
      else if (flags.length === 1 && flags[0].length === m[0].length)
        result = m.map((row) => row.filter((_, i) => flag(flags[0][i])));
      else return fail('#VALUE!', 'Include flags must align with the rows or columns.');
      if (!result.length || !result[0].length)
        return a.ifEmpty !== undefined && a.ifEmpty !== ''
          ? a.ifEmpty
          : fail('#CALC!', 'No values match the filter.');
      return result;
    },
    {
      data: [
        ['A', 10],
        ['B', 20],
        ['C', 30],
      ],
      include: [true, false, true],
    },
    [
      ['A', 10],
      ['C', 30],
    ],
  ),
  define(
    'SORT',
    'Sort a range',
    'Dynamic arrays',
    'Sort rows or columns by a selected 1-based field.',
    [
      data(),
      field('sortIndex', 'Sort field number', 'number', 1),
      field('sortOrder', 'Direction', 'select', 1, [
        { label: 'Ascending', value: 1 },
        { label: 'Descending', value: -1 },
      ]),
      field('byCol', 'Sort columns instead of rows', 'boolean', false),
    ],
    (a) => {
      let m = matrix(a.data);
      if (a.byCol) m = transpose(m);
      const i = integer(a.sortIndex ?? 1) - 1,
        order = integer(a.sortOrder ?? 1);
      if (i < 0 || i >= m[0].length || ![1, -1].includes(order))
        fail('#VALUE!', 'Choose a valid sort field and direction.');
      const sorted = [...m].sort((x, y) => cmp(x[i], y[i]) * order);
      return a.byCol ? transpose(sorted) : sorted;
    },
    {
      data: [
        ['B', 2],
        ['A', 3],
        ['C', 1],
      ],
      sortIndex: 2,
      sortOrder: -1,
    },
    [
      ['A', 3],
      ['B', 2],
      ['C', 1],
    ],
  ),
  define(
    'SORTBY',
    'Sort by a related column',
    'Dynamic arrays',
    'Sort a range by one or two related key columns or key rows.',
    [
      data(),
      data('by', 'First sort keys'),
      field('sortOrder', 'First direction', 'select', 1, [
        { label: 'Ascending', value: 1 },
        { label: 'Descending', value: -1 },
      ]),
      field('by2', 'Second keys (optional)', 'data', []),
      field('sortOrder2', 'Second direction', 'select', 1, [
        { label: 'Ascending', value: 1 },
        { label: 'Descending', value: -1 },
      ]),
    ],
    (a) => {
      const original = matrix(a.data),
        keyMatrix = matrix(a.by),
        horizontal = keyMatrix.length === 1 && keyMatrix[0].length > 1;
      const m = horizontal ? transpose(original) : original,
        keys = vector(a.by),
        second = a.by2?.length ? vector(a.by2) : undefined;
      if (keys.length !== m.length || (second && second.length !== m.length))
        fail('#VALUE!', 'Sort keys must align with the selected range.');
      const order = integer(a.sortOrder ?? 1),
        order2 = integer(a.sortOrder2 ?? 1);
      if (![1, -1].includes(order) || ![1, -1].includes(order2))
        fail('#VALUE!', 'Sort direction must be 1 or -1.');
      const result = m
        .map((row, i) => ({ row, i }))
        .sort(
          (x, y) =>
            cmp(keys[x.i], keys[y.i]) * order ||
            (second ? cmp(second[x.i], second[y.i]) * order2 : 0),
        )
        .map((v) => v.row);
      return horizontal ? transpose(result) : result;
    },
    { data: [['Ali'], ['Bina'], ['Chen']], by: [70, 90, 80], sortOrder: -1 },
    [['Bina'], ['Chen'], ['Ali']],
  ),
  define(
    'UNIQUE',
    'Remove duplicate rows',
    'Dynamic arrays',
    'Return distinct rows or columns, optionally keeping only entries that occur exactly once.',
    [
      data(),
      field('byCol', 'Compare columns instead of rows', 'boolean', false),
      field('exactlyOnce', 'Keep only values occurring once', 'boolean', false),
    ],
    (a) => {
      const m = a.byCol ? transpose(matrix(a.data)) : matrix(a.data);
      const equal = (x: any[], y: any[]) => x.every((v, i) => cmp(v, y[i]) === 0);
      const out = m.filter(
        (row, i) =>
          !m.slice(0, i).some((other) => equal(row, other)) &&
          (!a.exactlyOnce || m.filter((other) => equal(row, other)).length === 1),
      );
      if (!out.length) fail('#CALC!', 'No unique entries match the selected policy.');
      return a.byCol ? transpose(out) : out;
    },
    {
      data: [
        ['A', 1],
        ['B', 2],
        ['a', 1],
      ],
      exactlyOnce: true,
    },
    [['B', 2]],
  ),
  define(
    'SEQUENCE',
    'Generate a number sequence',
    'Dynamic arrays',
    'Create a rectangular sequence with chosen start and step.',
    [
      field('rows', 'Rows', 'number', 5),
      field('columns', 'Columns', 'number', 1),
      field('start', 'Start', 'number', 1),
      field('step', 'Step', 'number', 1),
    ],
    (a) => {
      const r = integer(a.rows ?? 5),
        c = integer(a.columns ?? 1);
      boundedSize(r, c);
      return Array.from({ length: r }, (_, i) =>
        Array.from(
          { length: c },
          (_, j) => numeric(a.start ?? 1) + (i * c + j) * numeric(a.step ?? 1),
        ),
      );
    },
    { rows: 2, columns: 3, start: 10, step: 2 },
    [
      [10, 12, 14],
      [16, 18, 20],
    ],
  ),
  define(
    'TRANSPOSE',
    'Swap rows and columns',
    'Dynamic arrays',
    'Turn rows into columns and columns into rows.',
    [data()],
    (a) => transpose(matrix(a.data)),
    {
      data: [
        [1, 2, 3],
        [4, 5, 6],
      ],
    },
    [
      [1, 4],
      [2, 5],
      [3, 6],
    ],
  ),
  ...(['TAKE', 'DROP'] as const).map((name) =>
    define(
      name,
      name === 'TAKE' ? 'Keep rows or columns from an edge' : 'Remove rows or columns from an edge',
      'Dynamic arrays',
      'Positive counts select the beginning; negative counts select the end. Leave columns blank to keep all columns.',
      [
        data(),
        field('rows', name === 'TAKE' ? 'Rows to keep' : 'Rows to remove', 'number', 1),
        field('columns', 'Columns (optional)', 'text', ''),
      ],
      (a) => {
        const m = matrix(a.data),
          r = integer(a.rows ?? 1),
          c = a.columns === undefined || a.columns === '' ? undefined : integer(a.columns);
        const part = (values: any[], count: number | undefined): any[] =>
          count === undefined
            ? values
            : name === 'TAKE'
              ? count === 0
                ? []
                : count > 0
                  ? values.slice(0, count)
                  : values.slice(count)
              : count === 0
                ? values.slice()
                : count > 0
                  ? values.slice(count)
                  : values.slice(0, Math.max(0, values.length + count));
        const result = part(m, r).map((row: any[]) => part(row, c));
        if (!result.length || !result[0].length)
          fail('#CALC!', 'The selected counts produce an empty array.');
        return result;
      },
      {
        data: [
          [1, 2],
          [3, 4],
          [5, 6],
        ],
        rows: name === 'TAKE' ? -2 : 1,
        columns: -1,
      },
      name === 'TAKE' ? [[4], [6]] : [[3], [5]],
    ),
  ),
  ...(['CHOOSECOLS', 'CHOOSEROWS'] as const).map((name) =>
    define(
      name,
      name === 'CHOOSECOLS' ? 'Select and rearrange columns' : 'Select and rearrange rows',
      'Dynamic arrays',
      'Choose 1-based positions, using negative positions to count from the end.',
      [data(), data('indices', 'Positions (duplicates allowed)')],
      (a) => {
        const original = matrix(a.data),
          m = name === 'CHOOSECOLS' ? transpose(original) : original;
        const indices = flatten(a.indices).map((v) => integer(v));
        if (!indices.length || indices.some((i) => i === 0 || Math.abs(i) > m.length))
          fail('#VALUE!', 'Positions must be nonzero and inside the range.');
        const result = indices.map((i) => m[i > 0 ? i - 1 : m.length + i]);
        return name === 'CHOOSECOLS' ? transpose(result) : result;
      },
      {
        data: [
          [1, 2, 3],
          [4, 5, 6],
        ],
        indices: name === 'CHOOSECOLS' ? [3, 1, -1] : [-1, 1],
      },
      name === 'CHOOSECOLS'
        ? [
            [3, 1, 3],
            [6, 4, 6],
          ]
        : [
            [4, 5, 6],
            [1, 2, 3],
          ],
    ),
  ),
  ...(['VSTACK', 'HSTACK'] as const).map((name) =>
    define(
      name,
      name === 'VSTACK' ? 'Stack ranges vertically' : 'Join ranges horizontally',
      'Dynamic arrays',
      'Combine ranges, filling unmatched dimensions with #N/A cells.',
      [data('first', 'First range'), data('second', 'Second range')],
      (a) => {
        const arrays = a.arrays ? a.arrays.map(matrix) : [matrix(a.first), matrix(a.second)];
        if (name === 'VSTACK') {
          const width = Math.max(...arrays.map((m: any[][]) => m[0].length));
          return arrays.flatMap((m: any[][]) =>
            m.map((row) =>
              Array.from({ length: width }, (_, c) => (c < row.length ? row[c] : NA())),
            ),
          );
        }
        const height = Math.max(...arrays.map((m: any[][]) => m.length));
        return Array.from({ length: height }, (_, r) =>
          arrays.flatMap((m: any[][]) => m[r] || Array.from({ length: m[0].length }, NA)),
        );
      },
      name === 'VSTACK'
        ? { first: [[1, 2]], second: [[3, 4]] }
        : { first: [[1], [2]], second: [[3], [4]] },
      name === 'VSTACK'
        ? [
            [1, 2],
            [3, 4],
          ]
        : [
            [1, 3],
            [2, 4],
          ],
    ),
  ),
  ...(['TOCOL', 'TOROW'] as const).map((name) =>
    define(
      name,
      name === 'TOCOL' ? 'Flatten into one column' : 'Flatten into one row',
      'Dynamic arrays',
      'Scan a rectangular range into one row or column, optionally ignoring blanks and errors.',
      [
        data(),
        field('ignore', 'Ignore', 'select', 0, [
          { label: 'Nothing', value: 0 },
          { label: 'Blanks', value: 1 },
          { label: 'Errors', value: 2 },
          { label: 'Blanks and errors', value: 3 },
        ]),
        field('scanByColumn', 'Scan down columns first', 'boolean', false),
      ],
      (a) => {
        const m = matrix(a.data),
          ignore = integer(a.ignore ?? 0);
        if (![0, 1, 2, 3].includes(ignore)) fail('#VALUE!', 'Ignore mode must be 0, 1, 2 or 3.');
        const list = flatten(a.scanByColumn ? transpose(m) : m)
          .filter(
            (v) =>
              !(ignore & 1 && v === null) &&
              !(ignore & 2 && v && typeof v === 'object' && 'error' in v),
          )
          .map((v) => (v === null ? 0 : v));
        if (!list.length) fail('#CALC!', 'No values remain after filtering.');
        return name === 'TOCOL' ? list.map((v) => [v]) : [list];
      },
      {
        data: [
          [1, null],
          [2, 3],
        ],
        ignore: 1,
        scanByColumn: true,
      },
      name === 'TOCOL' ? [[1], [2], [3]] : [[1, 2, 3]],
      [
        'Blank cells are null; empty text strings are preserved. Unignored blanks become zero as in Excel.',
      ],
    ),
  ),
  define(
    'EXPAND',
    'Expand a range with padding',
    'Dynamic arrays',
    'Extend a rectangular range to a larger size and fill new cells.',
    [
      data(),
      field('rows', 'Result rows', 'number', 3),
      field('columns', 'Result columns', 'number', 3),
      field('pad', 'Padding value', 'text', '#N/A'),
    ],
    (a) => {
      const m = matrix(a.data),
        r = integer(a.rows ?? m.length),
        c = integer(a.columns ?? m[0].length);
      boundedSize(r, c);
      if (r < m.length || c < m[0].length)
        fail('#VALUE!', 'Expansion dimensions cannot shrink the source range.');
      return Array.from({ length: r }, (_, i) =>
        Array.from({ length: c }, (_, j) =>
          i < m.length && j < m[0].length
            ? m[i][j]
            : a.pad === undefined || a.pad === '#N/A'
              ? NA()
              : a.pad,
        ),
      );
    },
    { data: [[1, 2]], rows: 2, columns: 3, pad: 0 },
    [
      [1, 2, 0],
      [0, 0, 0],
    ],
  ),
  ...(['WRAPROWS', 'WRAPCOLS'] as const).map((name) =>
    define(
      name,
      name === 'WRAPROWS' ? 'Wrap a list into rows' : 'Wrap a list into columns',
      'Dynamic arrays',
      'Wrap a vector after the selected number of items, padding its final row or column.',
      [
        data('data', 'Source row or column'),
        field('wrapCount', 'Items per row or column', 'number', 3),
        field('pad', 'Padding value', 'text', '#N/A'),
      ],
      (a) => {
        const v = vector(a.data),
          count = integer(a.wrapCount ?? 3);
        if (count < 1) fail('#NUM!', 'Wrap count must be at least 1.');
        boundedSize(Math.ceil(v.length / count), count);
        const result = Array.from({ length: Math.ceil(v.length / count) }, (_, r) =>
          Array.from({ length: count }, (_, c) =>
            r * count + c < v.length
              ? v[r * count + c]
              : a.pad === undefined || a.pad === '#N/A'
                ? NA()
                : a.pad,
          ),
        );
        return name === 'WRAPCOLS' ? transpose(result) : result;
      },
      { data: [1, 2, 3, 4, 5], wrapCount: 3, pad: 0 },
      name === 'WRAPROWS'
        ? [
            [1, 2, 3],
            [4, 5, 0],
          ]
        : [
            [1, 4],
            [2, 5],
            [3, 0],
          ],
    ),
  ),
];

const variable = (name: string) => ({ op: 'variable', name });
const literal = (value: any) => ({ op: 'value', value });
const operationField = (defaultOperation: any) =>
  field('operations', 'Visual operation', 'operations', defaultOperation);
const safeNotes = [
  'Uses a safe operation tree rather than JavaScript or formula text. Recursive lambdas and nested spilled arrays are not supported.',
];
const defaultMap = { op: 'multiply', args: [variable('value'), literal(2)] };
const defaultSum = { op: 'sum', args: [variable('values')] };
const accumulator = { op: 'add', args: [variable('accumulator'), variable('value')] };
const operationCell = (calculate: () => any): any => {
  try {
    return scalarResult(calculate());
  } catch (error) {
    if (!(error instanceof CalcError) || ['#NAME?', '#CALC!'].includes(error.code)) throw error;
    return { error: error.code, message: error.message };
  }
};
const reusableFunctions: FunctionDef[] = [
  define(
    'LET',
    'Name intermediate calculation values',
    'Dynamic arrays',
    'Name intermediate values and calculate a final result using the visual operation builder.',
    [
      field('bindings', 'Named values', 'operations', [
        { name: 'subtotal', value: { op: 'value', value: 100 } },
      ]),
      operationField({ op: 'multiply', args: [variable('subtotal'), literal(1.1)] }),
    ],
    (a) => {
      const scope: Record<string, any> = Object.create(null);
      const bindings = a.bindings ?? [];
      if (!Array.isArray(bindings) || bindings.length > 126)
        fail('#VALUE!', 'LET supports at most 126 named intermediate values.');
      for (const b of bindings) {
        validName(b.name);
        scope[b.name] = evaluateOperation(b.value, scope);
      }
      return evaluateOperation(a.operations, scope);
    },
    {
      bindings: [
        { name: 'price', value: literal(20) },
        { name: 'quantity', value: literal(3) },
      ],
      operations: { op: 'multiply', args: [variable('price'), variable('quantity')] },
    },
    60,
    safeNotes,
  ),
  define(
    'LAMBDA',
    'Define and run a reusable calculation',
    'Dynamic arrays',
    'Name parameters, build a safe calculation, and apply it to supplied argument values.',
    [
      field('parameters', 'Parameter names (comma separated)', 'text', 'value'),
      operationField(defaultMap),
      data('arguments', 'Argument values'),
    ],
    (a) => {
      const names = parameterNames(a.parameters, ['value']);
      if (names.length > 253) fail('#VALUE!', 'At most 253 parameters are supported.');
      const values = flatten(a.arguments);
      if (values.length !== names.length)
        fail('#VALUE!', 'Supply one argument for each named parameter.');
      const scope = Object.fromEntries(names.map((n, i) => [n, values[i]]));
      return evaluateOperation(a.operations ?? defaultMap, scope);
    },
    { parameters: 'value', operations: defaultMap, arguments: [7] },
    14,
    safeNotes,
  ),
  define(
    'MAP',
    'Calculate each cell with a reusable operation',
    'Dynamic arrays',
    'Apply a named reusable calculation to every cell, with an optional aligned second range.',
    [
      data(),
      field('second', 'Second range (optional)', 'data', []),
      field('parameters', 'Parameter names', 'text', 'value'),
      operationField(defaultMap),
    ],
    (a) => {
      const m = matrix(a.data),
        second = a.second?.length ? matrix(a.second) : undefined,
        names = parameterNames(a.parameters, second ? ['value', 'other'] : ['value']);
      if (names.length !== (second ? 2 : 1))
        fail('#VALUE!', 'Parameter count must match the number of input ranges.');
      if (second && (second.length !== m.length || second[0].length !== m[0].length))
        fail('#VALUE!', 'Mapped input ranges must have identical dimensions.');
      return m.map((row, r) =>
        row.map((value, c) =>
          operationCell(() =>
            evaluateOperation(a.operations ?? defaultMap, {
              [names[0]]: value,
              ...(second ? { [names[1]]: second[r][c] } : {}),
            }),
          ),
        ),
      );
    },
    {
      data: [
        [1, 2],
        [3, 4],
      ],
      operations: defaultMap,
    },
    [
      [2, 4],
      [6, 8],
    ],
    safeNotes,
  ),
  ...(['BYROW', 'BYCOL'] as const).map((name) =>
    define(
      name,
      name === 'BYROW' ? 'Calculate a result for every row' : 'Calculate a result for every column',
      'Dynamic arrays',
      'Pass each row or column to a safe reusable calculation that returns one value.',
      [data(), field('parameters', 'Parameter name', 'text', 'values'), operationField(defaultSum)],
      (a) => {
        const m = name === 'BYCOL' ? transpose(matrix(a.data)) : matrix(a.data),
          names = parameterNames(a.parameters, ['values']);
        if (names.length !== 1)
          fail('#VALUE!', 'Row and column operations take exactly one parameter.');
        const result = m.map((row) =>
          operationCell(() => evaluateOperation(a.operations ?? defaultSum, { [names[0]]: row })),
        );
        return name === 'BYROW' ? result.map((v) => [v]) : [result];
      },
      {
        data: [
          [1, 2],
          [3, 4],
        ],
        operations: defaultSum,
      },
      name === 'BYROW' ? [[3], [7]] : [[4, 6]],
      safeNotes,
    ),
  ),
  ...(['REDUCE', 'SCAN'] as const).map((name) =>
    define(
      name,
      name === 'REDUCE'
        ? 'Combine values into an accumulated result'
        : 'Show running accumulated values',
      'Dynamic arrays',
      'Process cells in row order using a safe operation with accumulator and value parameters.',
      [
        data(),
        field('initial', 'Initial accumulated value', 'number', 0),
        field('parameters', 'Parameter names', 'text', 'accumulator,value'),
        operationField(accumulator),
      ],
      (a) => {
        const m = matrix(a.data),
          names = parameterNames(a.parameters, ['accumulator', 'value']);
        if (names.length !== 2)
          fail('#VALUE!', 'Accumulating operations take accumulator and value parameters.');
        let total = a.initial ?? 0;
        const out = m.map((row) =>
          row.map((value) => {
            total = scalarResult(
              evaluateOperation(a.operations ?? accumulator, {
                [names[0]]: total,
                [names[1]]: value,
              }),
            );
            return total;
          }),
        );
        return name === 'SCAN' ? out : total;
      },
      {
        data: [
          [1, 2],
          [3, 4],
        ],
        initial: 10,
        operations: accumulator,
      },
      name === 'SCAN'
        ? [
            [11, 13],
            [16, 20],
          ]
        : 20,
      safeNotes,
    ),
  ),
  define(
    'MAKEARRAY',
    'Generate a table from row and column positions',
    'Dynamic arrays',
    'Create a table by applying a safe calculation to each 1-based row and column position.',
    [
      field('rows', 'Rows', 'number', 3),
      field('columns', 'Columns', 'number', 3),
      field('parameters', 'Parameter names', 'text', 'row,column'),
      operationField({ op: 'multiply', args: [variable('row'), variable('column')] }),
    ],
    (a) => {
      const r = integer(a.rows ?? 3),
        c = integer(a.columns ?? 3);
      boundedSize(r, c);
      const names = parameterNames(a.parameters, ['row', 'column']);
      if (names.length !== 2) fail('#VALUE!', 'Array generation takes row and column parameters.');
      return Array.from({ length: r }, (_, i) =>
        Array.from({ length: c }, (_, j) =>
          operationCell(() =>
            evaluateOperation(
              a.operations ?? { op: 'multiply', args: [variable('row'), variable('column')] },
              { [names[0]]: i + 1, [names[1]]: j + 1 },
            ),
          ),
        ),
      );
    },
    {
      rows: 2,
      columns: 3,
      operations: { op: 'multiply', args: [variable('row'), variable('column')] },
    },
    [
      [1, 2, 3],
      [2, 4, 6],
    ],
    safeNotes,
  ),
];

const databaseExample = [
  ['Department', 'Salary', 'Name'],
  ['HR', 100, 'Ali'],
  ['IT', 200, 'Bina'],
  ['HR', 300, 'Chen'],
  ['HR', null, 'Dina'],
];
const fieldIndex = (headers: any[], value: any): number => {
  const numericIndex =
    typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))
      ? integer(value) - 1
      : headers.findIndex((h) => String(h).toLowerCase() === String(value).toLowerCase());
  if (numericIndex < 0 || numericIndex >= headers.length)
    fail('#VALUE!', `Unknown database field '${value}'.`);
  return numericIndex;
};
const filteredRecords = (a: any): { headers: any[]; rows: any[][]; index: number } => {
  const db = matrix(a.database);
  if (db.length < 2) fail('#VALUE!', 'A database needs a header row and at least one data row.');
  const headers = db[0],
    index = fieldIndex(headers, a.field);
  const criteria = a.criteria?.length ? matrix(a.criteria) : [[]];
  if (!criteria[0]?.length) return { headers, rows: db.slice(1), index };
  if (criteria.length < 2)
    fail('#VALUE!', 'Criteria need a header row and at least one condition row.');
  const columns = criteria[0].map((h) => fieldIndex(headers, h));
  const rows = db
    .slice(1)
    .filter((row) =>
      criteria
        .slice(1)
        .some((conditions) =>
          conditions.every((condition, c) => matchesCriterion(row[columns[c]], condition, true)),
        ),
    );
  return { headers, rows, index };
};
const expectedDatabase: Record<string, number> = {
  DSUM: 400,
  DAVERAGE: 200,
  DCOUNT: 2,
  DCOUNTA: 2,
  DMAX: 300,
  DMIN: 100,
  DGET: 200,
  DPRODUCT: 30000,
  DSTDEV: Math.sqrt(20000),
  DVAR: 20000,
};
const dbDescriptions: Record<string, string> = {
  DSUM: 'Sum matching numeric records',
  DAVERAGE: 'Average matching numeric records',
  DCOUNT: 'Count matching numeric records',
  DCOUNTA: 'Count matching nonblank records',
  DMAX: 'Largest matching numeric value',
  DMIN: 'Smallest matching numeric value',
  DGET: 'Get exactly one matching record',
  DPRODUCT: 'Multiply matching numeric values',
  DSTDEV: 'Sample standard deviation of matching records',
  DVAR: 'Sample variance of matching records',
};
const databaseFunctions = Object.keys(expectedDatabase).map((name) =>
  define(
    name,
    dbDescriptions[name],
    'Database',
    'Apply database criteria: all conditions in one criteria row must match; criteria rows are alternatives.',
    [
      data('database', 'Database including header row'),
      field('field', 'Result field name or number', 'text', 'Salary'),
      field('criteria', 'Criteria table including header row', 'matrix', [['Department'], ['HR']]),
    ],
    (a) => {
      const { rows, index } = filteredRecords(a),
        values = rows.map((row) => row[index]);
      values.forEach(cellError);
      if (name === 'DGET')
        return values.length === 1
          ? values[0]
          : fail(
              values.length ? '#NUM!' : '#VALUE!',
              values.length ? 'More than one record matches DGET.' : 'No record matches DGET.',
            );
      const n = numbers(values),
        total = n.reduce((s, x) => s + x, 0);
      if (name === 'DSUM') return total;
      if (name === 'DCOUNT') return n.length;
      if (name === 'DCOUNTA') return values.filter((v) => v !== null && v !== '').length;
      if (name === 'DAVERAGE')
        return n.length ? total / n.length : fail('#DIV/0!', 'No numeric matching records.');
      if (name === 'DMAX') return n.length ? Math.max(...n) : 0;
      if (name === 'DMIN') return n.length ? Math.min(...n) : 0;
      if (name === 'DPRODUCT') return n.length ? n.reduce((p, v) => p * v, 1) : 0;
      if (n.length < 2)
        fail(
          '#DIV/0!',
          'At least two numeric matching records are required for sample statistics.',
        );
      const mean = total / n.length,
        variance = n.reduce((s, v) => s + (v - mean) ** 2, 0) / (n.length - 1);
      return name === 'DSTDEV' ? Math.sqrt(variance) : variance;
    },
    {
      database: databaseExample,
      field: 'Salary',
      criteria: [['Department'], [name === 'DGET' ? 'IT' : 'HR']],
    },
    expectedDatabase[name],
    [
      'Criteria text without an explicit operator uses Excel database prefix matching. Wildcards and escaped wildcards are supported. Formula-based criteria columns are not supported.',
    ],
  ),
);

const filtersObject = (filters: any): Record<string, string> => {
  if (!filters) return {};
  if (Array.isArray(filters))
    return Object.fromEntries(
      filters.map((filter: any) => [
        filter.column ?? filter.dimension ?? filter.field,
        String(filter.value),
      ]),
    );
  return filters;
};
const provider = (a: any, c: CalcContext) => {
  const id = String(a.connection || '');
  const selected = c.providers?.[id];
  if (!selected)
    fail(
      '#CONNECT!',
      `Connection '${id || '(none)'}' is not configured. Select the labeled demo model or register a production model provider.`,
    );
  return selected;
};
const cubeFields = () => [field('connection', 'Analytical connection', 'text', 'demo')];
const cubeNotes = [
  'Requires an explicitly configured model provider. The demo connection is a labeled local sales dataset, not Excel/SSAS cube compatibility. Production adapters and their credentials/infrastructure must be supplied separately.',
];
const pivotFunctions: FunctionDef[] = [
  define(
    'GETPIVOTDATA',
    'Get a filtered pivot summary',
    'Pivot & analytical models',
    'Summarize a field from a local table with pivot-style filters and aggregation.',
    [
      data('database', 'Source table including header row'),
      field('field', 'Value field name or number', 'text', 'Salary'),
      field('aggregation', 'Summary', 'select', 'sum', [
        'sum',
        'average',
        'count',
        'counta',
        'min',
        'max',
        'product',
      ]),
      field('filters', 'Pivot field filters', 'conditions', []),
    ],
    (a) => {
      const db = matrix(a.database);
      if (db.length < 2) fail('#REF!', 'A pivot source needs headers and records.');
      const index = fieldIndex(db[0], a.field),
        filters = Array.isArray(a.filters)
          ? a.filters
          : Object.entries(a.filters || {}).map(([column, value]) => ({ column, value }));
      const rows = db
        .slice(1)
        .filter((row) =>
          filters.every((f: any) =>
            matchesCriterion(
              row[fieldIndex(db[0], f.column ?? f.field)],
              `${f.operator || '='}${f.value ?? ''}`,
            ),
          ),
        );
      if (!rows.length) fail('#REF!', 'No pivot items match these filters.');
      const values = rows.map((r) => r[index]);
      values.forEach(cellError);
      const n = numbers(values),
        total = n.reduce((s, v) => s + v, 0);
      switch (a.aggregation || 'sum') {
        case 'sum':
          return total;
        case 'average':
          return n.length ? total / n.length : fail('#DIV/0!', 'Pivot contains no numeric values.');
        case 'count':
          return n.length;
        case 'counta':
          return values.filter((v) => v !== null && v !== '').length;
        case 'min':
          return n.length ? Math.min(...n) : 0;
        case 'max':
          return n.length ? Math.max(...n) : 0;
        case 'product':
          return n.length ? n.reduce((p, v) => p * v, 1) : 0;
        default:
          return fail('#VALUE!', 'Select a supported pivot aggregation.');
      }
    },
    {
      database: databaseExample,
      field: 'Salary',
      filters: [{ column: 'Department', value: 'HR' }],
      aggregation: 'sum',
    },
    400,
    [
      'Uses a functioning local pivot summary rather than referencing a stored Excel PivotTable object.',
    ],
  ),
  define(
    'CUBEVALUE',
    'Read a connected model measure',
    'Pivot & analytical models',
    'Read an aggregate measure from the selected analytical provider and member filters.',
    [
      ...cubeFields(),
      field('measure', 'Measure', 'text', 'Sales'),
      field('filters', 'Dimension member filters', 'conditions', []),
    ],
    (a, c) => provider(a, c).value(String(a.measure), filtersObject(a.filters)),
    { connection: 'demo', measure: 'Sales', filters: [{ column: 'Region', value: 'North' }] },
    2000,
    cubeNotes,
    { providers: { demo: demoProvider } },
  ),
  define(
    'CUBEMEMBER',
    'Browse connected model members',
    'Pivot & analytical models',
    'Read model dimension members, optionally validating and returning one selected member.',
    [
      ...cubeFields(),
      field('dimension', 'Dimension', 'text', 'Region'),
      field('member', 'Member (blank = list all)', 'text', ''),
    ],
    (a, c) => {
      const members = provider(a, c).members(String(a.dimension));
      if (a.member !== undefined && a.member !== '')
        return members.includes(String(a.member))
          ? String(a.member)
          : fail('#N/A', 'The selected member does not exist in this model dimension.');
      return members.map((m) => [m]);
    },
    { connection: 'demo', dimension: 'Region', member: 'North' },
    'North',
    cubeNotes,
    { providers: { demo: demoProvider } },
  ),
];

export const advancedFunctions: FunctionDef[] = [
  ...lookupFunctions,
  ...referenceFunctions,
  ...arrayFunctions,
  ...reusableFunctions,
  ...databaseFunctions,
  ...pivotFunctions,
].map((def) => ({ ...def, external: def.name.startsWith('CUBE') }));
