import { NextRequest, NextResponse } from 'next/server';
import {
  appBaseUrl,
  isProductionUrl,
  reviewerCodeIsValid,
  safeRedirectPath,
  REVIEWER_COOKIE,
} from '../../../lib/reviewer';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const nextPath = safeRedirectPath(formData.get('from'), '/settings/connections');

  if (!reviewerCodeIsValid(formData.get('accessCode'))) {
    return NextResponse.redirect(new URL('/signin?error=access', request.url), 303);
  }

  const baseUrl = appBaseUrl(request.url);
  const response = NextResponse.redirect(new URL(nextPath, baseUrl), 303);
  response.cookies.set(REVIEWER_COOKIE, '1', {
    httpOnly: true,
    maxAge: 60 * 60 * 4,
    path: '/',
    sameSite: 'lax',
    secure: isProductionUrl(baseUrl),
  });

  return response;
}
