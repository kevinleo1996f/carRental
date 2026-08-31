#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "CREATE DATABASE carrental_test;"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "carrental_test" -f /docker-entrypoint-initdb.d/schema.sql

echo "Created carrental_test (used by the Jest/Supertest suite) with the same schema as carrental."
