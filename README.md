# Airbnb Price Analyzer

A Node.js script that scrapes Airbnb to analyze pricing data for entire apartments/homes across multiple cities.

## Features

- **Dual Price Extraction**: Captures both nightly rates and actual monthly prices from Airbnb listings
- **Statistical Analysis**: Provides comprehensive boxplot statistics (Q1, Q3, median, IQR, outlier boundaries)
- **Multi-City Support**: Analyze multiple cities in a single run
- **Command Line Interface**: Flexible city selection via command line arguments
- **Export Options**: Results saved in both JSON and CSV formats
- **Realistic Pricing**: Filters out unrealistic prices and focuses on $30-400 nightly range

## Installation

```bash
npm install puppeteer
```

## Usage

### Command Line Interface

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

# More examples
node src/index.js Madrid Rome Amsterdam
node src/index.js "New York" --month 8
```

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
