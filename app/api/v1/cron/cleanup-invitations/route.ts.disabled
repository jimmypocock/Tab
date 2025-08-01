import { NextRequest, NextResponse } from 'next/server'
import { InvitationService } from '@/lib/services/invitation.service'
import { logger } from '@/lib/logger'

// This endpoint should be called periodically (e.g., daily) to clean up expired invitations
// You can set this up with Vercel Cron Jobs, or any external cron service
export async function GET(request: NextRequest) {
  try {
    // Verify the request is from a trusted source
    // In production, you'd want to check for a secret token
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Clean up expired invitations
    const result = await InvitationService.cleanupExpiredInvitations()

    return NextResponse.json({
      success: true,
      message: 'Expired invitations cleaned up successfully',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('Error cleaning up invitations', error as Error, {
      endpoint: '/api/v1/cron/cleanup-invitations'
    })
    return NextResponse.json(
      { error: 'Failed to clean up invitations' },
      { status: 500 }
    )
  }
}

// Also support POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request)
}