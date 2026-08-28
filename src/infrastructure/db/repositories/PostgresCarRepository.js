const pool = require('../pool');
const Car = require('../../../domain/entities/Car');
const CarRepository = require('../../../domain/repositories/CarRepository');

const FILTERABLE_COLUMNS = ['brand', 'model', 'year', 'fuel_type', 'transmission', 'drive'];

function toEntity(row) {
  return new Car({
    id: row.id,
    brand: row.brand,
    model: row.model,
    fuelType: row.fuel_type,
    transmission: row.transmission,
    year: row.year,
    drive: row.drive,
    createdAt: row.created_at,
  });
}

class PostgresCarRepository extends CarRepository {
  // Returns null instead of a Car when the row already exists (same
  // brand/model/year/transmission/drive), so the seed script can tell a
  // fresh insert apart from a duplicate it skipped.
  async create({ brand, model, fuelType, transmission, year, drive }) {
    const result = await pool.query(
      `INSERT INTO cars (brand, model, fuel_type, transmission, year, drive)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (brand, model, year, transmission, drive) DO NOTHING
       RETURNING *`,
      [brand, model, fuelType, transmission, year, drive]
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async findAll(filters = {}) {
    const clauses = [];
    const values = [];
    for (const [column, value] of Object.entries(filters)) {
      if (value === undefined || !FILTERABLE_COLUMNS.includes(column)) continue;
      values.push(value);
      clauses.push(`${column} = $${values.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await pool.query(`SELECT * FROM cars ${where} ORDER BY id`, values);
    return result.rows.map(toEntity);
  }

  async findById(id) {
    const result = await pool.query('SELECT * FROM cars WHERE id = $1', [id]);
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async delete(id) {
    await pool.query('DELETE FROM cars WHERE id = $1', [id]);
  }
}

module.exports = PostgresCarRepository;
