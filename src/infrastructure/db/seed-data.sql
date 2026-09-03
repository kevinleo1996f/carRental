-- Baseline demo data, applied automatically alongside schema.sql on a
-- fresh volume -- so `docker compose up` alone has something to demo
-- every endpoint against, with no NINJA_API_KEY or manual seed script
-- required. npm run seed adds real Ninja-sourced cars on top of this;
-- it never removes or duplicates these rows (same unique constraint).
-- Only applied to the main `carrental` database, not `carrental_test`
-- (create-test-db.sh only re-sources schema.sql, not this file) -- the
-- test suite truncates everything before every test anyway.

INSERT INTO cars (brand, model, fuel_type, transmission, year, drive) VALUES
  ('kia', 'seltos fwd', 'gas', 'automatic', 2021, 'fwd'),
  ('toyota', 'corolla', 'gas', 'automatic', 2022, 'fwd'),
  ('honda', 'civic', 'gas', 'manual', 2023, 'fwd'),
  ('ford', 'mustang', 'gas', 'automatic', 2022, 'rwd'),
  ('tesla', 'model 3', 'electricity', 'automatic', 2023, 'awd')
ON CONFLICT (brand, model, year, transmission, drive) DO NOTHING;

-- Password is "demopass123" (bcrypt-hashed) -- log in with this account
-- to see a real "My bookings" entry with zero setup.
INSERT INTO customers (full_name, email, password_hash) VALUES
  ('Demo Customer', 'demo@carrental.local', '$2a$10$CtNN3JYH4d91enjGIH/PMe1XipKqkCOeCbTatNYUBo9notxwvJ2u6')
ON CONFLICT (email) DO NOTHING;

INSERT INTO bookings (customer_id, car_id, start_date, end_date, status)
SELECT c.id, r.id, '2027-01-01', '2027-01-05', 'pending'
FROM customers c, cars r
WHERE c.email = 'demo@carrental.local' AND r.brand = 'kia' AND r.model = 'seltos fwd'
ON CONFLICT DO NOTHING;
