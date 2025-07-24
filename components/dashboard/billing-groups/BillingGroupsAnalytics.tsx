'use client'

import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { TrendingUp, TrendingDown, Users, Target, Clock, AlertTriangle, Activity, DollarSign } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { BillingGroupsAnalytics } from '@/lib/services/billing-groups-analytics.service'

interface BillingGroupsAnalyticsProps {
  organizationId?: string
}

interface AnalyticsState {
  analytics: BillingGroupsAnalytics | null
  isLoading: boolean
  error: string | null
  dateFrom: string
  dateTo: string
  refreshInterval: '5m' | '15m' | '1h' | 'manual'
}

const COLORS = {
  primary: '#3b82f6',
  secondary: '#6366f1',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  muted: '#6b7280',
}

const PIE_COLORS = [COLORS.primary, COLORS.secondary, COLORS.success, COLORS.warning, COLORS.danger]

export function BillingGroupsAnalytics({ organizationId }: BillingGroupsAnalyticsProps) {
  const [state, setState] = useState<AnalyticsState>({
    analytics: null,
    isLoading: true,
    error: null,
    dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    dateTo: new Date().toISOString().split('T')[0], // Today
    refreshInterval: '15m'
  })

  const fetchAnalytics = async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const params = new URLSearchParams({
        date_from: state.dateFrom,
        date_to: state.dateTo,
      })
      
      if (organizationId) {
        params.append('organization_id', organizationId)
      }

      const response = await fetch(`/api/v1/billing-groups/analytics?${params}`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to fetch analytics')
      }

      const data = await response.json()
      setState(prev => ({ 
        ...prev, 
        analytics: data.analytics,
        isLoading: false 
      }))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch analytics'
      setState(prev => ({ 
        ...prev, 
        error: errorMessage, 
        isLoading: false 
      }))
    }
  }

  // Initial load and refresh interval
  useEffect(() => {
    fetchAnalytics()
  }, [state.dateFrom, state.dateTo, organizationId])

  useEffect(() => {
    if (state.refreshInterval === 'manual') return

    const intervals = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
    }

    const timer = setInterval(fetchAnalytics, intervals[state.refreshInterval])
    return () => clearInterval(timer)
  }, [state.refreshInterval])

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  if (state.isLoading && !state.analytics) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                  <div className="h-8 bg-muted rounded w-3/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (state.error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          {state.error}
          <Button variant="outline" size="sm" onClick={fetchAnalytics}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!state.analytics) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No analytics data available.</p>
      </div>
    )
  }

  const { analytics } = state

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Billing Groups Analytics</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="date-from">From</Label>
            <Input
              id="date-from"
              type="date"
              value={state.dateFrom}
              onChange={(e) => setState(prev => ({ ...prev, dateFrom: e.target.value }))}
              className="w-auto"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="date-to">To</Label>
            <Input
              id="date-to"
              type="date"
              value={state.dateTo}
              onChange={(e) => setState(prev => ({ ...prev, dateTo: e.target.value }))}
              className="w-auto"
            />
          </div>
          <Select
            value={state.refreshInterval}
            onValueChange={(value: any) => setState(prev => ({ ...prev, refreshInterval: value }))}
          >
            <SelectTrigger className="w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="5m">Every 5min</SelectItem>
              <SelectItem value="15m">Every 15min</SelectItem>
              <SelectItem value="1h">Every hour</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchAnalytics} disabled={state.isLoading}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Groups</p>
                <p className="text-2xl font-bold">{analytics.overview.totalBillingGroups}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="mt-2 flex items-center text-sm">
              <span className="text-green-600">{analytics.overview.activeBillingGroups} active</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Rules</p>
                <p className="text-2xl font-bold">{analytics.overview.totalRules}</p>
              </div>
              <Target className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="mt-2 flex items-center text-sm">
              <span className="text-green-600">{analytics.overview.activeRules} active</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Automated Assignments</p>
                <p className="text-2xl font-bold">{formatNumber(analytics.overview.totalAutomatedAssignments)}</p>
              </div>
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="mt-2 flex items-center text-sm">
              <span className="text-blue-600">
                {Math.round(analytics.performance.ruleMatchRate * 100)}% match rate
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Groups/Tab</p>
                <p className="text-2xl font-bold">{analytics.overview.averageGroupsPerTab}</p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="mt-2 flex items-center text-sm">
              <span className="text-muted-foreground">Per transaction</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Billing Groups by Type */}
        <Card>
          <CardHeader>
            <CardTitle>Billing Groups by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.usage.billingGroupsByType}
                  dataKey="count"
                  nameKey="groupType"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ groupType, percentage }) => `${groupType} (${percentage}%)`}
                >
                  {analytics.usage.billingGroupsByType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Rules by Action */}
        <Card>
          <CardHeader>
            <CardTitle>Rules by Action Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.usage.rulesByAction}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="action" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill={COLORS.primary} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Billing Groups Created Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Groups Created Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.trends.billingGroupsCreatedOverTime}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke={COLORS.primary} 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Average Processing Time</span>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono">{analytics.performance.averageProcessingTime}ms</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Rule Match Rate</span>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="font-mono text-green-600">
                  {Math.round(analytics.performance.ruleMatchRate * 100)}%
                </span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Error Rate</span>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="font-mono text-red-600">
                  {Math.round(analytics.performance.errorRate * 100)}%
                </span>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h4 className="font-medium mb-2">Automated vs Manual</h4>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Automated</span>
                  <span className="font-mono">
                    {formatNumber(analytics.trends.automatedVsManualAssignments.automated)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Manual</span>
                  <span className="font-mono">
                    {formatNumber(analytics.trends.automatedVsManualAssignments.manual)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Top Categories by Assignment Count</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {analytics.performance.topCategories.slice(0, 5).map((category, index) => (
              <div key={category.category} className="flex items-center justify-between p-2 rounded bg-muted/50">
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{index + 1}</Badge>
                  <span className="font-medium">{category.category}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{category.assignmentCount} assignments</span>
                  <span className="font-mono">{formatCurrency(category.totalAmount)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
