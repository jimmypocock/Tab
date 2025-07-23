'use client'

import { useEffect, useState } from 'react'
import { useOrganization } from '@/components/dashboard/organization-provider'
import { debugTeamQuery } from '../debug-actions'

export default function TeamDebugPage() {
  const { currentOrganization } = useOrganization()
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const runDebug = async () => {
      if (!currentOrganization?.id) {
        setResults({ error: 'No organization ID' })
        setLoading(false)
        return
      }

      try {
        const debugResults = await debugTeamQuery(currentOrganization.id)
        setResults(debugResults)
      } catch (error) {
        setResults({ error: error?.toString() })
      } finally {
        setLoading(false)
      }
    }

    runDebug()
  }, [currentOrganization?.id])

  if (loading) {
    return <div className="p-8">Loading debug info...</div>
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Team Query Debug</h1>
      <p className="mb-4 text-sm text-gray-600">
        Organization ID: {currentOrganization?.id || 'None'}
      </p>
      
      <div className="space-y-6">
        {results && Object.entries(results).map(([testName, result]) => (
          <div key={testName} className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-2">{testName}</h2>
            <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  )
}