const config = require('../../config/env');

const BASE_URL = 'https://api.api-ninjas.com/v1/cars';
const REQUEST_TIMEOUT_MS = 5000;
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 300;

const TRANSMISSION_LABELS = {
  a: 'automatic',
  m: 'manual',
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A single attempt. Aborts via AbortController if Ninja hangs instead of
// erroring outright -- without this, a hung request would never reach
// SearchCar's catch block, and the whole point of the fallback (an
// instant-feeling response) would be defeated by a slow, not-quite-dead
// third party.
async function fetchOnce({ year, make }) {
  const url = new URL(BASE_URL);
  if (year) url.searchParams.set('year', year);
  if (make) url.searchParams.set('make', make);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { 'X-Api-Key': config.ninjaApiKey },
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Ninja API request failed (${response.status}): ${body}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

// One retry before giving up -- a single dropped connection or transient
// timeout shouldn't immediately fall back to the database if trying
// again would have worked. Doesn't distinguish retriable from permanent
// failures (an invalid API key fails the same way twice) -- keeping that
// judgment call out of scope here since SearchCar's fallback already
// covers "Ninja genuinely isn't available" either way.
async function fetchCars(params) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await fetchOnce(params);
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }
  throw lastError;
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
