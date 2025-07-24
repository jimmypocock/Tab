import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import { BillingGroupService } from '@/lib/services/billing-group.service'
import { db } from '@/lib/db'
import { tabs, lineItems } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { z } from 'zod'

// Validation schema
const quickSplitSchema = z.discriminatedUnion('split_type', [
  z.object({
    split_type: z.literal('even'),
    number_of_groups: z.number().int().min(2).max(10),
  }),
  z.object({
    split_type: z.literal('corporate_personal'),
    rules: z.object({
      corporate: z.object({
        categories: z.array(z.string()).optional(),
        time_range: z.object({
          start: z.string().regex(/^\d{2}:\d{2}$/),
          end: z.string().regex(/^\d{2}:\d{2}$/),
        }).optional(),
        weekdays_only: z.boolean().optional(),
      }),
      personal: z.object({
        categories: z.array(z.string()).optional(),
      }),
    }),
  }),
  z.object({
    split_type: z.literal('by_category'),
  }),
])

// POST /api/v1/tabs/:id/quick-split - Quickly split a tab using predefined templates
export const POST = withApiAuth(async (req, context, { params }) => {
  try {
    const { id: tabId } = params
    const body = await req.json()
    const validatedData = quickSplitSchema.parse(body)
    
    // Verify tab exists and belongs to organization
    const [tab] = await db
      .select({
        id: tabs.id,
        organizationId: tabs.organizationId,
      })
      .from(tabs)
      .where(eq(tabs.id, tabId))
      .limit(1)
    
    if (!tab) {
      return NextResponse.json(
        { error: 'Tab not found' },
        { status: 404 }
      )
    }
    
    if (tab.organizationId !== context.organizationId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }
    
    // Get all line items for the tab
    const tabLineItems = await db
      .select()
      .from(lineItems)
      .where(eq(lineItems.tabId, tabId))
    
    if (tabLineItems.length === 0) {
      return NextResponse.json(
        { error: 'No line items to split' },
        { status: 400 }
      )
    }
    
    let groups: any[] = []
    let assignments: Array<{ line_item_id: string; billing_group_id: string }> = []
    
    switch (validatedData.split_type) {
      case 'even': {
        // Create N equal groups
        const groupNames = Array.from({ length: validatedData.number_of_groups }, (_, i) => `Group ${i + 1}`)
        
        // Create billing groups
        for (const name of groupNames) {
          const group = await BillingGroupService.createBillingGroup({
            tabId,
            name,
            groupType: 'standard',
          })
          groups.push(group)
        }
        
        // Distribute items evenly
        tabLineItems.forEach((item, index) => {
          const groupIndex = index % groups.length
          assignments.push({
            line_item_id: item.id,
            billing_group_id: groups[groupIndex].id,
          })
        })
        break
      }
      
      case 'corporate_personal': {
        // Create corporate and personal groups
        const corporateGroup = await BillingGroupService.createBillingGroup({
          tabId,
          name: 'Corporate Expenses',
          groupType: 'corporate',
        })
        
        const personalGroup = await BillingGroupService.createBillingGroup({
          tabId,
          name: 'Personal Expenses',
          groupType: 'standard',
        })
        
        groups = [corporateGroup, personalGroup]
        
        // Apply rules to assign items
        const { corporate: corpRules, personal: persRules } = validatedData.rules
        
        for (const item of tabLineItems) {
          let assignToCorporate = false
          
          // Check category rules
          if (corpRules.categories && item.category) {
            assignToCorporate = corpRules.categories.includes(item.category)
          }
          
          // Add more sophisticated rule checking here based on time, metadata, etc.
          
          assignments.push({
            line_item_id: item.id,
            billing_group_id: assignToCorporate ? corporateGroup.id : personalGroup.id,
          })
        }
        break
      }
      
      case 'by_category': {
        // Get unique categories
        const categories = new Set<string>()
        const uncategorizedItems: typeof tabLineItems = []
        
        for (const item of tabLineItems) {
          if (item.category) {
            categories.add(item.category)
          } else {
            uncategorizedItems.push(item)
          }
        }
        
        // Create a group for each category
        const categoryGroupMap = new Map<string, string>()
        
        for (const category of categories) {
          const group = await BillingGroupService.createBillingGroup({
            tabId,
            name: category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' '),
            groupType: 'standard',
          })
          groups.push(group)
          categoryGroupMap.set(category, group.id)
        }
        
        // Create uncategorized group if needed
        let uncategorizedGroupId: string | null = null
        if (uncategorizedItems.length > 0) {
          const uncategorizedGroup = await BillingGroupService.createBillingGroup({
            tabId,
            name: 'Uncategorized',
            groupType: 'standard',
          })
          groups.push(uncategorizedGroup)
          uncategorizedGroupId = uncategorizedGroup.id
        }
        
        // Assign items to their category groups
        for (const item of tabLineItems) {
          if (item.category && categoryGroupMap.has(item.category)) {
            assignments.push({
              line_item_id: item.id,
              billing_group_id: categoryGroupMap.get(item.category)!,
            })
          } else if (uncategorizedGroupId) {
            assignments.push({
              line_item_id: item.id,
              billing_group_id: uncategorizedGroupId,
            })
          }
        }
        break
      }
    }
    
    // Perform bulk assignment
    if (assignments.length > 0) {
      await BillingGroupService.bulkAssignLineItems(assignments)
    }
    
    return NextResponse.json({
      message: 'Tab split successfully',
      split_type: validatedData.split_type,
      groups_created: groups.length,
      items_assigned: assignments.length,
      groups: groups.map(g => ({
        id: g.id,
        name: g.name,
        type: g.groupType,
        items_count: assignments.filter(a => a.billing_group_id === g.id).length,
      })),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    
    logger.error('Error performing quick split', { error, tabId: params.id, organizationId: context.organizationId })
    return NextResponse.json(
      { error: 'Failed to split tab' },
      { status: 500 }
    )
  }
})