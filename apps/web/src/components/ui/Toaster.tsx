import { Toaster as Sonner } from 'sonner';
import { useTheme } from '@/features/theme/theme-context';

export function Toaster() {
  const { resolved } = useTheme();
  return (
    <Sonner
      theme={resolved}
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: '!rounded-panel !border-line !bg-surface !text-ink !shadow-float !font-sans',
          description: '!text-ink-muted',
        },
      }}
    />
  );
}
