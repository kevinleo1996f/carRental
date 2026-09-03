const express = require('express');
const path = require('path');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./interfaces/http/swagger');
const authRoutes = require('./interfaces/http/routes/authRoutes');
const carsRoutes = require('./interfaces/http/routes/carsRoutes');
const bookingsRoutes = require('./interfaces/http/routes/bookingsRoutes');
const adminRoutes = require('./interfaces/http/routes/adminRoutes');
const notFoundHandler = require('./interfaces/http/middlewares/notFoundHandler');
const errorHandler = require('./interfaces/http/middlewares/errorHandler');
const config = require('./config/env');
const healthController = require('./interfaces/http/controllers/healthController');

const app = express();

// Only CORS_ORIGIN (http://localhost:3002 by default) may call this API
// from a browser. Requests with no Origin header at all -- curl, Postman,
// server-to-server -- are unaffected either way, since CORS is purely a
// browser mechanism and those were never subject to it in the first
// place. Same-origin requests (the app's own pages calling their own
// API) also never hit this check; the browser doesn't apply CORS to them.
app.use(cors({
  origin(origin, callback) {
    if (!origin || origin === config.corsOrigin) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    }
  },
}));
app.use(express.json());

// The 3-page test UI (login/index/admin.html) -- registered before the API
// routes so an exact static file match always wins; anything that isn't a
// real file (e.g. /auth/login) falls through to the routes below unchanged.
app.use(express.static(path.join(__dirname, '../public')));

app.get('/health', healthController.check);

// Publicly viewable -- no authMiddleware. Swagger UI's own "Authorize"
// button is where a real JWT gets pasted in, for testing protected routes
// from inside the docs page itself.
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use('/auth', authRoutes);
app.use('/cars', carsRoutes);
app.use('/bookings', bookingsRoutes);
app.use('/admin', adminRoutes);

// Reached only if nothing above matched -- turns Express's default
// "Cannot GET /whatever" HTML page into the same JSON error shape as
// everything else in the API.
app.use(notFoundHandler);

// Must be registered last -- Express only treats a 4-arg middleware as an
// error handler, and only errors passed to routes/middleware above this
// line will reach it.
app.use(errorHandler);

module.exports = app;
