import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CodingSessionDto } from '@devpulse/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog';
import { Field, Input, Select } from '@/components/ui/Field';
import { activityApi, activityKeys } from '@/features/activity/activity-api';
import { getErrorMessage } from '@/lib/api-client';
import { invalidateSessionData, sessionsApi } from '../sessions-api';

/** Renames a session or moves it to another project. Timing is never editable from the web. */
export function EditSessionDialog({
  session,
  onClose,
}: {
  session: CodingSessionDto;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(session.title ?? '');
  const [projectId, setProjectId] = useState(session.project?.id ?? '');
  const options = useQuery({
    queryKey: activityKeys.filters,
    queryFn: ({ signal }) => activityApi.filters(signal),
  });

  const save = useMutation({
    mutationFn: () =>
      sessionsApi.update(session.id, { title: title.trim() || null, projectId: projectId || null }),
    onSuccess: () => {
      invalidateSessionData(queryClient);
      toast.success('Session updated');
      onClose();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title="Edit session"
        description="Rename the session or move it to a different project."
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button type="submit" form="edit-session" loading={save.isPending}>
              Save changes
            </Button>
          </>
        }
      >
        <form
          id="edit-session"
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <Field label="Title" optional hint="Leave empty to name it after the branch.">
            <Input
              value={title}
              maxLength={120}
              autoFocus
              placeholder="e.g. Worked on authentication"
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>
          <Field label="Project">
            <Select
              value={projectId}
              disabled={options.isPending}
              onChange={(event) => setProjectId(event.target.value)}
            >
              <option value="">No project</option>
              {options.data?.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
