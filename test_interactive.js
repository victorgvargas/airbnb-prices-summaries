// Test script to simulate interactive mode
const { spawn } = require('child_process');

const child = spawn('node', ['src/index.js', '--interactive', 'Valencia'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: __dirname
});

// Simulate user input
setTimeout(() => {
    child.stdin.write('1\n'); // Mode 1: Same dates for all cities
}, 1000);

setTimeout(() => {
    child.stdin.write('1\n'); // Method 1: Specific start and end dates
}, 2000);

setTimeout(() => {
    child.stdin.write('2026-03-15\n'); // Check-in date
}, 3000);

setTimeout(() => {
    child.stdin.write('2026-03-20\n'); // Check-out date
}, 4000);

child.stdout.on('data', (data) => {
    console.log(data.toString());
});

child.stderr.on('data', (data) => {
    console.error(data.toString());
});

child.on('close', (code) => {
    console.log(`Process exited with code ${code}`);
});

// Kill after 60 seconds to prevent hanging
setTimeout(() => {
    child.kill();
}, 60000);
