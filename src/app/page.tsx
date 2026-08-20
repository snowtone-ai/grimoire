import type { Metadata } from 'next'

import { HomeExperience } from '@/features/home'

export const metadata: Metadata = {
  title: 'ホーム',
}

export default function HomePage() {
  return <HomeExperience />
}
