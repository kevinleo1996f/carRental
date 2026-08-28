const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

async function hash(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function compare(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

module.exports = { hash, compare };
