const DeleteCar = require('../../../src/application/use-cases/DeleteCar');
const { ConflictError } = require('../../../src/domain/errors');

describe('DeleteCar', () => {
  it('deletes a car that has no bookings', async () => {
    const fakeRepository = {
      findById: async () => ({ id: 1 }),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const useCase = new DeleteCar({ carRepository: fakeRepository });

    await useCase.execute(1);

    expect(fakeRepository.delete).toHaveBeenCalledWith(1);
  });

  it('throws NotFoundError for a car that does not exist', async () => {
    const fakeRepository = { findById: async () => null };
    const useCase = new DeleteCar({ carRepository: fakeRepository });

    await expect(useCase.execute(999)).rejects.toThrow('Car 999 not found.');
  });

  it('lets the repository\'s ConflictError through when the car has bookings', async () => {
    const fakeRepository = {
      findById: async () => ({ id: 1 }),
      delete: async () => {
        throw new ConflictError('Car has existing bookings and cannot be deleted.');
      },
    };
    const useCase = new DeleteCar({ carRepository: fakeRepository });

    await expect(useCase.execute(1)).rejects.toThrow('Car has existing bookings and cannot be deleted.');
  });
});
