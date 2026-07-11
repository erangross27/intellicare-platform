/**
 * Collection-Specific Formatters Index
 *
 * This file dynamically loads all collection-specific formatters.
 * Each collection has its own formatter file that knows how to format that collection's data.
 *
 * Usage:
 *   const formatters = require('./collectionFormatters');
 *   const formatter = formatters['follow_up_intelligence'];
 *   const formatted = formatter(document);
 */

const fs = require('fs');
const path = require('path');

const formatters = {};

// Dynamically load all formatter files in this directory
const formatterFiles = fs.readdirSync(__dirname)
  .filter(file => file.endsWith('.js') && file !== 'index.js');

formatterFiles.forEach(file => {
  const collectionName = file.replace('.js', '');
  try {
    formatters[collectionName] = require(path.join(__dirname, file));
  } catch (error) {
    console.error(`Failed to load formatter for ${collectionName}:`, error.message);
  }
});

console.log(`📋 Loaded ${Object.keys(formatters).length} collection-specific formatters`);

module.exports = formatters;
