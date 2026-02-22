#!/usr/bin/env node

// Demo of the interactive date selection functionality
const readline = require('readline');

function createReadlineInterface() {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
}

function question(rl, query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function demoInteractiveMode() {
    console.log('=== AIRBNB PRICE ANALYZER - INTERACTIVE DATE SELECTION DEMO ===\n');

    const cities = ['Valencia', 'Barcelona'];
    console.log('Cities to analyze:', cities.join(', '));

    const rl = createReadlineInterface();

    try {
        console.log('\n==== DATE SELECTION MODE ====');
        console.log('1. Same dates for all cities (enter start/end dates or number of months)');
        console.log('2. Different dates per city (specify dates for each city individually)');
        console.log('3. Use month parameter (original functionality)');

        const mode = await question(rl, 'Select mode (1, 2, or 3): ');

        if (mode === '1') {
            console.log('\n==== DATES FOR ALL CITIES ====');
            console.log('Choose date input method:');
            console.log('1. Specify start and end dates (YYYY-MM-DD format)');
            console.log('2. Specify start date and number of months');

            const method = await question(rl, 'Select method (1 or 2): ');

            if (method === '1') {
                const checkin = await question(rl, 'Enter check-in date (YYYY-MM-DD): ');
                const checkout = await question(rl, 'Enter check-out date (YYYY-MM-DD): ');

                console.log(`\n✅ Configuration saved:`);
                console.log(`   Mode: Same dates for all cities`);
                console.log(`   Dates: ${checkin} to ${checkout}`);
                console.log(`   Cities: ${cities.join(', ')}`);

            } else if (method === '2') {
                const checkin = await question(rl, 'Enter check-in date (YYYY-MM-DD): ');
                const months = await question(rl, 'Enter number of months (1-12): ');

                const checkinDate = new Date(checkin);
                const checkoutDate = new Date(checkinDate);
                checkoutDate.setMonth(checkoutDate.getMonth() + parseInt(months));
                const checkout = checkoutDate.toISOString().split('T')[0];

                console.log(`\n✅ Configuration saved:`);
                console.log(`   Mode: Same dates for all cities`);
                console.log(`   Dates: ${checkin} to ${checkout} (${months} months)`);
                console.log(`   Cities: ${cities.join(', ')}`);
            }

        } else if (mode === '2') {
            console.log('\n==== DATES PER CITY ====');
            const configs = [];

            for (const city of cities) {
                console.log(`\nDates for ${city}:`);
                const checkin = await question(rl, `  Check-in date for ${city} (YYYY-MM-DD): `);
                const checkout = await question(rl, `  Check-out date for ${city} (YYYY-MM-DD): `);
                configs.push({ city, checkin, checkout });
            }

            console.log(`\n✅ Configuration saved:`);
            console.log(`   Mode: Different dates per city`);
            configs.forEach(config => {
                console.log(`   ${config.city}: ${config.checkin} to ${config.checkout}`);
            });

        } else if (mode === '3') {
            console.log(`\n✅ Configuration saved:`);
            console.log(`   Mode: Month-based analysis (next month)`);
            console.log(`   Cities: ${cities.join(', ')}`);
        }

        console.log(`\n🚀 Ready to start price analysis!`);
        console.log(`Note: In the real application, this would now proceed to scrape Airbnb data.`);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        rl.close();
    }
}

// Run the demo
demoInteractiveMode().catch(console.error);
