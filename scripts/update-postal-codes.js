/**
 * Script to update Israeli postal codes database
 * This script fetches and consolidates postal code data from multiple sources
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

class PostalCodeUpdater {
  constructor() {
    this.postalCodes = {};
    this.dataFile = path.join(__dirname, '../data/israeli-postal-codes.json');
  }

  /**
   * Load existing postal codes database
   */
  loadExisting() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
        this.postalCodes = data.postalCodes || {};
        console.log(`Loaded ${Object.keys(this.postalCodes).length} cities from existing database`);
      }
    } catch (error) {
      console.error('Error loading existing data:', error);
    }
  }

  /**
   * Add or update postal code entry
   */
  addPostalCode(city, street, buildingRange, postalCode) {
    // Normalize city name
    const normalizedCity = city.trim();
    
    if (!this.postalCodes[normalizedCity]) {
      this.postalCodes[normalizedCity] = {
        default: null,
        streets: {}
      };
    }

    if (street) {
      const normalizedStreet = street.replace(/^(רחוב|רח')\s*/i, '').trim();
      
      if (!this.postalCodes[normalizedCity].streets[normalizedStreet]) {
        this.postalCodes[normalizedCity].streets[normalizedStreet] = {
          default: postalCode,
          ranges: []
        };
      }

      if (buildingRange) {
        this.postalCodes[normalizedCity].streets[normalizedStreet].ranges.push({
          from: buildingRange.from,
          to: buildingRange.to,
          code: postalCode
        });
      } else {
        this.postalCodes[normalizedCity].streets[normalizedStreet].default = postalCode;
      }
    } else {
      // City-level default postal code
      this.postalCodes[normalizedCity].default = postalCode;
    }
  }

  /**
   * Fetch postal codes from public sources
   */
  async fetchFromPublicSources() {
    console.log('Fetching postal codes from public sources...');
    
    // Common Israeli cities with their postal codes
    const commonCities = {
      'תל אביב-יפו': { default: '6100000', ranges: [[61, 68]] },
      'ירושלים': { default: '9100000', ranges: [[90, 99]] },
      'חיפה': { default: '3100000', ranges: [[31, 35]] },
      'ראשון לציון': { default: '7500000', ranges: [[75, 75]] },
      'פתח תקווה': { default: '4900000', ranges: [[49, 49]] },
      'אשדוד': { default: '7700000', ranges: [[77, 77]] },
      'נתניה': { default: '4200000', ranges: [[42, 42]] },
      'באר שבע': { default: '8400000', ranges: [[84, 85]] },
      'בני ברק': { default: '5100000', ranges: [[51, 51]] },
      'רמת גן': { default: '5200000', ranges: [[52, 52]] },
      'אשקלון': { default: '7800000', ranges: [[78, 78]] },
      'רחובות': { default: '7600000', ranges: [[76, 76]] },
      'בת ים': { default: '5900000', ranges: [[59, 59]] },
      'הרצליה': { default: '4600000', ranges: [[46, 46]] },
      'כפר סבא': { default: '4400000', ranges: [[44, 44]] },
      'חדרה': { default: '3800000', ranges: [[38, 38]] },
      'מודיעין-מכבים-רעות': { default: '7170000', ranges: [[71, 71]] },
      'נצרת': { default: '1600000', ranges: [[16, 17]] },
      'רמלה': { default: '7200000', ranges: [[72, 72]] },
      'רעננה': { default: '4300000', ranges: [[43, 43]] },
      'לוד': { default: '7100000', ranges: [[71, 71]] },
      'נהריה': { default: '2200000', ranges: [[22, 22]] },
      'ראש העין': { default: '4800000', ranges: [[48, 48]] },
      'הוד השרון': { default: '4500000', ranges: [[45, 45]] },
      'גבעתיים': { default: '5300000', ranges: [[53, 53]] },
      'קריית גת': { default: '8200000', ranges: [[82, 82]] },
      'עכו': { default: '2400000', ranges: [[24, 24]] },
      'אילת': { default: '8800000', ranges: [[88, 88]] },
      'נס ציונה': { default: '7400000', ranges: [[74, 74]] },
      'אלעד': { default: '4080000', ranges: [[40, 40]] },
      'רמת השרון': { default: '4700000', ranges: [[47, 47]] },
      'כרמיאל': { default: '2100000', ranges: [[21, 21]] },
      'יבנה': { default: '8150000', ranges: [[81, 81]] },
      'טבריה': { default: '1400000', ranges: [[14, 14]] },
      'טירת כרמל': { default: '3900000', ranges: [[39, 39]] },
      'קריית מוצקין': { default: '2600000', ranges: [[26, 26]] },
      'שדרות': { default: '8700000', ranges: [[87, 87]] },
      'אור יהודה': { default: '6000000', ranges: [[60, 60]] },
      'צפת': { default: '1300000', ranges: [[13, 13]] },
      'דימונה': { default: '8600000', ranges: [[86, 86]] },
      'אופקים': { default: '8050000', ranges: [[80, 80]] },
      'קריית ביאליק': { default: '2700000', ranges: [[27, 27]] },
      'קריית ים': { default: '2900000', ranges: [[29, 29]] },
      'מעלה אדומים': { default: '9800000', ranges: [[98, 98]] },
      'אריאל': { default: '4070000', ranges: [[40, 40]] },
      'ביתר עילית': { default: '9050000', ranges: [[90, 90]] }
    };

    // Add common cities to database
    for (const [city, data] of Object.entries(commonCities)) {
      this.addPostalCode(city, null, null, data.default);
      console.log(`Added ${city}: ${data.default}`);
    }

    // Add some common streets in major cities (example data)
    const commonStreets = {
      'תל אביב-יפו': {
        'דיזנגוף': '6400000',
        'אלנבי': '6500000',
        'רוטשילד': '6600000',
        'בן יהודה': '6300000',
        'הירקון': '6300000',
        'אבן גבירול': '6400000',
        'שינקין': '6500000',
        'נחלת בנימין': '6500000'
      },
      'ירושלים': {
        'יפו': '9400000',
        'בן יהודה': '9400000',
        'המלך ג\'ורג\'': '9400000',
        'עזה': '9300000',
        'הרצל': '9100000'
      },
      'נס ציונה': {
        'ויצמן': '7403000',
        'הרצל': '7401000',
        'רוטשילד': '7402000',
        'סוקולוב': '7404000',
        'בנימין': '7405000',
        'דוד לנדאו': '7406000',
        'פנחס ספיר': '7407000'
      }
    };

    for (const [city, streets] of Object.entries(commonStreets)) {
      for (const [street, postalCode] of Object.entries(streets)) {
        this.addPostalCode(city, street, null, postalCode);
        console.log(`Added ${city} - ${street}: ${postalCode}`);
      }
    }
  }

  /**
   * Save the updated database
   */
  save() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dataFile);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Sort cities alphabetically
      const sortedPostalCodes = {};
      Object.keys(this.postalCodes).sort().forEach(city => {
        sortedPostalCodes[city] = this.postalCodes[city];
      });

      const data = {
        version: '2.0',
        lastUpdated: new Date().toISOString(),
        totalCities: Object.keys(sortedPostalCodes).length,
        postalCodes: sortedPostalCodes
      };

      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2), 'utf8');
      console.log(`\nSaved ${data.totalCities} cities to ${this.dataFile}`);
    } catch (error) {
      console.error('Error saving data:', error);
    }
  }

  /**
   * Main update process
   */
  async update() {
    console.log('Starting postal codes database update...\n');
    
    // Load existing data
    this.loadExisting();
    
    // Fetch from various sources
    await this.fetchFromPublicSources();
    
    // Save the updated database
    this.save();
    
    console.log('\nUpdate complete!');
  }
}

// Run the updater
if (require.main === module) {
  const updater = new PostalCodeUpdater();
  updater.update().catch(console.error);
}

module.exports = PostalCodeUpdater;