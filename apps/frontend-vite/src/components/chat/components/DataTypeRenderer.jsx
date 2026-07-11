import React, { useState } from 'react';
import typography from '../styles/typography';

const { colors, fontFamily, fontSize, fontWeight, componentStyles } = typography;

// Detect data type from content
const detectDataType = (content) => {
  if (!content || typeof content !== 'string') return 'text';

  // IMPORTANT: Skip detection for conversational text (AI responses with explanations)
  // Only handle PURE structured data formats (tables, JSON)
  // This prevents discarding explanatory text from AI responses
  const isConversational = content.match(/\b(I can|I see|Yes|No|Here|The grid shows|Would you like|Let me|However|Additionally|Note that)\b/i) ||
                          content.includes('?') || // Has questions
                          content.match(/\.\s+[A-Z]/); // Has multiple sentences

  if (isConversational) {
    return 'text'; // Let markdown parser handle conversational content
  }

  // Check for table patterns (markdown tables)
  if (content.includes('|') && content.split('\n').some(line => line.includes('---'))) {
    return 'table';
  }

  // Check for JSON (pure JSON only)
  try {
    const trimmed = content.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      JSON.parse(trimmed);
      return 'json';
    }
  } catch {}

  // For everything else, use markdown parser
  // This ensures AI responses with lists, medical terms, etc. are fully preserved
  return 'text';
};

// Parse markdown table to structured data
const parseTable = (content) => {
  const lines = content.split('\n').filter(line => line.trim());
  const headers = [];
  const rows = [];

  let headerFound = false;
  let separatorFound = false;

  for (const line of lines) {
    if (!line.includes('|')) continue;

    const cells = line.split('|')
      .map(cell => cell.trim())
      .filter(cell => cell);

    if (!headerFound) {
      headers.push(...cells);
      headerFound = true;
    } else if (line.includes('---')) {
      separatorFound = true;
    } else if (separatorFound) {
      rows.push(cells);
    }
  }

  return { headers, rows };
};

// Table renderer - Clean professional display
const TableRenderer = ({ content, isRTL }) => {
  const { headers, rows } = parseTable(content);

  if (headers.length === 0) return null;

  return (
    <div style={{
      overflowX: 'auto',
      marginTop: '16px',
      marginBottom: '16px'
    }}>
      <table style={{
        width: '100%',
        borderCollapse: 'separate',
        borderSpacing: '0',
        direction: isRTL ? 'rtl' : 'ltr',
        fontSize: '15px'
      }}>
        <thead>
          <tr>
            {headers.map((header, i) => (
              <th key={i} style={{
                padding: '8px 12px',
                textAlign: isRTL ? 'right' : 'left',
                whiteSpace: 'nowrap',
                borderBottom: `2px solid ${colors.border.medium}`,
                fontWeight: fontWeight.semibold,
                color: colors.text.primary,
                fontSize: fontSize.regular
              }}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} style={{
                  padding: '8px 12px',
                  textAlign: isRTL ? 'right' : 'left',
                  borderBottom: `1px solid ${colors.border.light}`,
                  color: colors.text.secondary,
                  fontSize: fontSize.regular
                }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Multi-Category Grid Renderer - Multiple grids for different data categories with collapsible sections
const MultiCategoryGridRenderer = ({ categoryGrids, isRTL }) => {
  // State to track which sections are expanded
  const [expandedSections, setExpandedSections] = useState({});

  console.log('🔍 MultiCategoryGridRenderer received:', {
    categoryGrids,
    type: typeof categoryGrids,
    isArray: Array.isArray(categoryGrids),
    length: categoryGrids?.length
  });

  if (!categoryGrids || categoryGrids.length === 0) return null;

  const toggleSection = (category) => {
    setExpandedSections(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  return (
    <div style={{
      marginTop: '16px',
      marginBottom: '16px'
    }}>
      {categoryGrids.map((gridConfig, gridIndex) => {
        // Validate data is an array
        if (!Array.isArray(gridConfig.data)) {
          console.error(`❌ Grid ${gridIndex} (${gridConfig.title}): data is not an array:`, typeof gridConfig.data, gridConfig.data);
          gridConfig.data = []; // Fix it
        }

        const isExpanded = expandedSections[gridConfig.category] !== false; // Default to expanded
        const hasData = gridConfig.data && gridConfig.data.length > 0;

        console.log(`📊 Grid ${gridIndex}:`, {
          title: gridConfig.title,
          columns: gridConfig.columns,
          dataCount: gridConfig.data?.length,
          data: gridConfig.data,
          isExpanded
        });

        return (
        <div key={gridIndex} style={{
          marginBottom: gridIndex < categoryGrids.length - 1 ? '24px' : '0',
          border: `1px solid rgba(255, 255, 255, 0.2)`,
          borderRadius: '16px',
          overflow: 'hidden',
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)'
        }}>
          {/* Collapsible Category Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '18px 24px',
              background: 'rgba(167, 139, 250, 0.15)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'all 0.2s ease',
              ':hover': {
                background: 'rgba(167, 139, 250, 0.25)'
              }
            }}
            onClick={() => toggleSection(gridConfig.category)}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(167, 139, 250, 0.25)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(167, 139, 250, 0.15)'}
          >
            <h3 style={{
              fontSize: '17px',
              fontWeight: 600,
              color: '#ffffff',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              letterSpacing: '0.3px'
            }}>
              <span style={{
                fontSize: '14px',
                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
                display: 'inline-block',
                color: '#4a9eff'
              }}>▶</span>
              {gridConfig.title}
              {hasData && (
                <span style={{
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontWeight: 500,
                  backgroundColor: 'rgba(74, 158, 255, 0.15)',
                  padding: '4px 10px',
                  borderRadius: '12px'
                }}>
                  {gridConfig.data.length} record{gridConfig.data.length !== 1 ? 's' : ''}
                </span>
              )}
            </h3>
            {!hasData && (
              <span style={{
                fontSize: '13px',
                color: colors.text.tertiary || '#999',
                fontStyle: 'italic'
              }}>
                No data available
              </span>
            )}
          </div>

          {/* Category Grid - Only show if expanded and has data */}
          {isExpanded && (
          <div style={{
            overflowX: 'auto',
            maxWidth: '100%',
            padding: hasData ? '4px' : '0'
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              borderSpacing: '0',
              direction: isRTL ? 'rtl' : 'ltr',
              fontSize: '15px',
              tableLayout: 'auto'
            }}>
              <thead>
                <tr>
                  {gridConfig.columns.map((column, i) => {
                    // Use explicit columnWidths if provided, otherwise calculate based on header name
                    let width = 'auto';
                    let minWidth = 'auto';
                    let maxWidth = 'none';

                    if (gridConfig.columnWidths && gridConfig.columnWidths[i]) {
                      // Use explicit width from grid config
                      width = gridConfig.columnWidths[i];
                      minWidth = gridConfig.columnWidths[i];
                      maxWidth = gridConfig.columnWidths[i];
                    } else {
                      // Fallback to auto-calculation based on column name
                      const columnLower = column.toLowerCase();

                      // Short columns that should not wrap
                      if (columnLower.includes('date')) {
                        minWidth = '110px';
                        maxWidth = '130px';
                      } else if (columnLower.includes('type')) {
                        minWidth = '90px';
                        maxWidth = '110px';
                      } else if (columnLower.includes('onset')) {
                        minWidth = '80px';
                        maxWidth = '100px';
                      } else if (columnLower.includes('body') || columnLower.includes('part')) {
                        minWidth = '100px';
                        maxWidth = '120px';
                      } else if (columnLower.includes('system')) {
                        minWidth = '120px';
                        maxWidth = '150px';
                      } else if (columnLower.includes('radiologist') || columnLower.includes('provider')) {
                        minWidth = '130px';
                        maxWidth = '180px';
                      } else if (columnLower.includes('duration') || columnLower.includes('status')) {
                        minWidth = '100px';
                        maxWidth = '130px';
                      }
                    }

                    return (
                    <th key={i} style={{
                      padding: '16px 20px',
                      textAlign: isRTL ? 'right' : 'left',
                      whiteSpace: 'nowrap',
                      borderBottom: '2px solid rgba(167, 139, 250, 0.3)',
                      fontWeight: 600,
                      color: '#ffffff',
                      fontSize: '14px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                      fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
                      width: width,
                      minWidth: minWidth,
                      maxWidth: maxWidth
                    }}>
                      {column}
                    </th>
                  )})}

                </tr>
              </thead>
              <tbody>
                {gridConfig.data.map((row, rowIndex) => (
                  <tr key={rowIndex}
                    style={{
                      background: rowIndex % 2 === 0 ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.06)',
                      transition: 'background-color 0.15s ease',
                      cursor: 'default'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(167, 139, 250, 0.15)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = rowIndex % 2 === 0 ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.06)'}
                  >
                    {Object.values(row).map((cell, cellIndex) => {
                      // Get the column header to determine if it's a short column
                      const columnName = gridConfig.columns[cellIndex]?.toLowerCase() || '';
                      // If columnWidths are explicitly defined, respect them and allow wrapping for all columns
                      const hasExplicitWidth = gridConfig.columnWidths && gridConfig.columnWidths[cellIndex];
                      const isShortColumn = !hasExplicitWidth && (
                                          columnName.includes('date') ||
                                          columnName.includes('type') ||
                                          columnName.includes('onset') ||
                                          columnName.includes('duration') ||
                                          columnName.includes('status'));

                      // Format text with proper line breaks
                      const formatText = (text) => {
                        if (!text || typeof text !== 'string') return text;

                        // Split by numbered items first to preserve treatment plan structure
                        const parts = [];
                        let currentText = text;

                        // Find all numbered items (1. 2. 3. etc.)
                        const numberedSplit = currentText.split(/(?=\s+\d+\.\s+[A-Z])/);

                        numberedSplit.forEach((part, partIdx) => {
                          if (!part.trim()) return;

                          // Check if this part starts with a number
                          const numberMatch = part.match(/^\s*(\d+)\.\s+(.+)/s);
                          if (numberMatch) {
                            parts.push({
                              type: 'numbered',
                              number: numberMatch[1],
                              content: numberMatch[2].trim()
                            });
                          } else {
                            // This is a regular section - check for ALL CAPS headers
                            const headerPattern = /([A-Z][A-Z\s]{8,}?):\s*([^\n]*(?:\n(?![A-Z][A-Z\s]{8,}?:)[^\n]*)*)/g;
                            let lastIndex = 0;
                            let match;

                            while ((match = headerPattern.exec(part)) !== null) {
                              // Add any text before this header
                              if (match.index > lastIndex) {
                                const beforeText = part.substring(lastIndex, match.index).trim();
                                if (beforeText) {
                                  parts.push({ type: 'text', content: beforeText });
                                }
                              }

                              // Add the header with its content
                              parts.push({
                                type: 'header',
                                header: match[1],
                                content: match[2].trim()
                              });

                              lastIndex = match.index + match[0].length;
                            }

                            // Add any remaining text
                            if (lastIndex < part.length) {
                              const remainingText = part.substring(lastIndex).trim();
                              if (remainingText) {
                                parts.push({ type: 'text', content: remainingText });
                              }
                            }
                          }
                        });

                        // Render the parts
                        return parts.map((part, idx) => {
                          if (part.type === 'header') {
                            return (
                              <div key={idx} style={{
                                marginTop: idx > 0 ? '14px' : '0',
                                marginBottom: '8px'
                              }}>
                                <strong style={{
                                  fontWeight: 600,
                                  color: '#e8eaf0',
                                  fontSize: '14px',
                                  letterSpacing: '0.3px'
                                }}>{part.header}:</strong>
                                {' '}
                                <span style={{ color: '#d1d5db' }}>{part.content}</span>
                              </div>
                            );
                          }

                          if (part.type === 'numbered') {
                            // Check if content has a subcategory (ALL CAPS label followed by colon)
                            const subCategoryMatch = part.content.match(/^([A-Z\s]+):\s*(.+)/s);

                            return (
                              <div key={idx} style={{
                                marginTop: '12px',
                                marginBottom: '8px',
                                paddingLeft: '20px',
                                textIndent: '-20px'
                              }}>
                                <strong style={{ color: '#a8b2d1', fontWeight: 600 }}>{part.number}.</strong>
                                {' '}
                                {subCategoryMatch ? (
                                  <>
                                    <strong style={{ fontWeight: 600, color: '#e8eaf0' }}>{subCategoryMatch[1]}:</strong>
                                    {' '}
                                    <span>{subCategoryMatch[2]}</span>
                                  </>
                                ) : (
                                  <span>{part.content}</span>
                                )}
                              </div>
                            );
                          }

                          // Regular text
                          return (
                            <div key={idx} style={{
                              marginBottom: '6px',
                              color: '#d1d5db'
                            }}>{part.content}</div>
                          );
                        });
                      };

                      // Apply columnWidths if provided
                      let cellWidth = 'auto';
                      let cellMinWidth = 'auto';
                      let cellMaxWidth = 'none';

                      if (gridConfig.columnWidths && gridConfig.columnWidths[cellIndex]) {
                        cellWidth = gridConfig.columnWidths[cellIndex];
                        cellMinWidth = gridConfig.columnWidths[cellIndex];
                        cellMaxWidth = gridConfig.columnWidths[cellIndex];
                      }

                      return (
                      <td key={cellIndex} style={{
                        padding: '16px 20px',
                        textAlign: isRTL ? 'right' : 'left',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        color: '#d1d5db',
                        fontSize: '15px',
                        overflow: 'visible',
                        whiteSpace: isShortColumn ? 'nowrap' : 'normal',
                        wordBreak: isShortColumn ? 'keep-all' : 'break-word',
                        lineHeight: '1.7',
                        fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
                        verticalAlign: 'top',
                        width: cellWidth,
                        minWidth: cellMinWidth,
                        maxWidth: cellMaxWidth
                      }}>
                        {cell ? formatText(cell) : <span style={{ color: 'rgba(255, 255, 255, 0.3)', fontStyle: 'italic' }}>-</span>}
                      </td>
                    );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {gridConfig.data.length === 0 && (
              <div style={{
                padding: '20px',
                textAlign: 'center',
                color: colors.text.muted,
                fontSize: '14px'
              }}>
                No data available in this category
              </div>
            )}
          </div>
          )}
        </div>
      )})}
    </div>
  );
};

// JSON renderer with collapsible tree
const JSONRenderer = ({ content, isRTL }) => {
  const [expanded, setExpanded] = useState(true);

  let data;
  try {
    data = JSON.parse(content);
  } catch {
    return null;
  }

  const renderValue = (value, depth = 0) => {
    if (value === null) return <span style={{ color: colors.text.muted }}>null</span>;
    if (value === undefined) return <span style={{ color: colors.text.muted }}>undefined</span>;
    if (typeof value === 'boolean') return <span style={{ color: colors.accent.amber }}>{String(value)}</span>;
    if (typeof value === 'number') return <span style={{ color: colors.accent.blue }}>{value}</span>;
    if (typeof value === 'string') return <span style={{ color: colors.accent.teal }}>"{value}"</span>;

    if (Array.isArray(value)) {
      return (
        <div style={{ marginLeft: isRTL ? 0 : '20px', marginRight: isRTL ? '20px' : 0 }}>
          <span style={{ color: colors.text.muted }}>[</span>
          {value.map((item, i) => (
            <div key={i} style={{ marginLeft: isRTL ? 0 : '20px', marginRight: isRTL ? '20px' : 0 }}>
              {renderValue(item, depth + 1)}
              {i < value.length - 1 && <span style={{ color: colors.text.muted }}>,</span>}
            </div>
          ))}
          <span style={{ color: colors.text.muted }}>]</span>
        </div>
      );
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value);
      return (
        <div style={{ marginLeft: isRTL ? 0 : '20px', marginRight: isRTL ? '20px' : 0 }}>
          <span style={{ color: colors.text.muted }}>{'{'}</span>
          {entries.map(([key, val], i) => (
            <div key={key} style={{ marginLeft: isRTL ? 0 : '20px', marginRight: isRTL ? '20px' : 0 }}>
              <span style={{ color: colors.accent.purple }}>"{key}"</span>
              <span style={{ color: colors.text.muted }}>: </span>
              {renderValue(val, depth + 1)}
              {i < entries.length - 1 && <span style={{ color: colors.text.muted }}>,</span>}
            </div>
          ))}
          <span style={{ color: colors.text.muted }}>{'}'}</span>
        </div>
      );
    }
  };

  return (
    <div style={{
      marginTop: '16px',
      marginBottom: '16px',
      direction: isRTL ? 'rtl' : 'ltr'
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          cursor: 'pointer',
          marginBottom: expanded ? '12px' : 0,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        <span style={{
          transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
          fontSize: '12px',
          color: colors.text.tertiary
        }}>▶</span>
        <span style={{
          fontFamily: fontFamily.mono || 'monospace',
          color: colors.text.tertiary,
          fontSize: fontSize.regular
        }}>
          {Array.isArray(data) ? `Array[${data.length}]` : 'Object'}
        </span>
      </div>
      {expanded && (
        <div style={{
          fontFamily: fontFamily.mono || 'monospace',
          fontSize: fontSize.regular,
          lineHeight: '1.6',
          paddingLeft: isRTL ? 0 : '16px',
          paddingRight: isRTL ? '16px' : 0
        }}>
          {renderValue(data)}
        </div>
      )}
    </div>
  );
};

// Enhanced list renderer - Clean professional display
const ListRenderer = ({ content, isRTL }) => {
  const lines = content.split('\n').filter(line => line.trim());
  const items = [];

  lines.forEach(line => {
    const bulletMatch = line.match(/^[•\-*]\s+(.*)$/);
    const numberMatch = line.match(/^(\d+)\.\s+(.*)$/);

    if (bulletMatch) {
      items.push({ type: 'bullet', content: bulletMatch[1] });
    } else if (numberMatch) {
      items.push({ type: 'number', number: numberMatch[1], content: numberMatch[2] });
    }
  });

  if (items.length === 0) return null;

  return (
    <div style={{
      marginTop: '16px',
      marginBottom: '16px',
      direction: isRTL ? 'rtl' : 'ltr',
      lineHeight: '1.8'
    }}>
      {items.map((item, index) => (
        <div key={index} style={{
          display: 'flex',
          alignItems: 'flex-start',
          marginBottom: '8px',
          fontSize: '15px'
        }}>
          {item.type === 'bullet' ? (
            <span style={{
              color: colors.text.primary,
              marginRight: isRTL ? 0 : '12px',
              marginLeft: isRTL ? '12px' : 0,
              minWidth: '20px'
            }}>•</span>
          ) : (
            <span style={{
              color: colors.text.primary,
              marginRight: isRTL ? 0 : '12px',
              marginLeft: isRTL ? '12px' : 0,
              minWidth: '20px',
              fontWeight: fontWeight.medium
            }}>{item.number}.</span>
          )}
          <span style={{
            color: colors.text.secondary,
            flex: 1
          }}>{item.content}</span>
        </div>
      ))}
    </div>
  );
};

// Key-value pairs renderer - Clean professional text
const KeyValueRenderer = ({ content, isRTL }) => {
  const lines = content.split('\n').filter(line => line.trim() && line.includes(':'));
  const pairs = lines.map(line => {
    const colonIndex = line.indexOf(':');
    return {
      key: line.substring(0, colonIndex).trim(),
      value: line.substring(colonIndex + 1).trim()
    };
  });

  if (pairs.length === 0) return null;

  return (
    <div style={{
      marginTop: '16px',
      marginBottom: '16px',
      direction: isRTL ? 'rtl' : 'ltr',
      lineHeight: '1.8'
    }}>
      {pairs.map((pair, index) => (
        <div key={index} style={{
          marginBottom: '12px',
          fontSize: '15px'
        }}>
          <span style={{
            fontWeight: fontWeight.semibold,
            color: colors.text.primary,
            fontSize: fontSize.regular
          }}>
            {pair.key}:
          </span>
          <span style={{
            color: colors.text.secondary,
            fontSize: fontSize.regular,
            marginLeft: isRTL ? 0 : '8px',
            marginRight: isRTL ? '8px' : 0
          }}>
            {pair.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// Medical data renderer - Clean professional text
const MedicalDataRenderer = ({ content, isRTL }) => {
  // Parse medical values and ranges
  const parseValue = (text) => {
    const match = text.match(/(\d+\.?\d*)\s*([a-zA-Z%/]+)?/);
    if (match) {
      return { value: match[1], unit: match[2] || '' };
    }
    return { value: text, unit: '' };
  };

  const lines = content.split('\n').filter(line => line.trim());
  const medicalData = [];

  lines.forEach(line => {
    if (line.includes(':')) {
      const [label, ...valueParts] = line.split(':');
      const valueText = valueParts.join(':').trim();
      const { value, unit } = parseValue(valueText);

      // Check if it's high/low/normal
      let status = 'normal';
      if (line.toLowerCase().includes('high') || line.includes('↑')) status = 'high';
      if (line.toLowerCase().includes('low') || line.includes('↓')) status = 'low';
      if (line.toLowerCase().includes('critical')) status = 'critical';

      medicalData.push({ label: label.trim(), value, unit, status });
    }
  });

  if (medicalData.length === 0) return null;

  const getStatusColor = (status) => {
    switch (status) {
      case 'high': return colors.medical.warning;
      case 'low': return colors.medical.info;
      case 'critical': return colors.medical.critical;
      default: return colors.text.primary;
    }
  };

  const getStatusIndicator = (status) => {
    switch (status) {
      case 'high': return ' ↑';
      case 'low': return ' ↓';
      case 'critical': return ' ⚠';
      default: return '';
    }
  };

  return (
    <div style={{
      marginTop: '16px',
      marginBottom: '16px',
      direction: isRTL ? 'rtl' : 'ltr',
      lineHeight: '1.8'
    }}>
      {medicalData.map((item, index) => (
        <div key={index} style={{
          marginBottom: '12px',
          fontSize: '15px'
        }}>
          <span style={{
            fontWeight: fontWeight.semibold,
            color: colors.text.primary,
            fontSize: fontSize.regular
          }}>
            {item.label}:
          </span>
          <span style={{
            color: getStatusColor(item.status),
            fontSize: fontSize.regular,
            marginLeft: isRTL ? 0 : '8px',
            marginRight: isRTL ? '8px' : 0,
            fontWeight: item.status !== 'normal' ? fontWeight.medium : fontWeight.regular
          }}>
            {item.value} {item.unit}{getStatusIndicator(item.status)}
          </span>
        </div>
      ))}
    </div>
  );
};

// Main DataTypeRenderer component
const DataTypeRenderer = ({ content, categoryGrids, isRTL = false }) => {
  // Debug logging
  console.log('🎯 [DataTypeRenderer] Props:', {
    hasContent: !!content,
    hasCategoryGrids: !!categoryGrids,
    categoryGridsType: typeof categoryGrids,
    categoryGridsLength: Array.isArray(categoryGrids) ? categoryGrids.length : 'not array',
    isRTL
  });

  // Handle multi-category grids if provided
  if (categoryGrids) {
    console.log('🏥 [DataTypeRenderer] Rendering MultiCategoryGridRenderer with:', categoryGrids);
    return <MultiCategoryGridRenderer categoryGrids={categoryGrids} isRTL={isRTL} />;
  }

  const dataType = detectDataType(content);

  switch (dataType) {
    case 'table':
      return <TableRenderer content={content} isRTL={isRTL} />;
    case 'json':
      return <JSONRenderer content={content} isRTL={isRTL} />;
    case 'list':
      return <ListRenderer content={content} isRTL={isRTL} />;
    case 'keyvalue':
      return <KeyValueRenderer content={content} isRTL={isRTL} />;
    case 'medical':
      return <MedicalDataRenderer content={content} isRTL={isRTL} />;
    default:
      return null;
  }
};

// Export both the default and the multi-category renderer
export { MultiCategoryGridRenderer };
export default DataTypeRenderer;