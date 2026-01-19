'use client'

import dynamic from 'next/dynamic'
import { ComponentProps, ElementType } from 'react'

// Lazy load Framer Motion to reduce initial bundle size
const MotionDiv = dynamic(
  () => import('framer-motion').then((mod) => mod.motion.div),
  { ssr: false }
)

const MotionSpan = dynamic(
  () => import('framer-motion').then((mod) => mod.motion.span),
  { ssr: false }
)

// Type-safe wrapper components
export function LazyMotionDiv(props: ComponentProps<typeof MotionDiv>) {
  return <MotionDiv {...props} />
}

export function LazyMotionSpan(props: ComponentProps<typeof MotionSpan>) {
  return <MotionSpan {...props} />
}

// Generic motion component factory
export function createLazyMotion<T extends ElementType>(tag: T) {
  return dynamic(
    () => import('framer-motion').then((mod) => mod.motion[tag as keyof typeof mod.motion] as any),
    { ssr: false }
  )
}









