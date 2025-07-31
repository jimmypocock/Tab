import { NextRequest, NextResponse } from 'next/server'
import { InvitationService } from '@/lib/services/invitation.service'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  let token: string | undefined
  let userId: string | undefined
  
  try {
    const body = await request.json()
    token = body.token
    userId = body.userId

    if (!token || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Verify the user is authenticated
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user || user.id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Accept the invitation
    const result = await InvitationService.acceptInvitation(token, userId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error_message || 'Failed to accept invitation' },
        { status: 400 }
      )
    }

    // Get organization details for the response
    const { data: organization } = await supabase
      .from('organizations')
      .select('name, slug')
      .eq('id', result.organization_id)
      .single()

    return NextResponse.json({
      success: true,
      organizationId: result.organization_id,
      organizationName: organization?.name,
      organizationSlug: organization?.slug,
      role: result.role,
    })
  } catch (error) {
    logger.error('Error accepting invitation', error as Error, {
      endpoint: '/api/v1/auth/accept-invitation',
      token: token ? 'provided' : 'missing',
      userId
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}