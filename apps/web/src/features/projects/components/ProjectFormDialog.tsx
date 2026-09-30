import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createProjectSchema,
  PROJECT_COLORS,
  type CreateProjectInput,
  type ProjectDto,
} from '@devpulse/shared';
import { Check } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { projectColor } from '@/lib/colors';
import { applyServerErrors } from '@/lib/form-errors';
import { COMMON_LANGUAGES, languageName } from '@/lib/languages';
import { projectKeys, projectsApi } from '../projects-api';

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: ProjectDto;
  onSaved?: (project: ProjectDto) => void;
}

const FIELDS = ['name', 'description', 'repositoryUrl', 'primaryLanguage', 'color'] as const;

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  onSaved,
}: ProjectFormDialogProps) {
  const queryClient = useQueryClient();
  const form = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: project?.name ?? '',
      description: project?.description ?? '',
      repositoryUrl: project?.repositoryUrl ?? '',
      primaryLanguage: project?.primaryLanguage ?? '',
      color: project?.color,
    },
  });
  const { errors } = form.formState;
  const selectedColor = form.watch('color');

  const save = useMutation({
    mutationFn: (values: CreateProjectInput) =>
      project
        ? projectsApi.update(project.id, { ...values, color: values.color ?? undefined })
        : projectsApi.create(values),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all });
      toast.success(project ? 'Project saved' : 'Project created');
      onOpenChange(false);
      onSaved?.(saved);
    },
    onError: (error) => {
      const message = applyServerErrors(error, form.setError, FIELDS);
      if (message) form.setError('root', { message });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={project ? 'Edit project' : 'New project'}
        description={
          project
            ? undefined
            : 'Projects group your coding sessions. The extension can also create them automatically.'
        }
      >
        <form
          id="project-form"
          onSubmit={form.handleSubmit((values) => save.mutate(values))}
          noValidate
          className="grid gap-4"
        >
          {errors.root?.message && <Alert>{errors.root.message}</Alert>}
          <Field label="Name" error={errors.name?.message}>
            <Input autoFocus placeholder="Notes Saver" {...form.register('name')} />
          </Field>
          <Field label="Description" optional error={errors.description?.message}>
            <Textarea
              rows={2}
              placeholder="What is this project about?"
              {...form.register('description')}
            />
          </Field>
          <Field
            label="Repository URL"
            optional
            error={errors.repositoryUrl?.message}
            hint="GitHub, GitLab, Bitbucket and Azure DevOps are recognised."
          >
            <Input
              type="url"
              placeholder="https://github.com/you/project"
              {...form.register('repositoryUrl')}
            />
          </Field>
          <Field label="Primary language" optional error={errors.primaryLanguage?.message}>
            <Input
              list="project-languages"
              placeholder="typescript"
              autoCapitalize="none"
              {...form.register('primaryLanguage')}
            />
          </Field>
          <datalist id="project-languages">
            {COMMON_LANGUAGES.map((language) => (
              <option key={language} value={language}>
                {languageName(language)}
              </option>
            ))}
          </datalist>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Colour</legend>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((color) => (
                <label key={color} className="relative cursor-pointer">
                  <input
                    type="radio"
                    value={color}
                    className="peer sr-only"
                    {...form.register('color')}
                  />
                  <span
                    className="grid size-8 place-items-center rounded-full ring-offset-2 ring-offset-surface peer-focus-visible:ring-2 peer-focus-visible:ring-focus"
                    style={{ backgroundColor: projectColor(color) }}
                  >
                    {selectedColor === color && <Check className="size-4 text-white" aria-hidden />}
                  </span>
                  <span className="sr-only">{color}</span>
                </label>
              ))}
            </div>
            {!project && !selectedColor && (
              <p className="mt-1.5 text-xs text-ink-muted">
                Leave unselected to pick one automatically.
              </p>
            )}
          </fieldset>
        </form>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button type="submit" form="project-form" loading={save.isPending}>
            {project ? 'Save project' : 'Create project'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
