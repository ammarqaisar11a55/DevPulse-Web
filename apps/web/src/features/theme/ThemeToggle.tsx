import { Monitor, Moon, Sun } from 'lucide-react';
import { IconButton } from '@/components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useTheme } from './theme-context';
import type { ThemePreference } from './theme-storage';

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/** Compact navbar control. */
export function ThemeToggle() {
  const { preference, resolved, setPreference } = useTheme();
  const Icon = resolved === 'dark' ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton aria-label={`Theme: ${preference}. Change theme`}>
          <Icon />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-40">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={preference}
          onValueChange={(value) => setPreference(value as ThemePreference)}
        >
          {OPTIONS.map(({ value, label, icon: OptionIcon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <OptionIcon />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Full-width picker for the settings page. */
export function ThemePicker({ onChange }: { onChange?: (preference: ThemePreference) => void }) {
  const { preference, setPreference } = useTheme();
  return (
    <SegmentedControl
      label="Theme"
      value={preference}
      onChange={(value) => {
        setPreference(value);
        onChange?.(value);
      }}
      options={OPTIONS.map(({ value, label, icon: OptionIcon }) => ({
        value,
        label,
        icon: <OptionIcon />,
      }))}
    />
  );
}
