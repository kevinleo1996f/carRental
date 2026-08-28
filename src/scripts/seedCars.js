require('../config/env');
const pool = require('../infrastructure/db/pool');
const PostgresCarRepository = require('../infrastructure/db/repositories/PostgresCarRepository');
const { fetchCars, mapToCarRecord } = require('../infrastructure/external/ninjaApiClient');

const DEFAULT_YEAR_START = 2021;
const DEFAULT_YEAR_END = 2026;
const DEFAULT_BRANDS = [
  'toyota', 'honda', 'ford', 'kia', 'hyundai',
  'nissan', 'chevrolet', 'bmw', 'audi', 'volkswagen',
];

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const [key, value] = arg.replace(/^--/, '').split('=');
    args[key] = value;
  }
  return args;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function seed() {
  const args = parseArgs();
  const years = args.year
    ? [Number(args.year)]
    : Array.from(
        { length: DEFAULT_YEAR_END - DEFAULT_YEAR_START + 1 },
        (_, i) => DEFAULT_YEAR_START + i
      );
  const brands = args.brand ? [args.brand] : DEFAULT_BRANDS;

  const carRepository = new PostgresCarRepository();
  const stats = { inserted: 0, alreadyInDb: 0, noMatch: 0, failed: 0 };

  for (const year of years) {
    for (const brand of brands) {
      try {
        const results = await fetchCars({ year, make: brand });
        if (!results.length) {
          stats.noMatch += 1;
          continue;
        }

        const record = mapToCarRecord(results[0]);
        const saved = await carRepository.create(record);
        if (saved) {
          stats.inserted += 1;
          console.log(`+ ${record.year} ${record.brand} ${record.model}`);
        } else {
          stats.alreadyInDb += 1;
        }
      } catch (err) {
        // A single failed request (network error, Ninja API down, bad key,
        // etc.) never stops the run and never touches rows already saved —
        // it just skips this one year/brand combination.
        stats.failed += 1;
        console.warn(`! ${year} ${brand}: ${err.message} — skipping.`);
      }

      await sleep(300);
    }
  }

  console.log('\nSeed summary:');
  console.log(`  inserted:          ${stats.inserted}`);
  console.log(`  already in DB:     ${stats.alreadyInDb}`);
  console.log(`  no match from API: ${stats.noMatch}`);
  console.log(`  failed requests:   ${stats.failed}`);

  await pool.end();
}

seed().catch((err) => {
  console.error('Seed script crashed unexpectedly:', err);
  process.exit(1);
});
