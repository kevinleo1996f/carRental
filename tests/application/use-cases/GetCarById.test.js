const GetCarById = require('../../../src/application/use-cases/GetCarById');

describe('GetCarById', () => {
  it('returns the car when found', async () => {
    const car = { id: 1, brand: 'kia' };
    const fakeRepository = { findById: async (id) => (id === 1 ? car : null) };
    const useCase = new GetCarById({ carRepository: fakeRepository });

    await expect(useCase.execute(1)).resolves.toBe(car);
  });

  it('throws NotFoundError when the car does not exist', async () => {
    const fakeRepository = { findById: async () => null };
    const useCase = new GetCarById({ carRepository: fakeRepository });

    await expect(useCase.execute(999)).rejects.toThrow('Car 999 not found.');
  });
});
