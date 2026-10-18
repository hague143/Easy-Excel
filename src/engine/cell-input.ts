import type { CellError, CellValue, DataType } from './types';
import { civilFromSerial, dateSerial } from './base-helpers';

const numericPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
const errorPattern =
  /^#(?:NULL!|DIV\/0!|VALUE!|REF!|NAME\?|NUM!|N\/A|GETTING_DATA|SPILL!|CONNECT!|BLOCKED!|UNKNOWN!|FIELD!|CALC!)$/i;
const leadingZero = /^[+-]?0\d/;
const invalid = (type: DataType, explanation?: string): CellError => ({
  error: '#VALUE!',
  message:
    explanation ||
    `Enter a valid ${type} value. Clear the cell for a blank; choose Text to preserve literal content.`,
});
const numeric = (text: string, type: DataType): number | CellError => {
  if (!numericPattern.test(text)) return invalid(type);
  const value = Number(text);
  if (!Number.isFinite(value))
    return { error: '#NUM!', message: 'This number is outside the finite numeric range.' };
  // Long integer identifiers cannot round-trip through a double. Scientific notation is
  // an explicit numerical input; integer IDs should instead use a Text column.
  if (/^[+-]?\d+(?:\.0*)?$/.test(text) && !Number.isSafeInteger(value))
    return {
      error: '#NUM!',
      message:
        'This integer exceeds exact numeric precision. Choose Text to preserve every identifier digit.',
    };
  return value;
};
const integerIdentifier = (text: string): boolean =>
  leadingZero.test(text) ||
  (/^[+-]?\d+$/.test(text) &&
    (text.replace(/^[+-]/, '').length > 15 || !Number.isSafeInteger(Number(text))));

/** Parse an explicit edit according to its column's declared type. Never executes formulas. */
export function parseCellInput(raw: string, type: DataType): CellValue {
  // Empty text is a value. Clearing any other type produces a genuinely blank cell.
  if (type === 'text') return raw;
  const text = raw.trim();
  if (text === '') return null;
  if (errorPattern.test(text)) return { error: text.toUpperCase() };
  if (type === 'mixed') {
    if (integerIdentifier(text)) return raw;
    if (/^(?:true|false)$/i.test(text)) return /^true$/i.test(text);
    if (numericPattern.test(text)) {
      const result = numeric(text, 'number');
      return typeof result === 'number' ? result : raw;
    }
    // Mixed columns keep date-like strings, currency text and formula-like input as text.
    // Their interpretation requires an explicit column type or import setting.
    return raw;
  }
  if (type === 'boolean')
    return /^(?:true|false)$/i.test(text)
      ? /^true$/i.test(text)
      : invalid(
          type,
          'Enter TRUE or FALSE. Numeric 0/1 and yes/no are not silently converted to Boolean values.',
        );
  if (type === 'number') return numeric(text, type);
  if (type === 'percentage') {
    // As in Excel, 25% stores .25, while .25 stores .25. A plain 25 stores 25 (2500%).
    const percent = /%$/.test(text),
      body = percent ? text.slice(0, -1).trim() : text;
    const result = numeric(body, type);
    return typeof result === 'number' ? result / (percent ? 100 : 1) : result;
  }
  if (type === 'currency') {
    let body = text,
      negative = false;
    if (/^\(.*\)$/.test(body)) {
      negative = true;
      body = body.slice(1, -1).trim();
    }
    let sign = '';
    if (/^[+-]/.test(body)) {
      sign = body[0];
      body = body.slice(1).trim();
    }
    body = body.replace(/^(?:[$€£¥₹₨]|USD|EUR|GBP|JPY|INR|PKR|Rs\.?)\s*/i, '');
    if (!sign && /^[+-]/.test(body)) {
      sign = body[0];
      body = body.slice(1).trim();
    }
    body = body.replace(/\s*(?:USD|EUR|GBP|JPY|INR|PKR)$/i, '');
    if (negative && sign)
      return invalid(
        type,
        'Use either parentheses or a minus sign for negative currency, not both.',
      );
    if (body.includes(',') && !/^\d{1,3}(?:,\d{3})+(?:\.\d*)?$/.test(body))
      return invalid(
        type,
        'Currency thousands separators must group three digits, for example 1,234.50.',
      );
    const result = numeric((negative ? '-' : sign) + body.replace(/,/g, ''), type);
    return result;
  }
  if (type === 'date') {
    // ISO avoids guessing whether 03/04 means 3 April or March 4. Dates are stored
    // as ISO calendar strings, consistently with the workbook import path.
    const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
    if (!match)
      return invalid(
        type,
        'Enter an ISO calendar date: YYYY-MM-DD. Ambiguous date formats are not guessed.',
      );
    try {
      const serial = dateSerial(text),
        date = civilFromSerial(serial);
      return `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
    } catch {
      return invalid(
        type,
        'Enter a valid date from 1900-01-01 to 9999-12-31 (Excel’s serial-60 date is supported).',
      );
    }
  }
  if (type === 'time') {
    const match = /^(\d{1,2}):(\d{2})(?::(\d{2})(\.\d+)?)?\s*(AM|PM)?$/i.exec(text);
    if (!match) return invalid(type, 'Enter HH:MM[:SS] with optional AM or PM.');
    let hour = Number(match[1]);
    const minute = Number(match[2]),
      second = Number(match[3] || 0),
      period = match[5]?.toUpperCase();
    if (hour > 23 || minute > 59 || second > 59 || (period && (hour < 1 || hour > 12)))
      return invalid(type, 'Enter a valid clock time (00:00:00 to 23:59:59).');
    if (period) hour = (hour % 12) + (period === 'PM' ? 12 : 0);
    const fraction = match[4]?.replace(/0+$/, '') || '';
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}${match[3] !== undefined ? ':' + (String(Math.floor(second)).padStart(2, '0') + (second % 1 ? String(second).slice(String(second).indexOf('.')) : '')) + (fraction === '.' ? '' : fraction) : ''}`;
  }
  return invalid(type);
}

/** Human-editable representation; percentage round-trips without multiplying twice. */
export function formatCellInput(value: CellValue | undefined, type: DataType): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return value.error;
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (type === 'percentage' && typeof value === 'number') {
    const [coefficient, exponent = '0'] = String(value).split('e'),
      percent = Number(`${coefficient}e${Number(exponent) + 2}`);
    return Number.isFinite(percent) ? `${percent}%` : String(value);
  }
  if (type === 'date' && typeof value === 'number') {
    try {
      const date = civilFromSerial(value);
      return `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
    } catch {
      return String(value);
    }
  }
  if (type === 'time' && typeof value === 'number' && value >= 0 && value < 1) {
    const seconds = Math.round(value * 86400 * 1e6) / 1e6,
      hour = Math.floor(seconds / 3600) % 24,
      minute = Math.floor(seconds / 60) % 60,
      second = seconds % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(Math.floor(second)).padStart(2, '0') + (second % 1 ? String(second).slice(String(second).indexOf('.')) : '')}`;
  }
  return String(value);
}
