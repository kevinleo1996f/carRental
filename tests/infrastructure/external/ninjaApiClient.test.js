const { fetchCars, mapToCarRecord } = require('../../../src/infrastructure/external/ninjaApiClient');

describe('ninjaApiClient', () => {
  afterEach(() => {
    delete global.fetch;
  });

  describe('mapToCarRecord', () => {
    it('renames make to brand and expands "a" to "automatic"', () => {
      const record = mapToCarRecord({
        make: 'kia', model: 'seltos fwd', fuel_type: 'gas', transmission: 'a', year: 2021, drive: 'fwd',
      });
      expect(record).toEqual({
        brand: 'kia', model: 'seltos fwd', fuelType: 'gas', transmission: 'automatic', year: 2021, drive: 'fwd',
      });
    });

    it('expands "m" to "manual"', () => {
      expect(mapToCarRecord({ transmission: 'm' }).transmission).toBe('manual');
    });

    it('passes an unrecognized transmission code through unchanged', () => {
      expect(mapToCarRecord({ transmission: 'cvt' }).transmission).toBe('cvt');
    });
  });

  describe('fetchCars', () => {
    it('builds the request URL with year and make, and returns the parsed JSON on success', async () => {
      const mockJson = jest.fn().mockResolvedValue([{ make: 'kia' }]);
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: mockJson });

      const result = await fetchCars({ year: 2021, make: 'kia' });

      const calledUrl = global.fetch.mock.calls[0][0];
      expect(calledUrl.toString()).toBe('https://api.api-ninjas.com/v1/cars?year=2021&make=kia');
      expect(result).toEqual([{ make: 'kia' }]);
    });

    it('omits query params that were not given', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue([]) });

      await fetchCars({ year: 2021 });

      expect(global.fetch.mock.calls[0][0].toString()).toBe('https://api.api-ninjas.com/v1/cars?year=2021');
    });

    it('throws a descriptive error when the response is not ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: jest.fn().mockResolvedValue('{"error":"Invalid API Key."}'),
      });

      await expect(fetchCars({ year: 2021, make: 'kia' }))
        .rejects.toThrow('Ninja API request failed (401): {"error":"Invalid API Key."}');
    });
  });
});
