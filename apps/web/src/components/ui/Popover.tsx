import * as RadixPopover from '@radix-ui/react-popover';
import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/cn';
import { floatingSurface } from './DropdownMenu';

export const Popover = RadixPopover.Root;
export const PopoverTrigger = RadixPopover.Trigger;
export const PopoverClose = RadixPopover.Close;

export function PopoverContent({
  className,
  align = 'end',
  sideOffset = 6,
  ...props
}: ComponentPropsWithoutRef<typeof RadixPopover.Content>) {
  return (
    <RadixPopover.Portal>
      <RadixPopover.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(floatingSurface, 'p-0', className)}
        {...props}
      />
    </RadixPopover.Portal>
  );
}
