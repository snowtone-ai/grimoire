import type { Metadata } from 'next'

import { CatalogExperience } from '@/features/catalog'

export const metadata: Metadata = {
  title: '図鑑',
}

export default function CatalogPage() {
  return <CatalogExperience />
}
