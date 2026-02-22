// Main application logic for the Electron renderer process
class AirbnbAnalyzer {
    constructor() {
        this.isAnalysisRunning = false;
        this.currentResults = null;
        this.progressState = {
            totalCities: 0,
            currentCityIndex: 0,
            currentStep: '',
            steps: []
        };
        this.formState = {
            cities: '',
            dateMode: 'specific-all',
            checkinDate: '',
            checkoutDate: '',
            monthSelect: '',
            perCityDates: {}
        };
        this.initializeEventListeners();
        this.updateDateInputs();
    }

    saveFormState() {
        // Save current form values to state
        this.formState.cities = document.getElementById('citiesInput').value || '';

        const selectedMode = document.querySelector('input[name="dateMode"]:checked')?.value;
        if (selectedMode) {
            this.formState.dateMode = selectedMode;
        }

        // Save date inputs based on current mode
        const checkinEl = document.getElementById('checkinDate');
        const checkoutEl = document.getElementById('checkoutDate');
        const monthEl = document.getElementById('monthSelect');

        if (checkinEl) this.formState.checkinDate = checkinEl.value;
        if (checkoutEl) this.formState.checkoutDate = checkoutEl.value;
        if (monthEl) this.formState.monthSelect = monthEl.value;

        // Save per-city dates
        document.querySelectorAll('input[data-city]').forEach(input => {
            const city = input.getAttribute('data-city');
            const isCheckin = input.id.startsWith('checkin_');

            if (!this.formState.perCityDates[city]) {
                this.formState.perCityDates[city] = {};
            }

            if (isCheckin) {
                this.formState.perCityDates[city].checkin = input.value;
            } else {
                this.formState.perCityDates[city].checkout = input.value;
            }
        });
    }

    restoreFormState() {
        // Restore cities input
        document.getElementById('citiesInput').value = this.formState.cities;

        // Restore date mode
        const modeRadio = document.querySelector(`input[name="dateMode"][value="${this.formState.dateMode}"]`);
        if (modeRadio) {
            modeRadio.checked = true;
        }

        // Restore date inputs after a short delay to ensure DOM is updated
        setTimeout(() => {
            const checkinEl = document.getElementById('checkinDate');
            const checkoutEl = document.getElementById('checkoutDate');
            const monthEl = document.getElementById('monthSelect');

            if (checkinEl && this.formState.checkinDate) {
                checkinEl.value = this.formState.checkinDate;
            }
            if (checkoutEl && this.formState.checkoutDate) {
                checkoutEl.value = this.formState.checkoutDate;
            }
            if (monthEl && this.formState.monthSelect) {
                monthEl.value = this.formState.monthSelect;
            }

            // Restore per-city dates
            Object.keys(this.formState.perCityDates).forEach(city => {
                const cityData = this.formState.perCityDates[city];
                const cityIndex = Array.from(document.querySelectorAll('[data-city]'))
                    .map(el => el.getAttribute('data-city'))
                    .indexOf(city);

                if (cityIndex >= 0) {
                    const checkinInput = document.getElementById(`checkin_${cityIndex}`);
                    const checkoutInput = document.getElementById(`checkout_${cityIndex}`);

                    if (checkinInput && cityData.checkin) {
                        checkinInput.value = cityData.checkin;
                    }
                    if (checkoutInput && cityData.checkout) {
                        checkoutInput.value = cityData.checkout;
                    }
                }
            });
        }, 100);
    }

    initializeEventListeners() {
        // Date mode change handlers - save state before changing
        document.querySelectorAll('input[name="dateMode"]').forEach(radio => {
            radio.addEventListener('change', () => {
                this.saveFormState();
                this.updateDateInputs();
                this.restoreFormState();
            });
        });

        // Cities input change handler
        document.getElementById('citiesInput').addEventListener('input', () => {
            this.saveFormState();
        });

        // Button handlers
        document.getElementById('startAnalysisBtn').addEventListener('click', () => this.startAnalysis());
        document.getElementById('clearFormBtn').addEventListener('click', () => this.clearForm());
        document.getElementById('cancelAnalysisBtn').addEventListener('click', () => this.cancelAnalysis());
        document.getElementById('newAnalysisBtn').addEventListener('click', () => this.newAnalysis());

        // Export handlers
        document.getElementById('exportJsonBtn').addEventListener('click', () => this.exportResults('json'));
        document.getElementById('exportCsvBtn').addEventListener('click', () => this.exportResults('csv'));

        // About handler
        document.getElementById('aboutBtn').addEventListener('click', () => window.electronAPI.showAbout());

        // Progress listener
        this.progressCallback = (message) => this.updateProgress(message);
        window.electronAPI.onAnalysisProgress(this.progressCallback);
    }

    updateDateInputs() {
        // Save current state before updating
        this.saveFormState();

        const selectedMode = document.querySelector('input[name="dateMode"]:checked').value;
        const dateInputsContainer = document.getElementById('dateInputs');

        let html = '';

        if (selectedMode === 'specific-all') {
            html = `
                <label>Date Range (Applied to all cities)</label>
                <div class="date-input-grid">
                    <div>
                        <label for="checkinDate">Check-in Date</label>
                        <input type="date" id="checkinDate" required>
                    </div>
                    <div>
                        <label for="checkoutDate">Check-out Date</label>
                        <input type="date" id="checkoutDate" required>
                    </div>
                </div>
                <small class="help-text">These dates will be used for all cities in the analysis</small>
            `;
        } else if (selectedMode === 'specific-per-city') {
            html = `
                <label>Per-City Date Configuration</label>
                <div id="perCityDates">
                    <p class="help-text">Enter cities first, then specify dates for each city after clicking "Configure Dates"</p>
                    <button type="button" id="configureDatesBtn" class="btn btn-outline">Configure Dates</button>
                </div>
            `;
        } else {
            html = `
                <label for="monthSelect">Month to Analyze</label>
                <select id="monthSelect" required>
                    <option value="">Select a month...</option>
                    <option value="1">January</option>
                    <option value="2">February</option>
                    <option value="3">March</option>
                    <option value="4">April</option>
                    <option value="5">May</option>
                    <option value="6">June</option>
                    <option value="7">July</option>
                    <option value="8">August</option>
                    <option value="9">September</option>
                    <option value="10">October</option>
                    <option value="11">November</option>
                    <option value="12">December</option>
                </select>
                <small class="help-text">Analysis will cover the entire selected month</small>
            `;
        }

        dateInputsContainer.innerHTML = html;

        // Add event listener for configure dates button
        const configureDatesBtn = document.getElementById('configureDatesBtn');
        if (configureDatesBtn) {
            configureDatesBtn.addEventListener('click', () => this.generatePerCityDateInputs());
        }

        // Add change listeners for date inputs to save state
        setTimeout(() => {
            document.querySelectorAll('input[type="date"], select').forEach(input => {
                input.addEventListener('change', () => this.saveFormState());
            });
        }, 50);

        // Set minimum dates to today
        const today = new Date().toISOString().split('T')[0];
        document.querySelectorAll('input[type="date"]').forEach(input => {
            input.min = today;
        });

        // Restore state after DOM update
        setTimeout(() => this.restoreFormState(), 50);
    }

    generatePerCityDateInputs() {
        this.saveFormState(); // Save current state before generating

        const citiesText = document.getElementById('citiesInput').value.trim();
        if (!citiesText) {
            alert('Please enter cities first before configuring dates.');
            return;
        }

        const cities = citiesText.split('\n').filter(city => city.trim());
        const perCityDatesContainer = document.getElementById('perCityDates');

        let html = '<div class="city-date-container">';

        cities.forEach((city, index) => {
            html += `
                <div class="city-date-inputs">
                    <h4>📍 ${city.trim()}</h4>
                    <div class="date-input-grid">
                        <div>
                            <label for="checkin_${index}">Check-in Date</label>
                            <input type="date" id="checkin_${index}" data-city="${city.trim()}" required>
                        </div>
                        <div>
                            <label for="checkout_${index}">Check-out Date</label>
                            <input type="date" id="checkout_${index}" data-city="${city.trim()}" required>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        perCityDatesContainer.innerHTML = html;

        // Set minimum dates to today
        const today = new Date().toISOString().split('T')[0];
        document.querySelectorAll('input[type="date"]').forEach(input => {
            input.min = today;
        });

        // Add change listeners for the new inputs
        document.querySelectorAll('input[data-city]').forEach(input => {
            input.addEventListener('change', () => this.saveFormState());
        });

        // Restore per-city dates if they exist
        setTimeout(() => this.restoreFormState(), 50);
    }

    async startAnalysis() {
        if (this.isAnalysisRunning) return;

        // Validate form
        const validation = this.validateForm();
        if (!validation.isValid) {
            alert(validation.message);
            return;
        }

        // Prepare configuration
        const config = this.buildAnalysisConfig();
        if (!config) return;

        // Start analysis
        this.isAnalysisRunning = true;
        this.disableForm();
        this.showProgressPanel();
        this.hideResultsPanel();

        try {
            const result = await window.electronAPI.startAnalysis(config);

            if (result.success) {
                // Complete progress
                this.completeAnalysis();
                this.currentResults = result.results;
                this.displayResults(result.results);
            } else {
                // Mark as failed
                this.failAnalysis(result.error);
                alert(`Analysis failed: ${result.error}`);
            }
        } catch (error) {
            console.error('Analysis error:', error);
            this.failAnalysis(error.message);
            alert(`Analysis failed: ${error.message}`);
        } finally {
            this.isAnalysisRunning = false;
            this.enableForm();

            // Keep progress panel visible for a moment to show completion
            setTimeout(() => {
                this.hideProgressPanel();
            }, 2000);
        }
    }

    disableForm() {
        // Disable all form inputs during analysis
        document.querySelectorAll('input, select, button').forEach(element => {
            if (element.id !== 'cancelAnalysisBtn') {
                element.disabled = true;
            }
        });
    }

    enableForm() {
        // Re-enable all form inputs after analysis
        document.querySelectorAll('input, select, button').forEach(element => {
            element.disabled = false;
        });
    }

    validateForm() {
        const citiesText = document.getElementById('citiesInput').value.trim();
        if (!citiesText) {
            return { isValid: false, message: 'Please enter at least one city.' };
        }

        const cities = citiesText.split('\n').filter(city => city.trim());
        if (cities.length === 0) {
            return { isValid: false, message: 'Please enter at least one valid city.' };
        }

        const selectedMode = document.querySelector('input[name="dateMode"]:checked').value;

        if (selectedMode === 'specific-all') {
            const checkin = document.getElementById('checkinDate')?.value;
            const checkout = document.getElementById('checkoutDate')?.value;

            if (!checkin || !checkout) {
                return { isValid: false, message: 'Please select both check-in and check-out dates.' };
            }

            if (new Date(checkin) >= new Date(checkout)) {
                return { isValid: false, message: 'Check-out date must be after check-in date.' };
            }
        } else if (selectedMode === 'specific-per-city') {
            // Validate per-city dates
            const cityDateInputs = document.querySelectorAll('input[data-city]');
            if (cityDateInputs.length === 0) {
                return { isValid: false, message: 'Please configure dates for each city first.' };
            }

            for (let i = 0; i < cities.length; i++) {
                const checkin = document.getElementById(`checkin_${i}`)?.value;
                const checkout = document.getElementById(`checkout_${i}`)?.value;

                if (!checkin || !checkout) {
                    return { isValid: false, message: `Please set dates for ${cities[i]}.` };
                }

                if (new Date(checkin) >= new Date(checkout)) {
                    return { isValid: false, message: `Check-out date must be after check-in date for ${cities[i]}.` };
                }
            }
        } else if (selectedMode === 'month') {
            const month = document.getElementById('monthSelect')?.value;
            if (!month) {
                return { isValid: false, message: 'Please select a month to analyze.' };
            }
        }

        return { isValid: true };
    }

    buildAnalysisConfig() {
        const citiesText = document.getElementById('citiesInput').value.trim();
        const cities = citiesText.split('\n').filter(city => city.trim()).map(city => city.trim());
        const selectedMode = document.querySelector('input[name="dateMode"]:checked').value;

        const config = { cities, mode: selectedMode };

        if (selectedMode === 'specific-all') {
            config.checkin = document.getElementById('checkinDate').value;
            config.checkout = document.getElementById('checkoutDate').value;
        } else if (selectedMode === 'specific-per-city') {
            config.cityDates = {};
            cities.forEach((city, index) => {
                const checkin = document.getElementById(`checkin_${index}`).value;
                const checkout = document.getElementById(`checkout_${index}`).value;
                config.cityDates[city] = {
                    mode: 'specific',
                    checkin,
                    checkout
                };
            });
        } else {
            config.month = parseInt(document.getElementById('monthSelect').value);
        }

        return config;
    }

    updateProgress(message) {
        const progressMessage = document.getElementById('progressMessage');
        if (progressMessage) {
            progressMessage.textContent = message;
        }

        this.parseAndUpdateDetailedProgress(message);
    }

    parseAndUpdateDetailedProgress(message) {
        // Parse different types of progress messages
        if (message.includes('Processing') && message.includes('(') && message.includes('/')) {
            // Extract city progress: "Processing London (1/3)"
            const match = message.match(/Processing (.+?) \((\d+)\/(\d+)\)/);
            if (match) {
                const [, cityName, current, total] = match;
                this.progressState.currentCityIndex = parseInt(current);
                this.progressState.totalCities = parseInt(total);
                this.updateCityProgress(cityName, 'Initializing scraper...');
            }
        } else if (message.includes('📊 Analyzing') && message.includes('data')) {
            // Extract analyzing message: "📊 Analyzing London data..."
            const match = message.match(/📊 Analyzing (.+?) data/);
            if (match) {
                const cityName = match[1];
                this.updateCurrentStep(cityName, 'Analyzing scraped data');
            }
        } else if (message.includes('✅') && message.includes('Found')) {
            // Extract success message: "✅ London: Found 24 prices, Average: $89/night"
            const match = message.match(/✅ (.+?): Found (\d+) prices, Average: \$(\d+)\/night/);
            if (match) {
                const [, cityName, count, avgPrice] = match;
                this.completeCurrentStep(cityName, `Found ${count} listings, avg $${avgPrice}/night`);
            }
        } else if (message.includes('⚠️') && message.includes('Found listings')) {
            // Extract warning: "⚠️ City: Found listings but no valid prices"
            const match = message.match(/⚠️ (.+?): (.+)/);
            if (match) {
                const [, cityName, reason] = match;
                this.errorCurrentStep(cityName, reason);
            }
        } else if (message.includes('❌')) {
            // Extract error: "❌ City: Error message"
            const match = message.match(/❌ (.+?): (.+)/);
            if (match) {
                const [, cityName, errorMsg] = match;
                this.errorCurrentStep(cityName, errorMsg);
            }
        } else if (message.includes('Waiting') && message.includes('seconds')) {
            // Handle waiting message
            this.updateCurrentStep('', 'Waiting between cities to avoid rate limiting...');
        }

        // Update overall progress
        this.updateOverallProgress();
    }

    updateCityProgress(cityName, step) {
        // Update current city display
        const cityNameEl = document.getElementById('currentCityName');
        const cityStepEl = document.getElementById('currentCityStep');

        if (cityNameEl) cityNameEl.textContent = `📍 ${cityName}`;
        if (cityStepEl) cityStepEl.textContent = step;

        // Add or update step in timeline
        this.addOrUpdateStep(cityName, step, 'active');
    }

    updateCurrentStep(cityName, step) {
        const cityStepEl = document.getElementById('currentCityStep');
        if (cityStepEl) cityStepEl.textContent = step;

        this.addOrUpdateStep(cityName || 'Current Task', step, 'active');
    }

    completeCurrentStep(cityName, result) {
        const cityStepEl = document.getElementById('currentCityStep');
        if (cityStepEl) cityStepEl.textContent = `✅ ${result}`;

        this.addOrUpdateStep(cityName, result, 'completed');
    }

    errorCurrentStep(cityName, error) {
        const cityStepEl = document.getElementById('currentCityStep');
        if (cityStepEl) cityStepEl.textContent = `❌ ${error}`;

        this.addOrUpdateStep(cityName, error, 'error');
    }

    addOrUpdateStep(stepName, detail, status) {
        const timeline = document.getElementById('stepTimeline');
        if (!timeline) return;

        const stepId = `step-${stepName.replace(/[^a-zA-Z0-9]/g, '-')}`;
        let stepElement = document.getElementById(stepId);

        if (!stepElement) {
            stepElement = document.createElement('div');
            stepElement.className = 'step-item';
            stepElement.id = stepId;
            stepElement.innerHTML = `
                <div class="step-icon waiting">
                    <span class="step-number">${this.progressState.steps.length + 1}</span>
                </div>
                <div class="step-text">
                    <div class="step-name">${stepName}</div>
                    <div class="step-detail">${detail}</div>
                </div>
            `;
            timeline.appendChild(stepElement);
            this.progressState.steps.push({ name: stepName, status: 'waiting' });
        }

        // Update step status
        const stepIndex = this.progressState.steps.findIndex(s => s.name === stepName);
        if (stepIndex >= 0) {
            this.progressState.steps[stepIndex].status = status;
        }

        // Update visual state
        stepElement.className = `step-item ${status}`;
        const icon = stepElement.querySelector('.step-icon');
        const detail_el = stepElement.querySelector('.step-detail');

        if (icon) {
            icon.className = `step-icon ${status}`;
            if (status === 'completed') {
                icon.innerHTML = '✓';
            } else if (status === 'error') {
                icon.innerHTML = '✗';
            } else if (status === 'active') {
                icon.innerHTML = '●';
            }
        }

        if (detail_el) {
            detail_el.textContent = detail;
        }

        // Scroll to latest step
        stepElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    updateOverallProgress() {
        // Calculate overall progress percentage
        let progress = 0;
        if (this.progressState.totalCities > 0) {
            const completedSteps = this.progressState.steps.filter(s =>
                s.status === 'completed' || s.status === 'error'
            ).length;
            const totalSteps = Math.max(this.progressState.totalCities, this.progressState.steps.length);
            progress = Math.min(95, (completedSteps / totalSteps) * 100);
        }

        // Update progress bar
        const progressFill = document.getElementById('progressBarFill');
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }

        // Update percentage text
        const progressPercentage = document.getElementById('progressPercentage');
        if (progressPercentage) {
            progressPercentage.textContent = `${Math.round(progress)}%`;
        }

        // Update step and city counters
        const currentStepEl = document.getElementById('currentStep');
        const cityProgressEl = document.getElementById('cityProgress');

        if (currentStepEl) {
            const completedCount = this.progressState.steps.filter(s =>
                s.status === 'completed' || s.status === 'error'
            ).length;
            currentStepEl.textContent = `Step ${completedCount + 1}`;
        }

        if (cityProgressEl && this.progressState.totalCities > 0) {
            cityProgressEl.textContent = `${this.progressState.currentCityIndex}/${this.progressState.totalCities} cities`;
        }
    }

    displayResults(results) {
        this.showResultsPanel();

        // Update summary stats
        const cities = results.cities || [];
        const successfulCities = cities.filter(c => !c.error);
        const totalListings = cities.reduce((sum, c) => sum + (c.listingsFound || 0), 0);
        const avgPrice = successfulCities.length > 0 ?
            successfulCities.reduce((sum, c) => sum + (c.averagePrice || 0), 0) / successfulCities.length : 0;

        document.getElementById('totalCities').textContent = cities.length;
        document.getElementById('successfulCities').textContent = successfulCities.length;
        document.getElementById('averagePrice').textContent = `$${Math.round(avgPrice)}`;
        document.getElementById('totalListings').textContent = totalListings;

        // Populate results table
        const tbody = document.querySelector('#resultsTable tbody');
        tbody.innerHTML = '';

        cities.forEach(city => {
            const row = document.createElement('tr');

            const formatPrice = (price) => price ? `$${Math.round(price)}` : 'N/A';
            const formatRange = (min, max) => {
                if (!min || !max) return 'N/A';
                return `$${Math.round(min)} - $${Math.round(max)}`;
            };

            const totalCostDisplay = city.totalCost ?
                `$${Math.round(city.totalCost.average)} (${city.totalCost.nights} nights)` : 'N/A';

            row.innerHTML = `
                <td><strong>${city.city}</strong></td>
                <td class="price">${formatPrice(city.averagePrice)}</td>
                <td class="price">${formatPrice(city.averageMonthlyPrice)}</td>
                <td class="price">${totalCostDisplay}</td>
                <td>${city.listingsFound || 0}</td>
                <td>${formatRange(city.minPrice, city.maxPrice)}</td>
                <td class="${city.error ? 'status-error' : 'status-success'}">
                    ${city.error ? 'Failed' : 'Success'}
                </td>
            `;

            tbody.appendChild(row);
        });
    }

    async exportResults(format) {
        if (!this.currentResults) {
            alert('No results to export.');
            return;
        }

        try {
            const result = await window.electronAPI.saveResults(this.currentResults, format);
            if (result.success && !result.cancelled) {
                alert(`Results exported successfully to: ${result.filePath}`);
            }
        } catch (error) {
            console.error('Export error:', error);
            alert(`Export failed: ${error.message}`);
        }
    }

    clearForm() {
        // Clear the form state object
        this.formState = {
            cities: '',
            dateMode: 'specific-all',
            checkinDate: '',
            checkoutDate: '',
            monthSelect: '',
            perCityDates: {}
        };

        // Clear form inputs
        document.getElementById('citiesInput').value = '';
        document.querySelector('input[name="dateMode"][value="specific-all"]').checked = true;
        this.updateDateInputs();

        // Hide panels and reset state
        this.hideProgressPanel();
        this.hideResultsPanel();
        this.currentResults = null;
        this.isAnalysisRunning = false;
    }

    cancelAnalysis() {
        this.isAnalysisRunning = false;
        this.enableForm();
        this.hideProgressPanel();
    }

    newAnalysis() {
        this.hideResultsPanel();
        this.currentResults = null;
        this.enableForm(); // Make sure form is enabled for new analysis
    }

    showProgressPanel() {
        // Reset progress state
        this.progressState = {
            totalCities: 0,
            currentCityIndex: 0,
            currentStep: '',
            steps: []
        };

        // Clear and show progress panel
        document.getElementById('progressPanel').style.display = 'block';
        document.getElementById('progressBarFill').style.width = '0%';
        document.getElementById('progressPercentage').textContent = '0%';
        document.getElementById('progressMessage').textContent = 'Preparing to start analysis...';
        document.getElementById('currentCityName').textContent = 'Getting ready...';
        document.getElementById('currentCityStep').textContent = 'Initializing analysis';
        document.getElementById('currentStep').textContent = 'Step 1';
        document.getElementById('cityProgress').textContent = '0/0 cities';

        // Clear timeline
        const timeline = document.getElementById('stepTimeline');
        if (timeline) {
            timeline.innerHTML = '';
        }

        // Add initial step
        this.addOrUpdateStep('Analysis Setup', 'Preparing scraper configuration...', 'active');
    }

    hideProgressPanel() {
        document.getElementById('progressPanel').style.display = 'none';
    }

    showResultsPanel() {
        document.getElementById('resultsPanel').style.display = 'block';
    }

    hideResultsPanel() {
        document.getElementById('resultsPanel').style.display = 'none';
    }

    completeAnalysis() {
        // Mark final step as completed
        this.addOrUpdateStep('Analysis Complete', 'All cities processed successfully!', 'completed');

        // Set progress to 100%
        const progressFill = document.getElementById('progressBarFill');
        if (progressFill) {
            progressFill.style.width = '100%';
        }

        const progressPercentage = document.getElementById('progressPercentage');
        if (progressPercentage) {
            progressPercentage.textContent = '100%';
        }

        const progressMessage = document.getElementById('progressMessage');
        if (progressMessage) {
            progressMessage.textContent = '✅ Analysis completed successfully!';
        }

        const cityStepEl = document.getElementById('currentCityStep');
        if (cityStepEl) {
            cityStepEl.textContent = 'Analysis finished - results ready!';
        }
    }

    failAnalysis(errorMessage) {
        // Mark final step as failed
        this.addOrUpdateStep('Analysis Failed', errorMessage, 'error');

        const progressMessage = document.getElementById('progressMessage');
        if (progressMessage) {
            progressMessage.textContent = '❌ Analysis failed - please try again';
        }

        const cityStepEl = document.getElementById('currentCityStep');
        if (cityStepEl) {
            cityStepEl.textContent = `Error: ${errorMessage}`;
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AirbnbAnalyzer();
});
