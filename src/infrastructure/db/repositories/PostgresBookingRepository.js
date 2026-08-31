const pool = require('../pool');
const Booking = require('../../../domain/entities/Booking');
const BookingRepository = require('../../../domain/repositories/BookingRepository');

function toEntity(row) {
  return new Booking({
    id: row.id,
    customerId: row.customer_id,
    carId: row.car_id,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

class PostgresBookingRepository extends BookingRepository {
  async create({ customerId, carId, startDate, endDate }) {
    const result = await pool.query(
      `INSERT INTO bookings (customer_id, car_id, start_date, end_date)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [customerId, carId, startDate, endDate]
    );
    return toEntity(result.rows[0]);
  }

  async findById(id) {
    const result = await pool.query('SELECT * FROM bookings WHERE id = $1', [id]);
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async findByCustomerId(customerId) {
    const result = await pool.query(
      'SELECT * FROM bookings WHERE customer_id = $1 ORDER BY id',
      [customerId]
    );
    return result.rows.map(toEntity);
  }

  async updateStatus(id, status) {
    const result = await pool.query(
      `UPDATE bookings SET status = $2, updated_at = now() WHERE id = $1 RETURNING *`,
      [id, status]
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async findAll(filters = {}) {
    const clauses = [];
    const values = [];
    if (filters.status) {
      values.push(filters.status);
      clauses.push(`status = $${values.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await pool.query(`SELECT * FROM bookings ${where} ORDER BY id`, values);
    return result.rows.map(toEntity);
  }

  // Two date ranges overlap when each one starts before the other ends.
  // pending/confirmed both block the dates; a rejected booking doesn't.
  async hasOverlap(carId, startDate, endDate) {
    const result = await pool.query(
      `SELECT 1 FROM bookings
       WHERE car_id = $1
         AND status IN ('pending', 'confirmed')
         AND start_date <= $3
         AND end_date >= $2
       LIMIT 1`,
      [carId, startDate, endDate]
    );
    return result.rowCount > 0;
  }
}

module.exports = PostgresBookingRepository;
