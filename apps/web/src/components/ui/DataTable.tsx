import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/cn';
import { Skeleton } from './Skeleton';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: 'left' | 'right';
  /**
   * How the column appears in the stacked mobile layout:
   * `primary` is the row title, `meta` renders as a labelled line, `hidden` is omitted.
   */
  mobile?: 'primary' | 'meta' | 'hidden';
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  caption: string;
  /**
   * Makes each row a link. The primary cell holds a real anchor stretched over the row, so rows
   * are reachable by keyboard and can be opened in a new tab.
   */
  rowHref?: (row: T) => string;
  loading?: boolean;
  loadingRows?: number;
  empty?: ReactNode;
}

/**
 * Renders a semantic table on wide screens and a stacked list on small screens,
 * so rows stay readable without horizontal scrolling.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  rowHref,
  loading,
  loadingRows = 6,
  empty,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div role="status" aria-label={`Loading ${caption}`} className="flex flex-col gap-2 p-4">
        {Array.from({ length: loadingRows }, (_, index) => (
          <Skeleton key={index} className="h-11 w-full" />
        ))}
      </div>
    );
  }
  if (rows.length === 0 && empty) return <>{empty}</>;

  const primary = columns.find((column) => column.mobile === 'primary') ?? columns[0];
  const meta = columns.filter((column) => column !== primary && column.mobile !== 'hidden');

  return (
    <>
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-line">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    'px-4 py-3 text-left text-xs font-medium whitespace-nowrap text-ink-muted first:pl-5 last:pr-5',
                    column.align === 'right' && 'text-right',
                    column.className,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const href = rowHref?.(row);
              return (
                <tr
                  key={rowKey(row)}
                  className={cn(
                    'border-b border-line last:border-0',
                    href && 'relative transition-colors hover:bg-surface-2',
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        'tabular px-4 py-3 align-middle first:pl-5 last:pr-5',
                        column.align === 'right' && 'text-right',
                        column.className,
                      )}
                    >
                      {href && column === primary ? (
                        <Link
                          to={href}
                          className="outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus"
                        >
                          {column.cell(row)}
                        </Link>
                      ) : (
                        column.cell(row)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-line md:hidden" aria-label={caption}>
        {rows.map((row) => {
          const content = (
            <>
              <div className="font-medium">{primary?.cell(row)}</div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                {meta.map((column) => (
                  <div key={column.key} className="min-w-0">
                    <dt className="text-xs text-ink-subtle">{column.header}</dt>
                    <dd className="tabular truncate">{column.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            </>
          );
          const href = rowHref?.(row);
          return (
            <li key={rowKey(row)}>
              {href ? (
                <Link to={href} className="block px-4 py-3.5 hover:bg-surface-2">
                  {content}
                </Link>
              ) : (
                <div className="px-4 py-3.5">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
