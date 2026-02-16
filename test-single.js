const { scrapeAirbnb } = require('./src/index.js');

(async () => {
    console.log('Testing single city extraction...');
    const results = await scrapeAirbnb("New York", 2);
    console.log('Results:', results);
})();
