import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { DataTable, type Column } from '@/components/ui/DataTable';

interface Row {
  id: string;
  name: string;
  minutes: number;
}

const rows: Row[] = [
  { id: 'a', name: 'Alpha', minutes: 30 },
  { id: 'b', name: 'Beta', minutes: 45 },
];

const columns: Column<Row>[] = [
  { key: 'minutes', header: 'Minutes', cell: (row) => row.minutes },
  { key: 'name', header: 'Name', mobile: 'primary', cell: (row) => row.name },
];

describe('DataTable', () => {
  it('links each row from its primary cell when rowHref is set', () => {
    render(
      <MemoryRouter>
        <DataTable
          caption="Things"
          rows={rows}
          columns={columns}
          rowKey={(row) => row.id}
          rowHref={(row) => `/things/${row.id}`}
        />
      </MemoryRouter>,
    );
    // One link per row in the table and one in the stacked mobile list.
    const alphaLinks = screen.getAllByRole('link', { name: /alpha/i });
    expect(alphaLinks).toHaveLength(2);
    for (const link of alphaLinks) expect(link).toHaveAttribute('href', '/things/a');
    // In the table, the link wraps the primary column even though it is not the first column.
    const tableLink = screen.getByRole('table').querySelector('a');
    expect(tableLink).toHaveTextContent('Alpha');
  });

  it('renders plain rows without rowHref', () => {
    render(
      <MemoryRouter>
        <DataTable caption="Things" rows={rows} columns={columns} rowKey={(row) => row.id} />
      </MemoryRouter>,
    );
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('shows the empty state when there are no rows', () => {
    render(
      <DataTable
        caption="Things"
        rows={[]}
        columns={columns}
        rowKey={(row) => row.id}
        empty={<p>Nothing here</p>}
      />,
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
});
