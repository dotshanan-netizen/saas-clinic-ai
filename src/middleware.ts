import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt, encrypt } from './lib/auth';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isBypassActive = process.env.BYPASS_AUTH === "true" && process.env.NODE_ENV !== "production";

  // Development/Pilot Testing Bypass Logic
  if (isBypassActive) {
    // 1. If visiting login, redirect to dashboard immediately
    if (path === '/login') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // 2. If visiting dashboard, ensure they have a session cookie automatically
    if (path.startsWith('/dashboard')) {
      const sessionCookie = request.cookies.get('clinova_session')?.value;
      let hasValidCookie = false;
      if (sessionCookie) {
        try {
          const payload = await decrypt(sessionCookie);
          if (payload?.clinicId) {
            hasValidCookie = true;
          }
        } catch (_) {
          // invalid cookie
        }
      }

      if (!hasValidCookie) {
        // Automatically log them in as default user
        const payload = {
          userId: "mock-development-user-id",
          clinicId: "cmryoendy0000dzrctyxgyf3k", // Default to rival-clinic
          role: "ADMIN",
          slug: "rival-clinic"
        };
        const sessionToken = await encrypt(payload);
        const response = NextResponse.next();
        response.cookies.set("clinova_session", sessionToken, {
          httpOnly: true,
          secure: true,
          sameSite: "strict",
          maxAge: 60 * 60 * 24, // 1 day
          path: "/",
        });
        return response;
      }
    }
  } else {
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
        } catch (_) {}
      }
      if (!hasValidCookie) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
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
    
    try {
      // Decode and verify the session if exists
      let tenantId = "cmryoendy0000dzrctyxgyf3k"; // Default to rival-clinic

      if (sessionCookie) {
        const payload = await decrypt(sessionCookie);
        if (payload?.clinicId) {
          tenantId = payload.clinicId as string;
        }
      } else if (!isBypassActive) {
        return NextResponse.json({ error: 'Unauthorized: No session cookie' }, { status: 401 });
      }

      // Clone the request headers and inject x-tenant-id
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-tenant-id', tenantId);

      // We should also remove 'clinicSlug' from body/query to prevent downstream IDOR if we wanted, 
      // but injecting x-tenant-id is enough for controllers to use it exclusively.
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });

    } catch (err) {
      console.error("Session decryption failed in middleware:", err);
      if (!isBypassActive) {
        return NextResponse.json({ error: 'Unauthorized: Invalid session' }, { status: 401 });
      }
      // Fallback for testing to avoid 401
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-tenant-id', "cmryoendy0000dzrctyxgyf3k");
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
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

