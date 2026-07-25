import { describe, it, expect } from 'vitest';
import { UpsertBranchSchema, UpsertDoctorSchema } from '@/dtos';

describe('DTO Validation', () => {
  describe('UpsertBranchSchema', () => {
    it('should pass with valid data', () => {
      const validData = {
        name: 'Main Branch',
        city: 'Riyadh',
        address: '123 Main St',
        phone: '0500000000',
        clinicSlug: 'test-clinic'
      };
      const result = UpsertBranchSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should fail if name is too short', () => {
      const invalidData = {
        name: 'Ma', // min 3
        city: 'Riyadh',
        address: '123 Main St',
        clinicSlug: 'test-clinic'
      };
      const result = UpsertBranchSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('يجب أن يكون الاسم 3 حروف على الأقل');
      }
    });

    it('should fail if address is missing', () => {
      const invalidData = {
        name: 'Main Branch',
        city: 'Riyadh',
        clinicSlug: 'test-clinic'
      };
      const result = UpsertBranchSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('UpsertDoctorSchema', () => {
    it('should fail if imageUrl is invalid', () => {
      const invalidData = {
        name: 'Dr. John',
        specialty: 'Dentist',
        imageUrl: 'not-a-url',
        clinicSlug: 'test-clinic'
      };
      const result = UpsertDoctorSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('رابط الصورة غير صالح');
      }
    });
  });
});
