import { createClient } from '@/lib/supabase/server'
import { withRedisCache, CacheTags, invalidateCache } from '@/lib/redis/client'
import { logger } from '@/lib/logger'

export interface DashboardStats {
  total_tabs: number
  open_tabs: number
  total_revenue: number
  pending_revenue: number
}

export interface RecentTab {
  id: string
  customerName: string | null
  customerEmail: string
  totalAmount: string
  paidAmount: string
  status: string
  createdAt: string
  lineItemCount: number
}

/**
 * Get dashboard statistics with caching
 */
export async function getDashboardStats(merchantId: string): Promise<DashboardStats> {
  return withRedisCache(
    `dashboard:stats:${merchantId}`,
    async () => {
      const supabase = await createClient()
      
      // Single optimized query to get all stats
      const { data: stats, error } = await supabase.rpc('get_merchant_stats', {
        merchant_id_param: merchantId
      })
      
      if (error) {
        logger.error('Failed to fetch dashboard stats', error, { merchantId })
        // Fallback to regular query if RPC doesn't exist
        const { data: tabs } = await supabase
          .from('tabs')
          .select('status, total_amount, paid_amount')
          .eq('merchant_id', merchantId)
        
        if (!tabs) {
          return {
            total_tabs: 0,
            open_tabs: 0,
            total_revenue: 0,
            pending_revenue: 0,
          }
        }
        
        return {
          total_tabs: tabs.length,
          open_tabs: tabs.filter(t => t.status === 'open').length,
          total_revenue: tabs.reduce((sum, t) => sum + parseFloat(t.paid_amount), 0),
          pending_revenue: tabs.reduce((sum, t) => {
            const balance = parseFloat(t.total_amount) - parseFloat(t.paid_amount)
            return sum + (balance > 0 ? balance : 0)
          }, 0),
        }
      }
      
      // RPC returns an array with a single row
      const statsData = Array.isArray(stats) ? stats[0] : stats
      
      return statsData || {
        total_tabs: 0,
        open_tabs: 0,
        total_revenue: 0,
        pending_revenue: 0,
      }
    },
    60 // Cache for 1 minute
  )
}

/**
 * Get recent tabs with optimized query
 */
export async function getRecentTabs(merchantId: string, limit: number = 5): Promise<RecentTab[]> {
  return withRedisCache(
    `dashboard:recent-tabs:${merchantId}:${limit}`,
    async () => {
      const supabase = await createClient()
      
      // Optimized query with aggregated line item count
      const { data: tabs, error } = await supabase
        .from('tabs')
        .select(`
          id,
          customer_name,
          customer_email,
          total_amount,
          paid_amount,
          status,
          created_at,
          line_items!inner(id)
        `)
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false })
        .limit(limit)
      
      if (error) {
        logger.error('Failed to fetch recent tabs', error, { merchantId })
        return []
      }
      
      // Transform the data to count line items
      return tabs?.map(tab => ({
        id: tab.id,
        customerName: tab.customer_name,
        customerEmail: tab.customer_email,
        totalAmount: tab.total_amount,
        paidAmount: tab.paid_amount,
        status: tab.status,
        createdAt: tab.created_at,
        lineItemCount: Array.isArray(tab.line_items) ? tab.line_items.length : 0,
      })) || []
    },
    30 // Cache for 30 seconds
  )
}

/**
 * Invalidate dashboard cache when data changes
 */
export async function invalidateDashboardCache(merchantId: string) {
  // In production, this would invalidate multiple keys
  // For now, just invalidate by merchant tag pattern
  await invalidateCache(CacheTags.merchant(merchantId))
}