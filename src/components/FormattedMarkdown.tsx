'use client';

import React from 'react';

interface FormattedMarkdownProps {
  content: string;
  className?: string;
}

export function FormattedMarkdown({ content, className = '' }: FormattedMarkdownProps) {
  if (!content) return null;

  // Unescape literal \n if raw string came through JSON encoding
  const sanitized = content.replace(/\\n/g, '\n').replace(/\\"/g, '"');

  // Split content into blocks by double newlines or table/code fences
  const lines = sanitized.split('\n');
  const blocks: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeLang = '';
  let codeLines: string[] = [];

  let inTable = false;
  let tableRows: string[][] = [];

  const flushTable = (key: string) => {
    if (tableRows.length === 0) return;
    const headerRow = tableRows[0];
    const bodyRows = tableRows.slice(1).filter(r => !r.every(c => /^[-:| ]+$/.test(c)));

    blocks.push(
      <div key={key} className="my-2.5 overflow-x-auto rounded-lg border border-zinc-700/60 bg-zinc-900/60 shadow-sm">
        <table className="w-full text-left text-[11px] border-collapse">
          <thead>
            <tr className="border-b border-zinc-700 bg-zinc-800/80 text-zinc-200">
              {headerRow.map((col, i) => (
                <th key={i} className="p-2 font-semibold tracking-wide border-r border-zinc-700/40 last:border-r-0">
                  {renderInlineFormatting(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {bodyRows.map((row, rIdx) => (
              <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-zinc-950/40' : 'bg-zinc-900/20 hover:bg-zinc-850/30'}>
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="p-2 text-zinc-300 border-r border-zinc-800/40 last:border-r-0 align-top">
                    {renderInlineFormatting(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
    inTable = false;
  };

  const flushCode = (key: string) => {
    if (codeLines.length === 0) return;
    blocks.push(
      <div key={key} className="my-2.5 rounded-lg border border-zinc-700/60 bg-zinc-950 overflow-hidden font-mono text-[11px]">
        {codeLang && (
          <div className="bg-zinc-900 px-3 py-1 text-[10px] text-zinc-400 font-bold uppercase tracking-wider border-b border-zinc-800">
            {codeLang}
          </div>
        )}
        <pre className="p-2.5 text-zinc-200 overflow-x-auto whitespace-pre leading-relaxed">
          <code>{codeLines.join('\n')}</code>
        </pre>
      </div>
    );
    codeLines = [];
    codeLang = '';
    inCodeBlock = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Code Block Fence (```)
    if (trimmed.startsWith('```')) {
      if (inTable) flushTable(`table_${i}`);
      if (inCodeBlock) {
        flushCode(`code_${i}`);
      } else {
        inCodeBlock = true;
        codeLang = trimmed.replace(/^```/, '').trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // 2. Markdown Table Line (| col | col |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      inTable = true;
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map(c => c.trim());
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      flushTable(`table_${i}`);
    }

    // 3. Horizontal Rule (---)
    if (trimmed === '---' || trimmed === '***') {
      blocks.push(<hr key={`hr_${i}`} className="my-3 border-zinc-800" />);
      continue;
    }

    // 4. Headings
    if (trimmed.startsWith('### ')) {
      blocks.push(
        <h4 key={`h4_${i}`} className="text-xs font-bold text-emerald-300 mt-2.5 mb-1 tracking-wide flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          {renderInlineFormatting(trimmed.replace(/^###\s+/, ''))}
        </h4>
      );
      continue;
    }
    if (trimmed.startsWith('#### ')) {
      blocks.push(
        <h5 key={`h5_${i}`} className="text-[11px] font-bold text-sky-300 mt-2 mb-0.5 tracking-wide">
          {renderInlineFormatting(trimmed.replace(/^####\s+/, ''))}
        </h5>
      );
      continue;
    }
    if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
      blocks.push(
        <h3 key={`h3_${i}`} className="text-xs font-extrabold text-white mt-3 mb-1.5 tracking-wider">
          {renderInlineFormatting(trimmed.replace(/^#+\s+/, ''))}
        </h3>
      );
      continue;
    }

    // 5. Blockquote (> quote)
    if (trimmed.startsWith('> ')) {
      blocks.push(
        <div key={`bq_${i}`} className="my-1.5 pl-3 border-l-2 border-emerald-500/60 text-zinc-300 italic text-[11px] bg-emerald-950/10 py-1 rounded-r">
          {renderInlineFormatting(trimmed.replace(/^>\s+/, ''))}
        </div>
      );
      continue;
    }

    // 6. Bullet lists (- bullet, * bullet)
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      blocks.push(
        <div key={`li_${i}`} className="flex items-start gap-2 my-0.5 text-[11px] text-zinc-300 leading-relaxed">
          <span className="w-1 h-1 rounded-full bg-emerald-400 mt-1.5 shrink-0"></span>
          <span>{renderInlineFormatting(trimmed.replace(/^[-*]\s+/, ''))}</span>
        </div>
      );
      continue;
    }

    // 7. Standard Paragraph / Empty Line
    if (trimmed.length > 0) {
      blocks.push(
        <p key={`p_${i}`} className="my-1 text-[11px] text-zinc-200 leading-relaxed">
          {renderInlineFormatting(trimmed)}
        </p>
      );
    }
  }

  // Flush remaining state
  if (inTable) flushTable(`table_end`);
  if (inCodeBlock) flushCode(`code_end`);

  return <div className={`space-y-1 ${className}`}>{blocks}</div>;
}

// Inline formatting parser: **bold**, `code`, *italic*
function renderInlineFormatting(text: string): React.ReactNode {
  if (!text) return null;

  // Split on bold (**text**) and code (`text`)
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    if (match[2]) {
      // Bold
      parts.push(
        <strong key={match.index} className="font-bold text-zinc-100">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      // Inline Code
      parts.push(
        <code key={match.index} className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700/60 font-mono text-[10px] text-emerald-300">
          {match[3]}
        </code>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

