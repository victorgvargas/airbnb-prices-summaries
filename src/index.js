const puppeteer = require('puppeteer');
const fs = require('fs').promises;

async function scrapeAirbnb(city, dateConfig, progressCallback = null) {
    let checkinDateString, checkoutDateString, daysInStay;

    if (dateConfig.mode === 'specific') {
        // Use specific dates provided
        checkinDateString = dateConfig.checkin;
        checkoutDateString = dateConfig.checkout;
        const checkinDate = new Date(dateConfig.checkin);
        const checkoutDate = new Date(dateConfig.checkout);
        daysInStay = Math.ceil((checkoutDate - checkinDate) / (1000 * 60 * 60 * 24));
    } else {
        // Use month-based calculation (existing logic)
        const targetMonth = dateConfig.month;
        const today = new Date();
        const currentYear = today.getFullYear();

        // Determine the year for the target month
        const targetYear = targetMonth <= today.getMonth() + 1 ? currentYear + 1 : currentYear;

        // Create first and last day of target month
        const firstDayOfTargetMonth = new Date(targetYear, targetMonth - 1, 1); // month is 0-indexed
        const lastDayOfTargetMonth = new Date(targetYear, targetMonth, 0); // day 0 = last day of previous month

        // Format dates properly to avoid timezone issues
        checkinDateString = `${firstDayOfTargetMonth.getFullYear()}-${String(firstDayOfTargetMonth.getMonth() + 1).padStart(2, '0')}-${String(firstDayOfTargetMonth.getDate()).padStart(2, '0')}`;
        checkoutDateString = `${lastDayOfTargetMonth.getFullYear()}-${String(lastDayOfTargetMonth.getMonth() + 1).padStart(2, '0')}-${String(lastDayOfTargetMonth.getDate()).padStart(2, '0')}`;
        daysInStay = lastDayOfTargetMonth.getDate();
    }

    console.log(`Using dates: ${checkinDateString} to ${checkoutDateString} (${daysInStay} days)`);

    if (progressCallback) {
        progressCallback(`🌐 Launching browser for ${city}...`);
    }

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
        if (progressCallback) {
            progressCallback(`🔍 Navigating to Airbnb for ${city}...`);
        }
        console.log('Navigating to Airbnb...');
        await page.goto("https://www.airbnb.com/", { waitUntil: 'networkidle2' });
        await page.setViewport({ width: 1920, height: 1080 });

        // Wait for page to load
        await new Promise(resolve => setTimeout(resolve, 3000));

        if (progressCallback) {
            progressCallback(`📍 Entering location: ${city}...`);
        }

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
        if (progressCallback) {
            progressCallback(`📅 Setting dates for ${city}...`);
        }
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
        if (progressCallback) {
            progressCallback(`🔍 Performing search for ${city}...`);
        }
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
                if (progressCallback) {
                    progressCallback(`🏠 Applying "Entire place" filter for ${city}...`);
                }
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
        if (progressCallback) {
            progressCallback(`📋 Extracting listings from ${city}...`);
        }
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

                    // Enhanced price extraction - handle both total and nightly prices correctly
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

                    // Extract stay duration from the text and URL to help identify total vs nightly prices
                    let stayNights = null;

                    // First, try to extract from URL parameters if available
                    const urlParams = window.location.search;
                    const checkinMatch = urlParams.match(/checkin=(\d{4}-\d{2}-\d{2})/);
                    const checkoutMatch = urlParams.match(/checkout=(\d{4}-\d{2}-\d{2})/);

                    if (checkinMatch && checkoutMatch) {
                        const checkinDate = new Date(checkinMatch[1]);
                        const checkoutDate = new Date(checkoutMatch[1]);
                        const timeDiff = checkoutDate.getTime() - checkinDate.getTime();
                        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
                        if (daysDiff > 0 && daysDiff <= 31) {
                            stayNights = daysDiff;
                            debugInfo.push(`Extracted stay duration from URL for element ${index + 1}: ${stayNights} nights`);
                        }
                    }

                    // If not found in URL, look for explicit night counts in text
                    if (!stayNights) {
                        const nightPatterns = [
                            /por\s+(\d{1,2})\s+noites?/gi,
                            /(\d{1,2})\s+nights?/gi,
                            /(\d{1,2})\s+noites?/gi
                        ];

                        for (const pattern of nightPatterns) {
                            const match = allText.match(pattern);
                            if (match) {
                                const nights = parseInt(match[0].match(/\d{1,2}/)[0]);
                                if (nights >= 1 && nights <= 31) {
                                    stayNights = nights;
                                    debugInfo.push(`Found stay duration in text for element ${index + 1}: ${stayNights} nights`);
                                    break;
                                }
                            }
                        }
                    }

                    // Now extract prices more intelligently
                    let foundTotalPrice = false;

                    // First, look for total prices (handle both large amounts with thousands separators and smaller amounts)
                    const totalPricePatterns = [
                        /Total\s*€\s*(\d{1,3}(?:[.,]\d{3})*)/gi, // Total € 1,234 or Total € 317
                        /Total:\s*€\s*(\d{1,3}(?:[.,]\d{3})*)/gi, // Total: € 1,234 or Total: € 317
                        /€\s*(\d{1,3}(?:[.,]\d{3})*)\s*€\s*(\d{1,3}(?:[.,]\d{3})*)/gi, // Two prices: € 359 € 330
                        /€\s*(\d{1,3}(?:[.,]\d{3})*)\s+Mostrar\s+detalhamento/gi, // € 317 Mostrar detalhamento
                        /€\s*(\d{1,3}(?:[.,]\d{3})*)\s+por\s+\d{1,2}\s+noites?/gi // € 317 por 14 noites (total for X nights)
                    ];

                    for (const pattern of totalPricePatterns) {
                        const matches = [...allText.matchAll(pattern)];
                        if (matches.length > 0) {
                            debugInfo.push(`Total price pattern matched for element ${index + 1}: ${matches[0][0]}`);

                            // Extract numeric value(s)
                            let totalValue = null;

                            if (matches[0][1] && matches[0][2]) {
                                // Two prices - take the lower one (discounted price)
                                const price1 = parseFloat(matches[0][1].replace(/,/g, ''));
                                const price2 = parseFloat(matches[0][2].replace(/,/g, ''));
                                totalValue = Math.min(price1, price2);
                                debugInfo.push(`Two total prices found: €${price1} and €${price2}, using €${totalValue}`);
                            } else if (matches[0][1]) {
                                totalValue = parseFloat(matches[0][1].replace(/,/g, ''));
                                debugInfo.push(`Single total price found: €${totalValue}`);
                            }

                            // Adjust the minimum threshold for different regions (Bangkok/Thailand has lower prices)
                            const minTotalPrice = 100; // Lower threshold for budget destinations
                            const maxTotalPrice = 8000; // Keep reasonable upper limit

                            if (totalValue && totalValue >= minTotalPrice && totalValue <= maxTotalPrice) {
                                // This looks like a total price, convert to nightly if we know the nights
                                if (stayNights && stayNights > 0) {
                                    pricePerNight = Math.round(totalValue / stayNights);
                                    price = `$${pricePerNight}`;
                                    debugInfo.push(`Calculated nightly price: €${totalValue} ÷ ${stayNights} nights = $${pricePerNight}/night`);
                                    foundTotalPrice = true;
                                    break;
                                } else {
                                    // Use a more accurate estimate based on typical booking patterns
                                    // Most Airbnb bookings are 3-14 nights, with 7-10 being most common
                                    let estimatedNights = 10; // Default estimate

                                    // Adjust estimate based on price range (higher prices suggest shorter stays)
                                    if (totalValue >= 2000) estimatedNights = 8; // Expensive = likely shorter
                                    else if (totalValue <= 800) estimatedNights = 12; // Cheaper = likely longer

                                    const estimatedNightly = Math.round(totalValue / estimatedNights);
                                    if (estimatedNightly >= 30 && estimatedNightly <= 400) {
                                        pricePerNight = estimatedNightly;
                                        price = `$${pricePerNightly}`;
                                        debugInfo.push(`Estimated nightly price from total €${totalValue}: ~$${pricePerNight}/night (÷${estimatedNights} estimate)`);
                                        foundTotalPrice = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }

                    // If no total price found, look for explicit nightly prices
                    if (!foundTotalPrice && !price) {
                        const nightlyPatterns = [
                            // Explicit per-night indicators
                            /€\s*(\d{1,3})\s*(?:por\s*noite|\/\s*noite|per\s*night|\/\s*night)/gi,
                            /\$\s*(\d{1,3})\s*(?:por\s*noite|\/\s*noite|per\s*night|\/\s*night)/gi,

                            // Small amounts that are likely nightly (not totals)
                            /€\s*(\d{2,3})\b(?!\s*€)(?!.*(?:Total|total|mensal|month))/gi, // 2-3 digits, standalone, not followed by another price or total indicator
                            /\$\s*(\d{2,3})\b(?!\s*\$)(?!.*(?:Total|total|mensal|month))/gi
                        ];

                        for (const pattern of nightlyPatterns) {
                            const matches = allText.match(pattern);
                            if (matches && matches.length > 0) {
                                debugInfo.push(`Nightly price pattern matched for element ${index + 1}: ${matches[0]}`);

                                // Extract the numeric value
                                const numericMatch = matches[0].match(/(\d{1,3})/);
                                if (numericMatch) {
                                    const nightlyValue = parseInt(numericMatch[1]);
                                    debugInfo.push(`Extracted nightly value: ${nightlyValue}`);

                                    // Realistic nightly price range
                                    if (nightlyValue >= 30 && nightlyValue <= 400) {
                                        price = `$${nightlyValue}`;
                                        pricePerNight = nightlyValue;
                                        debugInfo.push(`Valid nightly price found for element ${index + 1}: ${price}`);
                                        break;
                                    }
                                }
                            }
                        }
                    }

                    // Fallback: look for small standalone numbers that could be nightly rates
                    if (!price) {
                        const numberMatches = allText.match(/\b(\d{2,3})\b/g);
                        if (numberMatches) {
                            debugInfo.push(`Fallback numbers found in element ${index + 1}: ${numberMatches.slice(0, 5).join(', ')}`);

                            // Filter out numbers that appear in date contexts or total price contexts
                            const contextFilter = /\b\d{1,2}\s*(de\s*mar|mar|march|april|abr|€|Total)/gi;
                            if (!contextFilter.test(allText)) {
                                for (const num of numberMatches) {
                                    const value = parseInt(num);
                                    // Conservative nightly range
                                    if (value >= 50 && value <= 300) {
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
async function scrapeMultipleCities(cities, dateConfigs, maxConcurrent = 1, progressCallback = null) {
    const results = [];

    for (let i = 0; i < cities.length; i++) {
        const city = cities[i];
        let dateConfig;

        // Handle different dateConfigs formats for Electron compatibility
        if (typeof dateConfigs === 'object' && dateConfigs.mode) {
            // Same config for all cities
            dateConfig = dateConfigs;
        } else if (Array.isArray(dateConfigs)) {
            // Different config per city
            dateConfig = dateConfigs[i];
        } else {
            // Legacy format
            dateConfig = dateConfigs;
        }

        if (progressCallback) {
            progressCallback(`\n==== Processing ${city} (${i + 1}/${cities.length}) ====`);
        }
        console.log(`\n==== Processing ${city} ====`);

        try {
            const listings = await scrapeAirbnb(city, dateConfig, progressCallback);

            if (progressCallback) {
                progressCallback(`📊 Analyzing ${city} data...`);
            }

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

                    // Calculate monthly price statistics for ALL listings
                    // Combine explicit monthly prices with calculated ones (with 20% discount)
                    const allMonthlyPrices = [];
                    let explicitMonthlyCount = 0;
                    let calculatedMonthlyCount = 0;

                    listings.forEach(listing => {
                        if (listing.pricePerMonth && listing.pricePerMonth > 0) {
                            // Use explicit monthly price when available
                            allMonthlyPrices.push(listing.pricePerMonth);
                            explicitMonthlyCount++;
                        } else if (listing.pricePerNight && listing.pricePerNight > 0) {
                            // Calculate monthly price from nightly with 20% discount
                            const calculatedMonthly = Math.round(listing.pricePerNight * 30 * 0.8); // 20% discount
                            allMonthlyPrices.push(calculatedMonthly);
                            calculatedMonthlyCount++;
                        }
                    });

                    let monthlyStats = null;
                    if (allMonthlyPrices.length > 0) {
                        const averageMonthlyPrice = Math.round(allMonthlyPrices.reduce((sum, price) => sum + price, 0) / allMonthlyPrices.length);
                        const minMonthlyPrice = Math.min(...allMonthlyPrices);
                        const maxMonthlyPrice = Math.max(...allMonthlyPrices);

                        monthlyStats = {
                            averageMonthlyPrice,
                            minMonthlyPrice,
                            maxMonthlyPrice,
                            monthlyListingsFound: explicitMonthlyCount,
                            calculatedMonthlyListings: calculatedMonthlyCount,
                            totalMonthlyListings: allMonthlyPrices.length,
                            hasCalculatedPrices: calculatedMonthlyCount > 0,
                            hasExplicitPrices: explicitMonthlyCount > 0
                        };
                    }

                    // Calculate nights count and total cost for specific date ranges
                    let stayNights = 0;
                    let totalCost = null;
                    if (dateConfig.mode === 'specific') {
                        const checkinDate = new Date(dateConfig.checkin);
                        const checkoutDate = new Date(dateConfig.checkout);
                        stayNights = Math.ceil((checkoutDate - checkinDate) / (1000 * 60 * 60 * 24));
                        totalCost = {
                            average: Math.round(averagePrice * stayNights),
                            min: Math.round(minPrice * stayNights),
                            max: Math.round(maxPrice * stayNights),
                            nights: stayNights
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
                        totalCost, // Add total cost calculation
                        ...monthlyStats
                    });

                    const monthlyInfo = monthlyStats ?
                        `, Monthly: $${monthlyStats.averageMonthlyPrice} (${monthlyStats.monthlyListingsFound} listings)` :
                        ', No monthly prices found';

                    // Generate date range description for this city
                    let dateDescription;
                    let displayNights = 0;
                    if (dateConfig.mode === 'specific') {
                        const checkinDate = new Date(dateConfig.checkin);
                        const checkoutDate = new Date(dateConfig.checkout);
                        displayNights = Math.ceil((checkoutDate - checkinDate) / (1000 * 60 * 60 * 24));
                        dateDescription = `${dateConfig.checkin} to ${dateConfig.checkout} (${displayNights} nights)`;
                    } else {
                        const today = new Date();
                        const currentYear = today.getFullYear();
                        const targetYear = dateConfig.month <= today.getMonth() + 1 ? currentYear + 1 : currentYear;
                        const targetDate = new Date(targetYear, dateConfig.month - 1, 1);
                        const lastDayOfTargetMonth = new Date(targetYear, dateConfig.month, 0);
                        displayNights = lastDayOfTargetMonth.getDate();
                        dateDescription = targetDate.toLocaleString('default', { month: 'long', year: 'numeric' });
                    }

                    // Calculate total cost for the stay period (for interactive mode with specific dates)
                    let totalCostInfo = '';
                    if (dateConfig.mode === 'specific' && displayNights > 0) {
                        const totalCost = Math.round(averagePrice * displayNights);
                        totalCostInfo = ` | Total stay cost: ~$${totalCost} (${displayNights} nights × $${averagePrice})`;
                    }

                    const successMessage = `${city}: Found ${validPrices.length} valid nightly prices, Average: $${averagePrice}/night${monthlyInfo} for ${dateDescription}${totalCostInfo}`;
                    console.log(successMessage);
                    if (progressCallback) {
                        progressCallback(`✅ ${city}: Found ${validPrices.length} prices, Average: $${averagePrice}/night`);
                    }
                } else {
                    console.log(`${city}: No valid prices found`);
                    if (progressCallback) {
                        progressCallback(`⚠️ ${city}: Found listings but no valid prices`);
                    }
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
                if (progressCallback) {
                    progressCallback(`❌ ${city}: No listings found`);
                }
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
            if (progressCallback) {
                progressCallback(`❌ ${city}: ${error.message}`);
            }
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
            const waitMessage = 'Waiting 5 seconds before next city...';
            console.log(waitMessage);
            if (progressCallback) {
                progressCallback(`⏳ ${waitMessage}`);
            }
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    // Return Electron-compatible format
    return {
        cities: results,
        summary: {
            totalCities: cities.length,
            successfulCities: results.filter(r => !r.error).length,
            failedCities: results.filter(r => r.error).length
        }
    };
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
        const csvHeaders = 'City,Average Nightly Price,Median,Min Nightly,Max Nightly,Q1,Q3,IQR,Lower Boundary,Upper Boundary,Average Monthly Price,Min Monthly,Max Monthly,Nightly Listings Found,Monthly Listings Found,Total Cost Average,Total Cost Range,Nights,Status\n';
        const csvRows = results.map(r =>
            `"${r.city}",${r.averagePrice || 'N/A'},${r.median || 'N/A'},${r.minPrice || 'N/A'},${r.maxPrice || 'N/A'},${r.q1 || 'N/A'},${r.q3 || 'N/A'},${r.iqr || 'N/A'},${r.lowerBoundary || 'N/A'},${r.upperBoundary || 'N/A'},${r.averageMonthlyPrice || 'N/A'},${r.minMonthlyPrice || 'N/A'},${r.maxMonthlyPrice || 'N/A'},${r.listingsFound},${r.monthlyListingsFound || 0},${r.totalCost ? r.totalCost.average : 'N/A'},${r.totalCost ? `${r.totalCost.min}-${r.totalCost.max}` : 'N/A'},${r.totalCost ? r.totalCost.nights : 'N/A'},${r.error ? 'Failed' : 'Success'}`
        ).join('\n');

        await fs.writeFile(csvFilename, csvHeaders + csvRows);
        console.log(`CSV version written to ${csvFilename}`);

        return reportData;
    } catch (error) {
        console.error('Error writing results to file:', error);
        throw error;
    }
}

// Interactive date selection functions
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

function isValidDate(dateString) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;

    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return date instanceof Date && !isNaN(date) && date >= today;
}

async function getDateSelectionMode(rl) {
    console.log('\n==== DATE SELECTION MODE ====');
    console.log('1. Same dates for all cities (enter start/end dates or number of months)');
    console.log('2. Different dates per city (specify dates for each city individually)');
    console.log('3. Use month parameter (original functionality)');

    let mode;
    while (true) {
        const answer = await question(rl, 'Select mode (1, 2, or 3): ');
        if (['1', '2', '3'].includes(answer)) {
            mode = parseInt(answer);
            break;
        }
        console.log('Please enter 1, 2, or 3');
    }

    return mode;
}

async function getSpecificDatesForAllCities(rl) {
    console.log('\n==== DATES FOR ALL CITIES ====');
    console.log('Choose date input method:');
    console.log('1. Specify start and end dates (YYYY-MM-DD format)');
    console.log('2. Specify start date and number of months');

    let method;
    while (true) {
        const answer = await question(rl, 'Select method (1 or 2): ');
        if (['1', '2'].includes(answer)) {
            method = parseInt(answer);
            break;
        }
        console.log('Please enter 1 or 2');
    }

    if (method === 1) {
        // Specific start and end dates
        let checkin, checkout;

        while (true) {
            checkin = await question(rl, 'Enter check-in date (YYYY-MM-DD): ');
            if (isValidDate(checkin)) break;
            console.log('Invalid date. Please use YYYY-MM-DD format and ensure date is today or in the future.');
        }

        while (true) {
            checkout = await question(rl, 'Enter check-out date (YYYY-MM-DD): ');
            if (isValidDate(checkout) && new Date(checkout) > new Date(checkin)) break;
            console.log('Invalid date. Check-out must be after check-in date and use YYYY-MM-DD format.');
        }

        return { mode: 'specific', checkin, checkout };

    } else {
        // Start date and number of months
        let checkin, months;

        while (true) {
            checkin = await question(rl, 'Enter check-in date (YYYY-MM-DD): ');
            if (isValidDate(checkin)) break;
            console.log('Invalid date. Please use YYYY-MM-DD format and ensure date is today or in the future.');
        }

        while (true) {
            const monthsInput = await question(rl, 'Enter number of months (1-12): ');
            months = parseInt(monthsInput);
            if (months >= 1 && months <= 12) break;
            console.log('Please enter a number between 1 and 12');
        }

        const checkinDate = new Date(checkin);
        const checkoutDate = new Date(checkinDate);
        checkoutDate.setMonth(checkoutDate.getMonth() + months);

        const checkout = checkoutDate.toISOString().split('T')[0];

        return { mode: 'specific', checkin, checkout };
    }
}

async function getSpecificDatesPerCity(rl, cities) {
    console.log('\n==== DATES PER CITY ====');
    const dateConfigs = [];

    for (const city of cities) {
        console.log(`\nDates for ${city}:`);
        let checkin, checkout;

        while (true) {
            checkin = await question(rl, `  Check-in date for ${city} (YYYY-MM-DD): `);
            if (isValidDate(checkin)) break;
            console.log('  Invalid date. Please use YYYY-MM-DD format and ensure date is today or in the future.');
        }

        while (true) {
            checkout = await question(rl, `  Check-out date for ${city} (YYYY-MM-DD): `);
            if (isValidDate(checkout) && new Date(checkout) > new Date(checkin)) break;
            console.log('  Invalid date. Check-out must be after check-in date and use YYYY-MM-DD format.');
        }

        dateConfigs.push({ mode: 'specific', checkin, checkout });
    }

    return dateConfigs;
}

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);

    // Check for help flags
    if (args.includes('--help') || args.includes('-h')) {
        console.log('Usage: node src/index.js [options] <city1> [city2] [city3] ...');
        console.log('');
        console.log('Options:');
        console.log('  --month <1-12>    Month to analyze (1=January, 12=December)');
        console.log('                    Must be greater than current month');
        console.log('                    Defaults to next month if not specified');
        console.log('  --interactive     Enable interactive date selection mode');
        console.log('  --help, -h        Show this help message');
        console.log('');
        console.log('Examples:');
        console.log('  node src/index.js Paris Lisbon Helsinki');
        console.log('  node src/index.js "New York" London Tokyo --month 6');
        console.log('  node src/index.js Barcelona --month 12');
        console.log('  node src/index.js --interactive "New York" Paris Tokyo');
        console.log('');
        console.log('Interactive Mode:');
        console.log('  When --interactive is used, you will be prompted to select:');
        console.log('  - Same dates for all cities, or different dates per city');
        console.log('  - Specific start/end dates or start date + duration');
        process.exit(0);
    }

    if (args.length === 0) {
        console.log('Usage: node src/index.js [options] <city1> [city2] [city3] ...');
        console.log('Use --help for more information');
        process.exit(0);
    }

    // Parse cities, month option, and interactive flag
    const cities = [];
    let targetMonth = null;
    let interactive = false;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--month') {
            if (i + 1 >= args.length) {
                console.error('Error: --month option requires a value (1-12)');
                process.exit(1);
            }
            const monthValue = parseInt(args[i + 1]);
            if (isNaN(monthValue) || monthValue < 1 || monthValue > 12) {
                console.error('Error: Month must be a number between 1 and 12');
                process.exit(1);
            }

            const currentMonth = new Date().getMonth() + 1; // getMonth() is 0-indexed
            if (monthValue <= currentMonth) {
                console.error(`Error: Target month (${monthValue}) must be greater than current month (${currentMonth})`);
                process.exit(1);
            }

            targetMonth = monthValue;
            i++; // Skip the next argument (month value)
        } else if (args[i] === '--interactive') {
            interactive = true;
        } else {
            cities.push(args[i]);
        }
    }

    if (cities.length === 0) {
        console.error('Error: At least one city must be specified');
        process.exit(1);
    }

    // Default to next month if not specified and not interactive
    if (targetMonth === null && !interactive) {
        const currentMonth = new Date().getMonth() + 1;
        targetMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    }

    return { cities, targetMonth, interactive };
}

// Main execution with command line arguments - only run if this file is executed directly
if (require.main === module) {
    (async () => {
        // Get cities, target month, and interactive flag from command line arguments
        const { cities, targetMonth, interactive } = parseArgs();
        const guests = 1;
        let dateConfigs;

        if (interactive) {
            // Interactive mode - prompt user for date selection
            const rl = createReadlineInterface();

            try {
                const mode = await getDateSelectionMode(rl);

                if (mode === 1) {
                    // Same dates for all cities
                    const dateConfig = await getSpecificDatesForAllCities(rl);
                    dateConfigs = dateConfig; // Same config for all cities
                    console.log(`\nUsing dates: ${dateConfig.checkin} to ${dateConfig.checkout} for all cities`);
                } else if (mode === 2) {
                    // Different dates per city
                    dateConfigs = await getSpecificDatesPerCity(rl, cities);
                    console.log('\nUsing different dates for each city');
                } else {
                    // Mode 3: Use month parameter
                    if (!targetMonth) {
                        const currentMonth = new Date().getMonth() + 1;
                        const defaultMonth = currentMonth === 12 ? 1 : currentMonth + 1;
                        dateConfigs = { mode: 'month', month: defaultMonth };
                    } else {
                        dateConfigs = { mode: 'month', month: targetMonth };
                    }
                }
            } finally {
                rl.close();
            }
        } else {
            // Non-interactive mode - use month parameter
            dateConfigs = { mode: 'month', month: targetMonth };
        }

        // Calculate display info
        let displayInfo;
        if (Array.isArray(dateConfigs)) {
            displayInfo = 'custom date ranges per city';
        } else if (dateConfigs.mode === 'specific') {
            const checkinDate = new Date(dateConfigs.checkin);
            const checkoutDate = new Date(dateConfigs.checkout);
            const days = Math.ceil((checkoutDate - checkinDate) / (1000 * 60 * 60 * 24));
            displayInfo = `${dateConfigs.checkin} to ${dateConfigs.checkout} (${days} days)`;
        } else {
            // Month mode
            const today = new Date();
            const currentYear = today.getFullYear();
            const targetYear = dateConfigs.month <= today.getMonth() + 1 ? currentYear + 1 : currentYear;
            const targetDate = new Date(targetYear, dateConfigs.month - 1, 1);
            const lastDayOfTargetMonth = new Date(targetYear, dateConfigs.month, 0);
            const daysInTargetMonth = lastDayOfTargetMonth.getDate();
            const monthName = targetDate.toLocaleString('default', { month: 'long', year: 'numeric' });
            displayInfo = `${monthName} (${daysInTargetMonth} days)`;
        }

        console.log(`Starting Airbnb price analysis for ${displayInfo}...`);
        console.log('Cities to analyze:', cities.join(', '));
        console.log('\nNote: This tool analyzes short-term Airbnb rentals and provides:');
        console.log('- Actual Airbnb nightly rates for entire apartments');
        console.log('- Actual Airbnb monthly rates (when available)');
        console.log('- Calculated monthly rates with 20% discount (when no explicit monthly rates)');
        console.log('- Statistical distribution analysis (boxplot with quartiles)');
        console.log('- Both rates extracted from the same listing when displayed together\n');

        try {
            const results = await scrapeMultipleCities(cities, dateConfigs, 1);

            // Write results to file
            await writeResultsToFile(results.cities);

            // Display summary
            console.log('\n==== SUMMARY ====');
            console.log(`Total cities analyzed: ${results.cities.length}`);
            console.log(`Successful extractions: ${results.cities.filter(r => r.averagePrice !== null).length}`);
            console.log(`Failed extractions: ${results.cities.filter(r => r.averagePrice === null).length}`);

            // Display results
            console.log('\n==== RESULTS ====');
            results.cities.forEach(result => {
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

                    // Show total cost calculation for specific date ranges
                    if (result.totalCost) {
                        console.log(`  Total Stay Cost (${result.totalCost.nights} nights):`);
                        console.log(`    Average total: $${result.totalCost.average}`);
                        console.log(`    Range: $${result.totalCost.min} - $${result.totalCost.max}`);
                        console.log(`    Breakdown: ${result.totalCost.nights} nights × $${result.averagePrice} average = $${result.totalCost.average}`);
                    }

                    if (result.averageMonthlyPrice) {
                        console.log(`  Monthly Rates:`);
                        console.log(`    Average: $${result.averageMonthlyPrice}/month`);
                        console.log(`    Range: $${result.minMonthlyPrice} - $${result.maxMonthlyPrice}/month`);

                        if (result.hasExplicitPrices && result.hasCalculatedPrices) {
                            console.log(`    Listings: ${result.monthlyListingsFound} explicit + ${result.calculatedMonthlyListings} calculated (20% discount)`);
                        } else if (result.hasExplicitPrices) {
                            console.log(`    Listings with explicit monthly prices: ${result.monthlyListingsFound}`);
                        } else if (result.hasCalculatedPrices) {
                            console.log(`    Source: Calculated from nightly rates (30-day estimate with 20% discount)`);
                        }
                        console.log(`    Total monthly listings analyzed: ${result.totalMonthlyListings}`);
                    } else {
                        console.log(`  Monthly Rates: Not available`);
                    }
                } else {
                    console.log(`${result.city}: ${result.error || 'Failed to get data'}`);
                }
            });

            // Show overall averages
            const successfulResults = results.cities.filter(r => r.averagePrice !== null);
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
                const monthlyResults = results.cities.filter(r => r.averageMonthlyPrice !== null);
                if (monthlyResults.length > 0) {
                    const overallMonthlyAverage = Math.round(
                        monthlyResults.reduce((sum, r) => sum + r.averageMonthlyPrice, 0) / monthlyResults.length
                    );
                    console.log(`\n==== MONTHLY RATES SUMMARY ====`);
                    console.log(`Average across all cities with monthly data: $${overallMonthlyAverage}/month`);

                    const explicitOnlyResults = monthlyResults.filter(r => r.hasExplicitPrices && !r.hasCalculatedPrices);
                    const calculatedOnlyResults = monthlyResults.filter(r => r.hasCalculatedPrices && !r.hasExplicitPrices);
                    const mixedResults = monthlyResults.filter(r => r.hasExplicitPrices && r.hasCalculatedPrices);

                    if (explicitOnlyResults.length > 0) {
                        console.log(`Cities with explicit monthly pricing only: ${explicitOnlyResults.map(r => r.city).join(', ')}`);
                    }
                    if (calculatedOnlyResults.length > 0) {
                        console.log(`Cities with calculated monthly pricing only (20% discount): ${calculatedOnlyResults.map(r => r.city).join(', ')}`);
                    }
                    if (mixedResults.length > 0) {
                        console.log(`Cities with mixed pricing (explicit + calculated): ${mixedResults.map(r => r.city).join(', ')}`);
                    }

                    // Show total listings summary
                    const totalExplicitListings = monthlyResults.reduce((sum, r) => sum + (r.monthlyListingsFound || 0), 0);
                    const totalCalculatedListings = monthlyResults.reduce((sum, r) => sum + (r.calculatedMonthlyListings || 0), 0);
                    console.log(`Total monthly listings analyzed: ${totalExplicitListings + totalCalculatedListings} (${totalExplicitListings} explicit + ${totalCalculatedListings} calculated)`);
                }
            }

        } catch (error) {
            console.error('Error in main execution:', error);
        }
    })();
}

// Export functions for use in Electron app
module.exports = {
    scrapeAirbnb,
    scrapeMultipleCities,
    writeResultsToFile
};