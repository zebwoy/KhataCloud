/**
 * SuperAdminApp.tsx — KhataCloud super admin dashboard shell
 *
 * Auth is fully handled by RootApp — this component is only mounted
 * after Clerk has verified the user is a super_admin.
 * It owns: page navigation, sign-out, and rendering the SA sub-pages.
 */
import { useAuth, useUser } from '@clerk/react';
import { useState } from 'react';
import SALayout, { type SAPage } from './components/SuperAdmin/SALayout';
import SADashboard from './components/SuperAdmin/SADashboard';
import SAOrgs from './components/SuperAdmin/SAOrgs';
import SAUsers from './components/SuperAdmin/SAUsers';

export default function SuperAdminApp() {
  const { signOut } = useAuth();
  const { user }    = useUser();
  const [page, setPage] = useState<SAPage>('dashboard');

  return (
    <SALayout
      page={page}
      setPage={setPage}
      userName={user?.firstName ?? user?.primaryEmailAddress?.emailAddress ?? 'Super Admin'}
      userEmail={user?.primaryEmailAddress?.emailAddress ?? ''}
      onSignOut={() => signOut()}
    >
      {page === 'dashboard' && <SADashboard />}
      {page === 'orgs'      && <SAOrgs />}
      {page === 'users'     && <SAUsers />}
    </SALayout>
  );
}
