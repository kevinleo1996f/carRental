class Customer {
  constructor({ id, fullName, email, passwordHash, createdAt }) {
    this.id = id;
    this.fullName = fullName;
    this.email = email;
    this.passwordHash = passwordHash;
    this.createdAt = createdAt;
  }
}

module.exports = Customer;
