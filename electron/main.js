const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;

// Import the scraping logic from the working index.js scraper
const { scrapeMultipleCities } = require('../src/index.js');

let mainWindow;

function createWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        },
        show: false // Don't show until ready
    });

    // Load the HTML file
    mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Open DevTools in development
    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// App event listeners
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// IPC handlers for communication with renderer process
ipcMain.handle('start-analysis', async (event, config) => {
    try {
        const { cities } = config;

        // Send progress updates back to renderer
        const sendProgress = (message) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('analysis-progress', message);
            }
        };

        sendProgress('Starting analysis...');

        // Prepare date configurations based on the selected mode
        let dateConfigs;
        if (config.mode === 'specific-all') {
            dateConfigs = {
                mode: 'specific',
                checkin: config.checkin,
                checkout: config.checkout
            };
        } else if (config.mode === 'specific-per-city') {
            dateConfigs = config.cityDates;
        } else {
            // Month mode
            dateConfigs = {
                mode: 'month',
                month: config.month
            };
        }

        sendProgress(`Analyzing ${cities.length} cities...`);

        // Run the scraping analysis
        const results = await scrapeMultipleCities(cities, dateConfigs, 1, sendProgress);

        sendProgress('Analysis complete!');

        return {
            success: true,
            results: results,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('Analysis error:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

ipcMain.handle('save-results', async (event, { results, format }) => {
    try {
        const { filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Save Analysis Results',
            defaultPath: `airbnb-analysis-${new Date().toISOString().split('T')[0]}.${format}`,
            filters: format === 'json' ?
                [{ name: 'JSON Files', extensions: ['json'] }] :
                [{ name: 'CSV Files', extensions: ['csv'] }]
        });

        if (filePath) {
            let content;
            if (format === 'json') {
                content = JSON.stringify(results, null, 2);
            } else {
                // Convert to CSV
                const headers = 'City,Average Nightly Price,Median,Min Nightly,Max Nightly,Q1,Q3,IQR,Lower Boundary,Upper Boundary,Average Monthly Price,Min Monthly,Max Monthly,Nightly Listings Found,Monthly Listings Found,Total Cost Average,Total Cost Range,Nights,Status\n';
                const rows = results.cities.map(r =>
                    `"${r.city}",${r.averagePrice || 'N/A'},${r.median || 'N/A'},${r.minPrice || 'N/A'},${r.maxPrice || 'N/A'},${r.q1 || 'N/A'},${r.q3 || 'N/A'},${r.iqr || 'N/A'},${r.lowerBoundary || 'N/A'},${r.upperBoundary || 'N/A'},${r.averageMonthlyPrice || 'N/A'},${r.minMonthlyPrice || 'N/A'},${r.maxMonthlyPrice || 'N/A'},${r.listingsFound},${r.monthlyListingsFound || 0},${r.totalCost ? r.totalCost.average : 'N/A'},${r.totalCost ? `${r.totalCost.min}-${r.totalCost.max}` : 'N/A'},${r.totalCost ? r.totalCost.nights : 'N/A'},${r.error ? 'Failed' : 'Success'}`
                ).join('\n');
                content = headers + rows;
            }

            await fs.writeFile(filePath, content);
            return { success: true, filePath };
        }

        return { success: false, cancelled: true };

    } catch (error) {
        console.error('Save error:', error);
        return { success: false, error: error.message };
    }
});

// Handle app updates and other system events
ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

ipcMain.handle('show-about', () => {
    dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'About Airbnb Price Analyzer',
        message: 'Airbnb Price Analyzer',
        detail: `Version: ${app.getVersion()}\n\nA desktop application for analyzing Airbnb prices across multiple cities.\n\nCreated by Victor Vargas`,
        buttons: ['OK']
    });
});
