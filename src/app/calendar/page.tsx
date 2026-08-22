import type { Metadata } from 'next'

import { CalendarExperience } from '@/features/calendar'

export const metadata: Metadata = { title: 'カレンダー' }

export default function CalendarPage() {
  return <CalendarExperience />
}
