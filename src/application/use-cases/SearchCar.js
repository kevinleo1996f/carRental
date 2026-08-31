const { NotFoundError } = require('../../domain/errors');

class SearchCar {
  constructor({ ninjaApiClient, carRepository }) {
    this.ninjaApiClient = ninjaApiClient;
    this.carRepository = carRepository;
  }

  async execute({ brand, year }) {
    try {
      const results = await this.ninjaApiClient.fetchCars({ year, make: brand });
      if (results.length) {
        const record = this.ninjaApiClient.mapToCarRecord(results[0]);
        const car = await this.carRepository.upsert(record);
        return { car, source: 'ninja_api' };
      }
      // A successful call with zero matches still falls through to the
      // database below -- Ninja "working but has no data" is treated the
      // same as "not working" for this purpose: always try the local
      // cache before giving up entirely.
    } catch (err) {
      console.warn(`Ninja API search failed for brand=${brand} year=${year}: ${err.message} -- falling back to the local database.`);
    }

    const [car] = await this.carRepository.findAll({ brand, year });
    if (!car) {
      throw new NotFoundError(
        `No car found for brand=${brand}, year=${year}, from either the live API or the local database.`
      );
    }
    return { car, source: 'database_fallback' };
  }
}

module.exports = SearchCar;
