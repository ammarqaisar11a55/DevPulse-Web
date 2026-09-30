import * as RadixDialog from '@radix-ui/react-dialog';
import { useQuery } from '@tanstack/react-query';
import type { SearchResponse, SearchResult } from '@devpulse/shared';
import { FolderGit2, Laptop, ListTree, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { ColorDot } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { projectColor } from '@/lib/colors';
import { formatRelative } from '@/lib/format';

const GROUP_LABELS: Record<SearchResult['type'], string> = {
  projects: 'Projects',
  sessions: 'Sessions',
  devices: 'Devices',
};
const GROUP_ICONS = { projects: FolderGit2, sessions: ListTree, devices: Laptop };

const searchApi = (q: string, signal?: AbortSignal) =>
  api.get<SearchResponse>('/search', { query: { q }, signal });

function useShortcut(onTrigger: () => void) {
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onTrigger();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onTrigger]);
}

/** Global search: a top-bar trigger (and Cmd/Ctrl+K) opening a keyboard-driven palette. */
export function SearchCommand() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const query = useDebouncedValue(input.trim(), 250);
  const enabled = open && query.length >= 2;

  const search = useQuery({
    queryKey: ['search', query],
    queryFn: ({ signal }) => searchApi(query, signal),
    enabled,
    staleTime: 15_000,
  });

  const results = useMemo(
    () => search.data?.groups.flatMap((group) => group.results) ?? [],
    [search.data],
  );
  useShortcut(() => setOpen(true));
  useEffect(() => setActive(0), [query]);

  const choose = (result: SearchResult | undefined) => {
    if (!result) return;
    setOpen(false);
    setInput('');
    navigate(result.href);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (results.length === 0) return;
      const next =
        (active + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
      setActive(next);
      listRef.current
        ?.querySelector(`[data-index="${next}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(results[active]);
    }
  };

  let index = -1;
  const activeId = results[active]
    ? `search-result-${results[active].type}-${results[active].id}`
    : undefined;

  return (
    <RadixDialog.Root open={open} onOpenChange={setOpen}>
      <RadixDialog.Trigger asChild>
        <button
          type="button"
          className="flex h-10 w-full max-w-md items-center gap-2.5 rounded-control border border-line bg-surface px-3 text-sm text-ink-subtle transition-colors hover:border-line-strong max-sm:w-10 max-sm:justify-center max-sm:px-0"
          aria-label="Search"
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="flex-1 text-left max-sm:hidden">
            Search projects, sessions and devices
          </span>
          <kbd className="rounded border border-line px-1.5 font-sans text-[11px] max-sm:hidden">
            Ctrl K
          </kbd>
        </button>
      </RadixDialog.Trigger>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=open]:animate-fade-in" />
        <RadixDialog.Content
          aria-describedby={undefined}
          className="fixed top-[12vh] left-1/2 z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-sheet border border-line bg-surface shadow-float data-[state=open]:animate-scale-in"
        >
          <RadixDialog.Title className="sr-only">Search</RadixDialog.Title>
          <div className="flex items-center gap-3 border-b border-line px-4">
            <Search className="size-4 shrink-0 text-ink-subtle" aria-hidden />
            <input
              autoFocus
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search projects, sessions and devices"
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls="search-results"
              aria-activedescendant={activeId}
              aria-autocomplete="list"
              className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-ink-subtle"
            />
            {search.isFetching && <Spinner />}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {!enabled ? (
              <p className="px-4 py-8 text-center text-sm text-ink-muted">
                Type at least two characters to search.
              </p>
            ) : search.isError ? (
              <p className="px-4 py-8 text-center text-sm text-danger">
                Search is unavailable right now.
              </p>
            ) : search.data && results.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-muted">
                No results for “{query}”.
              </p>
            ) : (
              <ul
                id="search-results"
                role="listbox"
                ref={listRef}
                aria-label="Search results"
                className="py-2"
              >
                {search.data?.groups
                  .filter((group) => group.results.length > 0)
                  .map((group) => {
                    const Icon = GROUP_ICONS[group.type];
                    return (
                      <li key={group.type} role="presentation">
                        <p className="px-4 pt-2 pb-1 text-xs text-ink-subtle">
                          {GROUP_LABELS[group.type]}
                          {group.total > group.results.length
                            ? ` (${group.results.length} of ${group.total})`
                            : ''}
                        </p>
                        <ul role="presentation">
                          {group.results.map((result) => {
                            index += 1;
                            const current = index;
                            return (
                              <li
                                key={result.id}
                                id={`search-result-${result.type}-${result.id}`}
                                role="option"
                                aria-selected={current === active}
                                data-index={current}
                                onMouseMove={() => setActive(current)}
                                onClick={() => choose(result)}
                                className={cn(
                                  'mx-2 flex cursor-pointer items-center gap-3 rounded-control px-3 py-2.5',
                                  current === active && 'bg-surface-3',
                                )}
                              >
                                {result.type === 'devices' ? (
                                  <Icon className="size-4 shrink-0 text-ink-muted" aria-hidden />
                                ) : (
                                  <ColorDot color={projectColor(result.color)} />
                                )}
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-medium">
                                    {result.title}
                                  </span>
                                  {result.subtitle && (
                                    <span className="block truncate text-xs text-ink-muted">
                                      {result.subtitle}
                                    </span>
                                  )}
                                </span>
                                {result.date && (
                                  <span className="shrink-0 text-xs text-ink-subtle">
                                    {formatRelative(result.date)}
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
