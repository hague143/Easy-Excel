import type { Workbook } from '../engine/types';
import { parseScalar } from '../engine/bindings';
export function ComparisonInput({
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
  const cmp = value?.__comparison || {
    left: { __source: 'column', sheetId, columnId: '' },
    operator: '>=',
    right: 0,
  };
  const sheet =
    workbook.sheets.find((s) => s.id === (cmp.left.sheetId || sheetId)) || workbook.sheets[0];
  const update = (v: any) => set({ __comparison: { ...cmp, ...v } });
  return (
    <div className="conditions">
      <select
        aria-label="Compare dataset"
        value={sheet.id}
        onChange={(e) => update({ left: { ...cmp.left, sheetId: e.target.value, columnId: '' } })}
      >
        {workbook.sheets.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Compare column"
        value={cmp.left.columnId}
        onChange={(e) =>
          update({ left: { ...cmp.left, sheetId: sheet.id, columnId: e.target.value } })
        }
      >
        <option value="">Select column…</option>
        {sheet.columns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <div className="condition-value">
        <select
          aria-label="Comparison operator"
          value={cmp.operator}
          onChange={(e) => update({ operator: e.target.value })}
        >
          {[
            ['=', 'equals'],
            ['<>', 'does not equal'],
            ['>', 'greater than'],
            ['>=', 'at least'],
            ['<', 'less than'],
            ['<=', 'at most'],
          ].map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <input
          aria-label="Comparison value"
          value={cmp.right ?? ''}
          onChange={(e) => update({ right: parseScalar(e.target.value) })}
        />
      </div>
      <button className="text-button" onClick={() => set(false)}>
        Use a true / false value instead
      </button>
    </div>
  );
}
