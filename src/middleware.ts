import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from './lib/auth';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // Protect /api/clinic, /api/conversations, /api/bookings, /api/chat, and /api/whatsapp routes
  if (
    path.startsWith('/api/clinic') ||
    path.startsWith('/api/conversations') ||
    path.startsWith('/api/bookings') ||
    path.startsWith('/api/chat') ||
    path.startsWith('/api/whatsapp')
  ) {
    const sessionCookie = request.cookies.get('clinova_session')?.value;
    
    // Check if the cookie exists
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized: No session cookie' }, { status: 401 });
    }

    try {
      // Decode and verify the session
      const payload = await decrypt(sessionCookie);
      const tenantId = payload?.clinicId;

      if (!tenantId) {
        return NextResponse.json({ error: 'Unauthorized: Invalid session' }, { status: 401 });
      }

      // Clone the request headers and inject x-tenant-id
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-tenant-id', tenantId as string);

      // We should also remove 'clinicSlug' from body/query to prevent downstream IDOR if we wanted, 
      // but injecting x-tenant-id is enough for controllers to use it exclusively.
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });

    } catch (err) {
      return NextResponse.json({ error: 'Unauthorized: Session decryption failed' }, { status: 401 });
    }
  }

  // Allow all other routes to pass through unhindered
  return NextResponse.next();
}

// Ensure the middleware is only invoked on matching paths
export const config = {
  matcher: ['/api/clinic/:path*', '/api/conversations/:path*', '/api/bookings/:path*', '/api/chat/:path*', '/api/whatsapp/:path*'],
};
