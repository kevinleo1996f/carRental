const notFoundHandler = require('../../../../src/interfaces/http/middlewares/notFoundHandler');

describe('notFoundHandler', () => {
  it('passes a NotFoundError naming the method and URL to next()', () => {
    const next = jest.fn();
    notFoundHandler({ method: 'GET', originalUrl: '/nope' }, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.message).toBe('Route not found: GET /nope');
    expect(err.statusCode).toBe(404);
  });
});
