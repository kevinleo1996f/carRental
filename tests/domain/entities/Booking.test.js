const Booking = require('../../../src/domain/entities/Booking');

describe('Booking entity', () => {
  it('creates a booking with default status "pending"', () => {
    const booking = new Booking({
      id: 1,
      customerId: 1,
      carId: 1,
      startDate: '2026-09-01',
      endDate: '2026-09-05',
    });

    expect(booking.status).toBe('pending');
  });

  it('rejects an end_date before start_date', () => {
    expect(() => new Booking({
      customerId: 1,
      carId: 1,
      startDate: '2026-09-05',
      endDate: '2026-09-01',
    })).toThrow('end_date must not be before start_date');
  });

  it('rejects an invalid status', () => {
    expect(() => new Booking({
      customerId: 1,
      carId: 1,
      startDate: '2026-09-01',
      endDate: '2026-09-05',
      status: 'archived',
    })).toThrow(/status must be one of/);
  });
});
