import React, { useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import CategoriesListPDFTemplate from './artifact/pdf-templates/CategoriesListPDFTemplate';

/**
 * CategoriesListExport - Export buttons for medical data categories list
 *
 * Provides TXT, CSV, and PDF export functionality for the list of available
 * medical data categories. Uses client-side file generation with existing
 * @react-pdf/renderer and file-saver libraries.
 *
 * Props:
 * - categories: Array of category objects with name, displayName, count, lastUpdated
 * - patientName: Patient's full name for filename and document header
 * - patientId: Patient ID for document header
 */
const CategoriesListExport = ({ categories, patientName, patientId, onExportComplete, isDropdown = false }) => {
  const [exporting, setExporting] = useState(null);

  // Generate safe filename from patient name
  const getSafeFileName = (extension) => {
    const safeName = (patientName || 'Patient')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_');
    const timestamp = new Date().toISOString().split('T')[0];
    return `${safeName}_Medical_Categories_${timestamp}.${extension}`;
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  // Export to TXT format
  const exportToTXT = () => {
    try {
      setExporting('txt');

      let text = 'MEDICAL DATA CATEGORIES\n';
      text += '═'.repeat(60) + '\n\n';

      if (patientName) {
        text += `Patient: ${patientName}\n`;
      }
      if (patientId) {
        text += `Patient ID: ${patientId}\n`;
      }
      text += `Generated: ${new Date().toLocaleString()}\n\n`;

      text += 'Summary:\n';
      text += `─`.repeat(60) + '\n';
      const totalDocs = categories.reduce((sum, cat) => sum + cat.count, 0);
      const totalCats = categories.length - 1; // Exclude "Full Report"
      text += `Total Categories: ${totalCats}\n`;
      text += `Total Documents: ${totalDocs}\n\n`;

      text += 'Categories List:\n';
      text += `─`.repeat(60) + '\n\n';

      categories.forEach((category, index) => {
        text += `${index + 1}. ${category.displayName || category.name}\n`;
        text += `   Documents: ${category.count}\n`;
        if (category.lastUpdated) {
          text += `   Last Updated: ${formatDate(category.lastUpdated)}\n`;
        }
        text += '\n';
      });

      text += '\n' + '═'.repeat(60) + '\n';
      text += 'IntelliCare Medical Report - Confidential Patient Information\n';

      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      saveAs(blob, getSafeFileName('txt'));

      setExporting(null);
      if (onExportComplete) onExportComplete();
    } catch (error) {
      console.error('Failed to export TXT:', error);
      alert(`TXT Export Error: ${error.message}`);
      setExporting(null);
    }
  };

  // Export to CSV format
  const exportToCSV = () => {
    try {
      setExporting('csv');

      // CSV Header
      let csv = 'Number,Category Name,Display Name,Document Count,Last Updated\n';

      // CSV Rows
      categories.forEach((category, index) => {
        const number = index + 1;
        const name = `"${(category.name || '').replace(/"/g, '""')}"`;
        const displayName = `"${(category.displayName || '').replace(/"/g, '""')}"`;
        const count = category.count || 0;
        const lastUpdated = category.lastUpdated ? `"${formatDate(category.lastUpdated)}"` : '""';

        csv += `${number},${name},${displayName},${count},${lastUpdated}\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      saveAs(blob, getSafeFileName('csv'));

      setExporting(null);
      if (onExportComplete) onExportComplete();
    } catch (error) {
      console.error('Failed to export CSV:', error);
      alert(`CSV Export Error: ${error.message}`);
      setExporting(null);
    }
  };

  // Export to PDF format
  const exportToPDF = async () => {
    try {
      setExporting('pdf');

      // Generate PDF blob using @react-pdf/renderer
      const blob = await pdf(
        <CategoriesListPDFTemplate
          categories={categories}
          patientName={patientName}
          patientId={patientId}
        />
      ).toBlob();

      saveAs(blob, getSafeFileName('pdf'));

      setExporting(null);
      if (onExportComplete) onExportComplete();
    } catch (error) {
      console.error('Failed to export PDF:', error);
      alert(`PDF Export Error: ${error.message}`);
      setExporting(null);
    }
  };

  // Dropdown menu item style
  const dropdownItemStyle = {
    width: '100%',
    padding: '10px 16px',
    background: 'transparent',
    border: 'none',
    cursor: exporting !== null ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: '#ececf1',
    fontSize: '13px',
    fontFamily: '"Courier New", "Monaco", "Menlo", "Consolas", monospace',
    textAlign: 'left',
    transition: 'background 0.2s ease',
    opacity: exporting !== null ? 0.5 : 1
  };

  if (isDropdown) {
    // Render as dropdown menu items
    return (
      <>
        <button
          onClick={exportToTXT}
          disabled={exporting !== null}
          style={dropdownItemStyle}
          onMouseEnter={(e) => {
            if (exporting === null) {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          {exporting === 'txt' ? 'Exporting...' : 'Export as TXT'}
        </button>

        <button
          onClick={exportToCSV}
          disabled={exporting !== null}
          style={dropdownItemStyle}
          onMouseEnter={(e) => {
            if (exporting === null) {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
            <line x1="9" y1="18" x2="15" y2="18"/>
          </svg>
          {exporting === 'csv' ? 'Exporting...' : 'Export as CSV'}
        </button>

        <button
          onClick={exportToPDF}
          disabled={exporting !== null}
          style={dropdownItemStyle}
          onMouseEnter={(e) => {
            if (exporting === null) {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
          {exporting === 'pdf' ? 'Exporting...' : 'Export as PDF'}
        </button>
      </>
    );
  }

  // Render as inline buttons (original design)
  return (
    <>
      {/* TXT Export Button */}
      <button
        onClick={exportToTXT}
        disabled={exporting !== null}
        style={{
          background: 'transparent',
          border: 'none',
          borderRadius: '6px',
          padding: '6px 10px',
          cursor: exporting !== null ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          transition: 'all 0.2s ease',
          color: exporting === 'txt' ? '#667eea' : '#8e8ea0',
          fontSize: '13px',
          fontFamily: '"Courier New", "Monaco", "Menlo", "Consolas", monospace',
          fontWeight: '500',
          opacity: exporting !== null && exporting !== 'txt' ? 0.5 : 1
        }}
        onMouseEnter={(e) => {
          if (exporting === null) {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.color = '#ececf1';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = '#8e8ea0';
        }}
        title="Export as plain text file"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
        {exporting === 'txt' ? 'Exporting...' : 'Export TXT'}
      </button>

      {/* CSV Export Button */}
      <button
        onClick={exportToCSV}
        disabled={exporting !== null}
        style={{
          background: 'transparent',
          border: 'none',
          borderRadius: '6px',
          padding: '6px 10px',
          cursor: exporting !== null ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          transition: 'all 0.2s ease',
          color: exporting === 'csv' ? '#667eea' : '#8e8ea0',
          fontSize: '13px',
          fontFamily: '"Courier New", "Monaco", "Menlo", "Consolas", monospace',
          fontWeight: '500',
          opacity: exporting !== null && exporting !== 'csv' ? 0.5 : 1
        }}
        onMouseEnter={(e) => {
          if (exporting === null) {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.color = '#ececf1';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = '#8e8ea0';
        }}
        title="Export as CSV spreadsheet"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="9" y1="15" x2="15" y2="15"/>
          <line x1="9" y1="18" x2="15" y2="18"/>
          <line x1="9" y1="12" x2="12" y2="12"/>
        </svg>
        {exporting === 'csv' ? 'Exporting...' : 'Export CSV'}
      </button>

      {/* PDF Export Button */}
      <button
        onClick={exportToPDF}
        disabled={exporting !== null}
        style={{
          background: 'transparent',
          border: 'none',
          borderRadius: '6px',
          padding: '6px 10px',
          cursor: exporting !== null ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          transition: 'all 0.2s ease',
          color: exporting === 'pdf' ? '#667eea' : '#8e8ea0',
          fontSize: '13px',
          fontFamily: '"Courier New", "Monaco", "Menlo", "Consolas", monospace',
          fontWeight: '500',
          opacity: exporting !== null && exporting !== 'pdf' ? 0.5 : 1
        }}
        onMouseEnter={(e) => {
          if (exporting === null) {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.color = '#ececf1';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = '#8e8ea0';
        }}
        title="Export as PDF document"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="12" y1="18" x2="12" y2="12"/>
          <line x1="9" y1="15" x2="15" y2="15"/>
        </svg>
        {exporting === 'pdf' ? 'Exporting...' : 'Export PDF'}
      </button>
    </>
  );
};

export default CategoriesListExport;
