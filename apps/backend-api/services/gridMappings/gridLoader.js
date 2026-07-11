/**
 * Medical Grid Loader
 *
 * Automatically loads all grid mappings from individual files.
 * Each collection has its own file for maintainability.
 *
 * Usage:
 *   const gridLoader = require('./gridMappings/gridLoader');
 *   const gridConfig = gridLoader.getGridConfig(category, categoryData);
 */

const fs = require('fs');
const path = require('path');

class GridLoader {
  constructor() {
    this.gridMappings = {};
    this.loadAllGrids();
  }

  /**
   * Load all grid files from the grids directory
   */
  loadAllGrids() {
    const gridsDir = path.join(__dirname, 'grids');

    if (!fs.existsSync(gridsDir)) {
      console.warn('⚠️  Grids directory not found');
      return;
    }

    const gridFiles = fs.readdirSync(gridsDir).filter(f => f.endsWith('.js'));

    gridFiles.forEach(file => {
      const collectionName = file.replace('.js', '');
      try {
        const gridConfig = require(path.join(gridsDir, file));
        this.gridMappings[collectionName] = gridConfig;
      } catch (error) {
        console.error(`❌ Failed to load grid: ${collectionName}`, error.message);
      }
    });

    console.log(`✅ Loaded ${Object.keys(this.gridMappings).length} grid mappings`);
  }

  /**
   * Get grid configuration for a category
   * @param {string} category - Collection name (e.g., 'diagnoses', 'medications')
   * @param {Array} categoryData - Array of records for this category
   * @param {Object} context - Security context for mapper functions that need to query data
   * @returns {Object|null} Grid configuration with title, columns, and data
   */
  async getGridConfig(category, categoryData, context = {}) {
    if (!category || !categoryData || categoryData.length === 0) {
      return null;
    }

    // Check if this is a document mode collection (skip grid mapping)
    const { isDocumentMode } = require('./collectionDisplayConfig');
    if (isDocumentMode(category)) {
      console.log(`📄 [GridLoader] ${category} is in DOCUMENT mode - skipping grid mapping`);
      return null; // Return null to prevent grid formatting
    }

    // Check if we have a specific mapping for this category
    const mapping = this.gridMappings[category];

    if (!mapping) {
      // No mapping found - log warning
      console.warn(`⚠️  No grid mapping found for category: ${category}`);
      return null;
    }

    // Apply deduplication if specified
    let processedData = categoryData;
    if (mapping.deduplicate && typeof mapping.deduplicate === 'function') {
      processedData = mapping.deduplicate(categoryData);
    }

    // Map the data using the category's mapper function
    // Check if mapper expects array or single entry by checking parameter name
    let mappedData;
    const mapperStr = mapping.mapper.toString();
    const isArrayMapper = mapperStr.includes('categoryData') || mapperStr.includes('.map(');

    console.log(`🔍 [GridLoader] ${category}: isArrayMapper=${isArrayMapper}, input records=${processedData.length}`);

    // Debug: Log input data for problematic categories
    if (['clinical_scores', 'prognosis', 'patient_provider', 'patient_education_records'].includes(category)) {
      console.log(`🔍 [GridLoader] ${category} INPUT DATA:`, JSON.stringify(processedData[0], null, 2));
    }

    try {
      if (isArrayMapper) {
        // Mapper expects the full array (e.g., imaging_reports, family_history)
        // Pass context for async mappers that need to query data
        mappedData = await mapping.mapper(processedData, context);
      } else {
        // Mapper expects single entry (e.g., medications, allergies)
        mappedData = processedData.map(mapping.mapper);
      }

      console.log(`🔍 [GridLoader] ${category}: mapped to ${mappedData?.length || 0} rows`);

      // Debug: Log first row structure for problematic categories
      if (['clinical_scores', 'prognosis', 'providers', 'patient_education_records'].includes(category) && mappedData && mappedData.length > 0) {
        console.log(`🔍 [GridLoader] ${category} OUTPUT ROW:`, JSON.stringify(mappedData[0]));
        console.log(`🔍 [GridLoader] ${category} columns:`, mapping.columns);
      }
    } catch (error) {
      console.error(`❌ [GridLoader] Error mapping ${category}:`, error.message);
      mappedData = [];
    }

    // Return grid configuration with gridFormat flag for frontend
    return {
      category: category,
      title: mapping.title,
      columns: mapping.columns,
      headers: mapping.headers || mapping.columns, // Use headers if available, otherwise columns
      data: mappedData,
      gridFormat: true, // CRITICAL: Required by UniversalGridDisplay
      displayTitle: mapping.title
    };
  }

  /**
   * Get all available categories
   * @returns {Array<string>} List of category names with mappings
   */
  getAvailableCategories() {
    return Object.keys(this.gridMappings);
  }

  /**
   * Check if a category has a grid mapping
   * @param {string} category - Category name
   * @returns {boolean} True if mapping exists
   */
  hasMapping(category) {
    return Boolean(this.gridMappings[category]);
  }

  /**
   * Get statistics about grid mappings
   * @returns {Object} Stats object
   */
  getStats() {
    return {
      totalMappings: Object.keys(this.gridMappings).length,
      categories: Object.keys(this.gridMappings)
    };
  }
}

// Export singleton instance
module.exports = new GridLoader();
