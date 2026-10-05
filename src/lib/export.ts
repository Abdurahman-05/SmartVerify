import { File, Paths } from 'expo-file-system';
import { printToFileAsync } from 'expo-print';
import { shareAsync } from 'expo-sharing';

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const escapeCsv = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

export interface ExportTable {
  title: string;
  subtitle: string;
  columns: string[];
  rows: string[][];
  footer?: string;
}

export async function sharePdf(table: ExportTable) {
  const head = table.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('');
  const body = table.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('');
  const html = `
    <html><head><meta charset="utf-8" /><style>
      body { font-family: -apple-system, Roboto, sans-serif; color: #14201B; padding: 24px; }
      h1 { font-size: 22px; margin: 0; color: #0D4A36; }
      p { color: #3B4A44; margin: 4px 0 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { text-align: left; background: #DDEFE6; padding: 8px; }
      td { padding: 8px; border-bottom: 1px solid #DDE5E1; }
      .footer { margin-top: 16px; font-weight: bold; }
    </style></head><body>
      <h1>${escapeHtml(table.title)}</h1>
      <p>${escapeHtml(table.subtitle)}</p>
      <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
      ${table.footer ? `<div class="footer">${escapeHtml(table.footer)}</div>` : ''}
    </body></html>`;

  const { uri } = await printToFileAsync({ html });
  await shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: table.title });
}

export async function shareCsv(fileName: string, table: ExportTable) {
  const lines = [table.columns, ...table.rows].map((row) => row.map(escapeCsv).join(','));
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  // BOM so Excel opens Amharic text correctly.
  file.write(`﻿${lines.join('\n')}`);
  await shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: table.title });
}
