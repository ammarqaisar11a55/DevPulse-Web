import * as Menu from '@radix-ui/react-dropdown-menu';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;
export const DropdownMenuRadioGroup = Menu.RadioGroup;

export const floatingSurface =
  'z-50 min-w-48 rounded-panel border border-line bg-surface p-1 text-sm text-ink shadow-float data-[state=open]:animate-scale-in';

export function DropdownMenuContent({
  className,
  align = 'end',
  sideOffset = 6,
  ...props
}: ComponentPropsWithoutRef<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(floatingSurface, className)}
        {...props}
      />
    </Menu.Portal>
  );
}

const itemClasses =
  'flex cursor-default items-center gap-2.5 rounded-md px-2.5 py-2 outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-3 [&_svg]:size-4 [&_svg]:text-ink-muted';

export function DropdownMenuItem({
  className,
  tone,
  ...props
}: ComponentPropsWithoutRef<typeof Menu.Item> & { tone?: 'danger' }) {
  return (
    <Menu.Item
      className={cn(itemClasses, tone === 'danger' && 'text-danger [&_svg]:text-danger', className)}
      {...props}
    />
  );
}

export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof Menu.RadioItem>) {
  return (
    <Menu.RadioItem className={cn(itemClasses, 'pr-8', className)} {...props}>
      {children}
      <Menu.ItemIndicator className="absolute right-3 size-1.5 rounded-full bg-accent" />
    </Menu.RadioItem>
  );
}

export function DropdownMenuLabel({ children }: { children: ReactNode }) {
  return <Menu.Label className="px-2.5 pt-2 pb-1 text-xs text-ink-subtle">{children}</Menu.Label>;
}

export function DropdownMenuSeparator() {
  return <Menu.Separator className="my-1 h-px bg-line" />;
}
