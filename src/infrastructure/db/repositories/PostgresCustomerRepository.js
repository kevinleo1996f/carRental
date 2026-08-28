const pool = require('../pool');
const Customer = require('../../../domain/entities/Customer');
const CustomerRepository = require('../../../domain/repositories/CustomerRepository');

function toEntity(row) {
  return new Customer({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  });
}

class PostgresCustomerRepository extends CustomerRepository {
  async create({ fullName, email, passwordHash }) {
    const result = await pool.query(
      `INSERT INTO customers (full_name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [fullName, email, passwordHash]
    );
    return toEntity(result.rows[0]);
  }

  async findByEmail(email) {
    const result = await pool.query('SELECT * FROM customers WHERE email = $1', [email]);
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async findById(id) {
    const result = await pool.query('SELECT * FROM customers WHERE id = $1', [id]);
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }
}

module.exports = PostgresCustomerRepository;
