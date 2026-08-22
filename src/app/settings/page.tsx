import type { Metadata } from 'next'

import { SettingsExperience } from '@/features/settings'

export const metadata: Metadata = { title: '設定' }

export default function SettingsPage() {
  return <SettingsExperience />
}
