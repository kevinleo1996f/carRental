module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.js',
    // Abstract base classes -- every method just throws "Not implemented"
    // by design; only the concrete Postgres*Repository subclasses (which
    // override every method) are ever actually called. Coverage tooling
    // has no way to know these are meant to be uninstantiated contracts,
    // not real code paths.
    '!src/domain/repositories/**',
    // Process entrypoints, not business logic -- verified by actually
    // running them in Docker throughout this whole project (server
    // health checks, worker log output, seed script runs), not by unit
    // tests. Nothing else in the codebase ever `require`s these.
    '!src/server.js',
    '!src/worker.js',
    '!src/scripts/**',
  ],
};
