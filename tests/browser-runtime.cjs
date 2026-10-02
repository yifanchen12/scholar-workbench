'use strict';
// Development-only dependency; application runtime needs no npm packages.
try {
  module.exports = {playwright: require(process.env.PLAYWRIGHT_PATH || 'playwright')};
} catch {
  throw new Error('Install Playwright for browser checks (npm install --no-save --package-lock=false playwright), or set PLAYWRIGHT_PATH to its package path.');
}
