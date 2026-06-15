import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const PASSWORD_RECOVERY_COOKIE = 'verdact_password_recovery';

function isSafeNext(next: string | null): string {
  if (!next) return '/dashboard';
  if (!next.startsWith('/')) return '/dashboard';
  if (next.startsWith('//')) return '/dashboard';
  return next;
}

function redirectAfterAuth(origin: string, next: string, isRecoveryFlow: boolean) {
  const response = NextResponse.redirect(`${origin}${next}`);
  if (next === '/reset-password' && isRecoveryFlow) {
    response.cookies.set(PASSWORD_RECOVERY_COOKIE, '1', {
      httpOnly: true,
      maxAge: 15 * 60,
      path: '/',
      sameSite: 'lax',
      secure: origin.startsWith('https://'),
    });
  }
  return response;
}

function isAdmissionError(message: string): boolean {
  return message.toLowerCase().includes('invite-only');
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = isSafeNext(searchParams.get('next'));
  const isRecoveryFlow = searchParams.get('flow') === 'recovery' || type === 'recovery';

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      if (isAdmissionError(error.message)) {
        return NextResponse.redirect(`${origin}/signup?access=pending`);
      }
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(error.message)}`,
      );
    }
    return redirectAfterAuth(origin, next, isRecoveryFlow);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as 'signup' | 'magiclink' | 'recovery' | 'email_change' | 'email',
      token_hash: tokenHash,
    });
    if (error) {
      if (isAdmissionError(error.message)) {
        return NextResponse.redirect(`${origin}/signup?access=pending`);
      }
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(error.message)}`,
      );
    }
    return redirectAfterAuth(origin, next, isRecoveryFlow);
  }

  if (isRecoveryFlow && next === '/reset-password') {
    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=missing_auth_code`);
}
