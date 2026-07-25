import { describe, it, expect, beforeAll } from 'vitest';
import { encrypt, decrypt } from '@/lib/auth';

describe('Auth Service', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'supersecret_for_tests_1234567890';
  });

  it('should encrypt and decrypt JWT tokens', async () => {
    const payload = { clinicId: 'test-clinic-1', userId: 'user-1' };
    const token = await encrypt(payload);
    
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    
    const decrypted = await decrypt(token);
    expect(decrypted).toBeDefined();
    expect(decrypted?.clinicId).toBe(payload.clinicId);
    expect(decrypted?.userId).toBe(payload.userId);
  });
});
