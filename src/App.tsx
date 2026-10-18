import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Bookmark,
  Calculator,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Columns3,
  Database,
  Download,
  FilePlus2,
  FileSpreadsheet,
  Filter,
  FolderOpen,
  GraduationCap,
  HelpCircle,
  History,
  LayoutDashboard,
  Link2,
  Loader2,
  Menu,
  MoreHorizontal,
  Plus,
  Redo2,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Sigma,
  Sparkles,
  Table2,
  Trash2,
  Undo2,
  Upload,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { functions, registry, searchFunctions } from './engine/registry';
import type { CalculationResult, FunctionDef, Sheet, Workbook } from './engine/types';
import { calculateAsync } from './engine/client';
import { colLetter, operationOrder, resolveBindings } from './engine/bindings';
import type { SavedOperation } from './engine/bindings';
import { Grid, displayCell } from './components/Grid';
import type { Selection } from './components/Grid';
import { defaultArgs, InputForm } from './components/InputForm';
import { GuidePrompt, TaskGuide } from './components/TaskGuide';
import { functionGuide, isCellInput } from './help/guides';
import { averageExampleSheet, averageSelections } from './help/selection-example';
import type { AverageSelection } from './help/selection-example';
import { ImportModal } from './components/ImportModal';
import { ResultPanel } from './components/ResultPanel';
import { SAMPLE_DATASETS, createSampleWorkbook } from './workbook/samples';
import { downloadBlob, exportCSV, exportXLSX, resultSheet } from './workbook/io';
import {
  loadLocalProject,
  parseProject,
  saveLocalProject,
  serializeProject,
} from './workbook/project';
import type { AppProject } from './workbook/project';

type View = 'workspace' | 'library' | 'history' | 'operations';
const initialProject = (): AppProject => {
  try {
    const saved = loadLocalProject();
    if (saved) return saved;
  } catch {
    /* preserve corrupt local storage for user recovery */
  }
  return { version: 1, workbook: createSampleWorkbook(), history: [], operations: [] };
};
const iconFor = (category: string) =>
  category.includes('Text') ? (
    <Wand2 size={17} />
  ) : category.includes('Finance') || category.includes('sales') ? (
    <ArrowUpRight size={17} />
  ) : category.includes('Education') ? (
    <GraduationCap size={17} />
  ) : category.includes('Date') ? (
    <Clock3 size={17} />
  ) : category.includes('Lookup') ? (
    <Search size={17} />
  ) : category.includes('Workflows') ? (
    <Zap size={17} />
  ) : (
    <Sigma size={17} />
  );
const curated = ['SUM', 'AVERAGE', 'WF.GRADES', 'XLOOKUP', 'TRIM', 'PMT'];
function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9_ -]/g, '').trim() || 'SheetPilot';
}

export default function App() {
  const [initial] = useState(initialProject),
    [workbook, setWorkbook] = useState<Workbook>(initial.workbook),
    [sheetId, setSheetId] = useState(initial.selectedSheetId || initial.workbook.sheets[0].id),
    [history, setHistory] = useState<CalculationResult[]>(initial.history),
    [operations, setOperations] = useState<SavedOperation[]>(initial.operations);
  const [view, setView] = useState<View>('workspace'),
    [selectedName, setSelectedName] = useState(
      initial.settings?.selectedFunction && registry.has(initial.settings.selectedFunction)
        ? initial.settings.selectedFunction
        : 'SUM',
    ),
    [args, setArgs] = useState<Record<string, any>>(
      () =>
        initial.settings?.args ||
        defaultArgs(
          registry.get('SUM')!,
          initial.workbook,
          initial.selectedSheetId || initial.workbook.sheets[0].id,
        ),
    ),
    [selection, setSelection] = useState<Selection>({ r1: 0, c1: 0, r2: 0, c2: 0 });
  const [undo, setUndo] = useState<Workbook[]>([]),
    [redo, setRedo] = useState<Workbook[]>([]),
    [dirty, setDirty] = useState(!initial.savedAt),
    [result, setResult] = useState<CalculationResult | null>(null),
    [busy, setBusy] = useState(false),
    [auto, setAuto] = useState(false),
    [toast, setToast] = useState(''),
    [error, setError] = useState(''),
    [query, setQuery] = useState(''),
    [category, setCategory] = useState('All'),
    [catalogOpen, setCatalogOpen] = useState(false),
    [showSamples, setShowSamples] = useState(false),
    [showHelp, setShowHelp] = useState(false),
    [importFile, setImportFile] = useState<File | null>(null),
    [exportOpen, setExportOpen] = useState(false),
    [sheetMenu, setSheetMenu] = useState(false),
    [filterOpen, setFilterOpen] = useState(false),
    [filterText, setFilterText] = useState(''),
    [sidebarOpen, setSidebarOpen] = useState(false),
    [showAdvanced, setShowAdvanced] = useState(false),
    [showTaskGuide, setShowTaskGuide] = useState(false),
    [historyFocus, setHistoryFocus] = useState<string | null>(null);
  const upload = useRef<HTMLInputElement>(null),
    openProject = useRef<HTMLInputElement>(null),
    calcToken = useRef(0),
    autoRef = useRef(false);
  const sheet = workbook.sheets.find((s) => s.id === sheetId) || workbook.sheets[0],
    def = registry.get(selectedName)!;
  const found = searchFunctions(query, category),
    categories = [
      'All',
      'Workflows',
      ...Array.from(new Set(functions.flatMap((f) => f.categories))).filter(
        (c) => c !== 'Workflows',
      ),
    ];
  const visibleRows =
    sheet.rows.length -
    (sheet.filteredRows?.length || 0) -
    (sheet.hiddenRows?.filter((r) => !sheet.filteredRows?.includes(r)).length || 0);
  const numericSelection = sheet.rows
    .slice(Math.min(selection.r1, selection.r2), Math.max(selection.r1, selection.r2) + 1)
    .flatMap((r) =>
      r.slice(Math.min(selection.c1, selection.c2), Math.max(selection.c1, selection.c2) + 1),
    )
    .filter((v): v is number => typeof v === 'number');
  const selectedRange = `${colLetter(Math.min(selection.c1, selection.c2))}${Math.min(selection.r1, selection.r2) + 2}:${colLetter(Math.max(selection.c1, selection.c2))}${Math.max(selection.r1, selection.r2) + 2}`;
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(''), 4500);
      return () => clearTimeout(id);
    }
  }, [toast]);
  function changeWorkbook(next: Workbook) {
    setUndo((p) => [...p.slice(-39), workbook]);
    setRedo([]);
    setWorkbook(next);
    setDirty(true);
  }
  function changeSheet(next: Sheet) {
    changeWorkbook({
      ...workbook,
      sheets: workbook.sheets.map((s) => (s.id === next.id ? next : s)),
    });
  }
  function undoChange() {
    if (!undo.length) return;
    setRedo((p) => [...p, workbook]);
    setWorkbook(undo[undo.length - 1]);
    setUndo((p) => p.slice(0, -1));
    setDirty(true);
  }
  function redoChange() {
    if (!redo.length) return;
    setUndo((p) => [...p, workbook]);
    setWorkbook(redo[redo.length - 1]);
    setRedo((p) => p.slice(0, -1));
    setDirty(true);
  }
  function selectSheet(id: string) {
    setSheetId(id);
    setSelection({ r1: 0, c1: 0, r2: 0, c2: 0 });
    setView('workspace');
    setSidebarOpen(false);
    setFilterText('');
  }
  function selectTask(fn: FunctionDef) {
    setSelectedName(fn.name);
    setArgs(defaultArgs(fn, workbook, sheet.id));
    setCatalogOpen(false);
    setSidebarOpen(false);
    setView('workspace');
    setShowAdvanced(false);
    setResult(null);
    setError('');
  }
  function navigate(next: View) {
    setView(next);
    setSidebarOpen(false);
  }
  function loadExample() {
    let example = structuredClone(def.example.args);
    const context = def.example.context;
    if (context?.workbook) {
      const source = context.workbook,
        names = new Map<string, string>(),
        ids = new Map<string, string>();
      const sheets = source.sheets.map((s) => {
        const id = crypto.randomUUID(),
          name = uniqueSheetName(`${s.name} example`, workbook);
        names.set(s.name, name);
        ids.set(s.id, id);
        return { ...structuredClone(s), id, name, source: 'Synthetic example' };
      });
      const replace = (v: any): any => {
        if (Array.isArray(v)) return v.map(replace);
        if (v && typeof v === 'object')
          return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, replace(x)]));
        if (typeof v === 'string') {
          if (ids.has(v)) return ids.get(v);
          if (names.has(v)) return names.get(v);
          for (const [old, next] of names) {
            if (v.startsWith(`'${old}'!`)) return v.replace(`'${old}'!`, `'${next}'!`);
            if (v.startsWith(`${old}!`)) return v.replace(`${old}!`, `'${next}'!`);
          }
        }
        return v;
      };
      example = replace(example);
      changeWorkbook({ ...workbook, sheets: [...workbook.sheets, ...sheets] });
      setSheetId(ids.get(context.sheetId || '') || sheets[0].id);
    }
    setArgs(example);
    setToast(
      context?.workbook
        ? 'Synthetic example worksheet and values loaded. Click Calculate.'
        : 'Example values loaded. Click Calculate to test this task.',
    );
  }
  function loadSelectionExample(mode: AverageSelection) {
    const id = crypto.randomUUID();
    const practice = averageExampleSheet(id, uniqueSheetName('AVERAGE practice', workbook));
    changeWorkbook({ ...workbook, sheets: [...workbook.sheets, practice] });
    setSheetId(id);
    setSelection(averageSelections[mode].selection);
    setArgs({ data: { __source: 'range', sheetId: id, range: averageSelections[mode].range } });
    setResult(null);
    setError('');
    setShowTaskGuide(false);
    setToast('Practice selection loaded. Press Calculate to see the average.');
  }
  function getProject(): AppProject {
    return {
      version: 1,
      format: 'sheetpilot',
      savedAt: new Date().toISOString(),
      workbook,
      history,
      operations,
      selectedSheetId: sheet.id,
      settings: { selectedFunction: selectedName, args, autoRecalculate: auto },
    };
  }
  function save() {
    try {
      saveLocalProject(getProject());
      setDirty(false);
      setToast('Project saved on this device.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  function downloadProject() {
    try {
      downloadBlob(
        new Blob([serializeProject(getProject())], { type: 'application/json' }),
        `${safeName(workbook.name)}.sheetpilot.json`,
      );
      setToast('Project downloaded with datasets, settings, and history.');
    } catch (e) {
      setError(String(e));
    }
  }
  async function reopen(file: File) {
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('Projects must be smaller than 20 MB.');
      const project = parseProject(await file.text());
      changeWorkbook(project.workbook);
      setSheetId(project.selectedSheetId || project.workbook.sheets[0].id);
      setHistory(project.history);
      setOperations(project.operations);
      if (project.settings?.selectedFunction && registry.has(project.settings.selectedFunction)) {
        setSelectedName(project.settings.selectedFunction);
        setArgs(project.settings.args || {});
      }
      setResult(null);
      setToast('Project opened. All identifiers and types were preserved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  async function run(
    name = selectedName,
    sourceArgs = args,
    previousHistory = history,
  ): Promise<CalculationResult | null> {
    const token = ++calcToken.current;
    setBusy(true);
    setError('');
    try {
      const fn = registry.get(name)!;
      const resolved = resolveBindings(sourceArgs, workbook, previousHistory);
      const rowKeys = fn.inputs
        .filter((i) => isCellInput(fn, i) && Array.isArray(resolved[i.key]))
        .map((i) => i.key);
      if (rowKeys.length) resolved.__rowWise = rowKeys;
      const calculation = await calculateAsync(name, resolved, { workbook, sheetId: sheet.id });
      calculation.inputSheet = sheet.name;
      calculation.settings = sourceArgs;
      calculation.inputs = collectColumnNames(sourceArgs, workbook);
      if (token === calcToken.current) {
        setResult(calculation);
        setHistory((p) => [calculation, ...p].slice(0, 250));
        setDirty(true);
      }
      return calculation;
    } catch (e) {
      if (token === calcToken.current) setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      if (token === calcToken.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (!auto || !autoRef.current) {
      autoRef.current = true;
      return;
    }
    const timer = setTimeout(() => void (operations.length ? runPipeline() : run()), 450);
    return () => clearTimeout(timer);
  }, [workbook]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
      if (
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'z'
      ) {
        e.preventDefault();
        e.shiftKey ? redoChange() : undoChange();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });
  function addWorkbook(incoming: Workbook) {
    const added = incoming.sheets.map((s) => ({
      ...s,
      id: crypto.randomUUID(),
      name: uniqueSheetName(s.name, workbook),
    }));
    changeWorkbook({ ...workbook, sheets: [...workbook.sheets, ...added] });
    selectSheet(added[0].id);
    setImportFile(null);
    setShowSamples(false);
    setToast(`${added.length} worksheet${added.length > 1 ? 's' : ''} added.`);
  }
  function addBlank() {
    const id = crypto.randomUUID(),
      name = uniqueSheetName('Untitled sheet', workbook);
    changeWorkbook({
      ...workbook,
      sheets: [
        ...workbook.sheets,
        {
          id,
          name,
          columns: ['A', 'B', 'C', 'D'].map((n) => ({
            id: crypto.randomUUID(),
            name: `Column ${n}`,
            type: 'mixed',
          })),
          rows: Array.from({ length: 8 }, () => [null, null, null, null]),
        },
      ],
    });
    selectSheet(id);
  }
  function addResult(r: CalculationResult) {
    const added = resultSheet(r);
    added.name = uniqueSheetName(r.taskName, workbook);
    changeWorkbook({ ...workbook, sheets: [...workbook.sheets, added] });
    selectSheet(added.id);
    setToast('Result added as a worksheet. Original inputs are preserved.');
  }
  function appendResult(r: CalculationResult) {
    const added = resultSheet(r);
    let output = added.rows;
    const hasHeader =
      r.functionName.startsWith('WF.') &&
      output.length > 1 &&
      output[0].every((v) => typeof v === 'string');
    const headings = hasHeader
      ? output[0].map(String)
      : added.columns.map((_, i) => `${r.taskName}${added.columns.length > 1 ? ` ${i + 1}` : ''}`);
    if (hasHeader) output = output.slice(1);
    const columns = [
        ...sheet.columns,
        ...headings.map((name) => ({ id: crypto.randomUUID(), name, type: 'mixed' as const })),
      ],
      height = Math.max(sheet.rows.length, output.length);
    if (height * columns.length > 250000) {
      setError(
        'The combined table would exceed 250,000 cells. Add the result as a separate worksheet instead.',
      );
      return;
    }
    const rows = Array.from({ length: height }, (_, i) => [
      ...(sheet.rows[i] || Array(sheet.columns.length).fill(null)),
      ...Array.from({ length: added.columns.length }, (_, j) => output[i]?.[j] ?? null),
    ]);
    changeSheet({ ...sheet, columns, rows });
    setToast('Calculated columns added in result row order. Original columns are preserved.');
  }
  function saveOperation(r: CalculationResult) {
    const id = crypto.randomUUID();
    const savedArgs = structuredClone(r.settings || args);
    const dependsOn: string[] = [];
    const map = (v: any): any => {
      if (Array.isArray(v)) return v.map(map);
      if (v && typeof v === 'object') {
        if (v.__source === 'result') {
          const prev = history.find((h) => h.id === v.resultId);
          const opId = prev?.settings?.__operationId;
          if (opId) {
            dependsOn.push(opId);
            return { ...v, resultId: `op:${opId}` };
          }
        }
        return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, map(x)]));
      }
      return v;
    };
    const operation = {
      id,
      name: r.taskName,
      functionName: r.functionName,
      args: map(savedArgs),
      dependsOn: [...new Set(dependsOn)],
    };
    setOperations((p) => [...p, operation]);
    setHistory((p) =>
      p.map((h) => (h.id === r.id ? { ...h, settings: { ...h.settings, __operationId: id } } : h)),
    );
    setDirty(true);
    setToast('Operation saved. Reapply it from Saved operations.');
  }
  function reapply(op: SavedOperation) {
    setSidebarOpen(false);
    const fn = registry.get(op.functionName)!;
    setSelectedName(op.functionName);
    const map = (v: any): any => {
      if (Array.isArray(v)) return v.map(map);
      if (v && typeof v === 'object') {
        if (v.__source === 'column') {
          const old = workbook.sheets
            .find((s) => s.id === v.sheetId)
            ?.columns.find((c) => c.id === v.columnId);
          return {
            ...v,
            sheetId: sheet.id,
            columnId: sheet.columns.find((c) => c.name === old?.name)?.id || '',
          };
        }
        return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, map(x)]));
      }
      return v;
    };
    setArgs(map(op.args));
    setView('workspace');
    setResult(null);
    setToast(`Check the columns for ${sheet.name}, then calculate.`);
  }
  async function runPipeline() {
    setBusy(true);
    setError('');
    try {
      const ordered = operationOrder(operations),
        computed = new Map<string, CalculationResult>();
      let running = [...history];
      for (const op of ordered) {
        const replace = (v: any): any => {
          if (Array.isArray(v)) return v.map(replace);
          if (v && typeof v === 'object') {
            if (v.__source === 'result' && String(v.resultId).startsWith('op:')) {
              const prior = computed.get(v.resultId.slice(3));
              if (!prior) throw new Error('A pipeline input has not been calculated.');
              return { ...v, resultId: prior.id };
            }
            return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, replace(x)]));
          }
          return v;
        };
        const calculation = await run(op.functionName, replace(op.args), running);
        if (!calculation || calculation.value?.error)
          throw new Error(`Pipeline stopped at ${op.name}. Check its inputs.`);
        calculation.settings = { ...calculation.settings, __operationId: op.id };
        computed.set(op.id, calculation);
        running = [calculation, ...running];
      }
      setToast(`${ordered.length} pipeline steps completed in dependency order.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  function applyFilter(text: string) {
    setFilterText(text);
    changeSheet({
      ...sheet,
      filteredRows: text
        ? sheet.rows.flatMap((r, i) =>
            r.some((v) => displayCell(v).toLowerCase().includes(text.toLowerCase())) ? [] : [i],
          )
        : [],
    });
  }
  const activeInputCount = def.inputs.filter((i) => i.required).length;
  const taskCards = curated.map((n) => registry.get(n)).filter((f): f is FunctionDef => Boolean(f));
  return (
    <div className="app-shell">
      <input
        ref={upload}
        className="hidden"
        type="file"
        accept=".csv,.tsv,.txt,.xlsx"
        onChange={(e) => {
          if (e.target.files?.[0]) setImportFile(e.target.files[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={openProject}
        className="hidden"
        type="file"
        accept=".json,.sheetpilot"
        onChange={(e) => {
          if (e.target.files?.[0]) void reopen(e.target.files[0]);
          e.target.value = '';
        }}
      />
      {sidebarOpen && (
        <button
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView('workspace');
          }}
        >
          <span className="brand-mark">
            <Table2 size={22} />
            <span />
          </span>
          <span>
            SheetPilot<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="workspace-switch">
          <span className="workspace-avatar">P</span>
          <div>
            <strong>Personal workspace</strong>
            <small>Local & private</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          <button
            className={view === 'workspace' ? 'active' : ''}
            onClick={() => navigate('workspace')}
          >
            <LayoutDashboard size={17} /> Workspace
          </button>
          <button
            className={view === 'library' ? 'active' : ''}
            onClick={() => {
              navigate('library');
              setQuery('');
            }}
          >
            <BookOpen size={17} /> Function library{' '}
            <span>{functions.filter((f) => !f.name.startsWith('WF.')).length}</span>
          </button>
          <button
            className={view === 'operations' ? 'active' : ''}
            onClick={() => navigate('operations')}
          >
            <Bookmark size={17} /> Saved operations
            {operations.length > 0 && <span>{operations.length}</span>}
          </button>
          <button
            className={view === 'history' ? 'active' : ''}
            onClick={() => navigate('history')}
          >
            <History size={17} /> Calculation history
          </button>
        </nav>
        <div className="sidebar-section-title">
          <span>YOUR WORKSHEETS</span>
          <button aria-label="Add worksheet" onClick={addBlank}>
            <Plus size={15} />
          </button>
        </div>
        <div className="dataset-list">
          {workbook.sheets.map((s, i) => (
            <div
              className={`dataset-item ${s.id === sheet.id && view === 'workspace' ? 'active' : ''}`}
              key={s.id}
            >
              <button onClick={() => selectSheet(s.id)}>
                <span className={`dataset-icon dataset-color-${i % 4}`}>
                  <Table2 size={15} />
                </span>
                <span className="dataset-name">
                  {s.name}
                  <small>
                    {s.rows.length} rows · {s.columns.length} columns
                  </small>
                </span>
              </button>
            </div>
          ))}
        </div>
        <button className="sidebar-add" onClick={() => upload.current?.click()}>
          <Plus size={15} />
          Import a dataset
        </button>
        <div className="sidebar-spacer" />
        <div className="sample-callout">
          <span className="sample-spark">
            <Sparkles size={19} />
          </span>
          <strong>Start with a little inspiration</strong>
          <p>Explore what’s possible with a ready-to-use sample.</p>
          <button onClick={() => setShowSamples(true)}>
            Explore sample data
            <ArrowUpRight size={14} />
          </button>
        </div>
        <button className="sidebar-help" onClick={() => setShowHelp(true)}>
          <HelpCircle size={16} />
          Getting started
          <ArrowUpRight size={13} />
        </button>
        <div className="privacy-note">
          <ShieldCheck size={13} />
          <span>Your data stays on your device</span>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumbs">
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>
              {view === 'workspace'
                ? sheet.name
                : view === 'library'
                  ? 'Function library'
                  : view === 'history'
                    ? 'Calculation history'
                    : 'Saved operations'}
            </strong>
          </div>
          <div className="topbar-actions">
            <span className="local-badge">
              <span />
              All local. All yours.
            </span>
            <button className="button save-button" onClick={save}>
              <Save size={15} />
              {dirty ? 'Save project' : 'Project saved'}
              {!dirty && <Check size={13} />}
            </button>
            <button
              className="profile-button"
              title="Personal workspace"
              onClick={() => setShowHelp(true)}
            >
              P
            </button>
          </div>
        </header>
        <main className={`page-content ${view === 'workspace' ? 'workspace-page' : ''}`}>
          {view === 'workspace' ? (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    <span className="tiny-square" />
                    YOUR DATA, WORKING SMARTER
                  </div>
                  <h1>Good data. Great possibilities.</h1>
                  <p>From spreadsheet to answer. No formulas needed.</p>
                </div>
                <div className="heading-actions">
                  <button className="button ghost" onClick={() => setShowSamples(true)}>
                    <Database size={15} />
                    Sample data
                  </button>
                  <button className="button primary" onClick={() => upload.current?.click()}>
                    <Upload size={15} />
                    Import data
                  </button>
                </div>
              </div>
              <div className="quick-tasks">
                <div className="quick-tasks-label">
                  <Zap size={16} />
                  <span>What would you like to do?</span>
                </div>
                <div className="quick-task-buttons">
                  {taskCards.slice(0, 5).map((f, i) => (
                    <button key={f.name} onClick={() => selectTask(f)}>
                      <span className={`quick-icon quick-color-${i}`}>
                        {iconFor(f.categories[0])}
                      </span>
                      {
                        [
                          'Add up values',
                          'Find an average',
                          'Assign grades',
                          'Find a record',
                          'Clean up text',
                        ][i]
                      }
                      <ArrowUpRight size={12} />
                    </button>
                  ))}
                  <button
                    className="browse-task"
                    onClick={() => {
                      setCatalogOpen(true);
                      setQuery('');
                    }}
                  >
                    <span>Explore all tasks</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
              <div className="work-area">
                <section className="sheet-panel">
                  <div className="sheet-heading">
                    <span className="sheet-title-icon">
                      <Table2 size={19} />
                    </span>
                    <div>
                      <h2>
                        {sheet.name}
                        <button
                          title="Worksheet options"
                          className="inline-icon"
                          onClick={() => setSheetMenu(!sheetMenu)}
                        >
                          <ChevronDown size={15} />
                        </button>
                      </h2>
                      <p>
                        {sheet.source ? 'Imported dataset' : 'Sample or local dataset'}
                        <span>·</span>
                        {sheet.rows.length} rows<span>·</span>
                        {sheet.columns.length} columns
                      </p>
                    </div>
                    <span className="sheet-status">
                      <span />
                      Ready to calculate
                    </span>
                    <button
                      className="icon-button"
                      aria-label="More worksheet options"
                      onClick={() => setSheetMenu(!sheetMenu)}
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    {sheetMenu && (
                      <div className="sheet-menu">
                        <label>
                          Worksheet name
                          <input
                            aria-label="Worksheet name"
                            defaultValue={sheet.name}
                            onBlur={(e) => {
                              if (e.target.value.trim())
                                changeSheet({ ...sheet, name: e.target.value.trim() });
                            }}
                          />
                        </label>
                        <button
                          onClick={() => {
                            changeSheet({ ...sheet, hiddenRows: [], filteredRows: [] });
                            setFilterText('');
                            setSheetMenu(false);
                          }}
                        >
                          Show all rows
                        </button>
                        <button
                          disabled={workbook.sheets.length === 1}
                          className="danger"
                          onClick={() => {
                            const next = workbook.sheets.filter((s) => s.id !== sheet.id);
                            changeWorkbook({ ...workbook, sheets: next });
                            setSheetId(next[0].id);
                            setSheetMenu(false);
                          }}
                        >
                          Delete worksheet
                        </button>
                        <button onClick={() => setSheetMenu(false)}>Done</button>
                      </div>
                    )}
                  </div>
                  <div className="sheet-toolbar">
                    <div className="toolbar-group">
                      <button
                        title="Undo (Ctrl+Z)"
                        aria-label="Undo"
                        disabled={!undo.length}
                        onClick={undoChange}
                      >
                        <Undo2 size={16} />
                      </button>
                      <button
                        title="Redo"
                        aria-label="Redo"
                        disabled={!redo.length}
                        onClick={redoChange}
                      >
                        <Redo2 size={16} />
                      </button>
                    </div>
                    <span className="toolbar-separator" />
                    <button
                      className={filterOpen ? 'active' : ''}
                      onClick={() => setFilterOpen(!filterOpen)}
                    >
                      <Filter size={14} />
                      Filter
                      {sheet.filteredRows?.length ? (
                        <span className="filter-count">{sheet.filteredRows.length}</span>
                      ) : null}
                    </button>
                    <button
                      onClick={() =>
                        changeSheet({
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
                      <Columns3 size={14} />
                      Add column
                    </button>
                    <div className="toolbar-spacer" />
                    <span className="range-label">{selectedRange}</span>
                    <div className="export-control">
                      <button onClick={() => setExportOpen(!exportOpen)}>
                        <Download size={14} />
                        Export
                        <ChevronDown size={12} />
                      </button>
                      {exportOpen && (
                        <div className="dropdown">
                          <button
                            onClick={() => {
                              downloadBlob(exportCSV(sheet), `${safeName(sheet.name)}.csv`);
                              setExportOpen(false);
                            }}
                          >
                            Current sheet as CSV
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                downloadBlob(
                                  await exportXLSX(workbook),
                                  `${safeName(workbook.name)}.xlsx`,
                                );
                                setExportOpen(false);
                              } catch (e) {
                                setError(String(e));
                              }
                            }}
                          >
                            All worksheets as XLSX
                          </button>
                          <button
                            onClick={() => {
                              downloadProject();
                              setExportOpen(false);
                            }}
                          >
                            Full SheetPilot project
                          </button>
                          <button
                            onClick={() => {
                              openProject.current?.click();
                              setExportOpen(false);
                            }}
                          >
                            Open a saved project
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {filterOpen && (
                    <div className="filter-bar">
                      <Search size={14} />
                      <input
                        aria-label="Filter worksheet"
                        placeholder="Filter rows containing…"
                        value={filterText}
                        onChange={(e) => applyFilter(e.target.value)}
                      />
                      <button
                        onClick={() => {
                          applyFilter('');
                          setFilterOpen(false);
                        }}
                      >
                        Clear
                        <X size={12} />
                      </button>
                    </div>
                  )}
                  <Grid
                    key={sheet.id}
                    sheet={sheet}
                    onChange={changeSheet}
                    selection={selection}
                    onSelect={setSelection}
                  />
                  <div className="sheet-footer">
                    <div className="worksheet-tabs">
                      {workbook.sheets.map((s) => (
                        <button
                          key={s.id}
                          className={s.id === sheet.id ? 'active' : ''}
                          onClick={() => selectSheet(s.id)}
                        >
                          <Table2 size={12} />
                          {s.name}
                        </button>
                      ))}
                      <button title="New worksheet" aria-label="New worksheet" onClick={addBlank}>
                        <Plus size={15} />
                      </button>
                    </div>
                    <span>{visibleRows} rows</span>
                  </div>
                </section>
                <aside className="task-panel">
                  <div className="task-panel-header">
                    <span className="task-bolt">
                      <Zap size={17} />
                    </span>
                    <h2>Let’s calculate</h2>
                    <span className="step-badge">01 — 02</span>
                  </div>
                  <button
                    className="task-search"
                    onClick={() => {
                      setCatalogOpen(true);
                      setQuery('');
                    }}
                  >
                    <Search size={16} />
                    <span>What do you want to calculate?</span>
                    <kbd>⌘ K</kbd>
                  </button>
                  <div className="selected-task">
                    <span className="eyebrow">SELECTED TASK</span>
                    <div className="selected-task-title">
                      <span className="selected-task-icon">{iconFor(def.categories[0])}</span>
                      <div>
                        <h3>{def.friendlyName}</h3>
                        <span className="function-tag">{def.name.replace('WF.', '')}</span>
                      </div>
                      <button className="text-button" onClick={() => setCatalogOpen(true)}>
                        Change
                      </button>
                    </div>
                    <p>{functionGuide(def).purpose}</p>
                    <GuidePrompt def={def} onOpen={() => setShowTaskGuide(true)} />
                  </div>
                  <div className="task-settings">
                    <div className="task-section-title">
                      <span>Configure inputs</span>
                      <span>{activeInputCount} required</span>
                    </div>
                    <InputForm
                      key={def.name}
                      def={def}
                      args={args}
                      onChange={setArgs}
                      workbook={workbook}
                      sheetId={sheet.id}
                      history={history}
                      selection={selection}
                    />
                    <button className="try-example" onClick={loadExample}>
                      <Sparkles size={12} />
                      Try with example values
                    </button>
                    <button
                      className="advanced-toggle"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                    >
                      <Settings2 size={13} />
                      Help & compatibility
                      <ChevronDown size={13} className={showAdvanced ? 'rotate' : ''} />
                    </button>
                    {showAdvanced && (
                      <div className="advanced-help">
                        <strong>{def.name}</strong>
                        <p>{def.description}</p>
                        {def.compatibility.map((note, i) => (
                          <p key={i}>{note}</p>
                        ))}
                        {def.external && (
                          <p>
                            This task uses an analytical provider. The local demo is explicitly
                            labeled; production connections need their own infrastructure.
                          </p>
                        )}
                        <p>Example result: {displayCell(def.example.expected).slice(0, 180)}</p>
                      </div>
                    )}
                  </div>
                  <div className="calculate-area">
                    <label className="auto-toggle">
                      <input
                        type="checkbox"
                        checked={auto}
                        onChange={(e) => setAuto(e.target.checked)}
                      />
                      <span className="toggle-track" />
                      <span>Recalculate when data changes</span>
                    </label>
                    <button
                      className="button primary calculate-button"
                      disabled={busy}
                      onClick={() => void run()}
                    >
                      {busy ? <Loader2 size={17} className="spin" /> : <Calculator size={17} />}{' '}
                      {busy ? 'Calculating…' : 'Calculate'}
                      {!busy && <ArrowRight size={17} />}
                    </button>
                    <p>
                      <ShieldCheck size={11} />
                      Calculated locally. Your data stays private.
                    </p>
                  </div>
                </aside>
              </div>
              {error && (
                <div className="inline-error" role="alert">
                  <span>{error}</span>
                  <button
                    className="icon-button"
                    aria-label="Dismiss error"
                    onClick={() => setError('')}
                  >
                    <X size={15} />
                  </button>
                </div>
              )}
              {result ? (
                <ResultPanel
                  key={result.id}
                  result={result}
                  onAdd={() => addResult(result)}
                  onAppend={() => appendResult(result)}
                  onSave={() => saveOperation(result)}
                  onError={setError}
                />
              ) : (
                <div className="results-empty">
                  <div className="results-empty-icon">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3>A little input. A clear answer.</h3>
                    <p>
                      Choose a task, confirm your columns, and click Calculate. Your results will
                      appear here.
                    </p>
                  </div>
                  <span className="results-empty-pill">
                    <span />
                    No formulas required
                  </span>
                </div>
              )}
              <div className="workspace-bottom">
                <span>
                  <span className="status-dot" />
                  Everything happens on your device
                </span>
                <span>
                  {numericSelection.length > 1
                    ? `Selection · Count ${numericSelection.length} · Sum ${numericSelection.reduce((a, b) => a + b, 0).toLocaleString()}`
                    : 'Built for the way you work.'}
                  <span className="keyboard-tip">Ctrl + S to save</span>
                </span>
              </div>
            </>
          ) : view === 'library' ? (
            <Catalogue
              found={found}
              query={query}
              setQuery={setQuery}
              category={category}
              setCategory={setCategory}
              categories={categories}
              onSelect={selectTask}
            />
          ) : view === 'history' ? (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">YOUR CALCULATIONS</div>
                  <h1>A little history. A lot of clarity.</h1>
                  <p>Every result, with the inputs and settings that produced it.</p>
                </div>
                <button className="button ghost" onClick={downloadProject}>
                  <Download size={15} />
                  Export project
                </button>
              </div>
              {history.length ? (
                <div className="history-layout">
                  <div className="history-list">
                    {history.map((h) => (
                      <button
                        className={historyFocus === h.id ? 'active' : ''}
                        key={h.id}
                        onClick={() => setHistoryFocus(h.id)}
                      >
                        <span className="history-task-icon">
                          {h.value?.error ? <X size={16} /> : <Check size={16} />}
                        </span>
                        <div>
                          <strong>{h.taskName}</strong>
                          <small>
                            {h.functionName} · {new Date(h.timestamp).toLocaleString()}
                          </small>
                        </div>
                        <ChevronRight size={15} />
                      </button>
                    ))}
                  </div>
                  <ResultPanel
                    key={(history.find((h) => h.id === historyFocus) || history[0]).id}
                    result={history.find((h) => h.id === historyFocus) || history[0]}
                    onAdd={() =>
                      addResult(history.find((h) => h.id === historyFocus) || history[0])
                    }
                    onSave={() =>
                      saveOperation(history.find((h) => h.id === historyFocus) || history[0])
                    }
                    onError={setError}
                  />
                </div>
              ) : (
                <EmptyState
                  icon={<History size={28} />}
                  title="Your next answer starts a story"
                  description="Run your first calculation to see a complete record here."
                  action="Go to workspace"
                  onAction={() => setView('workspace')}
                />
              )}
            </>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">BUILD ON WHAT WORKS</div>
                  <h1>Good work, ready to repeat.</h1>
                  <p>Reuse a calculation or connect saved operations into a pipeline.</p>
                </div>
                <button
                  className="button primary"
                  disabled={!operations.length || busy}
                  onClick={() => void runPipeline()}
                >
                  {busy ? <Loader2 className="spin" size={15} /> : <Zap size={15} />}Run pipeline
                </button>
              </div>
              {error && <div className="inline-error">{error}</div>}
              {operations.length ? (
                <div className="operations-list">
                  {operations.map((op, i) => (
                    <article className="operation-card" key={op.id}>
                      <span className="operation-number">{String(i + 1).padStart(2, '0')}</span>
                      <div className="operation-info">
                        <input
                          aria-label="Operation name"
                          value={op.name}
                          onChange={(e) => {
                            setOperations((p) =>
                              p.map((o) => (o.id === op.id ? { ...o, name: e.target.value } : o)),
                            );
                            setDirty(true);
                          }}
                        />
                        <small>
                          {op.functionName} ·{' '}
                          {op.dependsOn.length ? 'Uses a previous step' : 'Independent input'}
                        </small>
                        <label className="pipeline-dependency">
                          <Link2 size={12} />
                          Input from
                          <select
                            aria-label={`Dependency for ${op.name}`}
                            value={op.dependsOn[0] || ''}
                            onChange={(e) => {
                              const dep = e.target.value,
                                fn = registry.get(op.functionName),
                                key = fn?.inputs.find(
                                  (input) => input.type === 'data' || input.type === 'matrix',
                                )?.key;
                              setOperations((p) =>
                                p.map((o) =>
                                  o.id === op.id
                                    ? {
                                        ...o,
                                        dependsOn: dep ? [dep] : [],
                                        args: key
                                          ? dep
                                            ? {
                                                ...o.args,
                                                [key]: {
                                                  __source: 'result',
                                                  resultId: `op:${dep}`,
                                                },
                                              }
                                            : {
                                                ...o.args,
                                                [key]: defaultArgs(fn!, workbook, sheet.id)[key],
                                              }
                                          : o.args,
                                      }
                                    : o,
                                ),
                              );
                              setDirty(true);
                            }}
                          >
                            <option value="">Original worksheet inputs</option>
                            {operations
                              .filter((o) => o.id !== op.id)
                              .map((o) => (
                                <option value={o.id} key={o.id}>
                                  {o.name}
                                </option>
                              ))}
                          </select>
                        </label>
                      </div>
                      <button className="button ghost" onClick={() => reapply(op)}>
                        Reapply
                        <ArrowUpRight size={14} />
                      </button>
                      <button
                        className="icon-button danger"
                        aria-label={`Delete ${op.name}`}
                        onClick={() => {
                          setOperations((p) => p.filter((o) => o.id !== op.id));
                          setDirty(true);
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Bookmark size={28} />}
                  title="Make the useful things reusable"
                  description="After a calculation, choose Save operation. Reapply it to a compatible dataset, or link it to another operation."
                  action="Try a calculation"
                  onAction={() => setView('workspace')}
                />
              )}
            </>
          )}
        </main>
      </div>
      {catalogOpen && (
        <div className="modal-backdrop">
          <section
            className="modal catalogue-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Choose a calculation"
          >
            <button
              className="icon-button catalogue-close"
              aria-label="Close function catalogue"
              onClick={() => setCatalogOpen(false)}
            >
              <X size={20} />
            </button>
            <Catalogue
              found={found}
              query={query}
              setQuery={setQuery}
              category={category}
              setCategory={setCategory}
              categories={categories}
              onSelect={selectTask}
            />
          </section>
        </div>
      )}
      {showSamples && (
        <div className="modal-backdrop">
          <section
            className="modal sample-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Sample datasets"
          >
            <div className="modal-header">
              <div className="modal-icon">
                <Sparkles size={22} />
              </div>
              <div>
                <h2>A starting point for every possibility.</h2>
                <p>Explore synthetic sample data. Your existing worksheets stay intact.</p>
              </div>
              <button
                className="icon-button close-modal"
                aria-label="Close samples"
                onClick={() => setShowSamples(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="sample-cards">
              {SAMPLE_DATASETS.map((sample, i) => (
                <button
                  key={sample.id}
                  onClick={() => addWorkbook(createSampleWorkbook(sample.id))}
                >
                  <span className={`sample-card-icon dataset-color-${i % 4}`}>
                    {iconFor(sample.category)}
                  </span>
                  <span className="eyebrow">{sample.category}</span>
                  <h3>{sample.name}</h3>
                  <p>{sample.description}</p>
                  <span className="sample-card-bottom">
                    {sample.workbook.sheets[0].rows.length} rows
                    <ArrowUpRight size={17} />
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
      {showTaskGuide && (
        <TaskGuide
          key={def.name}
          def={def}
          onClose={() => setShowTaskGuide(false)}
          onExample={() => {
            loadExample();
            setShowTaskGuide(false);
          }}
          onSelectionExample={loadSelectionExample}
        />
      )}
      {showHelp && (
        <div className="modal-backdrop">
          <section
            className="modal help-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Getting started"
          >
            <button
              className="icon-button close-modal"
              aria-label="Close help"
              onClick={() => setShowHelp(false)}
            >
              <X size={20} />
            </button>
            <span className="modal-icon">
              <Table2 size={25} />
            </span>
            <h2>A clearer path from data to answer.</h2>
            <p>SheetPilot is your private, formula-free calculation workspace.</p>
            <ol>
              <li>
                <strong>Bring your data.</strong> Import CSV or XLSX, paste cells from Excel, or
                start with sample data. Double-click a cell to edit.
              </li>
              <li>
                <strong>Choose your task.</strong> Search by function, plain English, or Roman Urdu.
                Try “jama”, “ausat”, “qist”, or “hazri”.
              </li>
              <li>
                <strong>Confirm and calculate.</strong> Select columns and your rules. Results
                include settings, source, and any errors.
              </li>
              <li>
                <strong>Keep what matters.</strong> Save to this browser or export a full project to
                reopen anywhere.
              </li>
            </ol>
            <div className="help-note">
              <ShieldCheck size={17} />
              <p>
                Files stay in your browser. Imported macros never run, external workbook links are
                never fetched, and formula cells retain cached values. Spreadsheet exports contain
                values.
              </p>
            </div>
            <button className="button primary" onClick={() => setShowHelp(false)}>
              Let’s get to work
              <ArrowRight size={15} />
            </button>
          </section>
        </div>
      )}
      {importFile && (
        <ImportModal file={importFile} onClose={() => setImportFile(null)} onImport={addWorkbook} />
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
          <button aria-label="Dismiss notification" onClick={() => setToast('')}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function Catalogue({
  found,
  query,
  setQuery,
  category,
  setCategory,
  categories,
  onSelect,
}: {
  found: FunctionDef[];
  query: string;
  setQuery: (s: string) => void;
  category: string;
  setCategory: (s: string) => void;
  categories: string[];
  onSelect: (f: FunctionDef) => void;
}) {
  const [limit, setLimit] = useState(30);
  return (
    <div className="catalogue">
      <div className="page-heading">
        <div>
          <span className="eyebrow">A TOOL FOR EVERY TASK</span>
          <h1>What can we help you calculate?</h1>
          <p>Everyday tasks to advanced analysis. Always formula-free.</p>
        </div>
      </div>
      <div className="catalogue-search">
        <Search size={20} />
        <input
          autoFocus
          aria-label="Search functions and tasks"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(30);
          }}
          placeholder="Try ‘total sales’, ‘student grade’, ‘jama’, or ‘PMT’…"
        />
        {query && (
          <button className="icon-button" aria-label="Clear search" onClick={() => setQuery('')}>
            <X size={16} />
          </button>
        )}
        <span>{functions.length} tasks</span>
      </div>
      <div className="category-tabs">
        {categories.map((c) => (
          <button
            className={category === c ? 'active' : ''}
            onClick={() => {
              setCategory(c);
              setLimit(30);
            }}
            key={c}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="catalogue-results-heading">
        <span>
          {found.length} {query ? 'matching' : 'available'} tasks
        </span>
        <small>
          Choose a task to configure its inputs
          <ArrowRight size={12} />
        </small>
      </div>
      <div className="function-cards">
        {found.slice(0, limit).map((f) => (
          <button key={f.name} onClick={() => onSelect(f)}>
            <div className="function-card-top">
              <span className="function-card-icon">{iconFor(f.categories[0])}</span>
              <span className="function-tag">{f.name.replace('WF.', '')}</span>
              <ArrowUpRight size={14} />
            </div>
            <h3>{f.friendlyName}</h3>
            <p>{f.description}</p>
            <div className="function-input-types">
              Needs: {[...new Set(f.inputs.map((i) => i.type))].join(' · ')}
            </div>
            <div className="function-card-example">
              <span>Example</span>
              {displayCell(f.example.expected).slice(0, 75)}
            </div>
            <div className="function-card-bottom">
              <span>{f.categories.filter((c) => c !== 'Workflows').join(' · ')}</span>
              <span>
                {f.external
                  ? 'Connection required'
                  : `${f.inputs.filter((i) => i.required).length} inputs`}
              </span>
            </div>
          </button>
        ))}
      </div>
      {found.length === 0 && (
        <EmptyState
          icon={<Search size={26} />}
          title="Let’s try a different search"
          description="Search a function name, category, or task. Try ‘average’, ‘salary’, or ‘date difference’."
          action="Show all tasks"
          onAction={() => {
            setQuery('');
            setCategory('All');
          }}
        />
      )}
      {found.length > limit && (
        <button className="button ghost show-more" onClick={() => setLimit(limit + 60)}>
          Show more tasks
          <ChevronDown size={14} />
        </button>
      )}
    </div>
  );
}
function EmptyState({
  icon,
  title,
  description,
  action,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="empty-state">
      <span>{icon}</span>
      <h2>{title}</h2>
      <p>{description}</p>
      <button className="button primary" onClick={onAction}>
        {action}
        <ArrowRight size={15} />
      </button>
    </div>
  );
}
function uniqueSheetName(name: string, workbook: Workbook) {
  let next = name,
    n = 2;
  while (workbook.sheets.some((s) => s.name === next)) next = `${name} (${n++})`;
  return next;
}
function collectColumnNames(value: any, workbook: Workbook): string[] {
  const found = new Set<string>();
  const visit = (v: any) => {
    if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === 'object') {
      if (v.__source === 'column') {
        const sheet = workbook.sheets.find((s) => s.id === v.sheetId),
          col = sheet?.columns.find((c) => c.id === v.columnId);
        if (col) found.add(`${sheet?.name}: ${col.name}`);
      } else if (v.__source === 'range') found.add(v.range);
      Object.values(v).forEach(visit);
    }
  };
  visit(value);
  return [...found];
}
