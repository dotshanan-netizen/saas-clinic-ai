import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DELETE as deleteBranch } from '@/app/api/clinic/branches/route';
import { prismaMock } from '../singleton';
import { NextRequest } from 'next/server';
import { EntityStatus } from '@/generated/prisma';

describe('API Security & Tenant Isolation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('DELETE /api/clinic/branches (BOLA/IDOR protection)', () => {
    it('should return 403 Forbidden if trying to delete a branch belonging to another tenant', async () => {
      // Mock the branch in the DB as belonging to TENANT-B
      prismaMock.branch.findUnique.mockResolvedValue({
        id: 'branch-123',
        clinicId: 'TENANT-B',
        name: 'Other Clinic Branch',
        city: 'Riyadh',
        address: '123 St',
        phone: null,
        status: EntityStatus.ACTIVE,
        createdAt: new Date(),
      });

      // Request comes from TENANT-A
      const req = new NextRequest('http://localhost:3000/api/clinic/branches?branchId=branch-123', {
        headers: new Headers({
          'x-tenant-id': 'TENANT-A',
        })
      });

      const res = await deleteBranch(req);
      expect(res.status).toBe(403);
      
      const body = await res.json();
      expect(body.error).toContain('Forbidden: cross-tenant access denied');
    });

    it('should return 200 OK if trying to delete a branch belonging to the SAME tenant', async () => {
      // Mock the branch in the DB as belonging to TENANT-A
      prismaMock.branch.findUnique.mockResolvedValue({
        id: 'branch-123',
        clinicId: 'TENANT-A',
        name: 'My Clinic Branch',
        city: 'Riyadh',
        address: '123 St',
        phone: null,
        status: EntityStatus.ACTIVE,
        createdAt: new Date(),
      });

      prismaMock.branch.delete.mockResolvedValue({
        id: 'branch-123',
        clinicId: 'TENANT-A',
        name: 'My Clinic Branch',
        city: 'Riyadh',
        address: '123 St',
        phone: null,
        status: EntityStatus.ACTIVE,
        createdAt: new Date(),
      });

      // Request comes from TENANT-A
      const req = new NextRequest('http://localhost:3000/api/clinic/branches?branchId=branch-123', {
        headers: new Headers({
          'x-tenant-id': 'TENANT-A',
        })
      });

      const res = await deleteBranch(req);
      expect(res.status).toBe(200);
      
      const body = await res.json();
      expect(body.id).toBe('branch-123');
    });
  });
});
