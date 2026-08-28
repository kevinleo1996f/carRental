const ListCars = require('../../../src/application/use-cases/ListCars');

describe('ListCars', () => {
  it('passes filters straight through to the repository', async () => {
    const cars = [{ id: 1, brand: 'kia' }];
    const fakeRepository = { findAll: jest.fn().mockResolvedValue(cars) };
    const useCase = new ListCars({ carRepository: fakeRepository });

    const result = await useCase.execute({ brand: 'kia' });

    expect(fakeRepository.findAll).toHaveBeenCalledWith({ brand: 'kia' });
    expect(result).toBe(cars);
  });

  it('defaults to no filters when none are given', async () => {
    const fakeRepository = { findAll: jest.fn().mockResolvedValue([]) };
    const useCase = new ListCars({ carRepository: fakeRepository });

    await useCase.execute();

    expect(fakeRepository.findAll).toHaveBeenCalledWith({});
  });
});
