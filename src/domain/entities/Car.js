class Car {
  constructor({ id, brand, model, fuelType, transmission, year, drive, createdAt }) {
    this.id = id;
    this.brand = brand;
    this.model = model;
    this.fuelType = fuelType;
    this.transmission = transmission;
    this.year = year;
    this.drive = drive;
    this.createdAt = createdAt;
  }
}

module.exports = Car;
