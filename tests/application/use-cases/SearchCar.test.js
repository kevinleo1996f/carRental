const SearchCar = require('../../../src/application/use-cases/SearchCar');

const ninjaCar = { make: 'kia', model: 'seltos fwd', fuel_type: 'gas', transmission: 'a', year: 2021, drive: 'fwd' };
const mappedRecord = { brand: 'kia', model: 'seltos fwd', fuelType: 'gas', transmission: 'automatic', year: 2021, drive: 'fwd' };
const upsertedCar = { id: 4, ...mappedRecord };

function makeUseCase({ fetchImpl, dbCar } = {}) {
  const ninjaApiClient = {
    fetchCars: fetchImpl || jest.fn().mockResolvedValue([ninjaCar]),
    mapToCarRecord: jest.fn().mockReturnValue(mappedRecord),
  };
  const carRepository = {
    upsert: jest.fn().mockResolvedValue(upsertedCar),
    findAll: jest.fn().mockResolvedValue(dbCar ? [dbCar] : []),
  };
  const useCase = new SearchCar({ ninjaApiClient, carRepository });
  return { useCase, ninjaApiClient, carRepository };
}

describe('SearchCar', () => {
  it('returns the Ninja result and upserts it when the live call succeeds', async () => {
    const { useCase, carRepository } = makeUseCase();

    const result = await useCase.execute({ brand: 'kia', year: 2021 });

    expect(result.source).toBe('ninja_api');
    expect(result.car).toBe(upsertedCar);
    expect(carRepository.upsert).toHaveBeenCalledWith(mappedRecord);
  });

  it('falls back to the database when Ninja throws', async () => {
    const dbCar = { id: 1, brand: 'kia', year: 2021 };
    const { useCase } = makeUseCase({
      fetchImpl: jest.fn().mockRejectedValue(new Error('Ninja API request failed (401)')),
      dbCar,
    });

    const result = await useCase.execute({ brand: 'kia', year: 2021 });

    expect(result.source).toBe('database_fallback');
    expect(result.car).toBe(dbCar);
  });

  it('falls back to the database when Ninja succeeds but finds nothing', async () => {
    const dbCar = { id: 1, brand: 'kia', year: 2021 };
    const { useCase } = makeUseCase({
      fetchImpl: jest.fn().mockResolvedValue([]),
      dbCar,
    });

    const result = await useCase.execute({ brand: 'kia', year: 2021 });

    expect(result.source).toBe('database_fallback');
    expect(result.car).toBe(dbCar);
  });

  it('throws NotFoundError when neither Ninja nor the database has a match', async () => {
    const { useCase } = makeUseCase({
      fetchImpl: jest.fn().mockRejectedValue(new Error('network error')),
      dbCar: undefined,
    });

    await expect(useCase.execute({ brand: 'made-up-brand', year: 1899 }))
      .rejects.toThrow(/No car found for brand=made-up-brand, year=1899/);
  });
});
