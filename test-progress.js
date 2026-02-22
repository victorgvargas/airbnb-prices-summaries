// Simple test to demonstrate the enhanced progress display
const { scrapeMultipleCities } = require('./src/index.js');

async function testProgressDisplay() {
    console.log('Testing enhanced progress display...');

    const cities = ['Bangkok'];
    const dateConfig = {
        mode: 'specific',
        checkin: '2026-03-15',
        checkout: '2026-03-29'
    };

    // Mock progress callback to see the messages
    const progressCallback = (message) => {
        console.log(`[PROGRESS] ${message}`);
    };

    try {
        const results = await scrapeMultipleCities(cities, dateConfig, 1, progressCallback);
        console.log('\n=== TEST COMPLETE ===');
        console.log('Results summary:', {
            totalCities: results.cities.length,
            successful: results.cities.filter(c => !c.error).length
        });
    } catch (error) {
        console.error('Test error:', error.message);
    }
}

if (require.main === module) {
    testProgressDisplay();
}
