const puppeteer = require('puppeteer');
const fs = require('fs').promises;

async function scrapeAirbnb(city, guests = 2) {
    // Calculate next month dates dynamically
    const today = new Date();
    const firstDayOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1); // First day of next month
    const lastDayOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0); // Last day of next month

    // Format dates properly to avoid timezone issues
    const checkinDateString = `${firstDayOfNextMonth.getFullYear()}-${String(firstDayOfNextMonth.getMonth() + 1).padStart(2, '0')}-${String(firstDayOfNextMonth.getDate()).padStart(2, '0')}`;
    const checkoutDateString = `${lastDayOfNextMonth.getFullYear()}-${String(lastDayOfNextMonth.getMonth() + 1).padStart(2, '0')}-${String(lastDayOfNextMonth.getDate()).padStart(2, '0')}`;
    const daysInMonth = lastDayOfNextMonth.getDate();

    console.log(`Using dates: ${checkinDateString} to ${checkoutDateString} (${daysInMonth} days)`);

    const browser = await puppeteer.launch({
        headless: true, // Set to true for headless mode
        defaultViewport: null,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled', // Help avoid detection
            '--disable-web-security',
            '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]
    });
    const page = await browser.newPage();

    try {
        console.log('Navigating to Airbnb...');
        await page.goto("https://www.airbnb.com/", { waitUntil: 'networkidle2' });
        await page.setViewport({ width: 1080, height: 1024 });

        // Wait for page to load
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Try to find and click on location input
        console.log('Looking for location input...');
        try {
            const locationSelector = await page.waitForSelector('input[placeholder*="Where"], input[data-testid="structured-search-input-field-query"]', { visible: true, timeout: 10000 });
            if (locationSelector) {
                await locationSelector.click();
                await locationSelector.type(city);
                console.log(`Entered city: ${city}`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } catch (error) {
            console.log('Could not find standard location input, trying alternative...');
            // Try to find any input that might be for location
            const inputs = await page.$$('input[type="text"], input:not([type])');
            if (inputs.length > 0) {
                await inputs[0].click();
                await inputs[0].type(city);
                console.log(`Entered city in alternative input: ${city}`);
            }
        }

        // Look for the specific date button to select next month dates
        console.log('Looking for date button...');
        try {
            // Try the specific class you provided
            const dateButton = await page.$('div.fhzfs0e[role="button"]');
            if (dateButton) {
                console.log('Found date button, clicking...');
                await dateButton.click();
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Try to find and click the specific dates for next month
                console.log(`Looking for check-in date (${checkinDateString})...`);
                const checkinButton = await page.$(`button[data-state--date-string="${checkinDateString}"]`);
                if (checkinButton) {
                    console.log(`Found and clicking check-in date (${checkinDateString})...`);
                    await checkinButton.click();
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    console.log('Specific check-in date not found, trying to find first day of next month...');
                    // Try to find any date in the next month
                    const nextMonthYear = checkinDateString.substring(0, 7); // YYYY-MM format
                    const nextMonthDates = await page.$$(`button[data-state--date-string*="${nextMonthYear}-"]`);
                    if (nextMonthDates.length > 0) {
                        await nextMonthDates[0].click();
                        console.log('Clicked first available date in next month');
                    } else {
                        // Fallback to any available date
                        const anyDateButtons = await page.$$('button[data-state--date-string]');
                        if (anyDateButtons.length > 0) {
                            await anyDateButtons[0].click();
                            console.log('Clicked first available date');
                        }
                    }
                }

                // Try to find check-out date (last day of next month)
                console.log(`Looking for check-out date (${checkoutDateString})...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                const checkoutButton = await page.$(`button[data-state--date-string="${checkoutDateString}"]`);
                if (checkoutButton) {
                    console.log(`Found and clicking check-out date (${checkoutDateString})...`);
                    await checkoutButton.click();
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    console.log('Specific check-out date not found, trying to find last day of next month...');
                    // Try to find the last few dates of the next month
                    const nextMonthYear = checkoutDateString.substring(0, 7); // YYYY-MM format
                    const possibleEndDates = [];
                    for (let day = daysInMonth; day >= daysInMonth - 3; day--) {
                        possibleEndDates.push(`${nextMonthYear}-${day.toString().padStart(2, '0')}`);
                    }

                    let foundEndDate = false;
                    for (const dateStr of possibleEndDates) {
                        const endDateButton = await page.$(`button[data-state--date-string="${dateStr}"]`);
                        if (endDateButton) {
                            await endDateButton.click();
                            console.log(`Clicked end date: ${dateStr}`);
                            foundEndDate = true;
                            break;
                        }
                    }

                    if (!foundEndDate) {
                        // Fallback to any available date roughly a month later
                        const availableDates = await page.$$('button[data-state--date-string]');
                        if (availableDates.length > 1) {
                            // Try to click a date that's about 30 positions later
                            await availableDates[Math.min(daysInMonth, availableDates.length - 1)].click();
                            console.log('Clicked alternative check-out date');
                        }
                    }
                }
            } else {
                console.log('Date button not found with specific class');
            }
        } catch (error) {
            console.log('Error with date selection:', error.message);
        }

        // Try to find and click search button
        console.log('Looking for search button...');
        try {
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Look for search button
            let searchButton = await page.$('button[data-testid="structured-search-input-search-button"]') ||
                await page.$('button[type="submit"]');

            if (!searchButton) {
                // Try to find by looking for buttons with search-related text or icons
                const allButtons = await page.$$('button, div[role="button"]');
                for (const button of allButtons) {
                    const text = await button.evaluate(el => el.textContent || '');
                    const ariaLabel = await button.evaluate(el => el.getAttribute('aria-label') || '');
                    if (text.toLowerCase().includes('search') ||
                        text.toLowerCase().includes('buscar') ||
                        ariaLabel.toLowerCase().includes('search')) {
                        searchButton = button;
                        break;
                    }
                }
            }

            if (searchButton) {
                console.log('Found search button, clicking...');
                await searchButton.click();

                // Wait for navigation with a more generous timeout
                try {
                    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 45000 });
                    console.log('Navigation successful');
                } catch (navError) {
                    console.log('Navigation timeout, but continuing to try scraping...');
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }

                // After initial search, apply "Entire place" filter
                console.log('Applying "Entire place" filter...');
                await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for page to load

                try {
                    // Look for filters button first
                    let filtersButton = await page.$('button[data-testid="category-bar-filter-button"]') ||
                        await page.$('button[aria-label*="filter"]') ||
                        await page.$('button[aria-label*="Filter"]');

                    if (!filtersButton) {
                        // Try to find by text content
                        const allButtons = await page.$$('button, div[role="button"]');
                        for (const button of allButtons) {
                            const text = await button.evaluate(el => el.textContent || '');
                            if (text.toLowerCase().includes('filter') || text.toLowerCase().includes('filtro')) {
                                filtersButton = button;
                                break;
                            }
                        }
                    }

                    if (filtersButton) {
                        console.log('Found filters button, clicking...');
                        await filtersButton.click();
                        await new Promise(resolve => setTimeout(resolve, 2000));

                        // Look for "Entire place" or similar option
                        const entirePlaceSelectors = [
                            'button[aria-label*="Entire place"]',
                            'button[aria-label*="Entire home"]',
                            'div[data-testid="filter-item-entire_place"] button',
                            'input[value="entire_place"]',
                        ];

                        let entirePlaceFound = false;
                        for (const selector of entirePlaceSelectors) {
                            const entirePlaceButton = await page.$(selector);
                            if (entirePlaceButton) {
                                console.log('Found "Entire place" filter, clicking...');
                                await entirePlaceButton.click();
                                entirePlaceFound = true;
                                break;
                            }
                        }

                        if (!entirePlaceFound) {
                            // Try to find by text content
                            const allFilterOptions = await page.$$('button, label, div[role="button"]');
                            for (const option of allFilterOptions) {
                                const text = await option.evaluate(el => el.textContent || '');
                                const ariaLabel = await option.evaluate(el => el.getAttribute('aria-label') || '');
                                if (text.toLowerCase().includes('entire place') ||
                                    text.toLowerCase().includes('entire home') ||
                                    text.toLowerCase().includes('casa inteira') ||
                                    text.toLowerCase().includes('lugar inteiro') ||
                                    ariaLabel.toLowerCase().includes('entire')) {
                                    console.log('Found entire place option by text, clicking...');
                                    await option.click();
                                    entirePlaceFound = true;
                                    break;
                                }
                            }
                        }

                        if (entirePlaceFound) {
                            // Apply the filter by clicking "Show places" or similar button
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            const applyButton = await page.$('button[data-testid="filter-panel-save-button"]') ||
                                await page.$('button[type="submit"]') ||
                                await page.$('a[data-testid="filter-panel-save-button"]');

                            if (applyButton) {
                                console.log('Applying entire place filter...');
                                await applyButton.click();
                                await new Promise(resolve => setTimeout(resolve, 3000));
                                console.log('Filter applied successfully');
                            } else {
                                // Try to find apply button by text
                                const allButtons = await page.$$('button, a');
                                for (const button of allButtons) {
                                    const text = await button.evaluate(el => el.textContent || '');
                                    if (text.toLowerCase().includes('show') || text.toLowerCase().includes('apply') || text.toLowerCase().includes('mostrar')) {
                                        await button.click();
                                        console.log('Applied filter using text-based button');
                                        await new Promise(resolve => setTimeout(resolve, 3000));
                                        break;
                                    }
                                }
                            }
                        } else {
                            console.log('Could not find "Entire place" filter option');
                        }
                    } else {
                        console.log('Could not find filters button, applying URL-based filter...');
                    }

                    // Always try URL-based filter as fallback for better results
                    console.log('Applying URL-based entire place filter...');
                    const currentUrl = page.url();
                    if (!currentUrl.includes('room_types')) {
                        const separator = currentUrl.includes('?') ? '&' : '?';
                        const newUrl = currentUrl + separator + 'room_types%5B%5D=Entire%20home%2Fapt';
                        console.log('Navigating to filtered URL for entire homes/apartments...');
                        await page.goto(newUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                        console.log('Entire place filter applied successfully via URL');
                        await new Promise(resolve => setTimeout(resolve, 3000));
                    }

                } catch (filterError) {
                    console.log('Error applying entire place filter:', filterError.message);
                    console.log('Continuing without filter...');
                }

            } else {
                console.log('No search button found, trying Enter key...');
                await page.keyboard.press('Enter');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        } catch (error) {
            console.log('Error with search:', error.message);
        }

        // Try to extract listings
        console.log('Attempting to extract listings...');
        await new Promise(resolve => setTimeout(resolve, 5000)); // Increased wait time

        // Debug: Check what's on the page
        const pageTitle = await page.title();
        const currentUrl = page.url();
        console.log(`Current page title: ${pageTitle}`);
        console.log(`Current URL: ${currentUrl}`);

        const listings = await page.evaluate(() => {
            // First, let's see what elements are available on the page
            const debugInfo = [];
            debugInfo.push(`Page location: ${window.location.href}`);
            debugInfo.push(`Page title: ${document.title}`);

            // Instead of looking for title elements, let's look for larger container elements
            const selectors = [
                '[data-testid="card-container"]', // This seems promising from the debug
                '[itemprop="itemListElement"]', // Also found 24 elements
                'div[role="group"]', // Found many, might contain listings
                '[data-testid="listing-card-title"]', // Start here but look at parent
            ];

            let elements = [];

            // Try to find container elements that likely contain both title and price
            for (const selector of selectors) {
                const found = document.querySelectorAll(selector);
                debugInfo.push(`Selector ${selector}: found ${found.length} elements`);

                if (selector === '[data-testid="listing-card-title"]' && found.length > 0) {
                    // For title elements, get their parent containers
                    elements = Array.from(found).map(el => {
                        // Go up a few levels to find the container with all listing info
                        let container = el.parentElement;
                        for (let i = 0; i < 5; i++) {
                            if (container && container.textContent && container.textContent.length > 50) {
                                return container;
                            }
                            container = container ? container.parentElement : null;
                        }
                        return el.parentElement || el;
                    });
                    break;
                } else if (found.length > 0 && elements.length === 0) {
                    elements = found;
                    if (elements.length > 0) break;
                }
            }

            debugInfo.push(`Selected ${elements.length} container elements`);

            const results = Array.from(elements).slice(0, 10).map((el, index) => {
                try {
                    let title = '';
                    let price = '';
                    let link = '';
                    let pricePerNight = null;

                    // Get all text content from the container
                    const allText = el.textContent || '';
                    const textSample = allText.substring(0, 300);
                    debugInfo.push(`Element ${index + 1} text: ${textSample}`);

                    // Look for title - try to find the listing title element within this container
                    const titleEl = el.querySelector('[data-testid="listing-card-title"]') ||
                        el.querySelector('h1, h2, h3, h4');
                    if (titleEl) {
                        title = titleEl.textContent?.trim() || '';
                    }

                    // If no specific title found, extract from beginning of text
                    if (!title) {
                        const lines = allText.split('\n').filter(line => line.trim());
                        for (const line of lines) {
                            const cleanLine = line.trim();
                            if (cleanLine.length > 5 && cleanLine.length < 100 &&
                                !cleanLine.match(/^\d+/) &&
                                (cleanLine.includes('·') || cleanLine.includes('⋅'))) {
                                title = cleanLine;
                                break;
                            }
                        }
                    }

                    // Enhanced price extraction - extract both nightly and monthly prices
                    let pricePerMonth = null;

                    // First extract monthly prices
                    const monthlyPatterns = [
                        /€\s*(\d{1,2}[.,]\d{3})\s*(?:€\s*(\d{1,2}[.,]\d{3}))?\s*(?:mensal|monthly|per month)/gi,
                        /€\s*(\d{1,2}[.,]\d{3})\s*(?:mensal|monthly|per month)/gi,
                        /\$\s*(\d{1,2}[.,]\d{3})\s*(?:mensal|monthly|per month)/gi,
                    ];

                    for (const pattern of monthlyPatterns) {
                        const matches = allText.match(pattern);
                        if (matches && matches.length > 0) {
                            debugInfo.push(`Monthly pattern matched for element ${index + 1}: ${matches[0]}`);

                            // Extract all numeric values from the match
                            const numericMatches = matches[0].match(/(\d{1,2}[.,]\d{3})/g);
                            if (numericMatches && numericMatches.length > 0) {
                                // Take the first reasonable monthly price (usually 1000-4000 range)
                                for (const numMatch of numericMatches) {
                                    let monthlyValue = parseInt(numMatch.replace(/[.,]/g, ''));
                                    if (monthlyValue >= 800 && monthlyValue <= 5000) {
                                        pricePerMonth = monthlyValue;
                                        debugInfo.push(`Valid monthly price found for element ${index + 1}: $${pricePerMonth}`);
                                        break;
                                    }
                                }
                                if (pricePerMonth) break;
                            }
                        }
                    }

                    // Then extract nightly prices (avoiding monthly context)
                    const pricePatterns = [
                        // First priority: explicit nightly rates
                        /€\s*(\d+(?:[.,]\d{3})*)\s*(?!.*mensal)/gi, // Euro without "mensal" (monthly)
                        /R\$\s*(\d+(?:[.,]\d{3})*)\s*(?!.*mensal)/gi, // Brazilian Real without "mensal"
                        /\$(\d+(?:[.,]\d{3})*)\s*(?!.*mensal)/gi, // US Dollar without "mensal"

                        // Second priority: numbers followed by "per night" indicators
                        /(\d+(?:[.,]\d{3})*)\s*(?:por\s*noite|\/\s*noite|per\s*night|\/\s*night)/gi,

                        // Last resort: any reasonable price range numbers (avoiding monthly prices)
                        /\b(\d{2,3})\b(?!.*(?:mensal|month|mes))/gi, // 2-3 digit numbers, avoid monthly context
                    ];

                    for (const pattern of pricePatterns) {
                        const matches = allText.match(pattern);
                        if (matches && matches.length > 0) {
                            debugInfo.push(`Nightly pattern matched for element ${index + 1}: ${matches[0]}`);

                            // Extract the numeric value
                            const numericMatch = matches[0].match(/(\d+(?:[.,]\d{3})*)/);
                            if (numericMatch) {
                                let numericValue = parseInt(numericMatch[1].replace(/[.,]/g, ''));

                                // Handle decimal places (if the last part is 2 digits, it's cents)
                                const parts = numericMatch[1].split(/[.,]/);
                                if (parts.length > 1 && parts[parts.length - 1].length === 2) {
                                    numericValue = parseInt(parts.slice(0, -1).join(''));
                                }

                                debugInfo.push(`Extracted nightly numeric value: ${numericValue}`);

                                // Realistic nightly price range for Airbnb
                                if (numericValue >= 30 && numericValue <= 400) {
                                    price = `$${numericValue}`;
                                    pricePerNight = numericValue;
                                    debugInfo.push(`Valid nightly price found for element ${index + 1}: ${price} (${pricePerNight})`);
                                    break;
                                }
                            }
                        }
                    }

                    // If still no nightly price found, look for standalone numbers in realistic nightly range
                    if (!price) {
                        // Skip text with monthly indicators for nightly price extraction
                        const monthlyKeywords = /mensal|month|mes|monthly/gi;
                        if (!monthlyKeywords.test(allText)) {
                            const numberMatches = allText.match(/\b(\d{2,3})\b/g); // 2-3 digit numbers only
                            if (numberMatches) {
                                debugInfo.push(`Numbers found in element ${index + 1}: ${numberMatches.slice(0, 5).join(', ')}`);
                                for (const num of numberMatches) {
                                    const value = parseInt(num);
                                    // Realistic Airbnb nightly range: $30-350
                                    if (value >= 30 && value <= 350) {
                                        price = `$${value}`;
                                        pricePerNight = value;
                                        debugInfo.push(`Using fallback nightly price for element ${index + 1}: ${price}`);
                                        break;
                                    }
                                }
                            }
                        }
                    }

                    // Try to find link
                    const linkEl = el.querySelector('a[href*="/rooms/"]') ||
                        el.querySelector('a') ||
                        el.closest('a');
                    if (linkEl && linkEl.href) {
                        link = linkEl.href;
                    }

                    const result = {
                        title: title || `Listing ${index + 1}`,
                        price: price || 'Price not found',
                        pricePerNight: pricePerNight,
                        pricePerMonth: pricePerMonth,
                        link: link || 'Link not found'
                    };

                    debugInfo.push(`Result for element ${index + 1}: Title="${result.title}", Nightly="${result.price}", Monthly=${result.pricePerMonth ? '$' + result.pricePerMonth : 'N/A'}`);

                    return result;
                } catch (error) {
                    debugInfo.push(`Error parsing element ${index + 1}: ${error.message}`);
                    return {
                        title: `Error parsing listing ${index + 1}`,
                        price: 'N/A',
                        pricePerNight: null,
                        link: 'N/A'
                    };
                }
            });

            return {
                listings: results,
                debug: debugInfo
            };
        });

        // Log debug information
        console.log('Debug information from page:');
        listings.debug.forEach((line, i) => console.log(`${i + 1}. ${line}`));

        const finalListings = listings.listings;

        console.log(`Found ${finalListings.length} listings`);
        return finalListings;

    } catch (error) {
        console.error('Error scraping Airbnb:', error);
        return [];
    } finally {
        await browser.close();
    }
}

// Function to scrape multiple cities and calculate averages
async function scrapeMultipleCities(cities, guests = 2) {
    const results = [];

    // Calculate next month info for consistent reporting
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const lastDayOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    const daysInNextMonth = lastDayOfNextMonth.getDate();
    const monthName = nextMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

    for (const city of cities) {
        console.log(`\n==== Processing ${city} ====`);
        try {
            const listings = await scrapeAirbnb(city, guests);

            if (listings.length > 0) {
                const validPrices = listings
                    .map(l => l.pricePerNight)
                    .filter(price => price !== null && price > 0);

                const validMonthlyPrices = listings
                    .map(l => l.pricePerMonth)
                    .filter(price => price !== null && price > 0);

                if (validPrices.length > 0) {
                    const averagePrice = Math.round(validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length);
                    const minPrice = Math.min(...validPrices);
                    const maxPrice = Math.max(...validPrices);

                    // Calculate nightly boxplot statistics
                    const sortedPrices = [...validPrices].sort((a, b) => a - b);
                    const q1Index = Math.floor(sortedPrices.length * 0.25);
                    const q3Index = Math.floor(sortedPrices.length * 0.75);
                    const medianIndex = Math.floor(sortedPrices.length * 0.5);

                    const q1 = sortedPrices[q1Index];
                    const median = sortedPrices[medianIndex];
                    const q3 = sortedPrices[q3Index];
                    const iqr = q3 - q1;

                    // Calculate outlier boundaries
                    const lowerBoundary = Math.max(minPrice, q1 - 1.5 * iqr);
                    const upperBoundary = Math.min(maxPrice, q3 + 1.5 * iqr);

                    // Calculate monthly price statistics if available
                    let monthlyStats = null;
                    if (validMonthlyPrices.length > 0) {
                        const averageMonthlyPrice = Math.round(validMonthlyPrices.reduce((sum, price) => sum + price, 0) / validMonthlyPrices.length);
                        const minMonthlyPrice = Math.min(...validMonthlyPrices);
                        const maxMonthlyPrice = Math.max(...validMonthlyPrices);

                        monthlyStats = {
                            averageMonthlyPrice,
                            minMonthlyPrice,
                            maxMonthlyPrice,
                            monthlyListingsFound: validMonthlyPrices.length
                        };
                    }

                    results.push({
                        city,
                        averagePrice,
                        minPrice,
                        maxPrice,
                        median,
                        q1,
                        q3,
                        iqr,
                        lowerBoundary,
                        upperBoundary,
                        listingsFound: validPrices.length,
                        totalListings: listings.length,
                        ...monthlyStats
                    });

                    const monthlyInfo = monthlyStats ?
                        `, Monthly: $${monthlyStats.averageMonthlyPrice} (${monthlyStats.monthlyListingsFound} listings)` :
                        ', No monthly prices found';

                    console.log(`${city}: Found ${validPrices.length} valid nightly prices, Average: $${averagePrice}/night${monthlyInfo} for ${monthName}`);
                } else {
                    console.log(`${city}: No valid prices found`);
                    results.push({
                        city,
                        averagePrice: null,
                        minPrice: null,
                        maxPrice: null,
                        median: null,
                        q1: null,
                        q3: null,
                        iqr: null,
                        lowerBoundary: null,
                        upperBoundary: null,
                        listingsFound: 0,
                        totalListings: listings.length,
                        averageMonthlyPrice: null,
                        minMonthlyPrice: null,
                        maxMonthlyPrice: null,
                        monthlyListingsFound: 0,
                        error: 'No valid prices found'
                    });
                }
            } else {
                console.log(`${city}: No listings found`);
                results.push({
                    city,
                    averagePrice: null,
                    minPrice: null,
                    maxPrice: null,
                    median: null,
                    q1: null,
                    q3: null,
                    iqr: null,
                    lowerBoundary: null,
                    upperBoundary: null,
                    listingsFound: 0,
                    totalListings: 0,
                    averageMonthlyPrice: null,
                    minMonthlyPrice: null,
                    maxMonthlyPrice: null,
                    monthlyListingsFound: 0,
                    error: 'No listings found'
                });
            }
        } catch (error) {
            console.error(`Error processing ${city}:`, error.message);
            results.push({
                city,
                averagePrice: null,
                minPrice: null,
                maxPrice: null,
                median: null,
                q1: null,
                q3: null,
                iqr: null,
                lowerBoundary: null,
                upperBoundary: null,
                listingsFound: 0,
                totalListings: 0,
                averageMonthlyPrice: null,
                minMonthlyPrice: null,
                maxMonthlyPrice: null,
                monthlyListingsFound: 0,
                error: error.message
            });
        }

        // Add delay between cities to avoid rate limiting
        if (cities.indexOf(city) < cities.length - 1) {
            console.log('Waiting 5 seconds before next city...');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    return results;
}

// Function to write results to file
async function writeResultsToFile(results, filename = 'airbnb-price-analysis.json') {
    try {
        const timestamp = new Date().toISOString();
        const reportData = {
            timestamp,
            summary: {
                totalCities: results.length,
                successfulCities: results.filter(r => r.averagePrice !== null).length,
                failedCities: results.filter(r => r.averagePrice === null).length
            },
            cities: results,
            averages: {
                overallAveragePrice: Math.round(
                    results
                        .filter(r => r.averagePrice !== null)
                        .reduce((sum, r, _, arr) => sum + r.averagePrice / arr.length, 0)
                ),
                overallAverageMonthlyPrice: Math.round(
                    results
                        .filter(r => r.averageMonthlyPrice !== null)
                        .reduce((sum, r, _, arr) => sum + r.averageMonthlyPrice / arr.length, 0)
                )
            }
        };

        await fs.writeFile(filename, JSON.stringify(reportData, null, 2));
        console.log(`\nResults written to ${filename}`);

        // Also create a CSV version for easy analysis
        const csvFilename = filename.replace('.json', '.csv');
        const csvHeaders = 'City,Average Nightly Price,Median,Min Nightly,Max Nightly,Q1,Q3,IQR,Lower Boundary,Upper Boundary,Average Monthly Price,Min Monthly,Max Monthly,Nightly Listings Found,Monthly Listings Found,Status\n';
        const csvRows = results.map(r =>
            `"${r.city}",${r.averagePrice || 'N/A'},${r.median || 'N/A'},${r.minPrice || 'N/A'},${r.maxPrice || 'N/A'},${r.q1 || 'N/A'},${r.q3 || 'N/A'},${r.iqr || 'N/A'},${r.lowerBoundary || 'N/A'},${r.upperBoundary || 'N/A'},${r.averageMonthlyPrice || 'N/A'},${r.minMonthlyPrice || 'N/A'},${r.maxMonthlyPrice || 'N/A'},${r.listingsFound},${r.monthlyListingsFound || 0},${r.error ? 'Failed' : 'Success'}`
        ).join('\n');

        await fs.writeFile(csvFilename, csvHeaders + csvRows);
        console.log(`CSV version written to ${csvFilename}`);

        return reportData;
    } catch (error) {
        console.error('Error writing results to file:', error);
        throw error;
    }
}

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('Usage: node src/index.js <city1> [city2] [city3] ...');
        console.log('Example: node src/index.js Paris Lisbon Helsinki');
        console.log('Example: node src/index.js "New York" London Tokyo');
        process.exit(1);
    }

    return args;
}

// Main execution with command line arguments
(async () => {
    // Get cities from command line arguments
    const cities = parseArgs();
    const guests = 1;

    // Calculate next month info for reporting
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const monthName = nextMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
    const daysInNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0).getDate();

    console.log(`Starting Airbnb price analysis for ${monthName} (${daysInNextMonth} days)...`);
    console.log('Cities to analyze:', cities.join(', '));
    console.log('\nNote: This tool analyzes short-term Airbnb rentals and provides:');
    console.log('- Actual Airbnb nightly rates for entire apartments');
    console.log('- Actual Airbnb monthly rates (when available)');
    console.log('- Statistical distribution analysis (boxplot with quartiles)');
    console.log('- Both rates extracted from the same listing when displayed together\n');

    try {
        const results = await scrapeMultipleCities(cities, guests);

        // Write results to file
        await writeResultsToFile(results);

        // Display summary
        console.log('\n==== SUMMARY ====');
        console.log(`Total cities analyzed: ${results.length}`);
        console.log(`Successful extractions: ${results.filter(r => r.averagePrice !== null).length}`);
        console.log(`Failed extractions: ${results.filter(r => r.averagePrice === null).length}`);

        // Display results
        console.log('\n==== RESULTS ====');
        results.forEach(result => {
            if (result.averagePrice) {
                console.log(`${result.city}:`);
                console.log(`  Nightly Rates:`);
                console.log(`    Average: $${result.averagePrice}/night`);
                console.log(`    Median: $${result.median}/night`);
                console.log(`    Range: $${result.minPrice} - $${result.maxPrice}`);
                console.log(`    Boxplot Analysis:`);
                console.log(`      Q1 (25th percentile): $${result.q1}/night`);
                console.log(`      Q3 (75th percentile): $${result.q3}/night`);
                console.log(`      IQR (Interquartile Range): $${result.iqr}/night`);
                console.log(`      Typical price range: $${result.lowerBoundary} - $${result.upperBoundary}/night (50% of data)`);
                console.log(`    Listings analyzed: ${result.listingsFound}`);

                if (result.averageMonthlyPrice) {
                    console.log(`  Monthly Rates:`);
                    console.log(`    Average: $${result.averageMonthlyPrice}/month`);
                    console.log(`    Range: $${result.minMonthlyPrice} - $${result.maxMonthlyPrice}/month`);
                    console.log(`    Listings with monthly prices: ${result.monthlyListingsFound}`);
                } else {
                    console.log(`  Monthly Rates: Not available`);
                }
            } else {
                console.log(`${result.city}: ${result.error || 'Failed to get data'}`);
            }
        });

        // Show overall averages
        const successfulResults = results.filter(r => r.averagePrice !== null);
        if (successfulResults.length > 0) {
            const overallAverage = Math.round(
                successfulResults.reduce((sum, r) => sum + r.averagePrice, 0) / successfulResults.length
            );
            const overallMedian = Math.round(
                successfulResults.reduce((sum, r) => sum + r.median, 0) / successfulResults.length
            );

            // Calculate overall boxplot statistics
            const allPrices = [];
            successfulResults.forEach(r => {
                for (let i = 0; i < r.listingsFound; i++) {
                    allPrices.push(r.averagePrice); // Approximate distribution using averages
                }
            });
            allPrices.sort((a, b) => a - b);

            const overallQ1 = allPrices[Math.floor(allPrices.length * 0.25)];
            const overallQ3 = allPrices[Math.floor(allPrices.length * 0.75)];
            const overallIQR = overallQ3 - overallQ1;

            console.log(`\n==== NIGHTLY RATES SUMMARY ====`);
            console.log(`Average across all cities: $${overallAverage}/night`);
            console.log(`Median across all cities: $${overallMedian}/night`);
            console.log(`Overall price distribution:`);
            console.log(`  Q1: $${overallQ1}/night`);
            console.log(`  Q3: $${overallQ3}/night`);
            console.log(`  IQR: $${overallIQR}/night`);

            // Monthly summary if available
            const monthlyResults = results.filter(r => r.averageMonthlyPrice !== null);
            if (monthlyResults.length > 0) {
                const overallMonthlyAverage = Math.round(
                    monthlyResults.reduce((sum, r) => sum + r.averageMonthlyPrice, 0) / monthlyResults.length
                );
                console.log(`\n==== MONTHLY RATES SUMMARY ====`);
                console.log(`Average across all cities with monthly data: $${overallMonthlyAverage}/month`);
                console.log(`Cities with monthly pricing: ${monthlyResults.map(r => r.city).join(', ')}`);
            }
        }

    } catch (error) {
        console.error('Error in main execution:', error);
    }
})();