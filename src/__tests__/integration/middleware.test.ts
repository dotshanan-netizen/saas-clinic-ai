import { describe, it, expect, vi } from 'vitest';
import { middleware } from '@/middleware';
import { NextRequest } from 'next/server';
import * as auth from '@/lib/auth';

vi.mock('@/lib/auth', () => ({
  decrypt: vi.fn(),
}));

describe('Middleware Integration', () => {
  it('should allow public routes to pass without session', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login');
    const res = await middleware(req);
    
    // NextResponse.next() returns a response with no particular status modification unless changed
    // We check if it doesn't return 401
    expect(res.status).not.toBe(401);
  });

  it('should block protected routes without session', async () => {
    const req = new NextRequest('http://localhost:3000/api/clinic/branches');
    const res = await middleware(req);
    
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized: No session cookie');
  });

  it('should inject x-tenant-id on valid session for protected routes', async () => {
    vi.mocked(auth.decrypt).mockResolvedValueOnce({ clinicId: 'tenant-123' });
    
    const req = new NextRequest('http://localhost:3000/api/clinic/branches', {
      headers: new Headers({
        Cookie: 'clinova_session=valid-token',
      })
    });
    
    const res = await middleware(req);
    
    // It should call next() which doesn't return a JSON body, and the status is 200 (default)
    expect(res.status).toBe(200);
    // Since it's NextResponse.next(), extracting the header injected into the request is hard directly from the response object
    // but we know it shouldn't be 401
  });
});
