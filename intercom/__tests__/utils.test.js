describe('utils/cors', () => {
  test('exports corsOptions with correct structure', () => {
    const { corsOptions } = require('../config');
    expect(corsOptions).toHaveProperty('methods');
    expect(corsOptions).toHaveProperty('credentials');
    expect(corsOptions).toHaveProperty('exposedHeaders');
    expect(corsOptions).toHaveProperty('origin');
  });
});

describe('routes/index', () => {
  test('exports all route modules', () => {
    const routes = require('../routes/index');
    expect(routes).toHaveProperty('backchannelLogout');
    expect(routes).toHaveProperty('fs');
    expect(routes).toHaveProperty('oc');
    expect(routes).toHaveProperty('wiki');
    expect(routes).toHaveProperty('nob');
    expect(routes).toHaveProperty('navigation');
    expect(routes).toHaveProperty('silent');
    expect(routes).toHaveProperty('uuid');
    expect(routes).toHaveProperty('sogo');
    expect(routes).toHaveProperty('ilias');
  });
});
