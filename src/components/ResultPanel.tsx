import { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Plus,
  Bookmark,
  ChevronDown,
  Clock3,
  BarChart3,
  AlertCircle,
} from 'lucide-react';
import type { CalculationResult } from '../engine/types';
import { downloadBlob, exportResultCSV, exportResultXLSX } from '../workbook/io';
import { displayCell } from './Grid';
import { formatResultNumber } from '../engine/result-format';

export function ResultPanel({
  result,
  onAdd,
  onAppend,
  onSave,
  onError,
}: {
  result: CalculationResult;
  onAdd: () => void;
  onAppend?: () => void;
  onSave: () => void;
  onError: (s: string) => void;
}) {
  const [copied, setCopied] = useState(false),
    [chart, setChart] = useState(false),
    [details, setDetails] = useState(false);
  const error =
    result.value &&
    typeof result.value === 'object' &&
    !Array.isArray(result.value) &&
    'error' in result.value;
  const array = Array.isArray(result.value),
    rows: any[][] = array
      ? Array.isArray(result.value[0])
        ? result.value
        : result.value.map((v: any) => [v])
      : [];
  const numericRows = rows.filter((r) => r.length > 1 && typeof r[r.length - 1] === 'number');
  const scalar =
    typeof result.value === 'number' ? formatResultNumber(result.value) : displayCell(result.value);
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        array
          ? rows.map((r) => r.map(displayCell).join('\t')).join('\n')
          : displayCell(result.value),
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      onError('Clipboard access was unavailable. You can export the result instead.');
    }
  }
  return (
    <section
      className={`result-panel ${error ? 'result-error' : ''}`}
      aria-label="Calculation result"
    >
      <div className="result-heading">
        <div className="result-icon">{error ? <AlertCircle size={17} /> : <Check size={17} />}</div>
        <div>
          <span className="eyebrow">{error ? 'CHECK YOUR INPUTS' : 'CALCULATION COMPLETE'}</span>
          <h3>{result.taskName}</h3>
        </div>
        <div className="result-timestamp">
          <Clock3 size={12} />
          {new Date(result.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
      {error ? (
        <div className="result-error-content">
          <strong>{result.value.error}</strong>
          <p>{result.value.message}</p>
        </div>
      ) : array ? (
        <>
          {chart && numericRows.length ? (
            <div className="bar-chart">
              {numericRows.slice(0, 15).map((r, i) => (
                <div className="bar-chart-row" key={i}>
                  <label>{displayCell(r[0])}</label>
                  <div>
                    <span
                      style={{
                        width: `${Math.max(1, (Math.abs(r[r.length - 1]) / Math.max(...numericRows.map((x) => Math.abs(x[x.length - 1])))) * 100)}%`,
                      }}
                    />
                  </div>
                  <b>
                    {new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(
                      r[r.length - 1],
                    )}
                  </b>
                </div>
              ))}
            </div>
          ) : (
            <div className="result-table-wrap">
              <table className="result-table">
                <tbody>
                  {rows.slice(0, 200).map((r, i) => (
                    <tr key={i}>
                      {r.map((v, j) => (
                        <td
                          key={j}
                          className={
                            typeof v === 'number' ? 'numeric-cell' : v?.error ? 'error-cell' : ''
                          }
                        >
                          {displayCell(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 200 && (
                <small>Showing 200 of {rows.length} rows. Export to view every result.</small>
              )}
            </div>
          )}
        </>
      ) : result.value?.url ? (
        <a className="result-link" href={result.value.url} target="_blank" rel="noreferrer">
          {result.value.label}
        </a>
      ) : (
        <div
          className="scalar-result"
          title={typeof result.value === 'number' ? String(result.value) : undefined}
        >
          {scalar}
          <small>
            {result.functionName === 'PMT'
              ? 'Payment per period (cash-flow sign shown)'
              : result.functionName.startsWith('WF.')
                ? 'Calculated result'
                : 'Result'}
          </small>
        </div>
      )}
      <p className="result-source">
        {result.inputSheet ? `From ${result.inputSheet}` : 'Direct input'}
        {result.inputs?.length ? ` · ${result.inputs.join(', ')}` : ''} ·{' '}
        {result.duration.toFixed(1)} ms
      </p>
      {result.warnings
        .filter((w) => /ignored|calculation error/i.test(w))
        .map((w, i) => (
          <p className="result-data-note" key={i}>
            {w}
          </p>
        ))}
      <div className="result-actions">
        <button onClick={copy}>
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
        </button>
        <button onClick={onAdd} disabled={Boolean(error)}>
          <Plus size={14} />
          Add to worksheet
        </button>
        {onAppend && (
          <button onClick={onAppend} disabled={Boolean(error)}>
            <Plus size={14} />
            Add as columns
          </button>
        )}
        <button
          onClick={() => downloadBlob(exportResultCSV(result), `${result.functionName}-result.csv`)}
        >
          <Download size={14} />
          CSV
        </button>
        <button
          onClick={async () => {
            try {
              downloadBlob(await exportResultXLSX(result), `${result.functionName}-result.xlsx`);
            } catch (e) {
              onError(String(e));
            }
          }}
        >
          <Download size={14} />
          XLSX
        </button>
        <button onClick={onSave}>
          <Bookmark size={14} />
          Save operation
        </button>
        {numericRows.length > 0 && (
          <button className={chart ? 'active' : ''} onClick={() => setChart(!chart)}>
            <BarChart3 size={14} />
            Chart
          </button>
        )}
      </div>
      <button className="result-details-toggle" onClick={() => setDetails(!details)}>
        Settings & compatibility
        <ChevronDown size={13} className={details ? 'rotate' : ''} />
      </button>
      {details && (
        <div className="result-details">
          <dl>
            {Object.entries(result.settings || result.args)
              .filter(([k]) => !k.startsWith('__'))
              .map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{displayCell(v).slice(0, 350)}</dd>
                </div>
              ))}
          </dl>
          {result.warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </div>
      )}
    </section>
  );
}
