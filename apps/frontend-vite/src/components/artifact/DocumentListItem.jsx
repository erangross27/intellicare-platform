import React from 'react';
import './DocumentListItem.css';

/**
 * DocumentListItem - Individual document card in list
 *
 * Displays a single document with title, preview text, and date.
 * Highlights the latest document with a badge.
 *
 * Props:
 * - document: object - Document data { _id, title, preview, date, isLatest }
 * - onClick: function - Callback when item is clicked
 * - categoryName: string - Optional category name to display as title
 */
const DocumentListItem = ({ document, onClick, categoryName }) => {
  // Extract date from multiple possible locations
  const extractDate = (doc) => {
    if (!doc) return null;
    // Direct date field
    if (doc.date) return doc.date;
    // MongoDB $date format
    if (doc.date?.$date) return doc.date.$date;
    // Nested in documentData
    if (doc.documentData?.date) return doc.documentData.date;
    // Nested in _records array
    if (doc._records?.[0]?.date) return doc._records[0].date;
    if (doc.documentData?._records?.[0]?.date) return doc.documentData._records[0].date;
    // Date in data wrapper
    if (doc.data?.date) return doc.data.date;
    // createdAt fallback
    if (doc.createdAt) return doc.createdAt;
    if (doc.createdAtUTC) return doc.createdAtUTC;
    return null;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';

    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      // Today
      if (diffDays === 0) {
        const hours = date.getHours();
        const minutes = date.getMinutes();
        return `Today at ${hours}:${minutes.toString().padStart(2, '0')}`;
      }

      // Yesterday
      if (diffDays === 1) {
        return 'Yesterday';
      }

      // Within last 7 days
      if (diffDays < 7) {
        return `${diffDays} days ago`;
      }

      // Older - show actual date
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      const day = date.getDate();
      const year = date.getFullYear();
      const currentYear = now.getFullYear();

      if (year === currentYear) {
        return `${month} ${day}`;
      } else {
        return `${month} ${day}, ${year}`;
      }
    } catch (err) {
      console.error('[DocumentListItem] Error formatting date:', err);
      return 'Unknown date';
    }
  };

  const handleClick = () => {
    onClick();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  // Determine icon based on title/category
  const getDocumentIcon = () => {
    const title = (document.title || '').toLowerCase();
    if (title.includes('medication') || title.includes('med')) {
      return '💊';
    } else if (title.includes('lab')) {
      return '🔬';
    } else if (title.includes('vital')) {
      return '❤️';
    } else if (title.includes('allerg')) {
      return '⚠️';
    } else if (title.includes('discharge')) {
      return '🏥';
    } else {
      return '📋';
    }
  };

  return (
    <div
      className={`document-list-item ${document.isLatest ? 'latest' : ''}`}
      onClick={handleClick}
      onKeyPress={handleKeyPress}
      role="button"
      tabIndex={0}
    >
      <div className="document-item-icon">{getDocumentIcon()}</div>
      <div className="document-item-info">
        <div className="document-item-title">
          {categoryName || document.title || 'Document'}
        </div>
        {document.preview && (
          <div className="document-item-preview">
            {document.preview}
          </div>
        )}
        <div className="document-item-meta">
          <span className="document-item-date">
            {formatDate(extractDate(document))}
          </span>
          {document.isLatest && (
            <span className="latest-badge">Latest</span>
          )}
        </div>
      </div>
      <div className="document-item-arrow">›</div>
    </div>
  );
};

export default DocumentListItem;
