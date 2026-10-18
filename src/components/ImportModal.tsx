import { useEffect, useState } from 'react';
import { Upload, X, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import type { ImportOptions, ImportPreview } from '../workbook/io';
import type { Workbook, DataType } from '../engine/types';
import { displayCell } from './Grid';

export function ImportModal({
  file,
  onClose,
  onImport,
}: {
  file: File;
  onClose: () => void;
  onImport: (w: Workbook) => void;
}) {
  const [options, setOptions] = useState<ImportOptions>({ headerRow: 0, encoding: 'utf-8' }),
    [preview, setPreview] = useState<ImportPreview | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(true),
    [dateConfirmed, setDateConfirmed] = useState(false);
  useEffect(() => {
    setBusy(true);
    setError('');
    const worker = new Worker(new URL('../workbook/import.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = ({ data }) => {
      setBusy(false);
      data.error ? setError(data.error) : setPreview(data.preview);
      worker.terminate();
    };
    worker.onerror = () => {
      setBusy(false);
      setError('Unable to read this file. Check its format and size.');
      worker.terminate();
    };
    worker.postMessage({ file, options });
    return () => worker.terminate();
  }, [file, options]);
  const sheet = preview?.workbook.sheets[0];
  return (
    <div className="modal-backdrop">
      <section
        className="modal import-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
      >
        <div className="modal-header">
          <div className="modal-icon">
            <Upload size={20} />
          </div>
          <div>
            <h2 id="import-title">Let’s bring in your data</h2>
            <p>
              {file.name} · {(file.size / 1024).toFixed(1)} KB · processed on your device
            </p>
          </div>
          <button className="icon-button close-modal" aria-label="Close import" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="import-settings">
          <label>
            Header row
            <select
              value={options.headerRow}
              onChange={(e) => setOptions({ ...options, headerRow: Number(e.target.value) })}
            >
              <option value={-1}>No header row</option>
              {[0, 1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  Row {n + 1}
                </option>
              ))}
            </select>
          </label>
          {/\.csv$|\.tsv$|\.txt$/i.test(file.name) && (
            <>
              <label>
                Delimiter
                <select
                  value={options.delimiter || ''}
                  onChange={(e) =>
                    setOptions({ ...options, delimiter: e.target.value || undefined })
                  }
                >
                  <option value="">Auto detect</option>
                  <option value=",">Comma</option>
                  <option value=";">Semicolon</option>
                  <option value={'\t'}>Tab</option>
                  <option value="|">Pipe</option>
                </select>
              </label>
              <label>
                Encoding
                <select
                  value={options.encoding}
                  onChange={(e) => setOptions({ ...options, encoding: e.target.value })}
                >
                  <option value="utf-8">UTF-8</option>
                  <option value="windows-1252">Windows-1252</option>
                  <option value="utf-16le">UTF-16 LE</option>
                </select>
              </label>
            </>
          )}
          <label>
            Date order
            <select
              aria-label="Date order"
              value={dateConfirmed ? options.dateFormat || 'iso' : ''}
              onChange={(e) => {
                setDateConfirmed(true);
                setOptions({
                  ...options,
                  dateFormat: e.target.value as ImportOptions['dateFormat'],
                });
              }}
            >
              <option value="">Confirm date format…</option>
              <option value="iso">YYYY-MM-DD (ISO)</option>
              <option value="dmy">DD/MM/YYYY</option>
              <option value="mdy">MM/DD/YYYY</option>
            </select>
          </label>
        </div>
        {busy ? (
          <div className="modal-loading">
            <Loader2 className="spin" /> Reading and checking your file…
          </div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : (
          sheet && (
            <>
              <div className="import-summary">
                <strong>
                  {preview!.workbook.sheets.length} worksheet
                  {preview!.workbook.sheets.length > 1 ? 's' : ''}
                </strong>
                <span>
                  {preview!.workbook.sheets.reduce((s, x) => s + x.rows.length, 0)} data rows
                </span>
                <span>{sheet.columns.length} columns in first sheet</span>
              </div>
              <div className="import-preview">
                <table>
                  <thead>
                    <tr>
                      {sheet.columns.map((c, i) => (
                        <th key={c.id}>
                          {c.name}
                          <select
                            aria-label={`Data type ${c.name}`}
                            value={options.columnTypes?.[i] || c.type}
                            onChange={(e) =>
                              setOptions({
                                ...options,
                                columnTypes: {
                                  ...options.columnTypes,
                                  [i]: e.target.value as DataType,
                                },
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
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.rows.slice(0, 6).map((r, i) => (
                      <tr key={i}>
                        {r.map((v, j) => (
                          <td key={j}>
                            {v === null ? <span className="muted">blank</span> : displayCell(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(preview!.issues.length > 0 || preview!.warnings.length > 0) && (
                <div className="import-notes">
                  <h4>
                    <AlertTriangle size={14} /> Data check
                  </h4>
                  {preview!.warnings.map((w, i) => (
                    <p key={`w${i}`}>{w}</p>
                  ))}
                  {preview!.issues.slice(0, 8).map((issue, i) => (
                    <p key={i}>
                      <span className={`issue-tag ${issue.type}`}>{issue.type}</span>
                      {issue.message}
                    </p>
                  ))}
                  {preview!.issues.length > 8 && (
                    <p>
                      + {preview!.issues.length - 8} more issues. Original values are preserved.
                    </p>
                  )}
                </div>
              )}
              {preview!.ambiguousDates.length > 0 && !dateConfirmed && (
                <p className="error-message">
                  This file includes ambiguous dates. Confirm the date order before importing.
                </p>
              )}
            </>
          )
        )}
        <div className="modal-footer">
          <small>IDs with leading zeros and large identifiers are kept as text.</small>
          <button className="button ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button primary"
            disabled={
              busy ||
              !preview ||
              Boolean(error) ||
              Boolean(preview.ambiguousDates.length && !dateConfirmed)
            }
            onClick={() => onImport(preview!.workbook)}
          >
            Import data
            <ArrowRight size={15} />
          </button>
        </div>
      </section>
    </div>
  );
}
