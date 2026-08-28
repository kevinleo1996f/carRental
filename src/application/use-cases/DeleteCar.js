const { NotFoundError } = require('../../domain/errors');

class DeleteCar {
  constructor({ carRepository }) {
    this.carRepository = carRepository;
  }

  async execute(id) {
    const car = await this.carRepository.findById(id);
    if (!car) {
      throw new NotFoundError(`Car ${id} not found.`);
    }
    // If the car still has bookings, the repository itself throws
    // ConflictError -- see PostgresCarRepository.delete().
    await this.carRepository.delete(id);
  }
}

module.exports = DeleteCar;
