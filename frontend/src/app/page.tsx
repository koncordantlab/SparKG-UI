'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/reddit')
  }, [router])

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="text-gray-500">Redirecting...</div>
    </div>
  )
}
