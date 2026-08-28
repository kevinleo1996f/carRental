class ListCars {
  constructor({ carRepository }) {
    this.carRepository = carRepository;
  }

  async execute(filters = {}) {
    return this.carRepository.findAll(filters);
  }
}

module.exports = ListCars;
