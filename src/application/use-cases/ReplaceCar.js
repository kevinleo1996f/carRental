const { NotFoundError } = require('../../domain/errors');

class ReplaceCar {
  constructor({ carRepository }) {
    this.carRepository = carRepository;
  }

  async execute(id, fields) {
    const updated = await this.carRepository.update(id, fields);
    if (!updated) {
      throw new NotFoundError(`Car ${id} not found.`);
    }
    return updated;
  }
}

module.exports = ReplaceCar;
