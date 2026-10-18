import { useEffect, useState } from 'react';
import { Plus, Trash2, Table2, Braces, CornerDownLeft } from 'lucide-react';
import type { FunctionDef, InputDef, Workbook, CalculationResult } from '../engine/types';
import type { Binding } from '../engine/bindings';
import { colLetter, parseLiteral } from '../engine/bindings';
import type { Selection } from './Grid';
import { ComparisonInput } from './ComparisonInput';
import { inputGuidance, sourceHelp } from '../help/guides';

const literalText = (value: any) =>
  value === undefined || value === null
    ? ''
    : typeof value === 'string'
      ? value
      : Array.isArray(value) && value.every((v) => !Array.isArray(v) && typeof v !== 'object')
        ? value.join(', ')
        : JSON.stringify(value);
export function defaultArgs(
  def: FunctionDef,
  workbook: Workbook,
  sheetId: string,
): Record<string, any> {
  const sheet = workbook.sheets.find((s) => s.id === sheetId)!;
  return Object.fromEntries(
    def.inputs.map((input) => {
      let value = input.default ?? def.defaults?.[input.key];
      if (input.type === 'data' || input.type === 'matrix') {
        // Example observations are only loaded by the explicit Try example action.
        const candidates = sheet.columns.filter(
          (c) => c.type === 'number' || c.type === 'currency' || c.type === 'percentage',
        );
        value =
          value !== undefined && !Array.isArray(value)
            ? value
            : {
                __source: 'column',
                sheetId,
                columnId: input.type === 'data' && candidates.length === 1 ? candidates[0].id : '',
              };
        if (
          input.default !== undefined &&
          (!Array.isArray(input.default) || input.default.length === 0)
        )
          value = input.default;
      }
      if (input.type === 'operations')
        value = value ?? {
          op: 'multiply',
          args: [
            { op: 'variable', name: 'value' },
            { op: 'value', value: 2 },
          ],
        };
      return [input.key, value];
    }),
  );
}
export function InputForm({
  def,
  args,
  onChange,
  workbook,
  sheetId,
  history,
  selection,
}: {
  def: FunctionDef;
  args: Record<string, any>;
  onChange: (a: Record<string, any>) => void;
  workbook: Workbook;
  sheetId: string;
  history: CalculationResult[];
  selection: Selection;
}) {
  const set = (key: string, value: any) => onChange({ ...args, [key]: value });
  return (
    <div className="input-form">
      {def.inputs.map((input, index) => (
        <div className="field" key={input.key}>
          <label htmlFor={`field-${input.key}`}>
            {input.label}
            {input.required && (
              <span className="required-dot" aria-label="required">
                *
              </span>
            )}
          </label>
          <Field
            input={input}
            value={args[input.key]}
            set={(v) => set(input.key, v)}
            workbook={workbook}
            sheetId={sheetId}
            history={history}
            selection={selection}
            example={def.example.args[input.key]}
          />
          <details className="input-instructions">
            <summary>How to fill in {input.label}</summary>
            <p>{inputGuidance(def, input)}</p>
          </details>
          {index === 0 && (input.type === 'data' || input.type === 'matrix') && (
            <small className="field-help">
              <Table2 size={11} /> Your original data stays intact
            </small>
          )}
        </div>
      ))}
    </div>
  );
}
interface FieldProps {
  input: InputDef;
  value: any;
  set: (v: any) => void;
  workbook: Workbook;
  sheetId: string;
  history: CalculationResult[];
  selection: Selection;
  example?: any;
}
function Field(p: FieldProps) {
  const { input, value, set, workbook, sheetId, history, selection, example } = p;
  const binding = value && typeof value === 'object' && '__source' in value;
  if (value?.__comparison)
    return <ComparisonInput value={value} set={set} workbook={workbook} sheetId={sheetId} />;
  if (input.type === 'data' || input.type === 'matrix' || binding) return <SourceField {...p} />;
  if (input.type === 'conditions')
    return example?.[0] &&
      ('condition' in example[0] || 'match' in example[0] || 'column' in example[0]) ? (
      <StructuredEditor
        value={value ?? []}
        template={Object.fromEntries(
          Object.keys(example[0]).map((k) => [
            k,
            k === 'condition' ? false : k === 'operator' ? '=' : '',
          ]),
        )}
        set={set}
      />
    ) : (
      <Conditions value={value} set={set} workbook={workbook} sheetId={sheetId} />
    );
  if (input.type === 'operations')
    return input.key === 'bindings' ? (
      <NamedBindings value={value} set={set} />
    ) : (
      <OperationBuilder value={value} set={set} />
    );
  if (input.key === 'criteria' && input.type === 'text')
    return <CriteriaInput id={`field-${input.key}`} label={input.label} value={value} set={set} />;
  if (input.type === 'select')
    return (
      <select
        id={`field-${input.key}`}
        value={value ?? ''}
        onChange={(e) => {
          const option = input.options?.find((o) =>
            typeof o === 'object' ? String(o.value) === e.target.value : o === e.target.value,
          );
          set(typeof option === 'object' ? option.value : e.target.value);
        }}
      >
        <option value="" disabled>
          Choose an option
        </option>
        {input.options?.map((o) => (
          <option
            key={typeof o === 'string' ? o : o.value}
            value={typeof o === 'string' ? o : o.value}
          >
            {typeof o === 'string' ? o : o.label}
          </option>
        ))}
      </select>
    );
  if (input.type === 'sheet')
    return (
      <select id={`field-${input.key}`} value={value ?? ''} onChange={(e) => set(e.target.value)}>
        <option value="">Select worksheet</option>
        {workbook.sheets.map((s) => (
          <option key={s.id} value={s.name}>
            {s.name}
          </option>
        ))}
      </select>
    );
  if (input.type === 'boolean')
    return (
      <>
        <label className="toggle-field">
          <input
            id={`field-${input.key}`}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => set(e.target.checked)}
          />
          <span>{value ? 'Enabled' : 'Disabled'}</span>
        </label>
        {input.key === 'condition' && (
          <button
            className="text-button"
            onClick={() =>
              set({
                __comparison: {
                  left: { __source: 'column', sheetId, columnId: '' },
                  operator: '>=',
                  right: 0,
                },
              })
            }
          >
            Compare a column with a value
          </button>
        )}
      </>
    );
  if (Array.isArray(value) || (value && typeof value === 'object'))
    return <StructuredEditor value={value} set={set} />;
  if (['reference', 'address', 'ref'].includes(input.key) && input.type === 'text')
    return (
      <div className="reference-field">
        <input
          id={`field-${input.key}`}
          value={value ?? ''}
          placeholder="Select cells in the worksheet"
          onChange={(e) => set(e.target.value)}
        />
        <button
          className="text-button"
          onClick={() => {
            const s = workbook.sheets.find((s) => s.id === sheetId)!;
            const first = `${colLetter(Math.min(selection.c1, selection.c2))}${Math.min(selection.r1, selection.r2) + 2}`,
              last = `${colLetter(Math.max(selection.c1, selection.c2))}${Math.max(selection.r1, selection.r2) + 2}`;
            set(`'${s.name.replace(/'/g, "''")}'!${first}${first === last ? '' : `:${last}`}`);
          }}
        >
          <CornerDownLeft size={12} />
          Use selected cells
        </button>
      </div>
    );
  if (
    input.type === 'text' &&
    ['value', 'search', 'ifTrue', 'ifFalse', 'ifNotFound', 'default'].includes(input.key)
  )
    return (
      <TypedLiteral
        input={input}
        value={value}
        set={set}
        onSource={() => set({ __source: 'column', sheetId, columnId: '' })}
      />
    );
  return (
    <div className="scalar-field">
      <input
        id={`field-${input.key}`}
        type={input.type === 'number' ? 'number' : input.type === 'date' ? 'date' : 'text'}
        step="any"
        value={value ?? ''}
        placeholder={
          input.type === 'number'
            ? 'Enter a number'
            : input.type === 'date'
              ? 'YYYY-MM-DD'
              : typeof example === 'string'
                ? example
                : 'Enter a value'
        }
        onChange={(e) =>
          set(
            input.type === 'number'
              ? e.target.value === ''
                ? undefined
                : Number(e.target.value)
              : e.target.value,
          )
        }
      />
      <button
        className="source-switch"
        title="Use a worksheet column or previous result"
        onClick={() => set({ __source: 'column', sheetId, columnId: '' })}
      >
        <Table2 size={14} />
      </button>
    </div>
  );
}
function TypedLiteral({
  input,
  value,
  set,
  onSource,
}: {
  input: InputDef;
  value: any;
  set: (v: any) => void;
  onSource: () => void;
}) {
  const kind = (v: any) =>
    v === null
      ? 'blank'
      : typeof v === 'number'
        ? 'number'
        : typeof v === 'boolean'
          ? 'boolean'
          : 'text';
  const [type, setType] = useState(kind(value));
  useEffect(() => {
    if (value !== undefined) setType(kind(value));
  }, [value]);
  return (
    <div className="typed-literal">
      <div className="scalar-field">
        {type === 'blank' ? (
          <span className="blank-input">Blank cell</span>
        ) : type === 'boolean' ? (
          <select
            id={`field-${input.key}`}
            value={String(value ?? false)}
            onChange={(e) => set(e.target.value === 'true')}
          >
            <option value="true">TRUE</option>
            <option value="false">FALSE</option>
          </select>
        ) : (
          <input
            id={`field-${input.key}`}
            type={type === 'number' ? 'number' : 'text'}
            step="any"
            value={value ?? ''}
            onChange={(e) =>
              set(
                type === 'number'
                  ? e.target.value === ''
                    ? undefined
                    : Number(e.target.value)
                  : e.target.value,
              )
            }
          />
        )}
        <button
          className="source-switch"
          title="Use a worksheet column or previous result"
          onClick={onSource}
        >
          <Table2 size={14} />
        </button>
      </div>
      <label className="literal-type-label">
        Value type
        <select
          aria-label={`${input.label} value type`}
          value={type}
          onChange={(e) => {
            const next = e.target.value;
            setType(next);
            set(
              next === 'blank'
                ? null
                : next === 'number'
                  ? Number(value) || 0
                  : next === 'boolean'
                    ? value === true
                    : String(value ?? ''),
            );
          }}
        >
          <option value="text">Text (preserves IDs)</option>
          <option value="number">Number</option>
          <option value="boolean">True / false</option>
          <option value="blank">Blank</option>
        </select>
      </label>
    </div>
  );
}
function SourceField(p: FieldProps) {
  const { input, value, set, workbook, sheetId, history, selection } = p;
  const binding: Binding =
    value && typeof value === 'object' && '__source' in value
      ? value
      : { __source: 'literal', text: literalText(value) };
  const sheet =
    workbook.sheets.find((s) => s.id === (binding.sheetId || sheetId)) || workbook.sheets[0];
  const mode = binding.__source;
  return (
    <div className="source-field">
      <div className="source-tabs">
        {[
          ['column', 'Column'],
          ['range', 'Range'],
          ['table', 'Table'],
          ['literal', 'Values'],
          ['result', 'Result'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={mode === id ? 'active' : ''}
            onClick={() =>
              set({ ...binding, __source: id as Binding['__source'], sheetId: sheet.id })
            }
          >
            {label}
          </button>
        ))}
      </div>
      <small className="source-mode-help">{sourceHelp[mode]}</small>
      {['column', 'range', 'table'].includes(mode) && (
        <select
          aria-label={`${input.label} dataset`}
          value={sheet.id}
          onChange={(e) => set({ ...binding, sheetId: e.target.value, columnId: '' })}
        >
          {workbook.sheets.map((s) => (
            <option value={s.id} key={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}
      {mode === 'column' && (
        <select
          id={`field-${input.key}`}
          aria-label={input.label}
          value={binding.columnId || ''}
          onChange={(e) => set({ ...binding, sheetId: sheet.id, columnId: e.target.value })}
        >
          <option value="">Select a column…</option>
          {sheet.columns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.type}
            </option>
          ))}
        </select>
      )}
      {mode === 'range' && (
        <>
          <input
            id={`field-${input.key}`}
            aria-label={input.label}
            placeholder="A2:C10"
            value={binding.range || ''}
            onChange={(e) => set({ ...binding, range: e.target.value })}
          />
          <button
            className="text-button"
            onClick={() =>
              set({
                ...binding,
                sheetId,
                range: `${colLetter(Math.min(selection.c1, selection.c2))}${Math.min(selection.r1, selection.r2) + 2}:${colLetter(Math.max(selection.c1, selection.c2))}${Math.max(selection.r1, selection.r2) + 2}`,
              })
            }
          >
            <CornerDownLeft size={12} />
            Use selected cells
          </button>
        </>
      )}
      {mode === 'table' && (
        <label className="check-label">
          <input
            type="checkbox"
            checked={Boolean(binding.headers)}
            onChange={(e) => set({ ...binding, headers: e.target.checked })}
          />
          Include column headers (database tasks)
        </label>
      )}
      {mode === 'literal' && (
        <textarea
          id={`field-${input.key}`}
          rows={3}
          aria-label={input.label}
          value={binding.text || ''}
          placeholder="Paste values, separated by commas or tabs"
          onChange={(e) => set({ ...binding, text: e.target.value })}
        />
      )}
      {mode === 'result' && (
        <select
          id={`field-${input.key}`}
          value={binding.resultId || ''}
          onChange={(e) => set({ ...binding, resultId: e.target.value })}
        >
          <option value="">Select a previous calculation…</option>
          {history.map((h) => (
            <option key={h.id} value={h.id}>
              {h.taskName} ·{' '}
              {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </option>
          ))}
        </select>
      )}
      {!['data', 'matrix'].includes(input.type) && (
        <button className="text-button muted" onClick={() => set(input.default ?? '')}>
          Use a single value instead
        </button>
      )}
    </div>
  );
}
function CriteriaInput({
  id,
  label,
  value,
  set,
}: {
  id?: string;
  label: string;
  value: any;
  set: (v: any) => void;
}) {
  const match = /^(<=|>=|<>|=|<|>)(.*)$/s.exec(String(value ?? '')),
    operator = match?.[1] || '=',
    text = match?.[2] ?? String(value ?? '');
  const combine = (op: string, raw: string) => set(`${op === '=' ? '' : op}${raw}`);
  return (
    <div className="criteria-input">
      <select
        aria-label={`${label} comparison`}
        value={operator}
        onChange={(e) => combine(e.target.value, text)}
      >
        {[
          ['=', 'is equal to'],
          ['<>', 'is not equal to'],
          ['>', 'is greater than'],
          ['>=', 'is at least'],
          ['<', 'is less than'],
          ['<=', 'is at most'],
        ].map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <input
        id={id}
        aria-label={label}
        value={text}
        placeholder="Enter comparison value"
        onChange={(e) => combine(operator, e.target.value)}
      />
    </div>
  );
}
function Conditions({
  value,
  set,
  workbook,
  sheetId,
}: {
  value: any;
  set: (v: any) => void;
  workbook: Workbook;
  sheetId: string;
}) {
  const rows = Array.isArray(value) ? value : [];
  const sheet = workbook.sheets.find((s) => s.id === sheetId)!;
  return (
    <div className="conditions">
      {rows.map((row: any, i: number) => (
        <div className="condition" key={i}>
          <span className="eyebrow">{i ? 'AND' : 'WHERE'}</span>
          <select
            aria-label={`Condition ${i + 1} column`}
            value={row.range?.columnId || ''}
            onChange={(e) =>
              set(
                rows.map((r, j) =>
                  j === i
                    ? { ...r, range: { __source: 'column', sheetId, columnId: e.target.value } }
                    : r,
                ),
              )
            }
          >
            <option value="">Choose column</option>
            {sheet.columns.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="condition-value">
            <CriteriaInput
              label={`Condition ${i + 1} criteria`}
              value={row.criteria}
              set={(value) => set(rows.map((r, j) => (j === i ? { ...r, criteria: value } : r)))}
            />
            <button title="Remove condition" onClick={() => set(rows.filter((_, j) => j !== i))}>
              <Trash2 size={13} />
            </button>
          </div>
          <small>= equals · &gt; greater · * any text · ~ escapes *</small>
        </div>
      ))}
      <button
        className="text-button"
        onClick={() =>
          set([...rows, { range: { __source: 'column', sheetId, columnId: '' }, criteria: '' }])
        }
      >
        <Plus size={13} />
        Add condition
      </button>
    </div>
  );
}
export function OperationBuilder({
  value,
  set,
  depth = 0,
}: {
  value: any;
  set: (v: any) => void;
  depth?: number;
}) {
  const node = value && typeof value === 'object' ? value : { op: 'value', value: value ?? 0 };
  const names: Record<string, string> = {
    value: 'Constant value',
    variable: 'Named input',
    add: 'Add',
    subtract: 'Subtract',
    multiply: 'Multiply',
    divide: 'Divide',
    power: 'Power',
    sum: 'Total',
    average: 'Average',
    min: 'Minimum',
    max: 'Maximum',
    concat: 'Join text',
    upper: 'Uppercase',
    lower: 'Lowercase',
    abs: 'Absolute value',
    round: 'Round',
    gt: 'Greater than',
    gte: 'At least',
    lt: 'Less than',
    lte: 'At most',
    eq: 'Equals',
    if: 'If / then / else',
  };
  const unary = ['sum', 'average', 'min', 'max', 'upper', 'lower', 'abs'],
    count = node.op === 'if' ? 3 : unary.includes(node.op) ? 1 : 2;
  return (
    <div className="operation-builder">
      <div className="operation-head">
        <Braces size={13} />
        <select
          aria-label="Operation"
          value={node.op}
          onChange={(e) => {
            const op = e.target.value;
            set({
              op,
              ...(op === 'value'
                ? { value: 2 }
                : op === 'variable'
                  ? { name: 'value' }
                  : {
                      args: [
                        { op: 'variable', name: 'value' },
                        { op: 'value', value: 2 },
                        { op: 'value', value: 0 },
                      ].slice(0, op === 'if' ? 3 : unary.includes(op) ? 1 : 2),
                    }),
            });
          }}
        >
          {Object.entries(names).map(([op, label]) => (
            <option key={op} value={op}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {node.op === 'value' ? (
        <input
          aria-label="Constant value"
          value={literalText(node.value)}
          onChange={(e) => {
            let v: any = e.target.value;
            try {
              v = parseLiteral(v);
            } catch {
              /* retain text */
            }
            set({ ...node, value: v });
          }}
        />
      ) : node.op === 'variable' ? (
        <input
          aria-label="Input name"
          value={node.name || ''}
          onChange={(e) => set({ ...node, name: e.target.value })}
        />
      ) : (
        Array.from({ length: count }, (_, i) => (
          <div className="operand" key={i}>
            <small>{node.op === 'if' ? ['When', 'Then', 'Otherwise'][i] : `Input ${i + 1}`}</small>
            {depth < 4 ? (
              <OperationBuilder
                value={node.args?.[i]}
                depth={depth + 1}
                set={(v) => {
                  const args = [...(node.args || [])];
                  args[i] = v;
                  set({ ...node, args });
                }}
              />
            ) : (
              <input
                value={node.args?.[i]?.name || node.args?.[i]?.value || ''}
                onChange={(e) => {
                  const args = [...(node.args || [])];
                  args[i] = { op: 'value', value: parseLiteral(e.target.value) };
                  set({ ...node, args });
                }}
              />
            )}
          </div>
        ))
      )}
    </div>
  );
}
function NamedBindings({ value, set }: { value: any; set: (v: any) => void }) {
  const rows = Array.isArray(value) ? value : [];
  const update = (index: number, patch: Record<string, any>) =>
    set(rows.map((row: any, i: number) => (i === index ? { ...row, ...patch } : row)));
  const add = () => {
    let number = rows.length + 1;
    while (rows.some((row: any) => row.name === `value${number}`)) number++;
    set([...rows, { name: `value${number}`, value: { op: 'value', value: 0 } }]);
  };
  return (
    <div className="named-bindings">
      <small className="field-help">
        Values are calculated from top to bottom. Use a name in later operations by choosing Named
        input.
      </small>
      {rows.map((row: any, i: number) => (
        <div className="condition" key={i}>
          <div className="condition-value">
            <label htmlFor={`binding-name-${i}`}>Name {i + 1}</label>
            <input
              id={`binding-name-${i}`}
              aria-label={`Intermediate value ${i + 1} name`}
              value={row.name ?? ''}
              placeholder="e.g. subtotal"
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <button
              type="button"
              title={`Remove named value ${i + 1}`}
              onClick={() => set(rows.filter((_: any, j: number) => j !== i))}
            >
              <Trash2 size={13} />
            </button>
          </div>
          <OperationBuilder value={row.value} set={(next) => update(i, { value: next })} />
        </div>
      ))}
      <button type="button" className="text-button" onClick={add}>
        <Plus size={13} />
        Add named value
      </button>
    </div>
  );
}
function StructuredEditor({
  value,
  set,
  template,
}: {
  value: any;
  set: (v: any) => void;
  template?: Record<string, any>;
}) {
  const [advanced, setAdvanced] = useState(false);
  const rows = Array.isArray(value) ? value : [value],
    sample = rows[0] ?? template,
    isObject = sample && typeof sample === 'object' && !Array.isArray(sample);
  const keys = isObject ? Object.keys(sample) : [];
  if (isObject)
    return (
      <div className="structured-editor">
        {rows.map((r: any, i: number) => (
          <div className="structured-row" key={i}>
            {keys.map((k) => {
              const update = (next: any) =>
                set(rows.map((row: any, j: number) => (j === i ? { ...row, [k]: next } : row)));
              return r[k] && typeof r[k] === 'object' && 'op' in r[k] ? (
                <div className="structured-operation" key={k}>
                  <span className="field-help">{k}</span>
                  <OperationBuilder value={r[k]} set={update} />
                </div>
              ) : (
                <label key={k}>
                  {k}
                  <input
                    aria-label={`${k} ${i + 1}`}
                    value={literalText(r[k])}
                    onChange={(e) => update(parseLiteral(e.target.value))}
                  />
                </label>
              );
            })}
            <button title="Remove entry" onClick={() => set(rows.filter((_, j) => j !== i))}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        <button
          className="text-button"
          onClick={() =>
            set([
              ...rows,
              Object.fromEntries(
                keys.map((k) => [
                  k,
                  sample[k] && typeof sample[k] === 'object' && 'op' in sample[k]
                    ? { op: 'value', value: 0 }
                    : (template?.[k] ?? ''),
                ]),
              ),
            ])
          }
        >
          <Plus size={12} />
          Add entry
        </button>
      </div>
    );
  return (
    <>
      <textarea
        rows={3}
        value={advanced ? JSON.stringify(value) : literalText(value)}
        onChange={(e) => {
          try {
            set(parseLiteral(e.target.value));
          } catch {
            /* show last valid entry */
          }
        }}
      />
      <button className="text-button" onClick={() => setAdvanced(!advanced)}>
        {advanced ? 'Simple editor' : 'Structured values'}
      </button>
    </>
  );
}
