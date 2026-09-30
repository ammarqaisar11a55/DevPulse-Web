import { PageHeader } from '@/components/PageHeader';
import { useCurrentUser } from '@/features/auth/auth-context';
import { greeting } from './greeting';

export function DashboardPage() {
  const user = useCurrentUser();
  const firstName = user.fullName.split(' ')[0] ?? user.fullName;
  return (
    <PageHeader
      title={`${greeting()}, ${firstName}`}
      description="Here's your development activity."
    />
  );
}
