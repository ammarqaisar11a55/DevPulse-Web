import {
  Activity,
  BarChart3,
  FolderGit2,
  LayoutDashboard,
  Laptop,
  ListTree,
  Settings,
  Target,
  Trophy,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the mobile bottom bar. */
  primary?: boolean;
}

export const MAIN_NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, primary: true },
  { to: '/activity', label: 'Activity', icon: Activity, primary: true },
  { to: '/sessions', label: 'Sessions', icon: ListTree },
  { to: '/projects', label: 'Projects', icon: FolderGit2, primary: true },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, primary: true },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/devices', label: 'Devices', icon: Laptop },
];

export const SECONDARY_NAV: NavItem[] = [{ to: '/settings', label: 'Settings', icon: Settings }];
