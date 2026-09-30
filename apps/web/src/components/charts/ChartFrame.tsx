import type { ReactNode } from 'react';

interface ChartFrameProps {
  /** Short description of what the chart shows, announced to screen readers. */
  summary: string;
  /** Accessible data table rendered for assistive technology. */
  table: { headers: string[]; rows: (string | number)[][] };
  height?: number;
  children: ReactNode;
}

/**
 * Wraps a chart in a figure with an accessible summary and a visually hidden data table, so the
 * values are available without relying on the visual.
 */
export function ChartFrame({ summary, table, height = 240, children }: ChartFrameProps) {
  return (
    // `relative` anchors the visually hidden content inside the figure.
    <figure className="relative m-0">
      <div aria-hidden style={{ height }} className="w-full">
        {children}
      </div>
      <figcaption className="sr-only">{summary}</figcaption>
      {/*
        Tables ignore the 1px size of `sr-only`, so the class goes on a wrapper: applied to the
        table directly, its full height extended the page and made the sticky sidebar slide.
      */}
      <div className="sr-only">
        <table>
          <thead>
            <tr>
              {table.headers.map((header) => (
                <th key={header} scope="col">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
