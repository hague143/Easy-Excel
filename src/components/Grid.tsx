import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Trash2, EyeOff } from 'lucide-react';
import type { Sheet, CellValue, DataType } from '../engine/types';
import { colLetter } from '../engine/bindings';
import { parseCellInput, formatCellInput } from '../engine/cell-input';

export interface Selection {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}
export const displayCell = (v: any): string =>
  v === null || v === undefined
    ? ''
    : typeof v === 'object'
      ? v.error || JSON.stringify(v)
      : typeof v === 'boolean'
        ? v
          ? 'TRUE'
          : 'FALSE'
        : String(v);
export function Grid({
  sheet,
  onChange,
  selection,
  onSelect,
}: {
  sheet: Sheet;
  onChange: (s: Sheet) => void;
  selection: Selection;
  onSelect: (s: Selection) => void;
}) {
  const [editing, setEditing] = useState<{ r: number; c: number; text: string } | null>(null),
    [columnMenu, setColumnMenu] = useState<number | null>(null);
  const [page, setPage] = useState(0),
    pageSize = 100,
    totalPages = Math.max(1, Math.ceil(sheet.rows.length / pageSize));
  useEffect(() => {
    if (page >= totalPages) setPage(totalPages - 1);
  }, [page, totalPages]);
  const drag = useRef(false),
    input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const up = () => {
      drag.current = false;
    };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, [editing?.r, editing?.c]);
  const rowMin = Math.min(selection.r1, selection.r2),
    rowMax = Math.max(selection.r1, selection.r2),
    colMin = Math.min(selection.c1, selection.c2),
    colMax = Math.max(selection.c1, selection.c2);
  const select = (r: number, c: number, extend = false) =>
    onSelect(extend ? { ...selection, r2: r, c2: c } : { r1: r, c1: c, r2: r, c2: c });
  function commit() {
    if (!editing) return;
    const rows = sheet.rows.map((r) => [...r]);
    const type = sheet.columns[editing.c].type;
    rows[editing.r][editing.c] = parseCellInput(editing.text, type);
    const formulae = { ...sheet.formulae };
    delete formulae[`${colLetter(editing.c)}${editing.r + 2}`];
    onChange({ ...sheet, rows, formulae });
    setEditing(null);
  }
  function moveColumn(c: number, to: number) {
    if (to < 0 || to >= sheet.columns.length) return;
    const cols = [...sheet.columns],
      rows = sheet.rows.map((r) => [...r]);
    const [col] = cols.splice(c, 1);
    cols.splice(to, 0, col);
    rows.forEach((r) => {
      const [v] = r.splice(c, 1);
      r.splice(to, 0, v);
    });
    onChange({ ...sheet, columns: cols, rows, formulae: undefined });
    setColumnMenu(null);
  }
  function paste(e: React.ClipboardEvent) {
    if (editing) return;
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    e.preventDefault();
    const parts = text
      .replace(/\r/g, '')
      .replace(/\n$/, '')
      .split('\n')
      .map((r) => r.split('\t'));
    if (parts.length * Math.max(...parts.map((r) => r.length)) > 250000) return;
    const rows = sheet.rows.map((r) => [...r]),
      columns = [...sheet.columns],
      formulae = { ...sheet.formulae };
    const height = rowMin + parts.length,
      width = colMin + Math.max(...parts.map((r) => r.length));
    while (columns.length < width)
      columns.push({
        id: crypto.randomUUID(),
        name: `Column ${columns.length + 1}`,
        type: 'mixed',
      });
    while (rows.length < height) rows.push(Array(columns.length).fill(null));
    rows.forEach((r) => {
      while (r.length < columns.length) r.push(null);
    });
    parts.forEach((r, i) =>
      r.forEach((v, j) => {
        rows[rowMin + i][colMin + j] = parseCellInput(v, columns[colMin + j].type);
        delete formulae[`${colLetter(colMin + j)}${rowMin + i + 2}`];
      }),
    );
    onChange({ ...sheet, columns, rows, formulae });
    onSelect({ r1: rowMin, c1: colMin, r2: height - 1, c2: width - 1 });
  }
  return (
    <div className="grid-wrap" onPaste={paste}>
      <table className="data-grid" aria-label={`${sheet.name} editable worksheet`}>
        <thead>
          <tr>
            <th className="row-number corner">
              <button
                title="Select table"
                onClick={() =>
                  onSelect({
                    r1: 0,
                    c1: 0,
                    r2: Math.max(0, sheet.rows.length - 1),
                    c2: sheet.columns.length - 1,
                  })
                }
              >
                ◩
              </button>
            </th>
            {sheet.columns.map((col, c) => (
              <th key={col.id} className={c >= colMin && c <= colMax ? 'selected-header' : ''}>
                <div className="column-head">
                  <button
                    className="column-label"
                    onClick={() =>
                      onSelect({ r1: 0, c1: c, r2: Math.max(0, sheet.rows.length - 1), c2: c })
                    }
                  >
                    <span className="col-letter">{colLetter(c)}</span>
                    <span>{col.name}</span>
                    <span className="type-badge">
                      {col.type === 'number' || col.type === 'currency'
                        ? '#'
                        : col.type === 'date'
                          ? '◷'
                          : 'Aa'}
                    </span>
                  </button>
                  <button
                    aria-label={`Options for ${col.name}`}
                    className="column-options"
                    onClick={() => setColumnMenu(columnMenu === c ? null : c)}
                  >
                    <ChevronDown size={13} />
                  </button>
                </div>
                {columnMenu === c && (
                  <div className="column-menu">
                    <label>
                      Column name
                      <input
                        aria-label="Column name"
                        defaultValue={col.name}
                        onBlur={(e) => {
                          const columns = sheet.columns.map((x, i) =>
                            i === c ? { ...x, name: e.target.value || x.name } : x,
                          );
                          onChange({ ...sheet, columns });
                        }}
                      />
                    </label>
                    <label>
                      Data type
                      <select
                        value={col.type}
                        onChange={(e) =>
                          onChange({
                            ...sheet,
                            columns: sheet.columns.map((x, i) =>
                              i === c ? { ...x, type: e.target.value as DataType } : x,
                            ),
                          })
                        }
                      >
                        {[
                          'text',
                          'number',
                          'currency',
                          'percentage',
                          'boolean',
                          'date',
                          'time',
                          'mixed',
                        ].map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                    <div className="menu-row">
                      <button onClick={() => moveColumn(c, c - 1)}>
                        <ChevronLeft size={14} />
                        Move left
                      </button>
                      <button onClick={() => moveColumn(c, c + 1)}>
                        Move right
                        <ChevronRight size={14} />
                      </button>
                    </div>
                    <button
                      className="danger"
                      disabled={sheet.columns.length === 1}
                      onClick={() => {
                        onChange({
                          ...sheet,
                          columns: sheet.columns.filter((_, i) => i !== c),
                          rows: sheet.rows.map((r) => r.filter((_, i) => i !== c)),
                          formulae: undefined,
                        });
                        setColumnMenu(null);
                      }}
                    >
                      <Trash2 size={14} />
                      Delete column
                    </button>
                    <button onClick={() => setColumnMenu(null)}>Done</button>
                  </div>
                )}
              </th>
            ))}
            <th className="add-column">
              <button
                title="Add column"
                onClick={() =>
                  onChange({
                    ...sheet,
                    columns: [
                      ...sheet.columns,
                      {
                        id: crypto.randomUUID(),
                        name: `Column ${sheet.columns.length + 1}`,
                        type: 'mixed',
                      },
                    ],
                    rows: sheet.rows.map((r) => [...r, null]),
                  })
                }
              >
                <Plus size={16} />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map((row, r) =>
            r < page * pageSize ||
            r >= (page + 1) * pageSize ||
            sheet.filteredRows?.includes(r) ||
            sheet.hiddenRows?.includes(r) ? null : (
              <tr key={r}>
                <th className="row-number">
                  <button
                    aria-label={`Select row ${r + 2}`}
                    onClick={() => onSelect({ r1: r, c1: 0, r2: r, c2: sheet.columns.length - 1 })}
                  >
                    {r + 2}
                  </button>
                </th>
                {sheet.columns.map((col, c) => {
                  const selected = r >= rowMin && r <= rowMax && c >= colMin && c <= colMax,
                    err = row[c] && typeof row[c] === 'object';
                  return (
                    <td
                      key={col.id}
                      data-cell={`${r}:${c}`}
                      tabIndex={0}
                      className={`${selected ? 'selected-cell ' : ''}${typeof row[c] === 'number' ? 'numeric-cell ' : ''}${err ? 'error-cell' : ''}`}
                      title={
                        err
                          ? (row[c] as any).message
                          : sheet.formulae?.[`${colLetter(c)}${r + 2}`]
                            ? `Imported cached formula: ${sheet.formulae[`${colLetter(c)}${r + 2}`]}`
                            : undefined
                      }
                      onMouseDown={(e) => {
                        if (editing) return;
                        drag.current = true;
                        select(r, c, e.shiftKey);
                      }}
                      onMouseEnter={() => {
                        if (drag.current) onSelect({ ...selection, r2: r, c2: c });
                      }}
                      onDoubleClick={() =>
                        setEditing({ r, c, text: formatCellInput(row[c], col.type) })
                      }
                      onKeyDown={(e) => {
                        if (editing) return;
                        if (e.key === 'Enter' || e.key === 'F2') {
                          e.preventDefault();
                          setEditing({ r, c, text: formatCellInput(row[c], col.type) });
                        } else if (e.key === 'Delete' || e.key === 'Backspace') {
                          e.preventDefault();
                          onChange({
                            ...sheet,
                            rows: sheet.rows.map((line, i) =>
                              line.map((v, j) =>
                                i >= rowMin && i <= rowMax && j >= colMin && j <= colMax ? null : v,
                              ),
                            ),
                          });
                        } else if (e.key.startsWith('Arrow')) {
                          e.preventDefault();
                          const nr = Math.max(
                              0,
                              Math.min(
                                sheet.rows.length - 1,
                                r + (e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0),
                              ),
                            ),
                            nc = Math.max(
                              0,
                              Math.min(
                                sheet.columns.length - 1,
                                c + (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0),
                              ),
                            );
                          select(nr, nc, e.shiftKey);
                          if (Math.floor(nr / pageSize) !== page)
                            setPage(Math.floor(nr / pageSize));
                          setTimeout(
                            () =>
                              document
                                .querySelector<HTMLElement>(`[data-cell="${nr}:${nc}"]`)
                                ?.focus(),
                            0,
                          );
                        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
                          e.preventDefault();
                          setEditing({ r, c, text: e.key });
                        }
                      }}
                    >
                      {editing?.r === r && editing?.c === c ? (
                        <input
                          ref={input}
                          className="cell-editor"
                          aria-label={`Edit ${col.name} row ${r + 2}`}
                          value={editing.text}
                          onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                          onBlur={commit}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter' || e.key === 'Tab') {
                              e.preventDefault();
                              commit();
                            }
                            if (e.key === 'Escape') setEditing(null);
                          }}
                        />
                      ) : row[c] === null ? (
                        <span className="blank-cell">—</span>
                      ) : (
                        <span>{displayCell(row[c])}</span>
                      )}
                    </td>
                  );
                })}
                <td className="grid-end" />
              </tr>
            ),
          )}
        </tbody>
      </table>
      {sheet.rows.length === 0 && (
        <div className="empty-grid">
          A fresh start. Add a row or paste data from your spreadsheet.
        </div>
      )}
      {totalPages > 1 && (
        <div className="grid-pagination">
          <button aria-label="Previous rows" disabled={!page} onClick={() => setPage(page - 1)}>
            <ChevronLeft size={14} />
          </button>
          <span>
            Rows {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sheet.rows.length)} of{' '}
            {sheet.rows.length} · calculations use all rows
          </span>
          <button
            aria-label="Next rows"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
      <div className="grid-bottom">
        <button
          onClick={() =>
            onChange({
              ...sheet,
              rows: [
                ...sheet.rows,
                ...Array.from({ length: 5 }, () =>
                  Array<CellValue>(sheet.columns.length).fill(null),
                ),
              ],
            })
          }
        >
          <Plus size={14} /> Add 5 rows
        </button>
        <span className="grid-hint">Double-click to edit · Paste directly from Excel</span>
        <div className="grid-row-actions">
          <button
            title="Hide selected rows"
            onClick={() =>
              onChange({
                ...sheet,
                hiddenRows: [
                  ...new Set([
                    ...(sheet.hiddenRows || []),
                    ...Array.from({ length: rowMax - rowMin + 1 }, (_, i) => rowMin + i),
                  ]),
                ],
              })
            }
          >
            <EyeOff size={13} />
          </button>
          <button
            title="Delete selected rows"
            onClick={() => {
              onChange({
                ...sheet,
                rows: sheet.rows.filter((_, r) => r < rowMin || r > rowMax),
                formulae: undefined,
                hiddenRows: [],
                filteredRows: [],
              });
              onSelect({ r1: 0, c1: 0, r2: 0, c2: 0 });
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
