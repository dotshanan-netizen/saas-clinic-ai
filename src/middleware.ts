import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from './lib/auth';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Standard secure auth behavior for /dashboard pages
  if (path.startsWith('/dashboard')) {
    const sessionCookie = request.cookies.get('clinova_session')?.value;
    let hasValidCookie = false;
    if (sessionCookie) {
      try {
        const payload = await decrypt(sessionCookie);
        if (payload?.clinicId) {
          hasValidCookie = true;
        }
      } catch {
        console.warn("[Middleware] Invalid session cookie — redirecting to login");
      }
    }
    if (!hasValidCookie) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Protect /api/clinic, /api/conversations, /api/bookings, /api/chat, /api/whatsapp, and /api/analytics routes
  if (
    path.startsWith('/api/clinic') ||
    path.startsWith('/api/conversations') ||
    path.startsWith('/api/bookings') ||
    path.startsWith('/api/chat') ||
    path.startsWith('/api/whatsapp') ||
    path.startsWith('/api/analytics')
  ) {
    const sessionCookie = request.cookies.get('clinova_session')?.value;
    
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized: No session cookie' }, { status: 401 });
    }

    try {
      const payload = await decrypt(sessionCookie);
      if (!payload?.clinicId) {
        return NextResponse.json({ error: 'Unauthorized: Invalid session payload' }, { status: 401 });
      }
      const tenantId = payload.clinicId as string;

      // Clone the request headers and inject x-tenant-id
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-tenant-id', tenantId);

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });

    } catch (err) {
      console.error("Session decryption failed in middleware:", err);
      return NextResponse.json({ error: 'Unauthorized: Invalid session' }, { status: 401 });
    }
  }

  // Allow all other routes to pass through unhindered
  return NextResponse.next();
}

// Ensure the middleware is only invoked on matching paths
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/dashboard',
    '/login',
    '/api/clinic/:path*',
    '/api/conversations/:path*',
    '/api/conversations',
    '/api/bookings/:path*',
    '/api/bookings',
    '/api/chat/:path*',
    '/api/chat',
    '/api/whatsapp/:path*',
    '/api/whatsapp',
    '/api/analytics/:path*',
    '/api/analytics',
  ],
};


