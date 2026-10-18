import { describe, expect, it } from 'vitest';
import { financeFunctions } from '../src/engine/finance';
import { CalcError } from '../src/engine/types';
const calc = (name: string, a: Record<string, any>) =>
  financeFunctions.find((f) => f.name === name)!.calculate(a, {});
const close = (actual: number, expected: number, tolerance = 1e-8) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(
    tolerance * Math.max(1, Math.abs(expected)),
  );
describe('financial reference examples', () => {
  for (const f of financeFunctions)
    it(`${f.name}: independently specified example`, () =>
      close(f.calculate(f.example.args, {}), f.example.expected));
  it('ignores text and booleans in cell ranges while preserving numeric zero', () => {
    close(calc('NPV', { rate: 0.1, values: [110, '121', null, 0, false, 121] }), 190.9090909090909);
    close(calc('IRR', { values: [-100, 'text', false, null, 0, 121] }), 0.1);
    close(
      calc('MIRR', { values: [-100, 'text', 0, 121], financeRate: 0.1, reinvestRate: 0.1 }),
      0.1,
    );
  });
  it('annualizes simple securities with the settlement year for actual/actual', () => {
    const a = {
      settlement: '2023-01-01',
      maturity: '2025-01-01',
      price: 90,
      redemption: 100,
      basis: 1,
    };
    close(calc('DISC', a), 0.04993160054719562);
    close(calc('INTRATE', { ...a, investment: 100, redemption: 110 }), 0.04993160054719562);
    close(
      calc('DISC', { ...a, settlement: '2024-01-01', maturity: '2026-01-01' }),
      0.05006839945280438,
    );
    close(calc('DISC', { ...a, basis: 0 }), 0.05);
    close(calc('DISC', { ...a, basis: 2 }), 0.04924760601915185);
  });
  it('calculates a standard monthly mortgage payment', () =>
    close(calc('PMT', { rate: 0.08 / 12, nper: 120, pv: 10000 }), -121.32759435535777));
  it('handles zero interest and beginning-of-period payments', () => {
    expect(calc('PMT', { rate: 0, nper: 10, pv: 1000 })).toBe(-100);
    close(calc('PMT', { rate: 0.1, nper: 2, pv: 100, type: 1 }), -52.38095238095238);
    expect(calc('IPMT', { rate: 0.1, nper: 2, pv: 100, type: 1, per: 1 })).toBe(0);
  });
  it('keeps principal and interest components consistent for both timings', () => {
    for (const type of [0, 1]) {
      const args = { rate: 0.01, nper: 12, pv: 1000, type };
      let principal = 0;
      for (let per = 1; per <= 12; per++) {
        const ip = calc('IPMT', { ...args, per }),
          pp = calc('PPMT', { ...args, per });
        close(ip + pp, calc('PMT', args));
        principal += pp;
      }
      close(principal, -1000);
    }
  });
  it('matches PV, FV, NPER and RATE against a nontrivial annuity', () => {
    const a = { rate: 0.01, nper: 36, pmt: -100, pv: 0, fv: 0, type: 1 };
    const present = calc('PV', a);
    close(calc('FV', { ...a, pv: present }), 0, 1e-7);
    close(calc('RATE', { ...a, pv: present }), 0.01);
    close(calc('NPER', { ...a, pv: present }), 36);
  });
  it('distinguishes end-of-period NPV from first-date XNPV', () => {
    close(calc('NPV', { rate: 0.1, values: [-100, 110] }), 0);
    close(calc('XNPV', { rate: 0.1, values: [-100, 110], dates: ['2023-01-01', '2024-01-01'] }), 0);
  });
  it('matches the Microsoft IRR example', () =>
    close(
      calc('IRR', { values: [-70000, 12000, 15000, 18000, 21000, 26000] }),
      0.0866309480365316,
    ));
  it('matches the Microsoft XIRR example', () =>
    close(
      calc('XIRR', {
        values: [-10000, 2750, 4250, 3250, 2750],
        dates: ['2008-01-01', '2008-03-01', '2008-10-30', '2009-02-15', '2009-04-01'],
      }),
      0.3733625335188315,
    ));
  it('finds different IRR roots with distinct supplied guesses', () => {
    close(calc('IRR', { values: [-100, 230, -132], guess: 0.05 }), 0.1);
    close(calc('IRR', { values: [-100, 230, -132], guess: 0.3 }), 0.2);
  });
  it('matches the Microsoft MIRR example', () =>
    close(
      calc('MIRR', {
        values: [-120000, 39000, 30000, 21000, 37000, 46000],
        financeRate: 0.1,
        reinvestRate: 0.12,
      }),
      0.1260941303659051,
    ));
  it('matches the Microsoft bond PRICE example', () =>
    close(
      calc('PRICE', {
        settlement: '2008-02-15',
        maturity: '2017-11-15',
        rate: 0.0575,
        yld: 0.065,
        redemption: 100,
        frequency: 2,
        basis: 0,
      }),
      94.63436162132213,
    ));
  it('matches the Microsoft bond YIELD example', () =>
    close(
      calc('YIELD', {
        settlement: '2008-02-15',
        maturity: '2016-11-15',
        rate: 0.0575,
        price: 95.04287,
        redemption: 100,
        frequency: 2,
        basis: 0,
      }),
      0.06500000688069,
    ));
  it('matches the Microsoft duration example', () =>
    close(
      calc('DURATION', {
        settlement: '2008-01-01',
        maturity: '2016-01-01',
        rate: 0.08,
        yld: 0.09,
        frequency: 2,
        basis: 1,
      }),
      5.99377495554519,
    ));
  it('preserves the modified duration relation for off-coupon dates', () => {
    const a = {
      settlement: '2024-03-15',
      maturity: '2031-12-31',
      rate: 0.05,
      yld: 0.06,
      frequency: 2,
      basis: 1,
    };
    close(calc('MDURATION', a), calc('DURATION', a) / 1.03);
  });
  it('round trips bond prices and yields across all day-count bases', () => {
    for (const basis of [0, 1, 2, 3, 4])
      for (const frequency of [1, 2, 4]) {
        const a = {
          settlement: '2024-03-15',
          maturity: '2028-08-31',
          rate: 0.05,
          yld: 0.065,
          redemption: 100,
          basis,
          frequency,
        };
        const price = calc('PRICE', a);
        close(calc('YIELD', { ...a, price }), 0.065);
      }
  });
  it('supports one remaining coupon with simple discounting', () => {
    const a = {
      settlement: '2024-07-01',
      maturity: '2024-12-31',
      rate: 0.05,
      yld: 0.06,
      frequency: 2,
      basis: 0,
      redemption: 100,
    };
    const price = calc('PRICE', a);
    close(calc('YIELD', { ...a, price }), 0.06);
  });
  it('handles leap-day and end-of-month coupon schedules', () => {
    const a = {
      settlement: '2024-02-29',
      maturity: '2026-02-28',
      rate: 0.05,
      yld: 0.05,
      frequency: 2,
      basis: 1,
    };
    close(calc('PRICE', a), 100);
  });
  it('includes the partial final year in fixed declining depreciation', () =>
    close(
      calc('DB', { cost: 1000000, salvage: 100000, life: 6, period: 7, month: 7 }),
      15845.098473848079,
    ));
  it('switches to straight line when beneficial and supports fractional VDB ranges', () => {
    close(calc('VDB', { cost: 2400, salvage: 300, life: 10, start: 0, end: 1 }), 480);
    close(
      calc('VDB', { cost: 2400, salvage: 300, life: 10, start: 0, end: 0.875, factor: 1.5 }),
      315,
    );
    close(calc('VDB', { cost: 1000, salvage: 0, life: 5, start: 0, end: 5 }), 1000);
  });
  it('uses requested issue/first-interest accrual start', () => {
    const a = {
      issue: '2023-01-01',
      firstInterest: '2023-07-01',
      settlement: '2024-01-01',
      rate: 0.1,
      par: 1000,
      frequency: 2,
      basis: 0,
    };
    close(calc('ACCRINT', { ...a, calcMethod: true }), 100);
    close(calc('ACCRINT', { ...a, calcMethod: false }), 50);
  });
});
describe('financial validation', () => {
  const invalid: Record<string, Record<string, any>> = {
    PMT: { rate: -1 },
    IPMT: { per: 0 },
    PPMT: { per: 99 },
    PV: { rate: -1 },
    FV: { rate: -1 },
    RATE: { nper: 0 },
    NPER: { rate: 0, pmt: 0 },
    NPV: { rate: -1 },
    XNPV: { dates: ['2020-01-01'] },
    IRR: { values: [1, 2, 3] },
    XIRR: { values: [1, 2], dates: ['2024-01-01', '2023-01-01'] },
    SLN: { life: 0 },
    DB: { month: 0 },
    DDB: { period: 0 },
    CUMIPMT: { start: 0 },
    CUMPRINC: { end: 99 },
    MIRR: { values: [1, 2] },
    RRI: { pv: 0 },
    EFFECT: { npery: 0 },
    NOMINAL: { npery: 0 },
    PDURATION: { rate: 0 },
    SYD: { per: 0 },
    VDB: { start: -1 },
    PRICE: { frequency: 3 },
    YIELD: { price: 0 },
    DURATION: { basis: 5 },
    MDURATION: { yld: -0.5 },
    ACCRINT: { par: 0 },
    DISC: { price: 0 },
    INTRATE: { investment: 0 },
    TBILLPRICE: { maturity: '2026-01-01' },
    TBILLYIELD: { price: 0 },
  };
  for (const f of financeFunctions)
    it(`${f.name}: rejects invalid domain`, () =>
      expect(() => calc(f.name, { ...f.example.args, ...invalid[f.name] })).toThrow(CalcError));
  it('rejects return problems without a finite identifiable root', () => {
    expect(() => calc('RATE', { nper: 10, pmt: 100, pv: 0, fv: 0, type: 1 })).toThrow(CalcError);
    expect(() => calc('RATE', { nper: 10, pmt: 0, pv: 0, fv: 0 })).toThrow(CalcError);
    expect(() => calc('IRR', { values: [-100, 50, -100] })).toThrow(CalcError);
    expect(() =>
      calc('XIRR', { values: [-100, 100], dates: ['2024-01-01', '2024-01-01'] }),
    ).toThrow(CalcError);
  });
  it('rejects impossible and locale-ambiguous security dates', () => {
    const a = { ...financeFunctions.find((f) => f.name === 'PRICE')!.example.args };
    expect(() => calc('PRICE', { ...a, settlement: '2024-02-30' })).toThrow(CalcError);
    expect(() => calc('PRICE', { ...a, settlement: '02/03/2024' })).toThrow(CalcError);
  });
  it('rejects external error cells in cash flow data', () =>
    expect(() => calc('NPV', { rate: 0.1, values: [100, { error: '#N/A' }] })).toThrow(CalcError));
});
