# 🏠 Airbnb Price Analyzer

A comprehensive tool for analyzing Airbnb prices across multiple cities. Available as both a command-line interface and a beautiful desktop application.

## 🖥️ Desktop Application (New!)

For the best user experience, use the new **Electron desktop application** with a beautiful graphical interface:

### Quick Start
1. Install dependencies: `npm install`
2. Launch the app: `npm run dev`
3. Use the intuitive point-and-click interface!

### Desktop Features
- **🎨 Beautiful Modern UI**: No command line required
- **📊 Real-time Progress**: Watch analysis progress with visual feedback
- **💾 Easy Export**: One-click export to JSON/CSV
- **📅 Visual Date Selection**: Calendar-based date pickers
- **📈 Interactive Results**: Organized table with summary statistics
- **🔄 Background Processing**: Analysis runs in background without blocking UI

### Building Desktop Apps
```bash
npm run build        # Current platform
npm run build:all    # All platforms (Windows, Mac, Linux)
```

---

## 💻 Command Line Interface

```bash
# Single city (defaults to next month)
node src/index.js Paris

# Multiple cities (defaults to next month)
node src/index.js Paris London Tokyo

# Cities with spaces (use quotes)
node src/index.js "New York" "Los Angeles" Barcelona

# Specify a target month (1-12, must be greater than current month)
node src/index.js Paris --month 6
node src/index.js Barcelona Madrid --month 12
node src/index.js "San Francisco" Seattle --month 4

# Interactive date selection mode
node src/index.js --interactive Paris Barcelona Tokyo
node src/index.js --interactive "New York" London

# More examples
node src/index.js Madrid Rome Amsterdam
node src/index.js "New York" --month 8
```

### Interactive Date Selection

When using the `--interactive` flag, you'll be prompted to select:

#### Mode 1: Same dates for all cities
- **Option 1**: Specify exact start and end dates (YYYY-MM-DD format)
- **Option 2**: Specify start date and duration in months
- **Bonus**: Automatically calculates total stay cost (nights × average nightly price)

#### Mode 2: Different dates per city
- Set custom check-in and check-out dates for each city individually
- **Bonus**: Shows individual total costs for each city's date range

#### Mode 3: Month-based analysis
- Use the traditional month parameter functionality

### Month Parameter

The `--month` option allows you to specify which month to analyze:
- **Format**: `--month <1-12>` where 1=January, 12=December
- **Restriction**: Month must be greater than the current month
- **Default**: Next month if not specified
- **Year Handling**: Automatically uses next year if needed

**Examples:**
- Current month is February → `--month 3` analyzes March 2026
- Current month is November → `--month 12` analyzes December 2026
- Current month is November → `--month 2` analyzes February 2027

### Output

The script generates two files:
- `airbnb-price-analysis.json`: Complete data with statistics
- `airbnb-price-analysis.csv`: Spreadsheet-friendly format

### Sample Output

```
Starting Airbnb price analysis for June 2026 (30 days)...
Cities to analyze: Paris, London

==== RESULTS ====
Paris:
  Nightly Rates:
    Average: $86/night
    Median: $89/night
    Range: $69 - $96
    Boxplot Analysis:
      Q1 (25th percentile): $78/night
      Q3 (75th percentile): $93/night
      IQR (Interquartile Range): $15/night
      Typical price range: $69 - $96/night (50% of data)
    Listings analyzed: 7
  Monthly Rates:
    Average: $2278/month
    Range: $1447 - $3450/month
    Listings with monthly prices: 3
```

## Configuration

The script analyzes:
- **Date Range**: Full month specified by `--month` parameter (defaults to next month)
- **Property Type**: Entire homes/apartments only
- **Guest Count**: 1 guest (configurable in code)
- **Listing Limit**: Top 10 listings per city
- **Browser Mode**: Headless (faster execution)
- **Year Handling**: Automatically determines correct year based on target month

## Technical Details

- **Browser Automation**: Puppeteer with Chrome
- **Anti-Detection**: Custom user agent and automation flags
- **Price Extraction**: Dual regex patterns for nightly vs monthly rates
- **Error Handling**: Graceful fallbacks for missing elements
- **Rate Limiting**: 5-second delays between cities

## Customization

To modify the script behavior, edit `/src/index.js`:

- Change `guests = 1` to adjust guest count
- Modify date calculation for different time periods
- Update price range validation in extraction logic
- Add new cities to default list or use command line

## Requirements

- Node.js 14+
- Chrome/Chromium browser
- Internet connection
- Sufficient memory for browser automation

## Notes

- The script targets realistic Airbnb pricing ($30-400/night)
- Monthly prices are actual Airbnb monthly rates, not calculations
- Results may vary based on availability and seasonality
- Script includes comprehensive debug information for troubleshooting
