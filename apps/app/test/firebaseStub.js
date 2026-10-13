// Unit tests exercise pure logic only; Firebase SDK calls are never made.
const fn = () => ({});
module.exports = new Proxy({}, { get: (_t, key) => (key === '__esModule' ? false : fn) });
