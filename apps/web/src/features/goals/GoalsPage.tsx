import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GoalDto } from '@devpulse/shared';
import { Archive, MoreHorizontal, Plus, Target, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { Panel, PanelBody } from '@/components/ui/Panel';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { getErrorMessage } from '@/lib/api-client';
import { CreateGoalDialog } from './components/CreateGoalDialog';
import { GoalProgress } from './components/GoalProgress';
import { goalTitle } from './goal-format';
import { goalKeys, goalsApi } from './goals-api';

export function GoalsPage() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<GoalDto | null>(null);
  const goals = useQuery({
    queryKey: goalKeys.list(false),
    queryFn: ({ signal }) => goalsApi.list(false, signal),
  });

  const onDone = (message: string) => () => {
    void queryClient.invalidateQueries({ queryKey: goalKeys.all });
    toast.success(message);
    setDeleting(null);
  };
  const onError = (error: unknown) => toast.error(getErrorMessage(error));
  const archive = useMutation({
    mutationFn: (id: string) => goalsApi.update(id, { archived: true }),
    onSuccess: onDone('Goal archived'),
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => goalsApi.remove(id),
    onSuccess: onDone('Goal deleted'),
    onError,
  });

  return (
    <>
      <PageHeader
        title="Goals"
        description="Targets for how much you want to code. Progress updates as sessions are recorded."
        actions={
          <Button leadingIcon={<Plus />} onClick={() => setCreating(true)}>
            New goal
          </Button>
        }
      />

      {goals.isPending ? (
        <Panel>
          <SkeletonRows rows={3} className="p-5" />
        </Panel>
      ) : goals.isError ? (
        <Panel>
          <ErrorState error={goals.error} onRetry={() => void goals.refetch()} />
        </Panel>
      ) : goals.data.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Target />}
            title="No goals yet"
            description="Set a daily, weekly or monthly target for coding time or sessions to see your progress here."
            action={
              <Button leadingIcon={<Plus />} onClick={() => setCreating(true)}>
                New goal
              </Button>
            }
          />
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.data.map((goal) => (
            <Panel key={goal.id}>
              <PanelBody className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <GoalProgress goal={goal} />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <IconButton
                      aria-label={`Actions for ${goalTitle(goal)}`}
                      size="sm"
                      className="-mt-1 -mr-2"
                    >
                      <MoreHorizontal />
                    </IconButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => archive.mutate(goal.id)}>
                      <Archive />
                      Archive goal
                    </DropdownMenuItem>
                    <DropdownMenuItem tone="danger" onSelect={() => setDeleting(goal)}>
                      <Trash2 />
                      Delete goal
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </PanelBody>
            </Panel>
          ))}
        </div>
      )}

      {creating && <CreateGoalDialog open onOpenChange={setCreating} />}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this goal?"
        description="The goal is removed. Your coding history is not affected."
        confirmLabel="Delete goal"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  );
}
