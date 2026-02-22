#!/usr/bin/env node

// Demo of the new total cost calculation feature
console.log('=== TOTAL COST CALCULATION DEMO ===\n');

// Simulate interactive mode results
const mockResults = [
    {
        city: "Barcelona",
        averagePrice: 85,
        minPrice: 65,
        maxPrice: 120,
        totalCost: {
            average: 595,  // 7 nights × $85
            min: 455,      // 7 nights × $65  
            max: 840,      // 7 nights × $120
            nights: 7
        }
    },
    {
        city: "Valencia",
        averagePrice: 72,
        minPrice: 55,
        maxPrice: 95,
        totalCost: {
            average: 360,  // 5 nights × $72
            min: 275,      // 5 nights × $55
            max: 475,      // 5 nights × $95
            nights: 5
        }
    }
];

console.log('Interactive Mode Results with Total Cost Calculations:\n');

mockResults.forEach(result => {
    console.log(`${result.city}:`);
    console.log(`  Nightly Rates:`);
    console.log(`    Average: $${result.averagePrice}/night`);
    console.log(`    Range: $${result.minPrice} - $${result.maxPrice}`);

    if (result.totalCost) {
        console.log(`  Total Stay Cost (${result.totalCost.nights} nights):`);
        console.log(`    Average total: $${result.totalCost.average}`);
        console.log(`    Range: $${result.totalCost.min} - $${result.totalCost.max}`);
        console.log(`    Breakdown: ${result.totalCost.nights} nights × $${result.averagePrice} average = $${result.totalCost.average}`);
    }
    console.log('');
});

console.log('✅ Total cost calculations help with:');
console.log('   • Budget planning for specific trips');
console.log('   • Comparing costs across different cities');
console.log('   • Understanding price variations for entire stays');
console.log('   • Making informed decisions about trip duration');
