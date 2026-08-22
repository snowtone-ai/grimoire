import type { Metadata } from 'next'

import { GrimoExperience } from '@/features/grimo'

export const metadata: Metadata = {
  title: 'グリモ',
}

export default function GrimoPage() {
  return <GrimoExperience />
}
