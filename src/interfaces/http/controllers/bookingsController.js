const CreateBooking = require('../../../application/use-cases/CreateBooking');
const GetBookingById = require('../../../application/use-cases/GetBookingById');
const ListBookingsForCustomer = require('../../../application/use-cases/ListBookingsForCustomer');
const PostgresBookingRepository = require('../../../infrastructure/db/repositories/PostgresBookingRepository');
const PostgresCarRepository = require('../../../infrastructure/db/repositories/PostgresCarRepository');
const eventPublisher = require('../../../infrastructure/messaging/publisher');
const parseId = require('../utils/parseId');
const { ValidationError } = require('../../../domain/errors');

const bookingRepository = new PostgresBookingRepository();
const carRepository = new PostgresCarRepository();
const createBooking = new CreateBooking({ bookingRepository, carRepository, eventPublisher });
const getBookingById = new GetBookingById({ bookingRepository });
const listBookingsForCustomer = new ListBookingsForCustomer({ bookingRepository });

function toResponse(booking) {
  return {
    id: booking.id,
    customer_id: booking.customerId,
    car_id: booking.carId,
    start_date: booking.startDate,
    end_date: booking.endDate,
    status: booking.status,
    created_at: booking.createdAt,
    updated_at: booking.updatedAt,
  };
}

async function create(req, res, next) {
  try {
    const { car_id: rawCarId, start_date: startDate, end_date: endDate } = req.body;
    if (!rawCarId || !startDate || !endDate) {
      throw new ValidationError('car_id, start_date, and end_date are all required.');
    }

    const booking = await createBooking.execute({
      customerId: req.user.customerId,
      carId: parseId(rawCarId, 'car_id'),
      startDate,
      endDate,
    });

    res.status(202).json({
      ...toResponse(booking),
      message: 'Confirmation will be sent within 24 hours.',
    });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const booking = await getBookingById.execute(parseId(req.params.id), req.user);
    res.status(200).json(toResponse(booking));
  } catch (err) {
    next(err);
  }
}

async function listMine(req, res, next) {
  try {
    const bookings = await listBookingsForCustomer.execute(req.user.customerId);
    res.status(200).json(bookings.map(toResponse));
  } catch (err) {
    next(err);
  }
}

module.exports = { create, getById, listMine };
