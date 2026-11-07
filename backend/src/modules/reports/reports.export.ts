import type { ExpensesReport, FoodReport, SalesReport, StaffReport } from './reports.service.js';

export type Tab = 'sales' | 'food' | 'expenses' | 'staff';
type Table = { title: string; columns: string[]; rows: string[][] };

const money = (v: number) => v.toLocaleString('en-US');
const kindNames: Record<string, string> = {
  FOOD: 'Food stock',
  DRINKS: 'Drinks',
  GAS: 'Gas',
  RENT: 'Rent',
  SALARY: 'Salary',
  REPAIRS: 'Repairs',
  TRANSPORT: 'Transport',
  BILLS: 'Bills',
  OTHER: 'Other',
};

/** The same numbers as the tab, as rows (section, item, detail, amount in ETB). */
export function tableOf(
  tab: Tab,
  data: SalesReport | FoodReport | ExpensesReport | StaffReport
): Table {
  const rows: string[][] = [];
  const add = (section: string, item: string, detail: string, amount: number | '') =>
    rows.push([section, item, detail, amount === '' ? '' : money(amount)]);
  if (tab === 'sales') {
    const s = data as SalesReport;
    add('Sales', 'Total sales', `${s.bills} bills`, s.total);
    add('Sales', 'Average bill', '', s.avgBill);
    add('Sales', 'Before (same length)', '', s.previousTotal);
    add('Paid by', 'Cash', `${s.paidBy.cash.bills} bills`, s.paidBy.cash.amount);
    add('Paid by', 'Bank', `${s.paidBy.bank.bills} bills`, s.paidBy.bank.amount);
    add('Paid by', 'Cash + Bank', `${s.paidBy.both.bills} bills`, s.paidBy.both.amount);
    for (const h of s.byHour.filter((x) => x.bills > 0)) {
      add('By hour', `${h.hour}:00-${(h.hour + 1) % 24}:00`, `${h.bills} bills`, h.amount);
    }
    for (const d of s.byDay) add('By day', d.date, `${d.bills} bills`, d.amount);
  } else if (tab === 'food') {
    const f = data as FoodReport;
    for (const i of f.bestSellers) add('Best sellers', i.name, `${i.qty} sold`, i.amount);
    for (const c of f.byCategory) add('By category', c.name || 'Other', `${c.qty} sold`, c.amount);
    for (const i of f.slowSellers) add('Slow sellers', i.name, `${i.qty} sold`, i.amount);
    add('Cancelled', 'Cancelled orders', `${f.cancelled.count} orders`, f.cancelled.amount);
    for (const o of f.cancelled.orders) {
      add(
        'Cancelled',
        `Order #${o.number}`,
        [o.waiter, o.reason].filter(Boolean).join(' - '),
        o.amount
      );
    }
  } else if (tab === 'expenses') {
    const e = data as ExpensesReport;
    add('Expenses', 'Total expenses', '', e.total);
    add('Expenses', 'Sales', '', e.sales);
    add('Expenses', 'Profit (sales - purchases and business costs)', '', e.profit);
    add('Expenses', 'Money left (sales - all expenses)', '', e.moneyLeft);
    for (const k of e.byKind)
      add('By kind', kindNames[k.kind] ?? k.kind, `${k.count} expenses`, k.amount);
    for (const b of e.boughtItems) add('Bought items', b.name, `${b.times} times`, b.amount);
    for (const p of e.byPerson) {
      add(
        'By person',
        p.name,
        `${p.count} expenses, cash ${money(p.cash)}, bank ${money(p.bank)}`,
        p.total
      );
    }
    add('Changes', 'Changed by the owner', String(e.changedByOwner), '');
    for (const d of e.deleted) add('Deleted', d.title, d.reason ?? '', d.amount);
  } else {
    const s = data as StaffReport;
    for (const w of s.waiterSales) {
      add('Waiter sales', w.name, `${w.bills} bills, average ${money(w.avgBill)}`, w.sales);
    }
    for (const t of s.tips) add('Tips', t.name, `paid out ${money(t.paidOut)}`, t.total);
    const c = s.receiptChecks;
    add('Receipt checks', 'All', `${c.ok} ok, ${c.failed} failed`, '');
    for (const b of c.byBank) add('Checks by bank', b.bank, `${b.ok} ok, ${b.failed} failed`, '');
    for (const p of c.byStaff) add('Checks by staff', p.name, `${p.ok} ok, ${p.failed} failed`, '');
    add('Kitchen', 'Average', `${s.kitchen.avgMinutes} min, ${s.kitchen.orders} orders`, '');
    for (const d of s.kitchen.slowest)
      add('Kitchen', d.name, `${d.minutes} min, ${d.orders} orders`, '');
  }
  const titles: Record<Tab, string> = {
    sales: 'Sales',
    food: 'Food & drink',
    expenses: 'Expenses',
    staff: 'Staff & checks',
  };
  return {
    title: `Reports - ${titles[tab]}`,
    columns: ['Section', 'Item', 'Detail', 'Amount (ETB)'],
    rows,
  };
}

/** CSV with a BOM so spreadsheet apps read Amharic names correctly. */
export function toCsv(table: Table, subtitle: string): string {
  const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [[table.title], [subtitle], [], table.columns, ...table.rows];
  return '﻿' + lines.map((l) => l.map(cell).join(',')).join('\r\n') + '\r\n';
}

/**
 * A plain text PDF (A4, Helvetica) without any library. Helvetica has no Ethiopic letters, so
 * those show as "?" here; the app's own PDF (made on the phone) keeps Amharic.
 */
export function toPdf(table: Table, subtitle: string): Buffer {
  const ascii = (s: string) =>
    s
      .replace(/[^\x20-\x7E]/g, '?')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  const widths = [110, 170, 160, 85];
  const fit = (s: string, w: number) => {
    const max = Math.floor(w / 5.2);
    return s.length > max ? `${s.slice(0, max - 1)}.` : s;
  };
  const lines: { text: string[]; bold?: boolean; size?: number }[] = [
    { text: [table.title], bold: true, size: 16 },
    { text: [subtitle] },
    { text: [''] },
    { text: table.columns, bold: true },
    ...table.rows.map((r) => ({ text: r })),
  ];
  const perPage = 48;
  const pages: string[] = [];
  for (let i = 0; i < lines.length; i += perPage) {
    let y = 800;
    const ops: string[] = [];
    for (const line of lines.slice(i, i + perPage)) {
      const size = line.size ?? 10;
      let x = 40;
      line.text.forEach((t, c) => {
        const w = line.text.length === 1 ? 515 : (widths[c] ?? 100);
        ops.push(
          `BT /${line.bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td (${ascii(fit(t, w * (10 / size)))}) Tj ET`
        );
        x += w;
      });
      y -= size + 6;
    }
    pages.push(ops.join('\n'));
  }

  const objects: string[] = [];
  const pageIds = pages.map((_, i) => 5 + i * 2);
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
  pages.forEach((content, i) => {
    const id = pageIds[i]!;
    objects[id] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${id + 1} 0 R >>`;
    objects[id + 1] = `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`;
  });

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = Buffer.byteLength(out);
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) {
    out += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
