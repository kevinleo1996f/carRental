const UpdateBookingStatus = require('../../../src/application/use-cases/UpdateBookingStatus');

function makeUseCase({ booking, publishImpl } = {}) {
  const bookingRepository = {
    findById: jest.fn().mockResolvedValue(booking),
    updateStatus: jest.fn().mockImplementation(async (id, status) => ({ ...booking, id, status })),
  };
  const eventPublisher = { publish: publishImpl || jest.fn().mockResolvedValue(undefined) };
  const useCase = new UpdateBookingStatus({ bookingRepository, eventPublisher });
  return { useCase, bookingRepository, eventPublisher };
}

describe('UpdateBookingStatus', () => {
  it('approves (confirms) a pending booking', async () => {
    const { useCase } = makeUseCase({ booking: { id: 1, status: 'pending' } });

    const result = await useCase.execute(1, 'confirmed');

    expect(result.status).toBe('confirmed');
  });

  it('rejects a pending booking', async () => {
    const { useCase } = makeUseCase({ booking: { id: 1, status: 'pending' } });

    const result = await useCase.execute(1, 'rejected');

    expect(result.status).toBe('rejected');
  });

  it('throws NotFoundError for a booking that does not exist', async () => {
    const { useCase } = makeUseCase({ booking: null });

    await expect(useCase.execute(999, 'confirmed')).rejects.toThrow('Booking 999 not found.');
  });

  it('throws ConflictError for a booking that is already confirmed', async () => {
    const { useCase } = makeUseCase({ booking: { id: 1, status: 'confirmed' } });

    await expect(useCase.execute(1, 'confirmed'))
      .rejects.toThrow('Booking 1 is already confirmed and cannot be changed.');
  });

  it('throws ConflictError for a booking that is already rejected', async () => {
    const { useCase } = makeUseCase({ booking: { id: 1, status: 'rejected' } });

    await expect(useCase.execute(1, 'confirmed'))
      .rejects.toThrow('Booking 1 is already rejected and cannot be changed.');
  });

  it('publishes booking.status_changed with the new status', async () => {
    const { useCase, eventPublisher } = makeUseCase({ booking: { id: 1, status: 'pending' } });

    await useCase.execute(1, 'confirmed');

    expect(eventPublisher.publish).toHaveBeenCalledWith('booking.status_changed', {
      bookingId: 1, status: 'confirmed',
    });
  });

  it('still returns the updated booking even if publishing the event fails', async () => {
    const { useCase } = makeUseCase({
      booking: { id: 1, status: 'pending' },
      publishImpl: jest.fn().mockRejectedValue(new Error('RabbitMQ is down')),
    });

    const result = await useCase.execute(1, 'confirmed');

    expect(result.status).toBe('confirmed');
  });
});
