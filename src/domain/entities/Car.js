class Car {
  constructor({ id, make, model, fuelType, transmission, year, drive, createdAt }) {
    this.id = id;
    this.make = make;
    this.model = model;
    this.fuelType = fuelType;
    this.transmission = transmission;
    this.year = year;
    this.drive = drive;
    this.createdAt = createdAt;
  }
}

module.exports = Car;
