'use client'

import { useMemo } from 'react'

import { ThreeCoralRuntime } from '@/world/three-coral-runtime'

import { GrimoExperience } from './GrimoExperience'

export function GrimoScene() {
  const runtime = useMemo(() => new ThreeCoralRuntime(), [])
  return <GrimoExperience runtime={runtime} />
}
