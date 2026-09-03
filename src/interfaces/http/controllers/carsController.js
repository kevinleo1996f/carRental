const ListCars = require('../../../application/use-cases/ListCars');
const GetCarById = require('../../../application/use-cases/GetCarById');
const DeleteCar = require('../../../application/use-cases/DeleteCar');
const ReplaceCar = require('../../../application/use-cases/ReplaceCar');
const SearchCar = require('../../../application/use-cases/SearchCar');
const PostgresCarRepository = require('../../../infrastructure/db/repositories/PostgresCarRepository');
const ninjaApiClient = require('../../../infrastructure/external/ninjaApiClient');
const parseId = require('../utils/parseId');
const { ValidationError } = require('../../../domain/errors');

const carRepository = new PostgresCarRepository();
const listCars = new ListCars({ carRepository });
const getCarById = new GetCarById({ carRepository });
const deleteCar = new DeleteCar({ carRepository });
const replaceCar = new ReplaceCar({ carRepository });
const searchCar = new SearchCar({ ninjaApiClient, carRepository });

function toResponse(car) {
  return {
    id: car.id,
    brand: car.brand,
    model: car.model,
    fuel_type: car.fuelType,
    transmission: car.transmission,
    year: car.year,
    drive: car.drive,
  };
}

async function list(req, res, next) {
  try {
    const { brand, model, year, fuel_type: fuelType, transmission, drive } = req.query;
    const filters = {};
    if (brand) filters.brand = brand;
    if (model) filters.model = model;
    if (year) filters.year = Number(year);
    if (fuelType) filters.fuel_type = fuelType;
    if (transmission) filters.transmission = transmission;
    if (drive) filters.drive = drive;

    const cars = await listCars.execute(filters);
    res.status(200).json(cars.map(toResponse));
  } catch (err) {
    next(err);
  }
}

async function search(req, res, next) {
  try {
    const { brand, year: rawYear } = req.query;
    if (!brand || !rawYear) {
      throw new ValidationError('brand and year are both required to search.');
    }

    const { car, source } = await searchCar.execute({ brand, year: parseId(rawYear, 'year') });
    res.status(200).json({ source, car: toResponse(car) });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const car = await getCarById.execute(parseId(req.params.id));
    res.status(200).json(toResponse(car));
  } catch (err) {
    next(err);
  }
}

async function replace(req, res, next) {
  try {
    const { brand, model, fuel_type: fuelType, transmission, year, drive } = req.body;
    if (!brand || !model || !fuelType || !transmission || !year || !drive) {
      throw new ValidationError('brand, model, fuel_type, transmission, year, and drive are all required for a full replace.');
    }

    const car = await replaceCar.execute(parseId(req.params.id), {
      brand, model, fuelType, transmission, year: Number(year), drive,
    });
    res.status(200).json(toResponse(car));
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await deleteCar.execute(parseId(req.params.id));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { list, search, getById, replace, remove };
