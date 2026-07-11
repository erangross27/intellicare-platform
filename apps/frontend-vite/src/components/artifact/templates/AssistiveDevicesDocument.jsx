import React, { useState, useMemo, useCallback } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import AssistiveDevicesDocumentPDFTemplate from '../pdf-templates/AssistiveDevicesDocumentPDFTemplate';
import './AssistiveDevicesDocument.css';

/**
 * AssistiveDevicesDocument — inline editing with per-section approve
 * Blue glow theme, PDFDownloadLink + pdfData memo, phrase matching search
 */

const SECTION_FIELDS = {
  deviceInfo: ['deviceType', 'deviceName', 'indication'],
  prescriptionDetails: ['prescribedBy'],
  supplierInsurance: ['supplier', 'insurance'],
  trainingCompliance: ['trainingProvided', 'effectiveness', 'compliance'],
  maintenance: ['maintenanceSchedule', 'replacementNeeds'],
  facility: ['facility'],
  notes: ['notes'],
};

const SECTION_TITLES = {
  deviceInfo: 'Device Information',
  prescriptionDetails: 'Prescription Details',
  supplierInsurance: 'Supplier & Insurance',
  trainingCompliance: 'Training & Compliance',
  maintenance: 'Maintenance',
  facility: 'Facility',
  notes: 'Notes',
};

const FIELD_LABELS = {
  deviceType: 'Device Type',
  deviceName: 'Device Name',
  indication: 'Indication',
  prescribedBy: 'Prescribed By',
  supplier: 'Supplier',
  insurance: 'Insurance',
  trainingProvided: 'Training Provided',
  effectiveness: 'Effectiveness',
  compliance: 'Compliance',
  maintenanceSchedule: 'Maintenance Schedule',
  replacementNeeds: 'Replacement Needs',
  facility: 'Facility',
  notes: 'Notes',
};

const SIMPLE_FIELDS = ['deviceType', 'deviceName', 'prescribedBy', 'supplier', 'insurance', 'facility'];
const ALL_EDITABLE_FIELDS = Object.values(SECTION_FIELDS).flat();

const AssistiveDevicesDocument = ({ document: data }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [approvedSections, setApprovedSections] = useState({});

  /* ==================== DATA UNWRAPPING ==================== */
  const records = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data)) {
      if (data.length === 1 && data[0]?.assistive_devices) return data[0].assistive_devices;
      return data;
    }
    if (data.assistive_devices) return data.assistive_devices;
    if (data.documentData) {
      const dd = data.documentData;
      if (Array.isArray(dd)) return dd;
      if (dd.assistive_devices) return dd.assistive_devices;
      return [dd];
    }
    if (data && typeof data === 'object') return [data];
    return [];
  }, [data]);

  /* ==================== HELPERS ==================== */
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return String(dateStr); }
  };

  const getRecordId = (record) => {
    const id = record?._id;
    if (!id) return null;
    if (typeof id === 'string') return id;
    if (id.$oid) return id.$oid;
    return String(id);
  };

  const getFieldValue = useCallback((record, fieldName, idx) => {
    const key = `${fieldName}-${idx}`;
    if (localEdits[key] !== undefined) return localEdits[key];
    return record[fieldName];
  }, [localEdits]);

  const splitBySentence = (text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<=\.)\s+|(?<=;)\s+/).filter(s => s.trim().length > 0);
  };

  function reconstructFullText(sentences) {
    return sentences.map((s, i) => {
      const trimmed = s.trim();
      if (i < sentences.length - 1 && !trimmed.endsWith('.') && !trimmed.endsWith(';')) {
        return trimmed + '.';
      }
      return trimmed;
    }).join(' ');
  }

  // highlightText uses regex replacement — content comes from user's own medical records (trusted source)
  const highlightText = (text) => {
    if (!text || !searchTerm) return text;
    const textStr = String(text);
    const escaped = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!escaped) return textStr;
    const regex = new RegExp(`(${escaped})`, 'gi');
    const result = textStr.replace(regex, '<mark>$1</mark>');
    return <span dangerouslySetInnerHTML={{ __html: result }} />;
  };

  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  /* ==================== SEARCH FILTERING ==================== */
  const shouldShowSection = (record, title, ...content) => {
    if (!searchTerm.trim()) return true;
    if (record._showAllSections) return true;
    const searchLower = searchTerm.toLowerCase().trim();
    if (title && title.toLowerCase().includes(searchLower)) return true;
    return content.filter(Boolean).join(' ').toLowerCase().includes(searchLower);
  };

  const shouldShowRow = (record, ...values) => {
    if (!searchTerm.trim()) return true;
    if (record._showAllSections) return true;
    const searchLower = searchTerm.toLowerCase().trim();
    return values.filter(Boolean).join(' ').toLowerCase().includes(searchLower);
  };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records.map((r, i) => ({ ...r, _origIdx: i, _showAllSections: true }));
    const searchLower = searchTerm.toLowerCase().trim();

    return records.map((record, idx) => {
      const r = { ...record, _origIdx: idx, _showAllSections: false };

      // Document title match → show all sections
      const docTitle = `Assistive Device ${idx + 1}`;
      if (docTitle.toLowerCase().includes(searchLower) || 'assistive devices'.includes(searchLower)) {
        r._showAllSections = true;
        return r;
      }

      // Build searchable text from all fields + labels + section titles + dates
      const searchableTexts = [
        docTitle,
        formatDate(record.date),
        ...Object.values(SECTION_TITLES),
        ...ALL_EDITABLE_FIELDS.flatMap(f => [
          FIELD_LABELS[f],
          String(getFieldValue(record, f, idx) || ''),
        ]),
        'Date Ordered', formatDate(record.dateOrdered),
        'Date Received', formatDate(record.dateReceived),
      ];

      const fullText = searchableTexts.filter(Boolean).join(' ').toLowerCase();
      return fullText.includes(searchLower) ? r : null;
    }).filter(Boolean);
  }, [records, searchTerm, localEdits, getFieldValue]);

  /* ==================== SAVE HANDLERS ==================== */
  const handleSaveField = useCallback(async (record, fieldName, idx, sectionId, sentenceIdx, valueOverride, editTrackingKey) => {
    const recordId = getRecordId(record);
    if (!recordId) return;
    setSaving(true);
    try {
      const newValue = valueOverride !== undefined ? valueOverride : editValue;
      const secureApiClient = (await import('../../../services/secureApiClient')).default;
      await secureApiClient.put(`/api/edit/assistive_devices/${recordId}/edit`, {
        field: fieldName,
        value: newValue,
      });
      const editKey = editTrackingKey || `${fieldName}-${idx}`;
      setLocalEdits(prev => ({ ...prev, [editKey]: newValue }));
      setEditingField(null);
      setEditValue('');
    } catch (err) {
      console.error('[AssistiveDevices] Save error:', err);
    } finally {
      setSaving(false);
    }
  }, [editValue]);

  function saveSentence(record, fieldName, idx, sectionId, sentenceIdx) {
    const currentValue = String(getFieldValue(record, fieldName, idx) || '');
    const currentSentences = splitBySentence(currentValue);
    const originalSentence = currentSentences[sentenceIdx] || '';
    const cleanOriginal = originalSentence.replace(/[.;]\s*$/, '').trim();
    const cleanNew = editValue.trim();

    if (cleanNew === cleanOriginal) {
      setEditingField(null);
      setEditValue('');
      return;
    }

    const newSentences = [...currentSentences];
    let newText = cleanNew;
    if (!newText.endsWith('.') && !newText.endsWith(';')) newText += '.';
    newSentences[sentenceIdx] = newText;
    const fullText = reconstructFullText(newSentences);

    const sKey = `${fieldName}-${idx}-s${sentenceIdx}`;
    setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));

    // Detect added sentences
    const newSentencesSplit = splitBySentence(fullText);
    if (newSentencesSplit.length > currentSentences.length) {
      for (let i = currentSentences.length; i < newSentencesSplit.length; i++) {
        setEditedSentences(prev => ({ ...prev, [`${fieldName}-${idx}-s${i}`]: 'added' }));
      }
    }

    handleSaveField(record, fieldName, idx, sectionId, null, fullText, `${fieldName}-${idx}`);
  }

  /* ==================== APPROVE ==================== */
  const renderApproveButton = (sectionId, idx, record) => {
    const key = `${sectionId}-${idx}`;
    const fields = SECTION_FIELDS[sectionId] || [];

    // Check hasEdits BEFORE isApproved
    const hasEdits = fields.some(f => {
      if (editedFields[`${f}-${idx}`]) return true;
      return Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`));
    });
    const isApproved = approvedSections[key];

    if (hasEdits) {
      return (
        <button
          className="approve-btn pending"
          onClick={async (e) => {
            e.stopPropagation();
            const recordId = getRecordId(record);
            if (!recordId) return;
            try {
              const secureApiClient = (await import('../../../services/secureApiClient')).default;
              await secureApiClient.put(`/api/edit/assistive_devices/${recordId}/approve`, {
                sectionId, approved: true,
              });
              // Clear edit markers for all fields in section
              const newEditedFields = { ...editedFields };
              const newEditedSentences = { ...editedSentences };
              fields.forEach(f => {
                Object.keys(newEditedFields).forEach(k => {
                  if (k.startsWith(`${f}-${idx}`)) delete newEditedFields[k];
                });
                Object.keys(newEditedSentences).forEach(k => {
                  if (k.startsWith(`${f}-${idx}`)) delete newEditedSentences[k];
                });
              });
              setEditedFields(newEditedFields);
              setEditedSentences(newEditedSentences);
              setApprovedSections(prev => ({ ...prev, [key]: true }));
            } catch (err) {
              console.error('[AssistiveDevices] Approve error:', err);
            }
          }}
        >
          Pending Approve
        </button>
      );
    }

    if (isApproved) {
      return <span className="approve-btn approved">Approved</span>;
    }

    return null;
  };

  /* ==================== RENDER EDITABLE FIELD (simple) ==================== */
  const renderEditableField = (record, fieldName, idx, sectionId) => {
    const value = getFieldValue(record, fieldName, idx);
    if (!value && !editedFields[`${fieldName}-${idx}`]) return null;

    const editKey = `${fieldName}-${idx}`;
    const isEditing = editingField === editKey;
    const isEdited = editedFields[editKey];
    const label = FIELD_LABELS[fieldName] || fieldName;

    if (!shouldShowRow(record, label, String(value || ''))) return null;

    return (
      <div key={fieldName} className="rec-mini-card">
        {/* suppress the nested-subtitle when it would duplicate the section title (single-field section) */}
        {SECTION_TITLES[sectionId] !== label && <div className="nested-subtitle">{highlightText(label)}</div>}
        {isEditing ? (
          <div className="edit-field-container">
            <textarea
              className="edit-textarea"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                  setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
                  handleSaveField(record, fieldName, idx, sectionId);
                }
                if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
              }}
              autoFocus
              rows={2}
              disabled={saving}
            />
            <div className="edit-actions">
              <button className="save-btn" disabled={saving} onClick={() => {
                setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
                handleSaveField(record, fieldName, idx, sectionId);
              }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div
              className={`numbered-row editable-row${isEdited ? ' modified' : ''}`}
              onClick={() => { setEditingField(editKey); setEditValue(String(value || '')); }}
            >
              <div className="row-content">
                <span className="content-value">{highlightText(String(value || ''))}</span>
                {!isEdited && <span className="edit-indicator">✎</span>}
              </div>
              <button
                className={`copy-btn${copiedId === editKey ? ' copied' : ''}`}
                onClick={(e) => { e.stopPropagation(); copyToClipboard(String(value || ''), editKey); }}
              >
                {copiedId === editKey ? 'Copied!' : 'Copy'}
              </button>
            </div>
            {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
          </>
        )}
      </div>
    );
  };

  /* ==================== RENDER SENTENCE EDITABLE FIELD ==================== */
  const renderSentenceEditableField = (record, fieldName, idx, sectionId) => {
    const value = getFieldValue(record, fieldName, idx);
    if (!value && !editedSentences[`${fieldName}-${idx}-s0`]) return null;

    const label = FIELD_LABELS[fieldName] || fieldName;
    const sentences = splitBySentence(String(value || ''));

    // Fall back to simple editable for single sentence
    if (sentences.length <= 1) {
      return renderEditableField(record, fieldName, idx, sectionId);
    }

    const sectionTitleMatches = (() => {
      if (!searchTerm) return false;
      return label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    })();

    return sentences.map((sentence, sIdx) => {
      const sentenceKey = `${fieldName}-${idx}-s${sIdx}`;
      const isEditing = editingField === sentenceKey;
      const isEdited = editedSentences[sentenceKey];
      const cleanSentence = sentence.replace(/[.;]\s*$/, '').trim();

      // Per-sentence search filtering
      if (!sectionTitleMatches && !shouldShowRow(record, label, sentence)) return null;

      return (
        <div key={sentenceKey} className="rec-mini-card">
          {sIdx === 0 && SECTION_TITLES[sectionId] !== label && <div className="nested-subtitle">{highlightText(label)}</div>}
          {isEditing ? (
            <div className="edit-field-container">
              <textarea
                className="edit-textarea"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) saveSentence(record, fieldName, idx, sectionId, sIdx);
                  if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                }}
                autoFocus
                rows={2}
                disabled={saving}
              />
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={() => saveSentence(record, fieldName, idx, sectionId, sIdx)}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div
                className={`numbered-row editable-row${isEdited ? ' modified' : ''}`}
                onClick={() => { setEditingField(sentenceKey); setEditValue(cleanSentence); }}
              >
                <div className="row-content">
                  <span className="content-value">{highlightText(cleanSentence)}</span>
                  {!isEdited && <span className="edit-indicator">✎</span>}
                </div>
                <button
                  className={`copy-btn${copiedId === sentenceKey ? ' copied' : ''}`}
                  onClick={(e) => { e.stopPropagation(); copyToClipboard(cleanSentence, sentenceKey); }}
                >
                  {copiedId === sentenceKey ? 'Copied!' : 'Copy'}
                </button>
              </div>
              {isEdited && (
                <div className={`modified-badge${isEdited === 'added' ? ' added' : ''}`}>
                  {isEdited === 'added' ? 'added' : 'edited - click Pending Approve to save'}
                </div>
              )}
            </>
          )}
        </div>
      );
    });
  };

  /* ==================== RENDER NON-EDITABLE FIELD (dates) ==================== */
  const renderNonEditableField = (record, fieldName, idx, label, value) => {
    if (!value) return null;
    if (!shouldShowRow(record, label, String(value))) return null;

    return (
      <div key={fieldName} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className="numbered-row">
          <div className="row-content">
            <span className="content-value">{highlightText(String(value))}</span>
          </div>
        </div>
      </div>
    );
  };

  /* ==================== RENDER GROUPED SECTION ==================== */
  const renderGroupedSection = (record, idx, sectionId) => {
    const title = SECTION_TITLES[sectionId];
    const fields = SECTION_FIELDS[sectionId];

    // Build content for section-level filtering
    const sectionContent = fields.map(f => {
      const val = getFieldValue(record, f, idx);
      return val ? `${FIELD_LABELS[f]} ${String(val)}` : '';
    }).filter(Boolean).join(' ');

    // Include date fields for prescriptionDetails search
    let extraContent = '';
    if (sectionId === 'prescriptionDetails') {
      if (record.dateOrdered) extraContent += ` Date Ordered ${formatDate(record.dateOrdered)}`;
      if (record.dateReceived) extraContent += ` Date Received ${formatDate(record.dateReceived)}`;
    }

    // Check if section has any data
    const hasFieldData = fields.some(f => {
      const val = getFieldValue(record, f, idx);
      return val && String(val).trim();
    });
    const hasDateData = sectionId === 'prescriptionDetails' && (record.dateOrdered || record.dateReceived);
    if (!hasFieldData && !hasDateData) return null;

    if (!shouldShowSection(record, title, sectionContent + extraContent)) return null;

    // Copy section text using pdfData
    const copySectionText = () => {
      const effectiveRecord = pdfData[idx] || record;
      let text = `${title.toUpperCase()}\n`;
      let itemNum = 1;
      fields.forEach(f => {
        const val = effectiveRecord[f];
        if (val && String(val).trim()) {
          // drop the redundant "Label:" prefix when the field label is the section title
          text += FIELD_LABELS[f] !== title
            ? `${itemNum}. ${FIELD_LABELS[f]}: ${String(val)}\n`
            : `${itemNum}. ${String(val)}\n`;
          itemNum++;
        }
      });
      if (sectionId === 'prescriptionDetails') {
        if (record.dateOrdered) { text += `${itemNum}. Date Ordered: ${formatDate(record.dateOrdered)}\n`; itemNum++; }
        if (record.dateReceived) { text += `${itemNum}. Date Received: ${formatDate(record.dateReceived)}\n`; }
      }
      return text;
    };

    const copySectionKey = `${sectionId}-section-${idx}`;

    return (
      <div className="section" key={sectionId}>
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button
                className={`copy-btn${copiedId === copySectionKey ? ' copied' : ''}`}
                onClick={() => copyToClipboard(copySectionText(), copySectionKey)}
              >
                {copiedId === copySectionKey ? 'Copied!' : 'Copy Section'}
              </button>
              {renderApproveButton(sectionId, idx, record)}
            </div>
          </div>

          {/* Render editable fields */}
          {fields.map(fieldName => {
            if (SIMPLE_FIELDS.includes(fieldName)) {
              return renderEditableField(record, fieldName, idx, sectionId);
            }
            return renderSentenceEditableField(record, fieldName, idx, sectionId);
          })}

          {/* Non-editable date fields for prescriptionDetails */}
          {sectionId === 'prescriptionDetails' && (
            <>
              {renderNonEditableField(record, 'dateOrdered', idx, 'Date Ordered', formatDate(record.dateOrdered))}
              {renderNonEditableField(record, 'dateReceived', idx, 'Date Received', formatDate(record.dateReceived))}
            </>
          )}
        </div>
      </div>
    );
  };

  /* ==================== PDF DATA (merges edits) ==================== */
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => {
      const merged = { ...record };
      Object.entries(localEdits).forEach(([key, value]) => {
        const lastDash = key.lastIndexOf('-');
        if (lastDash === -1) return;
        const fieldName = key.substring(0, lastDash);
        const recordIdx = parseInt(key.substring(lastDash + 1));
        if (recordIdx === idx && ALL_EDITABLE_FIELDS.includes(fieldName)) {
          merged[fieldName] = value;
        }
      });
      return merged;
    });
  }, [records, localEdits]);

  /* ==================== COPY ALL (uses pdfData) ==================== */
  const copyAllContent = () => {
    let text = 'ASSISTIVE DEVICES\n\n';
    pdfData.forEach((record, idx) => {
      text += `--- Assistive Device ${idx + 1} ---\n`;
      if (record.date) text += `Date: ${formatDate(record.date)}\n\n`;

      Object.entries(SECTION_TITLES).forEach(([sectionId, title]) => {
        const fields = SECTION_FIELDS[sectionId];
        let sectionText = '';
        let itemNum = 1;
        fields.forEach(f => {
          if (record[f] && String(record[f]).trim()) {
            // drop the redundant "Label:" prefix when the field label is the section title
            sectionText += FIELD_LABELS[f] !== title
              ? `${itemNum}. ${FIELD_LABELS[f]}: ${String(record[f])}\n`
              : `${itemNum}. ${String(record[f])}\n`;
            itemNum++;
          }
        });
        if (sectionId === 'prescriptionDetails') {
          if (record.dateOrdered) { sectionText += `${itemNum}. Date Ordered: ${formatDate(record.dateOrdered)}\n`; itemNum++; }
          if (record.dateReceived) { sectionText += `${itemNum}. Date Received: ${formatDate(record.dateReceived)}\n`; }
        }
        if (sectionText) text += `${title.toUpperCase()}\n${sectionText}\n`;
      });
      text += '\n';
    });
    return text;
  };

  /* ==================== RENDER ==================== */
  if (!records || records.length === 0) {
    return (
      <div className="assistive-devices-document">
        <div className="empty-state">
          <div className="empty-icon">No assistive devices data available.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="assistive-devices-document">
      {/* Header */}
      <div className="document-header">
        <h1 className="document-title">Assistive Devices</h1>
        <div className="header-actions">
          <button
            className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`}
            onClick={() => copyToClipboard(copyAllContent(), 'copy-all')}
          >
            {copiedId === 'copy-all' ? 'Copied!' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<AssistiveDevicesDocumentPDFTemplate document={pdfData} />}
            fileName={`assistive_devices_${new Date().toISOString().split('T')[0]}.pdf`}
          >
            {({ loading }) => (
              <button className="copy-btn">
                {loading ? 'Preparing...' : 'Export PDF'}
              </button>
            )}
          </PDFDownloadLink>
        </div>
      </div>

      {/* Search */}
      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="Search assistive devices..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button className="clear-search" onClick={() => setSearchTerm('')}>×</button>
        )}
      </div>

      {/* Records */}
      {filteredRecords.length === 0 && searchTerm && (
        <div className="no-results">No results found for "{searchTerm}"</div>
      )}

      <div className="records-list">
        {filteredRecords.map((record) => {
          const idx = record._origIdx;

          return (
            <div key={record._id || idx} className="record-card">
              {/* Record Header */}
              <div className="record-header">
                <div className="record-meta-row">
                  {record.date && (
                    <span className="record-date">{highlightText(formatDate(record.date))}</span>
                  )}
                </div>
                <h3 className="record-name">{highlightText(`Assistive Device ${idx + 1}`)}</h3>
              </div>

              {/* Grouped Sections */}
              {renderGroupedSection(record, idx, 'deviceInfo')}
              {renderGroupedSection(record, idx, 'prescriptionDetails')}
              {renderGroupedSection(record, idx, 'supplierInsurance')}
              {renderGroupedSection(record, idx, 'trainingCompliance')}
              {renderGroupedSection(record, idx, 'maintenance')}
              {renderGroupedSection(record, idx, 'facility')}
              {renderGroupedSection(record, idx, 'notes')}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AssistiveDevicesDocument;
