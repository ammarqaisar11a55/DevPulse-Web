import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog';
import { Field, Input, Select } from '@/components/ui/Field';
import { activityApi, activityKeys } from '@/features/activity/activity-api';
import { useCurrentUser } from '@/features/auth/auth-context';
import { projectKeys } from '@/features/projects/projects-api';
import { applyServerErrors } from '@/lib/form-errors';
import { COMMON_LANGUAGES, languageName } from '@/lib/languages';
import { localDateKey } from '@/lib/timezone';
import { parseLocalDate, startOfLocalDay } from '@devpulse/shared/time';
import { sessionKeys, sessionsApi } from '../sessions-api';

const timeOfDay = z.string().regex(/^\d{2}:\d{2}$/, 'Enter a time');

const formSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date'),
    start: timeOfDay,
    end: timeOfDay,
    idleMinutes: z.string().regex(/^\d{1,4}$/, 'Enter whole minutes'),
    projectId: z.string(),
    language: z.string().trim().max(40),
    title: z.string().trim().max(120),
  })
  .refine((data) => data.end > data.start, { message: 'End must be after start', path: ['end'] });

type FormValues = z.input<typeof formSchema>;

const toMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
};

/** Log time spent coding without the extension (e.g. on another machine). */
export function LogSessionDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const options = useQuery({
    queryKey: activityKeys.filters,
    queryFn: ({ signal }) => activityApi.filters(signal),
    enabled: open,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: localDateKey(new Date(), user.timezone),
      start: '09:00',
      end: '10:00',
      idleMinutes: '0',
      projectId: '',
      language: '',
      title: '',
    },
  });
  const { errors } = form.formState;

  const create = useMutation({
    mutationFn: (values: FormValues) => {
      // Interpret the entered wall-clock times in the user's DevPulse time zone.
      const dayStart = startOfLocalDay(parseLocalDate(values.date), user.timezone).getTime();
      const startedAt = new Date(dayStart + toMinutes(values.start) * 60_000);
      const endedAt = new Date(dayStart + toMinutes(values.end) * 60_000);
      const durationSeconds = (endedAt.getTime() - startedAt.getTime()) / 1000;
      return sessionsApi.create({
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        activeSeconds: Math.max(0, durationSeconds - Number(values.idleMinutes) * 60),
        projectId: values.projectId || undefined,
        language: values.language || undefined,
        title: values.title || undefined,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sessionKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['activity'] });
      void queryClient.invalidateQueries({ queryKey: ['analytics'] });
      void queryClient.invalidateQueries({ queryKey: projectKeys.all });
      toast.success('Session logged');
      onOpenChange(false);
    },
    onError: (error) => {
      const message = applyServerErrors(error, form.setError, ['end', 'start'], {
        endedAt: 'end',
        startedAt: 'start',
      });
      if (message) form.setError('root', { message });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Log a session"
        description={`Add coding time manually. Times are in ${user.timezone.replaceAll('_', ' ')}.`}
      >
        <form
          id="log-session"
          onSubmit={form.handleSubmit((values) => create.mutate(values))}
          noValidate
          className="grid gap-4"
        >
          {errors.root?.message && <Alert>{errors.root.message}</Alert>}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Date" error={errors.date?.message} className="col-span-3 sm:col-span-1">
              <Input
                type="date"
                max={localDateKey(new Date(), user.timezone)}
                {...form.register('date')}
              />
            </Field>
            <Field label="Start" error={errors.start?.message} className="col-span-3 sm:col-span-1">
              <Input type="time" {...form.register('start')} />
            </Field>
            <Field label="End" error={errors.end?.message} className="col-span-3 sm:col-span-1">
              <Input type="time" {...form.register('end')} />
            </Field>
          </div>
          <Field
            label="Idle time"
            hint="Minutes of the session spent away from the keyboard."
            error={errors.idleMinutes?.message}
          >
            <Input type="number" min={0} inputMode="numeric" {...form.register('idleMinutes')} />
          </Field>
          <Field label="Project" optional>
            <Select {...form.register('projectId')}>
              <option value="">No project</option>
              {options.data?.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Language" optional error={errors.language?.message}>
            <Input
              list="session-languages"
              autoCapitalize="none"
              placeholder="typescript"
              {...form.register('language')}
            />
          </Field>
          <datalist id="session-languages">
            {COMMON_LANGUAGES.map((language) => (
              <option key={language} value={language}>
                {languageName(language)}
              </option>
            ))}
          </datalist>
          <Field label="What did you work on?" optional error={errors.title?.message}>
            <Input placeholder="Refactored the billing module" {...form.register('title')} />
          </Field>
        </form>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button type="submit" form="log-session" loading={create.isPending}>
            Log session
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
