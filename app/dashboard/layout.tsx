import { verifySession } from '@/lib/dal';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Redirects to /login if no session. Runs on every dashboard route.
  await verifySession();

  return <>{children}</>;
}
