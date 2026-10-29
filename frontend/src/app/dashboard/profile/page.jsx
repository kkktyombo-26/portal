// app/dashboard/profile/page.jsx
// Drop ProfilePage.jsx into src/components/profile/ and import it here.

import ProfilePage from '../../../components/profile/ProfilePage';

export const metadata = { title: 'My Profile — Church Portal' };

export default function Page() {
  return <ProfilePage />;
}