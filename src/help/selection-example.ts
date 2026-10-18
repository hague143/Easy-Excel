import type { Sheet } from '../engine/types';
import type { Selection } from '../components/Grid';
export const averageSelections = {
  column: {
    label: 'A whole column',
    range: 'B2:B3',
    selection: { r1: 0, c1: 1, r2: 1, c2: 1 },
    values: [60, 50],
    answer: 55,
    explanation:
      'Everyone’s Mathematics marks: (60 + 50) ÷ 2 = 55. Choose Column → Mathematics, or Range → B2:B3.',
  },
  row: {
    label: 'One row',
    range: 'B2:D2',
    selection: { r1: 0, c1: 1, r2: 0, c2: 3 },
    values: [60, 80, 100],
    answer: 80,
    explanation:
      'Amina’s marks across three subjects: (60 + 80 + 100) ÷ 3 = 80. Choose Range → B2:D2. Do not include her name in A2.',
  },
  block: {
    label: 'A block of cells',
    range: 'B2:D3',
    selection: { r1: 0, c1: 1, r2: 1, c2: 3 },
    values: [60, 80, 100, 50, 70, 90],
    answer: 75,
    explanation:
      'Both students across all three subjects: the six marks total 450, so 450 ÷ 6 = 75. Choose Range → B2:D3. The header row is excluded.',
  },
} satisfies Record<
  string,
  {
    label: string;
    range: string;
    selection: Selection;
    values: number[];
    answer: number;
    explanation: string;
  }
>;
export type AverageSelection = keyof typeof averageSelections;
export function averageExampleSheet(id: string, name: string): Sheet {
  return {
    id,
    name,
    source: 'Beginner guide example',
    columns: ['Student', 'Mathematics', 'English', 'Science'].map((name, i) => ({
      id: `${id}-${i}`,
      name,
      type: i ? 'number' : 'text',
    })),
    rows: [
      ['Amina', 60, 80, 100],
      ['Bilal', 50, 70, 90],
    ],
  };
}
