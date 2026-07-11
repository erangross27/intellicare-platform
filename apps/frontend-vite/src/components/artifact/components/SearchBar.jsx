import React, { useRef, useEffect } from 'react';
import './SearchBar.css';

/**
 * Reusable search bar component for document templates
 * Supports Ctrl+Z (undo) by using uncontrolled input with ref sync
 * @param {string} searchTerm - Current search term
 * @param {function} onSearchChange - Callback when search term changes
 * @param {string} placeholder - Placeholder text
 */
const SearchBar = ({ searchTerm, onSearchChange, placeholder }) => {
  const inputRef = useRef(null);

  // Sync input value when searchTerm changes externally (e.g., clear button)
  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== searchTerm) {
      inputRef.current.value = searchTerm;
    }
  }, [searchTerm]);

  const handleClear = () => {
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    onSearchChange('');
  };

  return (
    <div className="search-container">
      <input
        ref={inputRef}
        type="text"
        className="search-input"
        placeholder={placeholder || 'Search...'}
        defaultValue={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      {searchTerm && (
        <button className="search-clear" onClick={handleClear}>
          ✕
        </button>
      )}
    </div>
  );
};

export default SearchBar;
