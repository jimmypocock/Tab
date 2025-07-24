'use client'

import { useState, useEffect } from 'react'
import { Download, Search, Filter, Clock, User, FileText, AlertTriangle, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import type { AuditEvent, AuditTrailQuery, AuditTrailResult } from '@/lib/services/billing-groups-audit.service'

interface AuditTrailProps {
  billingGroupId?: string
  showFilters?: boolean
  compact?: boolean
}

interface AuditTrailState {
  events: AuditEvent[]
  totalCount: number
  hasMore: boolean
  isLoading: boolean
  error: string | null
  filters: {
    entityType: string
    action: string
    userId: string
    dateFrom: string
    dateTo: string
    search: string
  }
  pagination: {
    offset: number
    limit: number
  }
}

const ENTITY_TYPE_LABELS = {
  billing_group: 'Billing Group',
  billing_group_rule: 'Rule',
  line_item_assignment: 'Assignment',
}

const ACTION_LABELS = {
  created: 'Created',
  updated: 'Updated',
  deleted: 'Deleted',
  assigned: 'Assigned',
  unassigned: 'Unassigned',
  override: 'Override',
}

const ACTION_COLORS = {
  created: 'bg-green-100 text-green-800',
  updated: 'bg-blue-100 text-blue-800',
  deleted: 'bg-red-100 text-red-800',
  assigned: 'bg-purple-100 text-purple-800',
  unassigned: 'bg-gray-100 text-gray-800',
  override: 'bg-orange-100 text-orange-800',
}

export function AuditTrail({ 
  billingGroupId, 
  showFilters = true, 
  compact = false 
}: AuditTrailProps) {
  const [state, setState] = useState<AuditTrailState>({
    events: [],
    totalCount: 0,
    hasMore: false,
    isLoading: true,
    error: null,
    filters: {
      entityType: '',
      action: '',
      userId: '',
      dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days ago
      dateTo: new Date().toISOString().split('T')[0], // Today
      search: '',
    },
    pagination: {
      offset: 0,
      limit: compact ? 10 : 25,
    },
  })
  const { toast } = useToast()

  const fetchAuditTrail = async (resetPagination = false) => {
    setState(prev => ({ 
      ...prev, 
      isLoading: true, 
      error: null,
      ...(resetPagination && { pagination: { ...prev.pagination, offset: 0 } })
    }))

    try {
      const params = new URLSearchParams()
      
      // Add filters
      if (state.filters.entityType) params.append('entity_type', state.filters.entityType)
      if (state.filters.action) params.append('action', state.filters.action)
      if (state.filters.userId) params.append('user_id', state.filters.userId)
      if (state.filters.dateFrom) params.append('date_from', state.filters.dateFrom)
      if (state.filters.dateTo) params.append('date_to', state.filters.dateTo)
      if (state.filters.search) params.append('search', state.filters.search)
      
      // Add pagination
      params.append('limit', state.pagination.limit.toString())
      params.append('offset', (resetPagination ? 0 : state.pagination.offset).toString())
      
      // Add billing group filter if provided
      if (billingGroupId) {
        params.append('entity_id', billingGroupId)
      }

      const response = await fetch(`/api/v1/billing-groups/audit?${params}`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to fetch audit trail')
      }

      const data: AuditTrailResult = await response.json()
      
      setState(prev => ({
        ...prev,
        events: resetPagination ? data.events : [...prev.events, ...data.events],
        totalCount: data.totalCount,
        hasMore: data.hasMore,
        isLoading: false,
      }))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch audit trail'
      setState(prev => ({ 
        ...prev, 
        error: errorMessage, 
        isLoading: false 
      }))

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    }
  }

  const loadMore = () => {
    setState(prev => ({
      ...prev,
      pagination: {
        ...prev.pagination,
        offset: prev.pagination.offset + prev.pagination.limit,
      },
    }))
  }

  const exportToCsv = async () => {
    try {
      const params = new URLSearchParams()
      
      // Add current filters
      if (state.filters.entityType) params.append('entity_type', state.filters.entityType)
      if (state.filters.action) params.append('action', state.filters.action)
      if (state.filters.userId) params.append('user_id', state.filters.userId)
      if (state.filters.dateFrom) params.append('date_from', state.filters.dateFrom)
      if (state.filters.dateTo) params.append('date_to', state.filters.dateTo)
      if (state.filters.search) params.append('search', state.filters.search)
      if (billingGroupId) params.append('entity_id', billingGroupId)
      
      params.append('export', 'csv')

      const response = await fetch(`/api/v1/billing-groups/audit?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to export audit trail')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `billing-groups-audit-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast({
        title: 'Export Successful',
        description: 'Audit trail has been exported to CSV.',
      })
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Failed to export audit trail to CSV.',
        variant: 'destructive',
      })
    }
  }

  const updateFilter = (key: keyof typeof state.filters, value: string) => {
    setState(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        [key]: value,
      },
    }))
  }

  const applyFilters = () => {
    fetchAuditTrail(true)
  }

  const clearFilters = () => {
    setState(prev => ({
      ...prev,
      filters: {
        entityType: '',
        action: '',
        userId: '',
        dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        dateTo: new Date().toISOString().split('T')[0],
        search: '',
      },
    }))
  }

  const formatTimestamp = (timestamp: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(timestamp))
  }

  const formatChanges = (changes: Record<string, { from: any; to: any }>) => {
    return Object.entries(changes)
      .map(([field, change]) => `${field}: ${JSON.stringify(change.from)} → ${JSON.stringify(change.to)}`)
      .join(', ')
  }

  // Load data on mount and when pagination changes
  useEffect(() => {
    fetchAuditTrail()
  }, [state.pagination.offset])

  return (
    <div className="space-y-4">
      {/* Header */}
      {!compact && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {billingGroupId ? 'Billing Group Audit Trail' : 'Audit Trail'}
          </h3>
          <Button variant="outline" onClick={exportToCsv}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-base">
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <Label htmlFor="entity-type">Entity Type</Label>
                <Select
                  value={state.filters.entityType}
                  onValueChange={(value) => updateFilter('entityType', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All types</SelectItem>
                    <SelectItem value="billing_group">Billing Groups</SelectItem>
                    <SelectItem value="billing_group_rule">Rules</SelectItem>
                    <SelectItem value="line_item_assignment">Assignments</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="action">Action</Label>
                <Select
                  value={state.filters.action}
                  onValueChange={(value) => updateFilter('action', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All actions</SelectItem>
                    <SelectItem value="created">Created</SelectItem>
                    <SelectItem value="updated">Updated</SelectItem>
                    <SelectItem value="deleted">Deleted</SelectItem>
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="override">Override</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search events..."
                    value={state.filters.search}
                    onChange={(e) => updateFilter('search', e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="date-from">From Date</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={state.filters.dateFrom}
                  onChange={(e) => updateFilter('dateFrom', e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="date-to">To Date</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={state.filters.dateTo}
                  onChange={(e) => updateFilter('dateTo', e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex gap-2 mt-4">
              <Button onClick={applyFilters} disabled={state.isLoading}>
                Apply Filters
              </Button>
              <Button variant="outline" onClick={clearFilters}>
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Alert */}
      {state.error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Events List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center text-base">
              <Clock className="h-4 w-4 mr-2" />
              Events ({state.totalCount})
            </CardTitle>
            {state.isLoading && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {state.events.length === 0 && !state.isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2" />
              <p>No audit events found.</p>
              <p className="text-sm">Try adjusting your filters or date range.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {state.events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-4 p-3 rounded-lg border bg-card"
                >
                  <div className="flex-shrink-0">
                    <Badge 
                      className={`${ACTION_COLORS[event.action as keyof typeof ACTION_COLORS]} border-0`}
                    >
                      {ACTION_LABELS[event.action as keyof typeof ACTION_LABELS]}
                    </Badge>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {ENTITY_TYPE_LABELS[event.entityType as keyof typeof ENTITY_TYPE_LABELS]}
                        </span>
                        <Badge variant="outline" className="text-xs font-mono">
                          {event.entityId.slice(-8)}
                        </Badge>
                      </div>
                      <time className="text-xs text-muted-foreground">
                        {formatTimestamp(event.timestamp)}
                      </time>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <User className="h-3 w-3" />
                      <span>{event.userEmail || event.userId}</span>
                      {event.ipAddress && (
                        <span className="font-mono text-xs">({event.ipAddress})</span>
                      )}
                    </div>
                    
                    {Object.keys(event.changes).length > 0 && (
                      <div className="text-xs bg-muted/50 rounded p-2 mt-2">
                        <span className="font-medium">Changes:</span>
                        <div className="mt-1 font-mono">
                          {formatChanges(event.changes)}
                        </div>
                      </div>
                    )}
                    
                    {Object.keys(event.metadata).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.entries(event.metadata).slice(0, 3).map(([key, value]) => (
                          <Badge key={key} variant="secondary" className="text-xs">
                            {key}: {String(value)}
                          </Badge>
                        ))}
                        {Object.keys(event.metadata).length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{Object.keys(event.metadata).length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {state.hasMore && (
                <div className="flex justify-center pt-4">
                  <Button 
                    variant="outline" 
                    onClick={loadMore}
                    disabled={state.isLoading}
                  >
                    {state.isLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ChevronRight className="h-4 w-4 mr-2" />
                    )}
                    Load More
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
