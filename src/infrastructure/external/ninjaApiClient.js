const config = require('../../config/env');

const BASE_URL = 'https://api.api-ninjas.com/v1/cars';

const TRANSMISSION_LABELS = {
  a: 'automatic',
  m: 'manual',
};

async function fetchCars({ year, make }) {
  const url = new URL(BASE_URL);
  if (year) url.searchParams.set('year', year);
  if (make) url.searchParams.set('make', make);

  const response = await fetch(url, {
    headers: { 'X-Api-Key': config.ninjaApiKey },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ninja API request failed (${response.status}): ${body}`);
  }

  return response.json();
}

function mapToCarRecord(apiCar) {
  return {
    brand: apiCar.make,
    model: apiCar.model,
    fuelType: apiCar.fuel_type,
    transmission: TRANSMISSION_LABELS[apiCar.transmission] || apiCar.transmission,
    year: apiCar.year,
    drive: apiCar.drive,
  };
}

module.exports = { fetchCars, mapToCarRecord };
