import type { Metadata } from 'next'

import { GrimoScene } from '@/features/grimo'

export const metadata: Metadata = {
  title: 'グリモ',
}

export default function GrimoPage() {
  return <GrimoScene />
}
