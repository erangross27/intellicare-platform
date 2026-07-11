import { useState, useMemo } from 'react';

/**
 * Custom hook for searching through document data
 * @param {Array} items - Array of items to search through
 * @param {Array<string>} searchFields - Array of field names to search in
 * @returns {Object} - { searchTerm, setSearchTerm, filteredItems }
 */
export const useDocumentSearch = (items, searchFields) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) {
      return items;
    }

    const searchLower = searchTerm.toLowerCase();

    return items.filter(item => {
      return searchFields.some(field => {
        // Handle nested fields (e.g., 'medication.name')
        const value = field.split('.').reduce((obj, key) => obj?.[key], item);

        if (value === null || value === undefined) {
          return false;
        }

        // Convert to string and search
        return value.toString().toLowerCase().includes(searchLower);
      });
    });
  }, [items, searchTerm, searchFields]);

  return {
    searchTerm,
    setSearchTerm,
    filteredItems
  };
};
