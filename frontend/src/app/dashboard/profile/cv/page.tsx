// app/dashboard/profile/cv/page.tsx
// Server wrapper — keeps metadata out of the client component.

import CvReaderPage from '../../../../components/profile/CVReaderPage'

export const metadata = { title: 'CV — KKKT DMP YOMBO' }

export default function Page() {
  return <CvReaderPage />
}