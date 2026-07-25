import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingService } from '@/lib/domain/BookingService';
import { prismaMock } from '../singleton';
import { startOfDay, addDays } from 'date-fns';

describe('Scheduling Engine & Calendar Logic', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should exclude slots on doctor holidays or closed days', async () => {
    // Mock doctor who is closed on Mondays
    prismaMock.doctor.findFirst.mockResolvedValue({
      id: 'doc-holiday',
      clinicId: 'clinic-1',
      name: 'د. سحر',
      specialty: 'جلدية',
      status: 'ACTIVE',
      schedules: [
        {
          id: 'sch-1',
          dayOfWeek: 'MONDAY',
          startTime: '09:00',
          endTime: '17:00',
          isClosed: true, // CLOSED!
        }
      ]
    } as any);

    prismaMock.booking.findMany.mockResolvedValue([]);

    const slots = await BookingService.getAvailableSlots('clinic-1', 'د. سحر');
    
    // Check that Monday keys are not present or have empty slots
    const mondayKeys = Object.keys(slots).filter(key => key.includes('الإثنين'));
    expect(mondayKeys.length).toBe(0);
  });

  it('should exclude slots that are outside doctor working hours', async () => {
    // Mock doctor who only works 09:00 to 10:00
    prismaMock.doctor.findFirst.mockResolvedValue({
      id: 'doc-hours',
      clinicId: 'clinic-1',
      name: 'د. أحمد',
      specialty: 'جراحة',
      status: 'ACTIVE',
      schedules: [
        {
          id: 'sch-2',
          dayOfWeek: 'TUESDAY',
          startTime: '09:00',
          endTime: '10:00',
          isClosed: false,
        }
      ]
    } as any);

    prismaMock.booking.findMany.mockResolvedValue([]);

    const slots = await BookingService.getAvailableSlots('clinic-1', 'د. أحمد');
    
    // Slots on Tuesday should only contain 09:00 and 09:30
    const tuesdayKeys = Object.keys(slots).filter(key => key.includes('الثلاثاء'));
    if (tuesdayKeys.length > 0) {
      const tuesdaySlots = slots[tuesdayKeys[0]];
      expect(tuesdaySlots.length).toBeLessThanOrEqual(2);
      expect(tuesdaySlots[0]).toContain('09:00 ص');
      expect(tuesdaySlots[1]).toContain('09:30 ص');
    }
  });

  it('should merge available slots from all doctors when doctor is ANY', async () => {
    // Mock two doctors offering the same service
    const mockDoctors = [
      {
        id: 'doc-1',
        name: 'د. سحر',
        schedules: [
          { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '10:00', isClosed: false }
        ]
      },
      {
        id: 'doc-2',
        name: 'د. أحمد',
        schedules: [
          { dayOfWeek: 'MONDAY', startTime: '09:30', endTime: '10:30', isClosed: false }
        ]
      }
    ];

    prismaMock.doctorService.findMany.mockResolvedValue(
      mockDoctors.map(doc => ({
        doctor: {
          ...doc,
          status: 'ACTIVE',
          schedules: doc.schedules.map(s => ({ ...s, isClosed: s.isClosed || false }))
        }
      })) as any
    );

    prismaMock.booking.findMany.mockResolvedValue([]);

    const slots = await BookingService.getAvailableSlots('clinic-1', 'ANY', 'كشفية');

    // Merged slots for Monday should be union: 09:00, 09:30, 10:00
    const mondayKeys = Object.keys(slots).filter(key => key.includes('الإثنين'));
    expect(mondayKeys.length).toBeGreaterThan(0);
    const mondaySlots = slots[mondayKeys[0]];
    expect(mondaySlots.some(slot => slot.includes('09:00 ص'))).toBe(true);
    expect(mondaySlots.some(slot => slot.includes('09:30 ص'))).toBe(true);
    expect(mondaySlots.some(slot => slot.includes('10:00 ص'))).toBe(true);
  });
});
