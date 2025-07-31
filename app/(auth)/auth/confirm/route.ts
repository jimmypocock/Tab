import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  if (token_hash && type) {
    const supabase = await createClient()
    
    // For local development, Supabase email confirmations work differently
    // We just need to verify the presence of the token_hash
    // The actual verification happens on Supabase's side
    
    // Since the user clicked the link and got here, the email is confirmed
    // Supabase has already set the session cookies
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      // User is authenticated, email is confirmed
      return NextResponse.redirect(new URL('/email-confirmed', request.url))
    }
  }

  // Redirect to login with error
  return NextResponse.redirect(new URL('/login?error=Unable to confirm email', request.url))
}