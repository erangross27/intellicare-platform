/**
 * Medical Category Icon Loader
 *
 * Automatically loads icon definitions from individual files.
 * Each collection has its own icon file for maintainability.
 *
 * Usage:
 *   const iconLoader = require('./gridMappings/iconLoader');
 *   const icon = iconLoader.getIcon('medications'); // Returns '💊'
 */

const fs = require('fs');
const path = require('path');

class IconLoader {
  constructor() {
    this.iconMappings = {};
    this.loadAllIcons();
  }

  /**
   * Load all icon files from the icons directory
   */
  loadAllIcons() {
    const iconsDir = path.join(__dirname, 'icons');

    if (!fs.existsSync(iconsDir)) {
      console.warn('⚠️  Icons directory not found, creating it...');
      fs.mkdirSync(iconsDir, { recursive: true });
      return;
    }

    const iconFiles = fs.readdirSync(iconsDir).filter(f => f.endsWith('.js'));

    iconFiles.forEach(file => {
      const collectionName = file.replace('.js', '');
      try {
        const iconConfig = require(path.join(iconsDir, file));
        this.iconMappings[collectionName] = iconConfig.icon || iconConfig;
      } catch (error) {
        console.error(`❌ Failed to load icon: ${collectionName}`, error.message);
      }
    });

    console.log(`✅ Loaded ${Object.keys(this.iconMappings).length} icon mappings`);
  }

  /**
   * Get icon for a category
   * @param {string} category - Collection name (e.g., 'medications', 'lab_results')
   * @returns {string} Emoji icon
   */
  getIcon(category) {
    if (!category) {
      return '📄'; // Default document icon
    }

    // Check if we have a specific icon for this category
    const icon = this.iconMappings[category];

    if (icon) {
      return typeof icon === 'string' ? icon : icon.icon || '📄';
    }

    // Fallback: Try to infer icon from category name
    return this.inferIconFromName(category);
  }

  /**
   * Infer icon from category name if no specific mapping exists
   * @param {string} category - Collection name
   * @returns {string} Inferred emoji icon
   */
  inferIconFromName(category) {
    const name = category.toLowerCase();

    // Medical tests and labs
    if (name.includes('lab') || name.includes('test') || name.includes('result')) return '🔬';
    if (name.includes('blood') || name.includes('hematology')) return '🩸';
    if (name.includes('imaging') || name.includes('xray') || name.includes('scan') || name.includes('mri') || name.includes('ct')) return '📷';

    // Medications
    if (name.includes('medication') || name.includes('prescription') || name.includes('drug') || name.includes('pharmacy')) return '💊';
    if (name.includes('vaccine') || name.includes('immunization')) return '💉';

    // Vitals and monitoring
    if (name.includes('vital') || name.includes('bp') || name.includes('pressure') || name.includes('heart_rate')) return '❤️';
    if (name.includes('glucose') || name.includes('sugar')) return '🩺';
    if (name.includes('weight') || name.includes('bmi')) return '⚖️';

    // Diagnosis and assessment
    if (name.includes('diagnos') || name.includes('condition')) return '📋';
    if (name.includes('allerg')) return '⚠️';
    if (name.includes('symptom') || name.includes('complaint')) return '🗣️';

    // Procedures
    if (name.includes('surgery') || name.includes('surgical') || name.includes('procedure') || name.includes('operation')) return '🔪';
    if (name.includes('exam') || name.includes('physical')) return '🩺';

    // Cardiology
    if (name.includes('cardio') || name.includes('heart') || name.includes('ekg') || name.includes('ecg')) return '❤️';

    // Neurology
    if (name.includes('neuro') || name.includes('brain') || name.includes('cognitive')) return '🧠';

    // Mental health
    if (name.includes('psych') || name.includes('mental') || name.includes('depression') || name.includes('anxiety')) return '🧘';

    // Social and lifestyle
    if (name.includes('social') || name.includes('family') || name.includes('history')) return '👥';
    if (name.includes('diet') || name.includes('nutrition')) return '🥗';
    if (name.includes('exercise') || name.includes('activity') || name.includes('fitness')) return '🏃';

    // Pregnancy and pediatrics
    if (name.includes('pregnan') || name.includes('obstetric') || name.includes('fetal')) return '🤰';
    if (name.includes('pediatric') || name.includes('child') || name.includes('infant')) return '👶';

    // Administration
    if (name.includes('appointment') || name.includes('schedule')) return '📅';
    if (name.includes('billing') || name.includes('insurance') || name.includes('payment')) return '💰';
    if (name.includes('document') || name.includes('report') || name.includes('record')) return '📄';
    if (name.includes('note') || name.includes('comment')) return '📝';

    // AI-generated insights
    if (name.includes('ai') || name.includes('intelligent') || name.includes('clinical_decision')) return '🤖';
    if (name.includes('trend') || name.includes('analys')) return '📈';
    if (name.includes('recommend')) return '💡';
    if (name.includes('quality') || name.includes('metric')) return '📊';
    if (name.includes('education') || name.includes('learning')) return '📚';
    if (name.includes('follow_up') || name.includes('followup')) return '📅';

    // Default
    return '📄';
  }

  /**
   * Get all available categories with icons
   * @returns {Array<string>} List of category names with icon mappings
   */
  getAvailableCategories() {
    return Object.keys(this.iconMappings);
  }

  /**
   * Check if a category has an icon mapping
   * @param {string} category - Category name
   * @returns {boolean} True if mapping exists
   */
  hasIcon(category) {
    return Boolean(this.iconMappings[category]);
  }

  /**
   * Get statistics about icon mappings
   * @returns {Object} Stats object
   */
  getStats() {
    return {
      totalIcons: Object.keys(this.iconMappings).length,
      categories: Object.keys(this.iconMappings)
    };
  }

  /**
   * Reload all icons (useful for development)
   */
  reload() {
    this.iconMappings = {};
    this.loadAllIcons();
  }
}

// Export singleton instance
module.exports = new IconLoader();
