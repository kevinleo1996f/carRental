const errorHandler = require('../../../../src/interfaces/http/middlewares/errorHandler');
const { ValidationError } = require('../../../../src/domain/errors');

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('errorHandler', () => {
  it('uses the error\'s own status code for a DomainError', () => {
    const res = makeRes();
    errorHandler(new ValidationError('bad input'), {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'bad input' });
  });

  it('turns a body-parser JSON error into 400', () => {
    const res = makeRes();
    const err = Object.assign(new Error('Unexpected token'), { type: 'entity.parse.failed' });
    errorHandler(err, {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Request body must be valid JSON.' });
  });

  it('falls back to a generic 500 for anything else', () => {
    const res = makeRes();
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    errorHandler(new Error('something broke'), {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Something went wrong.' });
    consoleSpy.mockRestore();
  });
});
