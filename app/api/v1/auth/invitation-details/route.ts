import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Missing token parameter' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    
    // Get invitation details
    const { data: invitation, error } = await supabase
      .from('invitation_tokens')
      .select(`
        id,
        email,
        role,
        expires_at,
        accepted_at,
        organizations (
          id,
          name
        )
      `)
      .eq('token', token)
      .single()

    if (error || !invitation) {
      logger.error('Error fetching invitation details', error as Error, {
        token: 'provided'
      })
      return NextResponse.json(
        { error: 'Invalid or expired invitation' },
        { status: 404 }
      )
    }

    // Check if invitation is expired
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { 
          error: 'This invitation has expired',
          email: invitation.email,
          organizationName: invitation.organizations?.name || 'the organization'
        },
        { status: 400 }
      )
    }

    // Check if invitation is already accepted
    if (invitation.accepted_at) {
      return NextResponse.json(
        { error: 'This invitation has already been accepted' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      email: invitation.email,
      role: invitation.role,
      organizationName: invitation.organizations?.name || 'the organization',
      organizationId: invitation.organizations?.id
    })
  } catch (error) {
    logger.error('Error fetching invitation details', error as Error, {
      endpoint: '/api/v1/auth/invitation-details'
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}