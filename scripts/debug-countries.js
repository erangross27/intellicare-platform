// Debug script to see what countries are in the system
const { getSupportedCountries } = require('../frontend-vite/src/utils/countryConfig');

console.log('Supported Countries:');
const countries = getSupportedCountries();
countries.forEach(country => {
  console.log(`  - "${country}"`);
});

console.log('\nTotal countries:', countries.length);