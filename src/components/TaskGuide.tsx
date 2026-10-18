import { useEffect, useRef, useState } from 'react';
import { BookOpen, X } from 'lucide-react';
import type { FunctionDef } from '../engine/types';
import { functionGuide, operationText, sourceHelp } from '../help/guides';
import { averageExampleSheet, averageSelections } from '../help/selection-example';
import type { AverageSelection } from '../help/selection-example';

export function GuidePrompt({ def, onOpen }: { def: FunctionDef; onOpen: () => void }) {
  return (
    <div className="guide-prompt">
      <BookOpen size={17} aria-hidden="true" />
      <div>
        <strong>New to this calculation?</strong>
        <p>Learn which cells to choose, what each input means, and how to read the answer.</p>
        <button onClick={onOpen}>
          Step-by-step guide for {def.name.replace('WF.', '')} <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}
function ExampleValue({ value }: { value: any }) {
  if (Array.isArray(value) && value.length && value.every(Array.isArray))
    return (
      <div className="guide-table-scroll">
        <table className="guide-value-table">
          <tbody>
            {value.map((row, r) => (
              <tr key={r}>
                {row.map((v: any, c: number) => (
                  <td key={c}>{operationText(v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  return <span className="guide-example-value">{operationText(value)}</span>;
}
export function TaskGuide({
  def,
  onClose,
  onExample,
  onSelectionExample,
}: {
  def: FunctionDef;
  onClose: () => void;
  onExample: () => void;
  onSelectionExample: (mode: AverageSelection) => void;
}) {
  const guide = functionGuide(def);
  const [mode, setMode] = useState<AverageSelection>('column');
  const root = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const closeHandler = useRef(onClose);
  closeHandler.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    close.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeHandler.current();
      }
      if (e.key === 'Tab') {
        const nodes = [
          ...(root.current?.querySelectorAll<HTMLElement>(
            'button, input, select, textarea, a[href], summary, [tabindex="0"]',
          ) ?? []),
        ].filter((n) => n.getClientRects().length);
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  const example = averageSelections[mode],
    sample = averageExampleSheet('preview', 'Example');
  return (
    <div
      className="modal-backdrop guide-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="modal task-guide-modal"
        ref={root}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-guide-title"
      >
        <header className="task-guide-header">
          <div>
            <span className="eyebrow">BEGINNER’S GUIDE · {def.name.replace('WF.', '')}</span>
            <h2 id="task-guide-title">How to use {def.name.replace('WF.', '')}</h2>
            <p>{def.friendlyName}</p>
          </div>
          <button
            ref={close}
            className="icon-button"
            aria-label="Close step-by-step guide"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </header>
        <div className="task-guide-body">
          <section>
            <h3>What does it do?</h3>
            <p>{guide.purpose}</p>
          </section>
          <section>
            <h3>Follow these steps</h3>
            <ol>
              {guide.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>
          {guide.selection.length > 0 && (
            <section>
              <h3>How to choose rows and columns</h3>
              {guide.selection.map((text) => (
                <p key={text}>{text}</p>
              ))}
              <details>
                <summary>What do Column, Range, Table, Values and Result mean?</summary>
                {Object.entries(sourceHelp).map(([key, text]) => (
                  <p key={key}>{text}</p>
                ))}
              </details>
            </section>
          )}
          {def.name === 'AVERAGE' && (
            <section className="selection-lesson">
              <h3>Try it: same table, three different questions</h3>
              <p>
                Every score is out of 100. Choose the question you want to answer and watch the
                selected cells change.
              </p>
              <div className="lesson-choices" role="group" aria-label="Example selection shape">
                {Object.entries(averageSelections).map(([key, item]) => (
                  <button
                    key={key}
                    aria-pressed={key === mode}
                    onClick={() => setMode(key as AverageSelection)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="guide-table-scroll">
                <table className="lesson-table" aria-label="Average selection example">
                  <thead>
                    <tr>
                      <th></th>
                      {sample.columns.map((col, c) => (
                        <th key={col.id}>
                          {String.fromCharCode(65 + c)} · {col.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sample.rows.map((row, r) => (
                      <tr key={r}>
                        <th scope="row">{r + 2}</th>
                        {row.map((value, c) => (
                          <td
                            key={c}
                            className={
                              r >= example.selection.r1 &&
                              r <= example.selection.r2 &&
                              c >= example.selection.c1 &&
                              c <= example.selection.c2
                                ? 'lesson-selected'
                                : ''
                            }
                          >
                            {String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div aria-live="polite" className="lesson-answer">
                <strong>
                  {example.range} → Average {example.answer}
                </strong>
                <p>{example.explanation}</p>
              </div>
              <button className="button primary" onClick={() => onSelectionExample(mode)}>
                Load this selection example
              </button>
              <small>A new practice worksheet will be added. Then press Calculate.</small>
            </section>
          )}
          {guide.inputs.length > 0 && (
            <section>
              <h3>Each input explained</h3>
              <div className="guide-input-list">
                {guide.inputs.map(({ input, instructions, example }) => (
                  <article key={input.key}>
                    <h4>
                      {input.label}{' '}
                      <span>{input.required ? 'Required' : 'Optional / default'}</span>
                    </h4>
                    <p>{instructions}</p>
                    <div className="guide-worked-input">
                      <strong>Worked-example setting</strong>
                      <ExampleValue
                        value={
                          example === undefined
                            ? (input.default ?? def.defaults?.[input.key])
                            : example
                        }
                      />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
          <section>
            <h3>Worked example and expected answer</h3>
            <p>
              Load the settings shown above to practice this exact task, then press Calculate.{' '}
              {def.example.context?.workbook
                ? 'The example also adds the worksheets it needs.'
                : def.inputs.length
                  ? 'The example uses sample values rather than your selected cells.'
                  : 'This task needs no input cells.'}
            </p>
            <div className="guide-expected">
              <strong>Expected answer</strong>
              <ExampleValue value={guide.exampleAnswer} />
            </div>
            <button className="button ghost" onClick={onExample}>
              Load worked example
            </button>
          </section>
          <section>
            <h3>How to read your result</h3>
            <p>{guide.result}</p>
            <p>
              When an input represents one value per row, the output follows the same row order. A
              summary produces one answer or a summary table. Use the result panel to copy or export
              your answer.
            </p>
          </section>
          {guide.cautions.length > 0 && (
            <section>
              <h3>Things to check</h3>
              <ul>
                {guide.cautions.map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <footer className="task-guide-footer">
          <span>No formula typing needed. Follow the input labels.</span>
          <button className="button primary" onClick={onClose}>
            Back to my calculation
          </button>
        </footer>
      </section>
    </div>
  );
}
