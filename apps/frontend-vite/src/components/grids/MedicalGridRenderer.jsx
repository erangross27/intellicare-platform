import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getRenderer } from './renderers';

/**
 * MedicalGridRenderer - Universal medical data grid component
 * Supports all 184 medical GET functions with custom renderers
 * Matches GREY-chat-single-category.html mockup design
 */
const MedicalGridRenderer = ({ data, language = 'en' }) => {
  const [sortConfig, setSortConfig] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(999999); // Show all records - no pagination
  const [filterText, setFilterText] = useState('');
  const [selectedRows, setSelectedRows] = useState([]);
  const [copiedFeedback, setCopiedFeedback] = useState(null); // Track copied cell for feedback
  const [toastMessage, setToastMessage] = useState(null); // Toast notification at top
  const [isPinned, setIsPinned] = useState(false); // Track if this grid is pinned

  const isRTL = language === 'he';

  // Extract data from message
  const {
    data: gridData = [],
    columns = [],
    headers = [],
    displayTitle = 'Medical Data',
    patientName, // Patient name from backend response
    hiddenColumns = [],
    cellRenderers = {},
    sortableColumns = [],
    filterableColumns = [],
    frozenColumns = [],
    quickFilters = [],
    features = {},
    performance = {},
    statistics = {}
  } = data || {};

  // Filter out hidden columns
  const visibleColumns = columns.filter(col => !hiddenColumns.includes(col));
  const visibleHeaders = headers.filter((_, index) => !hiddenColumns.includes(columns[index]));

  // Filter data
  const filteredData = useMemo(() => {
    if (!filterText) return gridData;

    return gridData.filter(row => {
      return Object.values(row).some(value =>
        String(value).toLowerCase().includes(filterText.toLowerCase())
      );
    });
  }, [gridData, filterText]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;

    const sorted = [...filteredData];
    sorted.sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return sorted;
  }, [filteredData, sortConfig]);

  // Paginate data
  const paginatedData = useMemo(() => {
    const start = currentPage * rowsPerPage;
    return sortedData.slice(start, start + rowsPerPage);
  }, [sortedData, currentPage, rowsPerPage]);

  // Check if this grid is already pinned
  useEffect(() => {
    const checkIfPinned = () => {
      try {
        if (!patientName) return; // Skip if no patient name available yet
        const existingPins = JSON.parse(localStorage.getItem('pinnedGrids') || '[]');
        const alreadyPinned = existingPins.some(pin =>
          pin.title === displayTitle && pin.patientName === patientName
        );
        setIsPinned(alreadyPinned);
      } catch (err) {
        console.error('Failed to check pinned status:', err);
      }
    };

    checkIfPinned();

    // Listen for pin updates
    const handlePinUpdate = () => {
      checkIfPinned();
    };

    window.addEventListener('pinnedGridsUpdated', handlePinUpdate);
    return () => window.removeEventListener('pinnedGridsUpdated', handlePinUpdate);
  }, [displayTitle, patientName]);

  // Handle sorting
  const handleSort = (column) => {
    if (!sortableColumns.includes(column) && sortableColumns.length > 0) return;

    setSortConfig(prevConfig => ({
      key: column,
      direction: prevConfig?.key === column && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Copy cell value to clipboard (works without HTTPS)
  const copyToClipboard = async (value) => {
    try {
      const textToCopy = value === null || value === undefined ? '--' : String(value);

      // Fallback for non-HTTPS (dev environment)
      const textarea = document.createElement('textarea');
      textarea.value = textToCopy;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);

      // Show toast notification at top
      setToastMessage(`Copied: ${textToCopy.substring(0, 30)}${textToCopy.length > 30 ? '...' : ''}`);
      setTimeout(() => setToastMessage(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Copy entire row to clipboard (works without HTTPS)
  const copyRow = async (row, rowIndex) => {
    try {
      // Format row data as readable text
      const rowText = visibleColumns
        .map((col, idx) => {
          const header = visibleHeaders[idx] || col;
          const value = row[col] === null || row[col] === undefined ? '--' : String(row[col]);
          return `${header}: ${value}`;
        })
        .join('\n');

      // Fallback for non-HTTPS (dev environment)
      const textarea = document.createElement('textarea');
      textarea.value = rowText;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);

      // Show "Copied!" feedback
      setCopiedFeedback(`row-${rowIndex}`);
      setTimeout(() => setCopiedFeedback(null), 2000);
    } catch (err) {
      console.error('Failed to copy row:', err);
    }
  };

  // Copy entire table to clipboard with aligned columns
  const copyAllTable = async () => {
    try {
      // Format headers with tabs
      const headerRow = visibleHeaders.join('\t');

      // Format all data rows with tabs
      const dataRows = paginatedData.map(row =>
        visibleColumns.map(col => {
          const value = row[col] === null || row[col] === undefined ? '--' : String(row[col]);
          return value;
        }).join('\t')
      ).join('\n');

      const tableText = `${displayTitle}\n\n${headerRow}\n${dataRows}`;

      // Fallback for non-HTTPS (dev environment)
      const textarea = document.createElement('textarea');
      textarea.value = tableText;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);

      // Show "Copied!" feedback
      setCopiedFeedback('copy-all');
      setTimeout(() => setCopiedFeedback(null), 2000);
    } catch (err) {
      console.error('Failed to copy table:', err);
    }
  };

  // Export table to Excel (CSV format)
  const exportToExcel = () => {
    try {
      // Calculate max width for each column
      const columnWidths = visibleColumns.map((col, idx) => {
        const headerLength = (visibleHeaders[idx] || col).length;
        const maxDataLength = Math.max(
          ...paginatedData.map(row => {
            const value = row[col] === null || row[col] === undefined ? '-' : String(row[col]);
            return value.length;
          }),
          0
        );
        return Math.max(headerLength, maxDataLength);
      });

      // Pad value to specified width
      const padValue = (value, width) => {
        return value.padEnd(width, ' ');
      };

      // Format headers with padding
      const headerRow = visibleHeaders
        .map((header, idx) => padValue(header, columnWidths[idx]))
        .join(',');

      // Format all data rows with padding
      const dataRows = paginatedData.map(row =>
        visibleColumns.map((col, idx) => {
          const value = row[col] === null || row[col] === undefined ? '-' : String(row[col]);
          return padValue(value, columnWidths[idx]);
        }).join(',')
      ).join('\n');

      const csvContent = `${headerRow}\n${dataRows}`;

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${displayTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Show "Exported!" feedback
      setCopiedFeedback('export');
      setTimeout(() => setCopiedFeedback(null), 2000);
    } catch (err) {
      console.error('Failed to export:', err);
    }
  };

  // Toggle pin/unpin grid
  const togglePinGrid = () => {
    try {
      // Use patientName from top-level data (already extracted above)
      const existingPins = JSON.parse(localStorage.getItem('pinnedGrids') || '[]');

      if (isPinned) {
        // Unpin: Remove from localStorage
        const updated = existingPins.filter(pin =>
          !(pin.title === displayTitle && pin.patientName === patientName)
        );
        localStorage.setItem('pinnedGrids', JSON.stringify(updated));
        setIsPinned(false);

        // Dispatch event so ChatContainer can remove undiscussed grids
        window.dispatchEvent(new CustomEvent('gridUnpinned', {
          detail: {
            title: displayTitle,
            patientName: patientName,
            timestamp: new Date().toISOString()
          }
        }));

        // Show "Unpinned!" feedback
        setCopiedFeedback('unpin');
        setTimeout(() => setCopiedFeedback(null), 2000);
      } else {
        // Pin: Add to localStorage
        const gridInfo = {
          title: displayTitle,
          patientName: patientName,
          timestamp: new Date().toISOString(),
          recordCount: totalCount,
          data: data
        };

        existingPins.unshift(gridInfo); // Add to beginning
        localStorage.setItem('pinnedGrids', JSON.stringify(existingPins));
        setIsPinned(true);

        // Show "Pinned!" feedback
        setCopiedFeedback('pin');
        setTimeout(() => setCopiedFeedback(null), 2000);
      }

      // Trigger custom event to update sidebar
      window.dispatchEvent(new Event('pinnedGridsUpdated'));
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  };

  // Render cell with custom renderer if available
  const renderCell = (value, column, row) => {
    const rendererName = cellRenderers[column];
    if (rendererName) {
      const Renderer = getRenderer(rendererName);
      if (Renderer) {
        return <Renderer value={value} row={row} />;
      }
    }

    // Default rendering
    if (value === null || value === undefined) return <span style={{color: '#8e8ea0'}}>--</span>;
    if (typeof value === 'boolean') return value ? '✓' : '✗';
    if (typeof value === 'object') return JSON.stringify(value);

    // Preserve newlines in text
    const text = String(value);
    if (text.includes('\n')) {
      return <span style={{whiteSpace: 'pre-wrap'}}>{text}</span>;
    }
    return text;
  };

  // If no data, show empty state
  if (!gridData || gridData.length === 0) {
    return (
      <div style={{
        padding: '32px',
        textAlign: 'center',
        color: '#8e8ea0'
      }}>
        <div style={{fontSize: '48px', marginBottom: '16px'}}>📋</div>
        <p>No data available</p>
      </div>
    );
  }

  // Get category icon based on displayTitle
  const getCategoryIcon = (title) => {
    const titleLower = title.toLowerCase();
    if (titleLower.includes('medication')) return '💊';
    if (titleLower.includes('cardiology') || titleLower.includes('heart')) return '❤️';
    if (titleLower.includes('lab')) return '🧪';
    if (titleLower.includes('appointment')) return '📅';
    if (titleLower.includes('procedure')) return '⚕️';
    if (titleLower.includes('imaging')) return '📷';
    if (titleLower.includes('diagnosis')) return '🔬';
    return '📋';
  };

  // Extract stats from statistics object or calculate from data
  const stats = statistics || {};
  const totalCount = filteredData.length;

  return (
    <div style={{
      background: '#444654',
      borderRadius: '16px',
      padding: '28px',
      margin: '16px 0',
      border: '1px solid #565869',
      direction: isRTL ? 'rtl' : 'ltr',
      position: 'relative'
    }}>
      {/* Card Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '24px',
        gap: '16px'
      }}>
        <div style={{
          fontSize: '32px',
          lineHeight: '1'
        }}>
          {getCategoryIcon(displayTitle)}
        </div>
        <div style={{flex: 1}}>
          <h3 style={{
            fontSize: '22px',
            fontWeight: '700',
            marginBottom: '4px',
            color: '#ececf1',
            margin: 0
          }}>
            {displayTitle}
          </h3>
          <div style={{
            fontSize: '13px',
            opacity: 0.7,
            color: '#c5c5d2'
          }}>
            {`Medical records • ${totalCount} ${totalCount === 1 ? 'entry' : 'entries'}`}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
          {/* Copy All Button */}
          <button
            onClick={copyAllTable}
            style={{
              background: copiedFeedback === 'copy-all' ? '#9ca3af' : '#565869',
              color: '#ececf1',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => {
              if (copiedFeedback !== 'copy-all') {
                e.target.style.background = '#6b7280';
              }
            }}
            onMouseLeave={(e) => {
              if (copiedFeedback !== 'copy-all') {
                e.target.style.background = '#565869';
              }
            }}
            title="Copy entire table"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            {copiedFeedback === 'copy-all' ? 'Copied!' : 'Copy All'}
          </button>

          {/* Export to Excel Button */}
          <button
            onClick={exportToExcel}
            style={{
              background: copiedFeedback === 'export' ? '#9ca3af' : '#565869',
              color: '#ececf1',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => {
              if (copiedFeedback !== 'export') {
                e.target.style.background = '#6b7280';
              }
            }}
            onMouseLeave={(e) => {
              if (copiedFeedback !== 'export') {
                e.target.style.background = '#565869';
              }
            }}
            title="Export to Excel (CSV)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {copiedFeedback === 'export' ? 'Exported!' : 'Export'}
          </button>

          {/* Pin/Unpin Button */}
          <button
            onClick={togglePinGrid}
            style={{
              background: copiedFeedback === 'pin' || copiedFeedback === 'unpin' ? '#9ca3af' : (isPinned ? '#6b7280' : '#565869'),
              color: '#ececf1',
              border: isPinned ? '1px solid #8e8ea0' : 'none',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => {
              if (copiedFeedback !== 'pin' && copiedFeedback !== 'unpin') {
                e.target.style.background = isPinned ? '#565869' : '#6b7280';
              }
            }}
            onMouseLeave={(e) => {
              if (copiedFeedback !== 'pin' && copiedFeedback !== 'unpin') {
                e.target.style.background = isPinned ? '#6b7280' : '#565869';
              }
            }}
            title={isPinned ? 'Unpin from sidebar' : 'Pin to sidebar for quick access'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {isPinned ? (
                // Pinned icon (filled pin or checkmark)
                <>
                  <path d="M12 17v5"/>
                  <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1v3.76z"/>
                  <line x1="4" y1="4" x2="20" y2="20" strokeWidth="2.5"/>
                </>
              ) : (
                // Unpinned icon (outline pin)
                <>
                  <path d="M12 17v5"/>
                  <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1v3.76z"/>
                </>
              )}
            </svg>
            {copiedFeedback === 'pin' ? 'Pinned!' : copiedFeedback === 'unpin' ? 'Unpinned!' : (isPinned ? 'Unpin' : 'Pin')}
          </button>

          {/* Record Count Badge */}
          <div style={{
            background: '#363a46',
            padding: '6px 14px',
            borderRadius: '16px',
            fontSize: '12px',
            fontWeight: '600',
            color: '#ececf1'
          }}>
            {totalCount} {totalCount === 1 ? 'Record' : 'Records'}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#363a46',
          color: '#ececf1',
          padding: '10px 20px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: '600',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          border: '1px solid #565869',
          zIndex: 1000,
          whiteSpace: 'nowrap',
          animation: 'fadeInOut 2s ease-in-out'
        }}>
          ✓ {toastMessage}
        </div>
      )}

      {/* Stats Grid (if statistics provided) */}
      {Object.keys(stats).length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '14px',
          marginBottom: '20px'
        }}>
          {Object.entries(stats).map(([key, value]) => {
            if (key === 'subtitle') return null;
            return (
              <div key={key} style={{
                background: '#363a46',
                border: '1px solid #565869',
                borderRadius: '10px',
                padding: '14px'
              }}>
                <div style={{
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  opacity: 0.7,
                  marginBottom: '6px',
                  color: '#c5c5d2'
                }}>
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </div>
                <div style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  color: '#ececf1'
                }}>
                  {value}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Data Table */}
      <div style={{
        background: '#363a46',
        border: '1px solid #565869',
        borderRadius: '10px',
        overflow: 'hidden'
      }}>
        <div style={{
          maxHeight: '600px',
          overflowY: 'auto',
          overflowX: 'auto'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse'
          }}>
          <thead style={{
            background: '#2a2d3a',
            position: 'sticky',
            top: 0,
            zIndex: 10
          }}>
            <tr>
              {visibleColumns.map((column, index) => (
                <th
                  key={column}
                  style={{
                    padding: '12px 14px',
                    textAlign: isRTL ? 'right' : 'left',
                    fontSize: '12px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: '#ececf1',
                    cursor: sortableColumns.includes(column) || sortableColumns.length === 0 ? 'pointer' : 'default',
                    userSelect: 'none',
                    background: '#2a2d3a',
                    whiteSpace: 'nowrap',
                    fontStretch: 'normal'
                  }}
                  onClick={() => handleSort(column)}
                  onMouseEnter={(e) => {
                    if (sortableColumns.includes(column) || sortableColumns.length === 0) {
                      e.target.style.background = '#363a46';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = '#2a2d3a';
                  }}
                >
                  <div style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
                    {visibleHeaders[index] || column}
                    {sortConfig?.key === column && (
                      <span style={{fontSize: '10px'}}>
                        {sortConfig.direction === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
              {/* Actions column header */}
              <th
                style={{
                  padding: '12px 14px',
                  textAlign: 'center',
                  fontSize: '12px',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: '#ececf1',
                  userSelect: 'none',
                  background: '#2a2d3a',
                  width: '80px'
                }}
              >
                ACTIONS
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, rowIndex) => {
              // Get medication group background color
              const getGroupColor = (groupIndex) => {
                if (!groupIndex) return 'transparent';

                // Special categories
                if (groupIndex === 9998) return '#4a3030'; // Dark red for Adherence Risk (entire regimen)
                if (groupIndex === 9999) return '#3d4a30'; // Dark olive for Simplification

                // Regular medication groups
                const colors = [
                  '#2d3748', // Dark blue-gray (group 1)
                  '#2d4a3e', // Dark green (group 2)
                  '#4a3832', // Dark brown (group 3)
                  '#3a2d4a', // Dark purple (group 4)
                  '#4a3a2d', // Dark orange (group 5)
                  '#2d4a4a'  // Dark teal (group 6)
                ];
                return colors[(groupIndex - 1) % colors.length];
              };

              const baseBackground = getGroupColor(row._medicationGroup);

              return (
              <tr
                key={rowIndex}
                style={{
                  background: baseBackground,
                  borderBottom: rowIndex < paginatedData.length - 1 ? '1px solid #4a4d58' : 'none'
                }}
              >
                {visibleColumns.map(column => {
                  return (
                    <td
                      key={column}
                      style={{
                        padding: '12px 14px',
                        fontSize: '14px',
                        color: '#c5c5d2',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                        verticalAlign: 'top'
                      }}
                      onClick={() => copyToClipboard(row[column])}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#4a4d58';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                      title="Click to copy"
                    >
                      {renderCell(row[column], column, row)}
                    </td>
                  );
                })}

                {/* Copy Row button */}
                <td style={{
                  padding: '12px 14px',
                  textAlign: 'center'
                }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyRow(row, rowIndex);
                    }}
                    style={{
                      background: copiedFeedback === `row-${rowIndex}` ? '#9ca3af' : '#565869',
                      color: '#ececf1',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      fontSize: '11px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      margin: '0 auto',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (copiedFeedback !== `row-${rowIndex}`) {
                        e.target.style.background = '#6b7280';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (copiedFeedback !== `row-${rowIndex}`) {
                        e.target.style.background = '#565869';
                      }
                    }}
                    title="Copy entire row"
                  >
                    {copiedFeedback === `row-${rowIndex}` ? (
                      <>Copied!</>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* Footer hint */}
      {totalCount > 10 && (
        <div style={{
          marginTop: '20px',
          paddingTop: '20px',
          borderTop: '1px solid #565869',
          fontSize: '13px',
          opacity: 0.7,
          textAlign: 'center',
          color: '#c5c5d2'
        }}>
          💡 Showing {Math.min(rowsPerPage, filteredData.length)} of {totalCount} total records
        </div>
      )}
    </div>
  );
};

export default MedicalGridRenderer;
