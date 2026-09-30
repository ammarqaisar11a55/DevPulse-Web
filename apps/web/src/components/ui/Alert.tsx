import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Alert({
  tone = 'danger',
  children,
  className,
}: {
  tone?: 'danger' | 'success';
  children: ReactNode;
  className?: string;
}) {
  const Icon = tone === 'danger' ? AlertCircle : CheckCircle2;
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex gap-2.5 rounded-control px-3.5 py-3 text-sm',
        tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success',
        className,
      )}
    >
      <Icon className="mt-px size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}
