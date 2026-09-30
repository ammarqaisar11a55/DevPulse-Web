import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { goalKeys, goalsApi } from '../goals-api';
import { GoalProgress } from './GoalProgress';

const SHOWN = 3;

/** Up to three active goals on the dashboard, with a prompt when none exist. */
export function DashboardGoals() {
  const goals = useQuery({
    queryKey: goalKeys.list(false),
    queryFn: ({ signal }) => goalsApi.list(false, signal),
  });
  if (goals.isError) return null;

  return (
    <Panel className="mb-6">
      <PanelHeader
        title="Goals"
        actions={
          <Link to="/goals" className="text-sm text-accent hover:underline">
            {goals.data?.length ? 'All goals' : 'Set a goal'}
          </Link>
        }
      />
      <PanelBody>
        {goals.isPending ? (
          <SkeletonRows rows={1} />
        ) : goals.data.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Set a daily or weekly target to see your progress here.
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {goals.data.slice(0, SHOWN).map((goal) => (
              <GoalProgress key={goal.id} goal={goal} compact />
            ))}
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}
