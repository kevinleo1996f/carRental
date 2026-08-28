const { NotFoundError } = require('../../domain/errors');

class GetCarById {
  constructor({ carRepository }) {
    this.carRepository = carRepository;
  }

  async execute(id) {
    const car = await this.carRepository.findById(id);
    if (!car) {
      throw new NotFoundError(`Car ${id} not found.`);
    }
    return car;
  }
}

module.exports = GetCarById;
