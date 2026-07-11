import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import secureApiClient from '../../../services/secureApiClient';
import SearchBar from '../components/SearchBar';
import SocialDeterminantsOfHealthDocumentPDFTemplate from '../pdf-templates/SocialDeterminantsOfHealthDocumentPDFTemplate';
import './SocialDeterminantsOfHealthDocument.css';

/**
 * SocialDeterminantsOfHealthDocument - Social Determinants of Health Viewer
 * November 2025 Standards - 4-level HYBRID search filtering
 * Schema has 9 nested objects: housingStatus, foodSecurity, financialBarriers, transportation,
 *   insurance, socialSupport, healthLiteracy, substanceUseBarriers, legalBarriers
 * And 2 arrays: referralsMade, dischargeBarriers
 * Plus: overallRiskAssessment, date, provider, facility, notes
 */

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field", "field.arrayIndex", or dotted object path) */
const DRAFT_KEY = 'social_determinants_of_healthPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};
/* Normalize a Mongo _id (string or { $oid }) to a string for the draft store key. */
const recordIdOf = (record) => {
  if (!record || !record._id) return null;
  return typeof record._id === 'object' && record._id.$oid ? record._id.$oid : String(record._id);
};

const SocialDeterminantsOfHealthDocument = ({ document: doc, data }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSectionId, setCopiedSectionId] = useState(null);

  // ============== EDITING STATE ==============
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [statusOverrides, setStatusOverrides] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const textareaRef = useRef(null);

  // Handle both prop names for compatibility
  const templateData = doc || data;

  // Unwrap data structure
  let recordsArray = [];
  if (!templateData) {
    recordsArray = [];
  } else if (Array.isArray(templateData)) {
    recordsArray = templateData;
  } else if (templateData?.social_determinants_of_health) {
    recordsArray = Array.isArray(templateData.social_determinants_of_health) ? templateData.social_determinants_of_health : [templateData.social_determinants_of_health];
  } else if (templateData?.data) {
    recordsArray = Array.isArray(templateData.data) ? templateData.data : [templateData.data];
  } else if (templateData?.documentData) {
    const inner = templateData.documentData;
    if (inner?.social_determinants_of_health) {
      recordsArray = Array.isArray(inner.social_determinants_of_health) ? inner.social_determinants_of_health : [inner.social_determinants_of_health];
    } else if (Array.isArray(inner)) {
      recordsArray = inner;
    } else {
      recordsArray = [inner];
    }
  } else {
    recordsArray = [templateData];
  }

  // Filter out invalid entries
  recordsArray = recordsArray.filter(record => record && typeof record === 'object');

  // Format date helper
  const formatDate = (date) => {
    if (!date) return '';
    try {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return String(date);
    }
  };

  // Format boolean helper
  const formatBoolean = (value) => {
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    return '';
  };

  // Split text by comma after colon - for fields like "Positive - 6/6 USDA criteria met: item1, item2, item3"
  // Returns { prefix: "Positive - 6/6 USDA criteria met", items: ["item1", "item2", "item3"] }
  // If no colon found, returns { prefix: null, items: [originalText] }
  const splitByCommaAfterColon = (text) => {
    if (!text || typeof text !== 'string') return { prefix: null, items: [] };

    const colonIndex = text.indexOf(':');
    if (colonIndex === -1 || colonIndex > 80) {
      // No colon or colon too far - just split by comma
      const items = text.split(/,\s*/).map(s => s.trim()).filter(s => s.length > 0);
      if (items.length <= 1) return { prefix: null, items: [text] };
      return { prefix: null, items };
    }

    const prefix = text.substring(0, colonIndex).trim();
    const afterColon = text.substring(colonIndex + 1).trim();

    // Split items by comma, parentheses-aware
    const items = [];
    let currentItem = '';
    let parenDepth = 0;

    for (let i = 0; i < afterColon.length; i++) {
      const char = afterColon[i];
      if (char === '(') {
        parenDepth++;
        currentItem += char;
      } else if (char === ')') {
        parenDepth--;
        currentItem += char;
      } else if (char === ',' && parenDepth === 0) {
        const trimmed = currentItem.trim();
        if (trimmed) items.push(trimmed);
        currentItem = '';
      } else {
        currentItem += char;
      }
    }
    const trimmed = currentItem.trim();
    if (trimmed) items.push(trimmed);

    // If only 1 item after colon, don't split
    if (items.length <= 1) return { prefix: null, items: [text] };

    return { prefix, items };
  };

  // Copy function using modern Clipboard API
  const copySection = async (text, sectionId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSectionId(sectionId);
      setTimeout(() => setCopiedSectionId(null), 2000);
    } catch (err) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      textarea.setAttribute('readonly', '');
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setCopiedSectionId(sectionId);
        setTimeout(() => setCopiedSectionId(null), 2000);
      } catch (fallbackErr) {
        console.error('Copy failed:', fallbackErr);
      }
      document.body.removeChild(textarea);
    }
  };

  // Copy all content (uses pdfData for edit persistence)
  const copyAllText = () => {
    let text = '=== SOCIAL DETERMINANTS OF HEALTH ===\n\n';

    const mergedRecords = pdfData.length > 0 ? pdfData : filteredRecords;
    mergedRecords.forEach((record, idx) => {
      text += `SDOH Assessment ${idx + 1}\n`;
      if (record.date) text += `Date: ${formatDate(record.date)}\n`;
      if (record.provider) text += `Provider: ${record.provider}\n`;
      if (record.facility) text += `Facility: ${record.facility}\n`;
      if (record.overallRiskAssessment) text += `Overall Risk: ${record.overallRiskAssessment}\n`;
      text += '\n';

      // Housing Status
      if (record.housingStatus && Object.keys(record.housingStatus).length > 0) {
        text += 'HOUSING STATUS:\n';
        const h = record.housingStatus;
        if (h.status) text += `  Status: ${h.status}\n`;
        if (h.housingType) text += `  Housing Type: ${h.housingType}\n`;
        if (h.adequacy) text += `  Adequacy: ${h.adequacy}\n`;
        if (h.housingInsecurity !== undefined) text += `  Housing Insecurity: ${formatBoolean(h.housingInsecurity)}\n`;
        if (h.barriers && h.barriers.length > 0) {
          text += '  Barriers:\n';
          h.barriers.forEach(b => text += `    - ${b}\n`);
        }
        text += '\n';
      }

      // Food Security
      if (record.foodSecurity && Object.keys(record.foodSecurity).length > 0) {
        text += 'FOOD SECURITY:\n';
        const f = record.foodSecurity;
        if (f.status) text += `  Status: ${f.status}\n`;
        if (f.hungerScreening) {
          // Check if it's a long text with colon (like "Positive - 6/6 USDA criteria met: item1, item2, ...")
          const colonIdx = f.hungerScreening.indexOf(':');
          if (colonIdx > 0 && colonIdx < 80) {
            const prefix = f.hungerScreening.substring(0, colonIdx).trim();
            const afterColon = f.hungerScreening.substring(colonIdx + 1).trim();
            const items = afterColon.split(/,\s*/).filter(s => s.trim());
            if (items.length > 1) {
              text += `  Hunger Screening: ${prefix}\n`;
              items.forEach(item => text += `    - ${item.trim()}\n`);
            } else {
              text += `  Hunger Screening: ${f.hungerScreening}\n`;
            }
          } else {
            text += `  Hunger Screening: ${f.hungerScreening}\n`;
          }
        }
        if (f.diabeticDiet !== undefined) text += `  Can Afford Diabetic Diet: ${formatBoolean(f.diabeticDiet)}\n`;
        if (f.renalDiet !== undefined) text += `  Can Afford Renal Diet: ${formatBoolean(f.renalDiet)}\n`;
        if (f.foodPantryUse !== undefined) text += `  Uses Food Pantry: ${formatBoolean(f.foodPantryUse)}\n`;
        if (f.snapBenefits !== undefined) text += `  Receives SNAP Benefits: ${formatBoolean(f.snapBenefits)}\n`;
        if (f.referrals && f.referrals.length > 0) {
          text += '  Referrals:\n';
          f.referrals.forEach(r => text += `    - ${r}\n`);
        }
        text += '\n';
      }

      // Financial Barriers
      if (record.financialBarriers && Object.keys(record.financialBarriers).length > 0) {
        text += 'FINANCIAL BARRIERS:\n';
        const fb = record.financialBarriers;
        if (fb.medicationAffordability !== undefined) text += `  Can Afford Medications: ${formatBoolean(fb.medicationAffordability)}\n`;
        if (fb.medicationCostRationing !== undefined) text += `  Skips/Rations Medications: ${formatBoolean(fb.medicationCostRationing)}\n`;
        if (fb.copayBurden) text += `  Copay Burden: ${fb.copayBurden}\n`;
        if (fb.utilityInsecurity !== undefined) text += `  Utility Insecurity: ${formatBoolean(fb.utilityInsecurity)}\n`;
        if (fb.medicalDebt) text += `  Medical Debt: ${fb.medicalDebt}\n`;
        if (fb.employmentStatus) text += `  Employment Status: ${fb.employmentStatus}\n`;
        if (fb.income) text += `  Income: ${fb.income}\n`;
        if (fb.financialAssistance && fb.financialAssistance.length > 0) {
          text += '  Financial Assistance:\n';
          fb.financialAssistance.forEach(a => text += `    - ${a}\n`);
        }
        text += '\n';
      }

      // Transportation
      if (record.transportation && Object.keys(record.transportation).length > 0) {
        text += 'TRANSPORTATION:\n';
        const t = record.transportation;
        if (t.hasReliableTransportation !== undefined) text += `  Has Reliable Transportation: ${formatBoolean(t.hasReliableTransportation)}\n`;
        if (t.missedAppointments !== undefined) text += `  Missed Appointments Due to Transport: ${formatBoolean(t.missedAppointments)}\n`;
        if (t.barriers && t.barriers.length > 0) {
          text += '  Barriers:\n';
          t.barriers.forEach(b => text += `    - ${b}\n`);
        }
        if (t.transportationAssistance && t.transportationAssistance.length > 0) {
          text += '  Transportation Assistance:\n';
          t.transportationAssistance.forEach(a => text += `    - ${a}\n`);
        }
        text += '\n';
      }

      // Insurance
      if (record.insurance && Object.keys(record.insurance).length > 0) {
        text += 'INSURANCE:\n';
        const i = record.insurance;
        if (i.status) text += `  Status: ${i.status}\n`;
        if (i.type) text += `  Type: ${i.type}\n`;
        if (i.gaps) {
          // Split long text by periods or commas for readability
          const gapItems = i.gaps.split(/\.\s+/).filter(s => s.trim());
          if (gapItems.length > 1) {
            text += '  Coverage Gaps:\n';
            gapItems.forEach(item => text += `    - ${item.trim()}${item.trim().endsWith('.') ? '' : '.'}\n`);
          } else {
            text += `  Coverage Gaps: ${i.gaps}\n`;
          }
        }
        if (i.insuranceNavigator !== undefined) text += `  Insurance Navigator Involved: ${formatBoolean(i.insuranceNavigator)}\n`;
        text += '\n';
      }

      // Social Support
      if (record.socialSupport && Object.keys(record.socialSupport).length > 0) {
        text += 'SOCIAL SUPPORT:\n';
        const s = record.socialSupport;
        if (s.livingSituation) text += `  Living Situation: ${s.livingSituation}\n`;
        if (s.caregiver) text += `  Caregiver: ${s.caregiver}\n`;
        if (s.caregiverBurden) text += `  Caregiver Burden: ${s.caregiverBurden}\n`;
        if (s.socialIsolation !== undefined) text += `  Socially Isolated: ${formatBoolean(s.socialIsolation)}\n`;
        if (s.communitySupport && s.communitySupport.length > 0) {
          text += '  Community Support:\n';
          s.communitySupport.forEach(c => text += `    - ${c}\n`);
        }
        text += '\n';
      }

      // Health Literacy
      if (record.healthLiteracy && Object.keys(record.healthLiteracy).length > 0) {
        text += 'HEALTH LITERACY:\n';
        const hl = record.healthLiteracy;
        if (hl.level) text += `  Level: ${hl.level}\n`;
        if (hl.languageBarrier !== undefined) text += `  Language Barrier: ${formatBoolean(hl.languageBarrier)}\n`;
        if (hl.primaryLanguage) text += `  Primary Language: ${hl.primaryLanguage}\n`;
        if (hl.interpreterNeeded !== undefined) text += `  Interpreter Needed: ${formatBoolean(hl.interpreterNeeded)}\n`;
        if (hl.educationLevel) text += `  Education Level: ${hl.educationLevel}\n`;
        if (hl.digitalLiteracy) text += `  Digital Literacy: ${hl.digitalLiteracy}\n`;
        text += '\n';
      }

      // Substance Use Barriers
      if (record.substanceUseBarriers && Object.keys(record.substanceUseBarriers).length > 0) {
        text += 'SUBSTANCE USE BARRIERS:\n';
        const sub = record.substanceUseBarriers;
        if (sub.activeSubstanceUse !== undefined) text += `  Active Substance Use: ${formatBoolean(sub.activeSubstanceUse)}\n`;
        if (sub.treatmentEngagement) text += `  Treatment Engagement: ${sub.treatmentEngagement}\n`;
        if (sub.barriers && sub.barriers.length > 0) {
          text += '  Barriers:\n';
          sub.barriers.forEach(b => text += `    - ${b}\n`);
        }
        text += '\n';
      }

      // Legal Barriers
      if (record.legalBarriers && Object.keys(record.legalBarriers).length > 0) {
        text += 'LEGAL BARRIERS:\n';
        const l = record.legalBarriers;
        if (l.incarceration) text += `  Incarceration: ${l.incarceration}\n`;
        if (l.immigration) text += `  Immigration Status: ${l.immigration}\n`;
        if (l.childCustody) text += `  Child Custody: ${l.childCustody}\n`;
        text += '\n';
      }

      // Referrals Made - sorted by priority then alphabetically
      if (record.referralsMade && record.referralsMade.length > 0) {
        text += 'REFERRALS MADE:\n';
        const priorityOrder = { urgent: 0, high: 1, medium: 2, routine: 3 };
        const sortedReferrals = [...record.referralsMade].sort((a, b) => {
          const aPriority = priorityOrder[(a.priority || '').toLowerCase()] ?? 4;
          const bPriority = priorityOrder[(b.priority || '').toLowerCase()] ?? 4;
          if (aPriority !== bPriority) return aPriority - bPriority;
          return (a.service || '').localeCompare(b.service || '');
        });
        sortedReferrals.forEach((ref, i) => {
          text += `  ${ref.service || 'Unknown Service'}`;
          if (ref.priority) text += ` [${ref.priority.toUpperCase()}]`;
          text += '\n';
          if (ref.status) text += `    ${ref.status}\n`;
        });
        text += '\n';
      }

      // Discharge Barriers
      if (record.dischargeBarriers && record.dischargeBarriers.length > 0) {
        text += 'DISCHARGE BARRIERS:\n';
        record.dischargeBarriers.forEach(b => text += `  - ${b}\n`);
        text += '\n';
      }

      // Interventions
      if (record.interventions) {
        if (Array.isArray(record.interventions) && record.interventions.length > 0) {
          text += 'INTERVENTIONS:\n';
          record.interventions.forEach(item => text += `  - ${item}\n`);
          text += '\n';
        } else if (typeof record.interventions === 'string' && record.interventions.trim()) {
          text += `INTERVENTIONS:\n  ${record.interventions}\n\n`;
        }
      }

      // Notes
      if (record.notes) {
        text += `NOTES:\n  ${record.notes}\n\n`;
      }

      text += '='.repeat(80) + '\n\n';
    });

    copySection(text, 'all');
  };

  // Add document titles for search
  const recordsWithTitle = useMemo(() => {
    return recordsArray.map((record, idx) => ({
      ...record,
      _documentTitle: `SDOH Assessment ${idx + 1}`
    }));
  }, [recordsArray]);

  // LEVEL 1: Document-level filtering
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return recordsWithTitle;

    const searchLower = searchTerm.toLowerCase().trim();
    const searchWords = searchLower.split(/\s+/);

    // Document title words
    const documentTitleWords = ['sdoh', 'social', 'determinants', 'health', 'assessment'];
    const searchNumberMatch = searchLower.match(/\d+/);

    return recordsWithTitle.filter((record) => {
      // Reset _showAllSections flag at the start of each filter
      record._showAllSections = false;

      const titleNumber = record._documentTitle.match(/\d+/)?.[0];

      // Check for document title search
      const hasDocTitleWord = documentTitleWords.some(word => searchLower.includes(word));
      if (searchNumberMatch && hasDocTitleWord) {
        if (searchNumberMatch[0] === titleNumber) {
          record._showAllSections = true;
          return true;
        } else {
          return false;
        }
      }

      // Build searchable text from all fields
      const searchableText = [
        record._documentTitle,
        record.overallRiskAssessment,
        record.provider,
        record.facility,
        record.notes,
        formatDate(record.date),
        // Section titles (all case variations for multi-word search)
        'housing status', 'Housing Status', 'HOUSING STATUS',
        'food security', 'Food Security', 'FOOD SECURITY',
        'financial barriers', 'Financial Barriers', 'FINANCIAL BARRIERS',
        'transportation', 'Transportation', 'TRANSPORTATION',
        'insurance', 'Insurance', 'INSURANCE',
        'social support', 'Social Support', 'SOCIAL SUPPORT',
        'health literacy', 'Health Literacy', 'HEALTH LITERACY',
        'substance use barriers', 'Substance Use Barriers', 'SUBSTANCE USE BARRIERS',
        'legal barriers', 'Legal Barriers', 'LEGAL BARRIERS',
        'referrals made', 'Referrals Made', 'REFERRALS MADE',
        'discharge barriers', 'Discharge Barriers', 'DISCHARGE BARRIERS',
        'interventions', 'Interventions', 'INTERVENTIONS',
        'overall risk', 'Overall Risk', 'OVERALL RISK',
        'provider information', 'Provider Information', 'PROVIDER INFORMATION',
        // ALL field labels with all case variations (CRITICAL for Level 1 filtering)
        // Housing Status fields
        'status', 'Status', 'STATUS',
        'housing type', 'Housing Type', 'HOUSING TYPE',
        'adequacy', 'Adequacy', 'ADEQUACY',
        'housing insecurity', 'Housing Insecurity', 'HOUSING INSECURITY',
        'barriers', 'Barriers', 'BARRIERS',
        // Food Security fields
        'hunger screening', 'Hunger Screening', 'HUNGER SCREENING',
        'diabetic diet', 'Diabetic Diet', 'DIABETIC DIET',
        'renal diet', 'Renal Diet', 'RENAL DIET',
        'food pantry use', 'Food Pantry Use', 'FOOD PANTRY USE',
        'snap benefits', 'Snap Benefits', 'SNAP BENEFITS',
        'referrals', 'Referrals', 'REFERRALS',
        // Financial Barriers fields
        'medication affordability', 'Medication Affordability', 'MEDICATION AFFORDABILITY',
        'medication cost rationing', 'Medication Cost Rationing', 'MEDICATION COST RATIONING',
        'copay burden', 'Copay Burden', 'COPAY BURDEN',
        'utility insecurity', 'Utility Insecurity', 'UTILITY INSECURITY',
        'medical debt', 'Medical Debt', 'MEDICAL DEBT',
        'employment status', 'Employment Status', 'EMPLOYMENT STATUS',
        'income', 'Income', 'INCOME',
        'financial assistance', 'Financial Assistance', 'FINANCIAL ASSISTANCE',
        // Transportation fields
        'has reliable transportation', 'Has Reliable Transportation', 'HAS RELIABLE TRANSPORTATION',
        'missed appointments', 'Missed Appointments', 'MISSED APPOINTMENTS',
        'transportation assistance', 'Transportation Assistance', 'TRANSPORTATION ASSISTANCE',
        // Insurance fields
        'type', 'Type', 'TYPE',
        'gaps', 'Gaps', 'GAPS',
        'insurance navigator', 'Insurance Navigator', 'INSURANCE NAVIGATOR',
        // Social Support fields
        'living situation', 'Living Situation', 'LIVING SITUATION',
        'caregiver', 'Caregiver', 'CAREGIVER',
        'caregiver burden', 'Caregiver Burden', 'CAREGIVER BURDEN',
        'social isolation', 'Social Isolation', 'SOCIAL ISOLATION',
        'community support', 'Community Support', 'COMMUNITY SUPPORT',
        // Health Literacy fields
        'level', 'Level', 'LEVEL',
        'language barrier', 'Language Barrier', 'LANGUAGE BARRIER',
        'primary language', 'Primary Language', 'PRIMARY LANGUAGE',
        'interpreter needed', 'Interpreter Needed', 'INTERPRETER NEEDED',
        'education level', 'Education Level', 'EDUCATION LEVEL',
        'digital literacy', 'Digital Literacy', 'DIGITAL LITERACY',
        // Substance Use Barriers fields
        'active substance use', 'Active Substance Use', 'ACTIVE SUBSTANCE USE',
        'treatment engagement', 'Treatment Engagement', 'TREATMENT ENGAGEMENT',
        // Legal Barriers fields
        'incarceration', 'Incarceration', 'INCARCERATION',
        'immigration', 'Immigration', 'IMMIGRATION',
        'child custody', 'Child Custody', 'CHILD CUSTODY',
        // Referrals Made fields
        'service', 'Service', 'SERVICE',
        'priority', 'Priority', 'PRIORITY',
        // Provider/Facility
        'provider', 'Provider', 'PROVIDER',
        'facility', 'Facility', 'FACILITY',
        'date', 'Date', 'DATE',
        'notes', 'Notes', 'NOTES',
        // Housing status field values
        record.housingStatus?.status,
        record.housingStatus?.housingType,
        record.housingStatus?.adequacy,
        ...(record.housingStatus?.barriers || []),
        // Food security fields
        record.foodSecurity?.status,
        record.foodSecurity?.hungerScreening,
        ...(record.foodSecurity?.referrals || []),
        // Financial barriers fields
        record.financialBarriers?.copayBurden,
        record.financialBarriers?.medicalDebt,
        record.financialBarriers?.employmentStatus,
        record.financialBarriers?.income,
        ...(record.financialBarriers?.financialAssistance || []),
        // Transportation fields
        ...(record.transportation?.barriers || []),
        ...(record.transportation?.transportationAssistance || []),
        // Insurance fields
        record.insurance?.status,
        record.insurance?.type,
        record.insurance?.gaps,
        // Social support fields
        record.socialSupport?.livingSituation,
        record.socialSupport?.caregiver,
        record.socialSupport?.caregiverBurden,
        ...(record.socialSupport?.communitySupport || []),
        // Health literacy fields
        record.healthLiteracy?.level,
        record.healthLiteracy?.primaryLanguage,
        record.healthLiteracy?.educationLevel,
        record.healthLiteracy?.digitalLiteracy,
        // Substance use barriers
        record.substanceUseBarriers?.treatmentEngagement,
        ...(record.substanceUseBarriers?.barriers || []),
        // Legal barriers
        record.legalBarriers?.incarceration,
        record.legalBarriers?.immigration,
        record.legalBarriers?.childCustody,
        // Referrals made
        ...(record.referralsMade || []).map(r => `${r.service} ${r.priority} ${r.status}`),
        // Discharge barriers
        ...(record.dischargeBarriers || []),
        // Interventions
        ...(Array.isArray(record.interventions) ? record.interventions : record.interventions ? [record.interventions] : [])
      ].filter(Boolean).join(' ').toLowerCase();

      return searchWords.every(word => searchableText.includes(word));
    });
  }, [recordsWithTitle, searchTerm]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {}, nStatus = {};
    recordsWithTitle.forEach((record, idx) => {
      const rid = recordIdOf(record);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        // fieldName is the base field (strip a trailing numeric arrayIndex segment only)
        const lastDot = fieldPart.lastIndexOf('.');
        const fieldName = (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1)))
          ? fieldPart.slice(0, lastDot)
          : fieldPart;
        nSentences[`${fieldName}-${idx}-s0`] = 'edited';
        nStatus[idx] = 'amended';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
    setStatusOverrides(prev => ({ ...nStatus, ...prev }));
  }, [recordsWithTitle]);

  // LEVEL 2: Section-level filtering
  const shouldShowSection = (record, sectionTitle, sectionContent) => {
    if (!searchTerm.trim()) return true;
    if (record._showAllSections) return true;

    const searchWords = searchTerm.toLowerCase().trim().split(/\s+/);
    const titleLower = (sectionTitle || '').toLowerCase();
    const contentText = Array.isArray(sectionContent)
      ? sectionContent.filter(Boolean).join(' ').toLowerCase()
      : (sectionContent || '').toString().toLowerCase();

    const combinedText = `${titleLower} ${contentText}`;
    return searchWords.every(word => combinedText.includes(word));
  };

  // LEVEL 3: Row-level filtering
  const shouldShowRow = (record, ...rowContent) => {
    if (!searchTerm.trim()) return true;
    if (record._showAllSections) return true;

    const searchWords = searchTerm.toLowerCase().trim().split(/\s+/);
    const rowText = rowContent.filter(Boolean).map(item => String(item)).join(' ').toLowerCase();
    return searchWords.every(word => rowText.includes(word));
  };

  // Highlight matching text
  const highlightText = (text) => {
    if (!text || !searchTerm.trim()) return text;
    const searchWords = searchTerm.toLowerCase().trim().split(/\s+/);
    let result = String(text);
    searchWords.forEach(word => {
      if (word.length > 1) {
        const regex = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        result = result.replace(regex, '<mark>$1</mark>');
      }
    });
    return <span dangerouslySetInnerHTML={{ __html: result }} />;
  };

  // ============== EDITING HELPERS ==============

  const getFieldValue = useCallback((record, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    // Dotted object path (e.g. utilities.electricity) — resolve nested value
    if (fieldName.includes('.')) {
      const parts = fieldName.split('.');
      let cur = record;
      for (const p of parts) {
        if (cur == null) return undefined;
        cur = cur[p];
      }
      return cur;
    }
    // Check top-level first, then nested paths for known fields
    if (record[fieldName] !== undefined) return record[fieldName];
    // educationLevel may be nested in healthLiteracy
    if (fieldName === 'educationLevel' && record.healthLiteracy?.educationLevel) {
      return record.healthLiteracy.educationLevel;
    }
    return record[fieldName];
  }, [localEdits]);

  const getArrayFieldValue = useCallback((record, fieldName, arrayIndex, idx) => {
    const editKey = `${fieldName}.${arrayIndex}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    const arr = record[fieldName];
    if (Array.isArray(arr) && arrayIndex < arr.length) return arr[arrayIndex];
    return undefined;
  }, [localEdits]);

  // ============== EDITING HANDLERS ==============

  const handleStartEdit = useCallback((fieldName, idx, currentValue) => {
    const editKey = `${fieldName}-${idx}-s0`;
    setEditingField(editKey);
    setEditValue(currentValue || '');
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingField(null);
    setEditValue('');
  }, []);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApprove commits).
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, arrayIndex, isBool) => {
    const recordId = recordIdOf(record);
    if (!recordId) return;
    // Boolean leaves save a real boolean; everything else trims the string
    const saveValue = isBool ? (editValue === 'Yes' || editValue === true) : editValue.trim();
    const fieldPart = (typeof arrayIndex === 'number') ? `${fieldName}.${arrayIndex}` : fieldName;
    const editKey = `${fieldPart}-${idx}`;
    const sKey = `${fieldName}-${idx}-s0`;

    setLocalEdits(prev => ({ ...prev, [editKey]: saveValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${sectionId}-${idx}`]: true }));
    setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    setStatusOverrides(prev => ({ ...prev, [idx]: 'amended' }));
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow
    setApprovedSections(prev => {
      if (!prev[sectionId]) return prev;
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });

    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldPart] = saveValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this record to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApprove = useCallback(async (record, idx, sectionId) => {
    const recordId = recordIdOf(record);
    if (!recordId) return;
    setApproving(true);
    try {
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix));
      // Persist each staged field to the DB now. arrayIndex ONLY when the segment after the LAST
      // dot is purely numeric (e.g. "dischargeBarriers.0"); dotted object paths stay as-is.
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field", "field.arrayIndex", or dotted path
        const lastDot = fieldPart.lastIndexOf('.');
        const isArrayIdx = lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1));
        const payload = { field: isArrayIdx ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (isArrayIdx) payload.arrayIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
        const resp = await secureApiClient.put(`/api/edit/social_determinants_of_health/${recordId}/edit`, payload);
        if (!resp || !resp.success) throw new Error((resp && resp.error) || 'save failed');
      }
      // Flag the record approved (audit trail)
      await secureApiClient.put(`/api/edit/social_determinants_of_health/${recordId}/approve`);

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this record's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[recordId]) { delete store[recordId]; writeDrafts(store); }

      setStatusOverrides(prev => ({ ...prev, [idx]: 'approved' }));
      setApprovedSections(prev => ({ ...prev, [sectionId]: true }));
      setEditedSentences(prev => {
        const updated = {};
        for (const key of Object.keys(prev)) {
          if (!key.includes(`-${idx}-`)) updated[key] = prev[key];
        }
        return updated;
      });
      setEditedFields(prev => {
        const updated = {};
        for (const key of Object.keys(prev)) {
          if (!key.endsWith(`-${idx}`)) updated[key] = prev[key];
        }
        return updated;
      });
    } catch (err) {
      console.error('[SocialDeterminantsOfHealth] Approve error:', err);
    } finally {
      setApproving(false);
    }
  }, [localEdits, pendingEdits]);

  // ============== SECTION_FIELDS + sectionHasEdits ==============
  const SECTION_FIELDS = {
    'risk': ['overallRiskAssessment'],
    'assessment': ['assessmentDate'],
    'literacy': ['educationLevel'],
    'discharge': ['dischargeBarriers'],
    'interventions': ['interventions'],
    'utilities': ['utilities'],
    'language': ['language'],
    'employment': ['employment'],
  };

  const sectionHasEdits = (sectionId) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return false;
    return Object.keys(localEdits).some(editKey => {
      const dashIdx = editKey.lastIndexOf('-');
      const fieldPart = editKey.substring(0, dashIdx);
      const baseField = fieldPart.includes('.') ? fieldPart.split('.')[0] : fieldPart;
      return fields.includes(baseField);
    });
  };

  // ============== pdfData MEMO ==============
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return recordsArray;
    return recordsArray.map((record, idx) => {
      const merged = { ...record };
      for (const [editKey, editVal] of Object.entries(localEdits)) {
        if (pendingEdits[editKey]) continue; // pending drafts stay OUT of the PDF until approved
        const dashIdx = editKey.lastIndexOf('-');
        const fieldPart = editKey.substring(0, dashIdx);
        const recIdx = parseInt(editKey.substring(dashIdx + 1), 10);
        if (recIdx === idx) {
          const dotParts = fieldPart.split('.');
          if (dotParts.length === 1) {
            merged[fieldPart] = editVal;
          } else if (dotParts.length === 2 && !isNaN(parseInt(dotParts[1], 10)) && Array.isArray(merged[dotParts[0]])) {
            // Array element edit (e.g. dischargeBarriers.0)
            const [parent, child] = dotParts;
            const childNum = parseInt(child, 10);
            merged[parent] = [...merged[parent]];
            merged[parent][childNum] = editVal;
          } else {
            // Nested object path (e.g. utilities.electricity, language.interpreter) — set deeply
            let cur = merged;
            for (let i = 0; i < dotParts.length - 1; i++) {
              const p = dotParts[i];
              cur[p] = (cur[p] && typeof cur[p] === 'object' && !Array.isArray(cur[p])) ? { ...cur[p] } : {};
              cur = cur[p];
            }
            cur[dotParts[dotParts.length - 1]] = editVal;
          }
        }
      }
      return merged;
    });
  }, [recordsArray, localEdits, pendingEdits]);

  // ============== EDIT INDICATOR ==============
  const editIndicator = (
    <span className="edit-indicator" title="Click to edit">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        <path d="m15 5 4 4" />
      </svg>
      <span className="edit-tag">edit</span>
    </span>
  );

  // ============== RENDER EDITABLE FIELD (string fields) ==============
  const renderEditableField = (record, fieldName, label, idx, sectionId, copyId) => {
    const displayValue = getFieldValue(record, fieldName, idx);
    if (!displayValue) return null;
    const canEdit = !!record._id;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const isFieldEdited = sectionWasEdited && editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';

    if (isEditing) {
      return (
        <div className="numbered-row edit-row" key={fieldName}>
          <div className="edit-field-container">
            <div className="content-subtitle">{label}</div>
            <textarea
              ref={textareaRef}
              className="edit-textarea"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') handleCancelEdit();
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveField(record, fieldName, idx, sectionId);
              }}
              rows={Math.max(2, Math.ceil((editValue?.length || 0) / 60))}
              disabled={saving}
            />
            <div className="edit-actions">
              <button className="edit-save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId)} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`numbered-row${isFieldEdited ? ' modified' : ''}`} key={fieldName}>
        <div
          className={`numbered-row-content${canEdit ? ' editable' : ''}`}
          onClick={() => canEdit && handleStartEdit(fieldName, idx, displayValue)}
          title={canEdit ? 'Click to edit' : undefined}
        >
          <span className="content-subtitle">{highlightText(label)}</span>
          <span>{highlightText(displayValue)}</span>
          {canEdit && !isFieldEdited && editIndicator}
        </div>
        <button
          className={`copy-btn ${copiedSectionId === copyId ? 'copied' : ''}`}
          onClick={() => copySection(`${label}: ${displayValue}`, copyId)}
        >
          {copiedSectionId === copyId ? 'Copied' : 'Copy'}
        </button>
        {isFieldEdited && <div className="modified-badge">edited — click approve to save</div>}
      </div>
    );
  };

  // ============== RENDER EDITABLE ARRAY ITEM ==============
  const renderEditableArrayItem = (record, fieldName, item, idx, itemIdx, sectionId, copyId) => {
    const displayValue = getArrayFieldValue(record, fieldName, itemIdx, idx) || item;
    if (!displayValue) return null;
    const canEdit = !!record._id;
    const editKey = `${fieldName}.${itemIdx}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const isItemEdited = sectionWasEdited && editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';

    if (isEditing) {
      return (
        <div key={itemIdx} className="numbered-row edit-row">
          <div className="edit-field-container">
            <textarea
              ref={textareaRef}
              className="edit-textarea"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') handleCancelEdit();
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveField(record, fieldName, idx, sectionId, itemIdx);
              }}
              rows={Math.max(2, Math.ceil((editValue?.length || 0) / 60))}
              disabled={saving}
            />
            <div className="edit-actions">
              <button className="edit-save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId, itemIdx)} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <React.Fragment key={itemIdx}>
        <div className={`numbered-row${isItemEdited ? ' modified' : ''}`}>
          <div
            className={`numbered-row-content${canEdit ? ' editable' : ''}`}
            onClick={() => canEdit && handleStartEdit(`${fieldName}.${itemIdx}`, idx, displayValue)}
            title={canEdit ? 'Click to edit' : undefined}
          >
            {highlightText(typeof displayValue === 'string' ? displayValue : JSON.stringify(displayValue))}
            {canEdit && !isItemEdited && editIndicator}
          </div>
          <button
            className={`copy-btn ${copiedSectionId === copyId ? 'copied' : ''}`}
            onClick={() => copySection(typeof displayValue === 'string' ? displayValue : JSON.stringify(displayValue), copyId)}
          >
            {copiedSectionId === copyId ? 'Copied' : 'Copy'}
          </button>
        </div>
        {isItemEdited && <div className="modified-badge">edited — click approve to save</div>}
      </React.Fragment>
    );
  };

  // ============== SECTION HEADER WITH APPROVE ==============
  const renderSectionHeader = (title, copyId, copyFn, idx, sectionId) => (
    <div className="section-header-row">
      <h3 className="section-title">{highlightText(title)}</h3>
      <div className="header-right-actions">
        <button
          className={`copy-btn ${copiedSectionId === copyId ? 'copied' : ''}`}
          onClick={copyFn}
        >
          {copiedSectionId === copyId ? 'Copied' : 'Copy Section'}
        </button>
        {(sectionHasEdits(sectionId) || approvedSections[sectionId]) && (
          <button
            className={`approve-btn${approvedSections[sectionId] ? ' approved' : ''}`}
            onClick={() => handleApprove(recordsArray[idx], idx, sectionId)}
            disabled={approving}
          >
            {approving ? 'Approving...' : approvedSections[sectionId] ? 'Approved' : 'Approve'}
          </button>
        )}
      </div>
    </div>
  );

  // Render object section with nested fields
  const renderObjectSection = (record, title, obj, recordId, sectionKey) => {
    if (!obj || Object.keys(obj).length === 0) return null;

    // Include BOTH keys (field labels) AND values in sectionContent for search
    // This allows searching "Barriers" to find the Housing Status section
    const sectionContent = Object.entries(obj)
      .map(([key, value]) => {
        const label = formatFieldLabel(key);
        if (Array.isArray(value)) {
          return `${label} ${value.join(' ')}`;
        }
        return `${label} ${value}`;
      })
      .filter(Boolean)
      .join(' ');

    if (!shouldShowSection(record, title, sectionContent)) return null;

    // Check if section title matches for HYBRID pattern
    const sectionTitleMatches = searchTerm && shouldShowRow(record, title);

    return (
      <div className="section-container" key={sectionKey}>
        <h3 className="section-title">{highlightText(title)}</h3>
        <div className="numbered-rows-wrapper">
          {renderObjectFields(record, obj, recordId, sectionKey, sectionTitleMatches)}
        </div>
      </div>
    );
  };

  // Render fields from an object
  const renderObjectFields = (record, obj, recordId, sectionKey, showAll = false) => {
    const fields = [];

    Object.entries(obj).forEach(([key, value], idx) => {
      if (value === null || value === undefined) return;

      const label = formatFieldLabel(key);

      if (Array.isArray(value) && value.length > 0) {
        // Check if subsection title matches search (e.g., searching "Barriers" should show all barrier items)
        const subsectionTitleMatches = searchTerm && shouldShowRow(record, label, label.toLowerCase(), label.toUpperCase());
        const showAllInSubsection = showAll || subsectionTitleMatches;

        // Array field - show if parent section matches, OR subsection title matches, OR any item matches
        if (showAllInSubsection || shouldShowRow(record, label, ...value)) {
          fields.push(
            <div key={`${sectionKey}-${key}`} className="subsection-container">
              <div className="subsection-subtitle">{highlightText(label)}</div>
              <div className="cyan-wireframe">
                {value.map((item, i) => (
                  <div key={i} className="numbered-row">
                    <div className="numbered-row-content">
                      {highlightText(typeof item === 'string' ? item : JSON.stringify(item))}
                    </div>
                    <button
                      className={`copy-btn ${copiedSectionId === `${recordId}-${sectionKey}-${key}-${i}` ? 'copied' : ''}`}
                      onClick={() => copySection(typeof item === 'string' ? item : JSON.stringify(item), `${recordId}-${sectionKey}-${key}-${i}`)}
                    >
                      {copiedSectionId === `${recordId}-${sectionKey}-${key}-${i}` ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        }
      } else if (typeof value === 'boolean') {
        // Boolean field
        if (showAll || shouldShowRow(record, label, formatBoolean(value))) {
          fields.push(
            <div key={`${sectionKey}-${key}`} className="numbered-row">
              <div className="numbered-row-content">
                <span className="content-subtitle">{highlightText(label)}</span>
                <span>{highlightText(formatBoolean(value))}</span>
              </div>
              <button
                className={`copy-btn ${copiedSectionId === `${recordId}-${sectionKey}-${key}` ? 'copied' : ''}`}
                onClick={() => copySection(`${label}: ${formatBoolean(value)}`, `${recordId}-${sectionKey}-${key}`)}
              >
                {copiedSectionId === `${recordId}-${sectionKey}-${key}` ? 'Copied' : 'Copy'}
              </button>
            </div>
          );
        }
      } else if (typeof value === 'string' && value.trim()) {
        // String field - check if it has comma-separated items after colon
        const parsed = splitByCommaAfterColon(value);

        if (showAll || shouldShowRow(record, label, value)) {
          // If multiple items, render with two-level nesting:
          // Level 1: Field label (blue) as subsection title
          // Level 2: Prefix (white) as nested subtitle inside cyan wireframe + items
          if (parsed.items.length > 1) {
            fields.push(
              <div key={`${sectionKey}-${key}`} className="subsection-container">
                <div className="subsection-subtitle">{highlightText(label)}</div>
                <div className="cyan-wireframe">
                  {parsed.prefix && (
                    <div className="nested-subtitle">{highlightText(parsed.prefix)}</div>
                  )}
                  {parsed.items.map((item, i) => (
                    <div key={i} className="numbered-row">
                      <div className="numbered-row-content">
                        {highlightText(item)}
                      </div>
                      <button
                        className={`copy-btn ${copiedSectionId === `${recordId}-${sectionKey}-${key}-${i}` ? 'copied' : ''}`}
                        onClick={() => copySection(item, `${recordId}-${sectionKey}-${key}-${i}`)}
                      >
                        {copiedSectionId === `${recordId}-${sectionKey}-${key}-${i}` ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          } else {
            // Single value - render normally
            fields.push(
              <div key={`${sectionKey}-${key}`} className="numbered-row">
                <div className="numbered-row-content">
                  <span className="content-subtitle">{highlightText(label)}</span>
                  <span>{highlightText(value)}</span>
                </div>
                <button
                  className={`copy-btn ${copiedSectionId === `${recordId}-${sectionKey}-${key}` ? 'copied' : ''}`}
                  onClick={() => copySection(`${label}: ${value}`, `${recordId}-${sectionKey}-${key}`)}
                >
                  {copiedSectionId === `${recordId}-${sectionKey}-${key}` ? 'Copied' : 'Copy'}
                </button>
              </div>
            );
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        // Nested object - render each subfield
        const nestedContent = Object.entries(value)
          .filter(([, v]) => v != null && v !== '')
          .map(([k, v]) => `${formatFieldLabel(k)}: ${typeof v === 'boolean' ? formatBoolean(v) : v}`)
          .join(', ');

        if (nestedContent && (showAll || shouldShowRow(record, label, nestedContent))) {
          fields.push(
            <div key={`${sectionKey}-${key}`} className="numbered-row">
              <div className="numbered-row-content">
                <span className="content-subtitle">{highlightText(label)}</span>
                <span>{highlightText(nestedContent)}</span>
              </div>
              <button
                className={`copy-btn ${copiedSectionId === `${recordId}-${sectionKey}-${key}` ? 'copied' : ''}`}
                onClick={() => copySection(`${label}: ${nestedContent}`, `${recordId}-${sectionKey}-${key}`)}
              >
                {copiedSectionId === `${recordId}-${sectionKey}-${key}` ? 'Copied' : 'Copy'}
              </button>
            </div>
          );
        }
      }
    });

    return fields.length > 0 ? fields : null;
  };

  // Format field label from camelCase
  const formatFieldLabel = (key) => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  // Convert a Date/ISO value to yyyy-mm-dd for <input type="date">
  const toInputDate = (value) => {
    if (!value) return '';
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch (e) {
      return '';
    }
  };

  // ============== RENDER EDITABLE DATE FIELD (Date type — date picker) ==============
  const renderDateField = (record, fieldName, label, idx, sectionId, copyId) => {
    const rawValue = getFieldValue(record, fieldName, idx);
    if (!rawValue) return null;
    const canEdit = !!record._id;
    const displayValue = formatDate(rawValue);
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const isFieldEdited = sectionWasEdited && editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';

    if (isEditing) {
      return (
        <div className="numbered-row edit-row" key={fieldName}>
          <div className="edit-field-container">
            <div className="content-subtitle">{label}</div>
            <input
              type="date"
              className="edit-date"
              value={toInputDate(editValue) || editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') handleCancelEdit(); }}
              ref={(el) => { if (el) { try { el.showPicker?.(); } catch (err) { /* noop */ } } }}
              disabled={saving}
            />
            <div className="edit-actions">
              <button className="edit-save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId)} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`numbered-row${isFieldEdited ? ' modified' : ''}`} key={fieldName}>
        <div
          className={`numbered-row-content${canEdit ? ' editable' : ''}`}
          onClick={() => canEdit && handleStartEdit(fieldName, idx, toInputDate(rawValue))}
          title={canEdit ? 'Click to edit' : undefined}
        >
          <span className="content-subtitle">{highlightText(label)}</span>
          <span>{highlightText(displayValue)}</span>
          {canEdit && !isFieldEdited && editIndicator}
        </div>
        <button
          className={`copy-btn ${copiedSectionId === copyId ? 'copied' : ''}`}
          onClick={() => copySection(`${label}: ${displayValue}`, copyId)}
        >
          {copiedSectionId === copyId ? 'Copied' : 'Copy'}
        </button>
        {isFieldEdited && <div className="modified-badge">edited — click approve to save</div>}
      </div>
    );
  };

  // ============== RENDER EDITABLE OBJECT NODE (recursive; booleans → Yes/No select, dotted-path saves) ==============
  // path is the dotted key path under rootField (e.g. utilities.electricity)
  const renderObjectLeaf = (record, rootField, path, idx, value, copyBase) => {
    const fieldName = `${rootField}.${path.join('.')}`;
    const leafKey = path[path.length - 1];
    const label = formatFieldLabel(leafKey);
    const isBool = typeof value === 'boolean';
    const displayValue = isBool ? formatBoolean(value) : String(value);
    const canEdit = !!record._id;
    const copyId = `${copyBase}-${path.join('-')}`;
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;

    if (isEditing) {
      return (
        <div className="numbered-row edit-row" key={leafKey}>
          <div className="edit-field-container">
            <div className="nested-subtitle sub-label">{label}</div>
            {isBool ? (
              <select
                className="edit-select"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') handleCancelEdit(); }}
                disabled={saving}
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            ) : (
              <textarea
                ref={textareaRef}
                className="edit-textarea"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') handleCancelEdit();
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveField(record, fieldName, idx, rootField);
                }}
                rows={Math.max(2, Math.ceil((editValue?.length || 0) / 60))}
                disabled={saving}
              />
            )}
            <div className="edit-actions">
              <button className="edit-save-btn" onClick={() => handleSaveField(record, fieldName, idx, rootField, undefined, isBool)} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="nested-mini-card" key={leafKey}>
        <div className="nested-subtitle sub-label">{highlightText(label)}</div>
        <div className="numbered-row">
          <div
            className={`numbered-row-content${canEdit ? ' editable' : ''}`}
            onClick={() => canEdit && handleStartEdit(fieldName, idx, isBool ? formatBoolean(value) : displayValue)}
            title={canEdit ? 'Click to edit' : undefined}
          >
            <span>{highlightText(displayValue)}</span>
            {canEdit && editIndicator}
          </div>
          <button
            className={`copy-btn ${copiedSectionId === copyId ? 'copied' : ''}`}
            onClick={() => copySection(`${label}: ${displayValue}`, copyId)}
          >
            {copiedSectionId === copyId ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    );
  };

  const renderObjectNode = (record, rootField, path, idx, value, copyBase, depth) => {
    if (value === null || value === undefined) return null;
    // Scalar leaf
    if (typeof value !== 'object' || Array.isArray(value)) {
      if (Array.isArray(value)) {
        if (value.length === 0) return null;
        const label = formatFieldLabel(path[path.length - 1]);
        return (
          <div className="subsection-container" key={path.join('-')}>
            <div className="subsection-subtitle">{highlightText(label)}</div>
            <div className="cyan-wireframe">
              {value.map((item, i) => (
                <div key={i} className="numbered-row">
                  <div className="numbered-row-content">
                    {highlightText(typeof item === 'string' ? item : JSON.stringify(item))}
                  </div>
                  <button
                    className={`copy-btn ${copiedSectionId === `${copyBase}-${path.join('-')}-${i}` ? 'copied' : ''}`}
                    onClick={() => copySection(typeof item === 'string' ? item : JSON.stringify(item), `${copyBase}-${path.join('-')}-${i}`)}
                  >
                    {copiedSectionId === `${copyBase}-${path.join('-')}-${i}` ? 'Copied' : 'Copy'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      }
      if (value === '' ) return null;
      return renderObjectLeaf(record, rootField, path, idx, value, copyBase);
    }
    // Object node
    const entries = Object.entries(value).filter(([, v]) => v !== null && v !== undefined && v !== '');
    if (entries.length === 0) return null;
    const label = path.length > 0 ? formatFieldLabel(path[path.length - 1]) : '';
    return (
      <React.Fragment key={path.join('-') || rootField}>
        {label && depth > 0 && <div className="nested-subtitle sub-label">{highlightText(label)}</div>}
        <div className="nested-group">
          {entries.map(([k, v]) => (
            <React.Fragment key={k}>
              {renderObjectNode(record, rootField, [...path, k], idx, v, copyBase, depth + 1)}
            </React.Fragment>
          ))}
        </div>
      </React.Fragment>
    );
  };

  // Render an editable top-level object section (utilities, language, employment)
  const renderEditableObjectSection = (record, title, rootField, obj, recordId, sectionKey, idx) => {
    if (!obj || typeof obj !== 'object' || Object.keys(obj).length === 0) return null;

    const sectionContent = Object.entries(obj)
      .map(([key, value]) => {
        const label = formatFieldLabel(key);
        if (Array.isArray(value)) return `${label} ${value.join(' ')}`;
        if (value && typeof value === 'object') return `${label} ${Object.values(value).join(' ')}`;
        return `${label} ${value}`;
      })
      .filter(Boolean)
      .join(' ');

    if (!shouldShowSection(record, title, sectionContent)) return null;

    return (
      <div className="section-container" key={sectionKey}>
        {renderSectionHeader(title, `${recordId}-${sectionKey}`, () => {
          const r = pdfData[idx] || record;
          const src = r[rootField] || obj;
          const lines = [title.toUpperCase(), '='.repeat(40)];
          const walk = (o, indent) => {
            Object.entries(o).forEach(([k, v]) => {
              if (v === null || v === undefined || v === '') return;
              if (Array.isArray(v)) {
                lines.push(`${indent}${formatFieldLabel(k)}:`);
                v.forEach(it => lines.push(`${indent}  - ${typeof it === 'string' ? it : JSON.stringify(it)}`));
              } else if (typeof v === 'object') {
                lines.push(`${indent}${formatFieldLabel(k)}:`);
                walk(v, indent + '  ');
              } else {
                lines.push(`${indent}${formatFieldLabel(k)}: ${typeof v === 'boolean' ? formatBoolean(v) : v}`);
              }
            });
          };
          walk(src, '');
          copySection(lines.join('\n'), `${recordId}-${sectionKey}`);
        }, idx, sectionKey)}
        <div className="numbered-rows-wrapper">
          {renderObjectNode(record, rootField, [], idx, obj, `${recordId}-${sectionKey}`, 0)}
        </div>
      </div>
    );
  };

  // Get risk badge class
  const getRiskBadgeClass = (risk) => {
    if (!risk) return 'risk-badge';
    const riskLower = risk.toLowerCase();
    if (riskLower.includes('very high')) return 'risk-badge risk-very-high';
    if (riskLower.includes('high')) return 'risk-badge risk-high';
    if (riskLower.includes('moderate')) return 'risk-badge risk-moderate';
    if (riskLower.includes('low')) return 'risk-badge risk-low';
    return 'risk-badge';
  };

  // Empty state
  if (recordsArray.length === 0) {
    return (
      <div className="social-determinants-of-health-document">
        <div className="empty-state">
          <span className="empty-icon">📋</span>
          <p>No social determinants of health data available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="social-determinants-of-health-document">
      {/* Header */}
      <div className="document-header">
        <h1 className="document-title">Social Determinants of Health</h1>
        <div className="header-actions">
          <button
            className={`action-btn ${copiedSectionId === 'all' ? 'copied' : ''}`}
            onClick={copyAllText}
          >
            {copiedSectionId === 'all' ? 'Copied!' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<SocialDeterminantsOfHealthDocumentPDFTemplate data={pdfData} />}
            fileName={`Social_Determinants_Of_Health_${new Date().toISOString().split('T')[0]}.pdf`}
            className="action-btn"
          >
            {({ loading }) => (loading ? 'Preparing PDF...' : 'Export PDF')}
          </PDFDownloadLink>
        </div>
      </div>

      {/* Search Bar */}
      <SearchBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder="Search assessments, housing, food, financial, transportation..."
        resultCount={filteredRecords.length}
        totalCount={recordsArray.length}
      />

      {/* Records */}
      <div className="records-container">
        {filteredRecords.map((record, idx) => {
          const recordId = record._id || `record-${idx}`;

          return (
            <div key={recordId} className="record-card">
              {/* Record Header */}
              <div className="record-header">
                {/* Row 1: Risk Badge (right) - EDITABLE overallRiskAssessment */}
                {(() => {
                  const riskValue = getFieldValue(record, 'overallRiskAssessment', idx);
                  const canEdit = !!record._id;
                  const editKey = `overallRiskAssessment-${idx}-s0`;
                  const isEditing = editingField === editKey;
                  const sectionKey = `risk-${idx}`;
                  const sectionWasEdited = editedFields[sectionKey];
                  const isFieldEdited = sectionWasEdited && editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';

                  if (isEditing) {
                    return (
                      <div className="record-badge-row">
                        <div className="edit-field-container" style={{ width: '100%' }}>
                          <textarea
                            ref={textareaRef}
                            className="edit-textarea"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') handleCancelEdit();
                              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveField(record, 'overallRiskAssessment', idx, 'risk');
                            }}
                            rows={1}
                            disabled={saving}
                          />
                          <div className="edit-actions">
                            <button className="edit-save-btn" onClick={() => handleSaveField(record, 'overallRiskAssessment', idx, 'risk')} disabled={saving}>
                              {saving ? 'Saving...' : 'Save'}
                            </button>
                            <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (riskValue) {
                    return (
                      <div className="record-badge-row">
                        <span
                          className={`${getRiskBadgeClass(riskValue)}${canEdit ? ' editable-badge' : ''}${isFieldEdited ? ' modified' : ''}`}
                          onClick={() => canEdit && handleStartEdit('overallRiskAssessment', idx, riskValue)}
                          title={canEdit ? 'Click to edit' : undefined}
                        >
                          {highlightText(riskValue)}
                          {canEdit && !isFieldEdited && editIndicator}
                        </span>
                        {(sectionHasEdits('risk') || approvedSections['risk']) && (
                          <button
                            className={`approve-btn${approvedSections['risk'] ? ' approved' : ''}`}
                            onClick={() => handleApprove(record, idx, 'risk')}
                            disabled={approving}
                            style={{ marginLeft: '8px' }}
                          >
                            {approving ? 'Approving...' : approvedSections['risk'] ? 'Approved' : 'Approve'}
                          </button>
                        )}
                        {isFieldEdited && <div className="modified-badge" style={{ marginLeft: '8px' }}>edited</div>}
                      </div>
                    );
                  }
                  return null;
                })()}
                {/* Row 2: Full Title */}
                <div className="record-title-row">
                  <h2 className="record-name">{highlightText(`Social Determinants of Health ${idx + 1}`)}</h2>
                </div>
              </div>

              {/* Provider/Facility Info */}
              {(record.provider || record.facility) && shouldShowSection(record, 'Provider Information', [record.provider, record.facility]) && (
                <div className="section-container">
                  <h3 className="section-title">{highlightText('Provider Information')}</h3>
                  <div className="numbered-rows-wrapper">
                    {record.provider && shouldShowRow(record, 'Provider', record.provider) && (
                      <div className="numbered-row">
                        <div className="numbered-row-content">
                          <span className="content-subtitle">{highlightText('Provider')}</span>
                          <span>{highlightText(record.provider)}</span>
                        </div>
                        <button
                          className={`copy-btn ${copiedSectionId === `${recordId}-provider` ? 'copied' : ''}`}
                          onClick={() => copySection(`Provider: ${record.provider}`, `${recordId}-provider`)}
                        >
                          {copiedSectionId === `${recordId}-provider` ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    )}
                    {record.facility && shouldShowRow(record, 'Facility', record.facility) && (
                      <div className="numbered-row">
                        <div className="numbered-row-content">
                          <span className="content-subtitle">{highlightText('Facility')}</span>
                          <span>{highlightText(record.facility)}</span>
                        </div>
                        <button
                          className={`copy-btn ${copiedSectionId === `${recordId}-facility` ? 'copied' : ''}`}
                          onClick={() => copySection(`Facility: ${record.facility}`, `${recordId}-facility`)}
                        >
                          {copiedSectionId === `${recordId}-facility` ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Assessment Date - EDITABLE date picker */}
              {getFieldValue(record, 'assessmentDate', idx) &&
                shouldShowSection(record, 'Assessment Date', formatDate(getFieldValue(record, 'assessmentDate', idx))) && (
                <div className="section-container">
                  {renderSectionHeader('Assessment Date', `${recordId}-assessment`, () => {
                    const r = pdfData[idx] || record;
                    copySection(`ASSESSMENT DATE\n${'='.repeat(40)}\n${formatDate(r.assessmentDate)}`, `${recordId}-assessment`);
                  }, idx, 'assessment')}
                  <div className="numbered-rows-wrapper">
                    {renderDateField(record, 'assessmentDate', 'Assessment Date', idx, 'assessment', `${recordId}-assessment-date`)}
                  </div>
                </div>
              )}

              {/* Housing Status */}
              {renderObjectSection(record, 'Housing Status', record.housingStatus, recordId, 'housing')}

              {/* Food Security */}
              {renderObjectSection(record, 'Food Security', record.foodSecurity, recordId, 'food')}

              {/* Financial Barriers */}
              {renderObjectSection(record, 'Financial Barriers', record.financialBarriers, recordId, 'financial')}

              {/* Transportation */}
              {renderObjectSection(record, 'Transportation', record.transportation, recordId, 'transport')}

              {/* Insurance */}
              {renderObjectSection(record, 'Insurance', record.insurance, recordId, 'insurance')}

              {/* Social Support */}
              {renderObjectSection(record, 'Social Support', record.socialSupport, recordId, 'social')}

              {/* Health Literacy - educationLevel is EDITABLE */}
              {record.healthLiteracy && Object.keys(record.healthLiteracy).length > 0 && (() => {
                const hl = record.healthLiteracy;
                const sectionContent = Object.entries(hl).map(([key, value]) => {
                  const label = formatFieldLabel(key);
                  if (Array.isArray(value)) return `${label} ${value.join(' ')}`;
                  return `${label} ${value}`;
                }).filter(Boolean).join(' ');

                if (!shouldShowSection(record, 'Health Literacy', sectionContent)) return null;
                const sectionTitleMatches = searchTerm && shouldShowRow(record, 'Health Literacy');
                const showAll = record._showAllSections || sectionTitleMatches;

                return (
                  <div className="section-container">
                    {renderSectionHeader('Health Literacy', `${recordId}-literacy`, () => {
                      const r = pdfData[idx] || record;
                      const hlr = r.healthLiteracy || {};
                      const lines = ['HEALTH LITERACY', '='.repeat(40)];
                      if (hlr.level) lines.push(`Level: ${hlr.level}`);
                      if (hlr.languageBarrier !== undefined) lines.push(`Language Barrier: ${formatBoolean(hlr.languageBarrier)}`);
                      if (hlr.primaryLanguage) lines.push(`Primary Language: ${hlr.primaryLanguage}`);
                      if (hlr.interpreterNeeded !== undefined) lines.push(`Interpreter Needed: ${formatBoolean(hlr.interpreterNeeded)}`);
                      if (hlr.educationLevel) lines.push(`Education Level: ${hlr.educationLevel}`);
                      if (hlr.digitalLiteracy) lines.push(`Digital Literacy: ${hlr.digitalLiteracy}`);
                      copySection(lines.join('\n'), `${recordId}-literacy`);
                    }, idx, 'literacy')}
                    <div className="numbered-rows-wrapper">
                      {/* Non-editable fields */}
                      {hl.level && (showAll || shouldShowRow(record, 'Level', hl.level)) && (
                        <div className="numbered-row">
                          <div className="numbered-row-content">
                            <span className="content-subtitle">{highlightText('Level')}</span>
                            <span>{highlightText(hl.level)}</span>
                          </div>
                          <button className={`copy-btn ${copiedSectionId === `${recordId}-literacy-level` ? 'copied' : ''}`} onClick={() => copySection(`Level: ${hl.level}`, `${recordId}-literacy-level`)}>
                            {copiedSectionId === `${recordId}-literacy-level` ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      )}
                      {hl.languageBarrier !== undefined && (showAll || shouldShowRow(record, 'Language Barrier', formatBoolean(hl.languageBarrier))) && (
                        <div className="numbered-row">
                          <div className="numbered-row-content">
                            <span className="content-subtitle">{highlightText('Language Barrier')}</span>
                            <span>{highlightText(formatBoolean(hl.languageBarrier))}</span>
                          </div>
                          <button className={`copy-btn ${copiedSectionId === `${recordId}-literacy-langBarrier` ? 'copied' : ''}`} onClick={() => copySection(`Language Barrier: ${formatBoolean(hl.languageBarrier)}`, `${recordId}-literacy-langBarrier`)}>
                            {copiedSectionId === `${recordId}-literacy-langBarrier` ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      )}
                      {hl.primaryLanguage && (showAll || shouldShowRow(record, 'Primary Language', hl.primaryLanguage)) && (
                        <div className="numbered-row">
                          <div className="numbered-row-content">
                            <span className="content-subtitle">{highlightText('Primary Language')}</span>
                            <span>{highlightText(hl.primaryLanguage)}</span>
                          </div>
                          <button className={`copy-btn ${copiedSectionId === `${recordId}-literacy-primaryLang` ? 'copied' : ''}`} onClick={() => copySection(`Primary Language: ${hl.primaryLanguage}`, `${recordId}-literacy-primaryLang`)}>
                            {copiedSectionId === `${recordId}-literacy-primaryLang` ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      )}
                      {hl.interpreterNeeded !== undefined && (showAll || shouldShowRow(record, 'Interpreter Needed', formatBoolean(hl.interpreterNeeded))) && (
                        <div className="numbered-row">
                          <div className="numbered-row-content">
                            <span className="content-subtitle">{highlightText('Interpreter Needed')}</span>
                            <span>{highlightText(formatBoolean(hl.interpreterNeeded))}</span>
                          </div>
                          <button className={`copy-btn ${copiedSectionId === `${recordId}-literacy-interpreter` ? 'copied' : ''}`} onClick={() => copySection(`Interpreter Needed: ${formatBoolean(hl.interpreterNeeded)}`, `${recordId}-literacy-interpreter`)}>
                            {copiedSectionId === `${recordId}-literacy-interpreter` ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      )}
                      {/* educationLevel - EDITABLE */}
                      {(showAll || shouldShowRow(record, 'Education Level', hl.educationLevel)) &&
                        renderEditableField(record, 'educationLevel', 'Education Level', idx, 'literacy', `${recordId}-literacy-education`)
                      }
                      {hl.digitalLiteracy && (showAll || shouldShowRow(record, 'Digital Literacy', hl.digitalLiteracy)) && (
                        <div className="numbered-row">
                          <div className="numbered-row-content">
                            <span className="content-subtitle">{highlightText('Digital Literacy')}</span>
                            <span>{highlightText(hl.digitalLiteracy)}</span>
                          </div>
                          <button className={`copy-btn ${copiedSectionId === `${recordId}-literacy-digital` ? 'copied' : ''}`} onClick={() => copySection(`Digital Literacy: ${hl.digitalLiteracy}`, `${recordId}-literacy-digital`)}>
                            {copiedSectionId === `${recordId}-literacy-digital` ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Substance Use Barriers */}
              {renderObjectSection(record, 'Substance Use Barriers', record.substanceUseBarriers, recordId, 'substance')}

              {/* Legal Barriers */}
              {renderObjectSection(record, 'Legal Barriers', record.legalBarriers, recordId, 'legal')}

              {/* Utilities - EDITABLE recursive object (dotted-path saves) */}
              {renderEditableObjectSection(record, 'Utilities', 'utilities', record.utilities, recordId, 'utilities', idx)}

              {/* Language - EDITABLE recursive object (dotted-path saves) */}
              {renderEditableObjectSection(record, 'Language', 'language', record.language, recordId, 'language', idx)}

              {/* Employment - EDITABLE recursive object (dotted-path saves) */}
              {renderEditableObjectSection(record, 'Employment', 'employment', record.employment, recordId, 'employment', idx)}

              {/* Referrals Made */}
              {record.referralsMade && record.referralsMade.length > 0 &&
                shouldShowSection(record, 'Referrals Made', record.referralsMade.map(r => `${r.service} ${r.priority} ${r.status}`)) && (
                <div className="section-container">
                  <h3 className="section-title">{highlightText('Referrals Made')}</h3>
                  <div className="numbered-rows-wrapper cyan-wireframe">
                    {record.referralsMade
                      .filter(ref => shouldShowRow(record, 'Referral', ref.service, ref.priority, ref.status))
                      .sort((a, b) => {
                        // Sort by priority: Urgent > High > Medium > Routine > (no priority)
                        const priorityOrder = { urgent: 0, high: 1, medium: 2, routine: 3 };
                        const aPriority = priorityOrder[(a.priority || '').toLowerCase()] ?? 4;
                        const bPriority = priorityOrder[(b.priority || '').toLowerCase()] ?? 4;
                        if (aPriority !== bPriority) return aPriority - bPriority;
                        // Then sort alphabetically by service name
                        return (a.service || '').localeCompare(b.service || '');
                      })
                      .map((ref, i) => (
                        <div key={i} className="referral-item-wrapper">
                          <div className="referral-header">
                            <span className="referral-service">{highlightText(ref.service || 'Unknown Service')}</span>
                            <div className="referral-actions">
                              {ref.priority && <span className={`referral-priority priority-${ref.priority?.toLowerCase()}`}>{highlightText(ref.priority)}</span>}
                              <button
                                className={`copy-btn ${copiedSectionId === `${recordId}-referral-${i}` ? 'copied' : ''}`}
                                onClick={() => copySection(`${ref.service}${ref.priority ? ` (${ref.priority})` : ''}${ref.status ? ` - ${ref.status}` : ''}`, `${recordId}-referral-${i}`)}
                              >
                                {copiedSectionId === `${recordId}-referral-${i}` ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          </div>
                          {ref.status && (
                            <div className="referral-status-row">
                              <span className="referral-status">{highlightText(ref.status)}</span>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Discharge Barriers - EDITABLE array, HYBRID pattern with sectionTitleMatches */}
              {record.dischargeBarriers && record.dischargeBarriers.length > 0 &&
                shouldShowSection(record, 'Discharge Barriers', record.dischargeBarriers) && (() => {
                  const sectionTitleMatches = searchTerm && shouldShowRow(record, 'Discharge Barriers', 'discharge barriers', 'barriers');
                  const showAll = record._showAllSections || sectionTitleMatches;

                  return (
                    <div className="section-container">
                      {renderSectionHeader('Discharge Barriers', `${recordId}-discharge`, () => {
                        const r = pdfData[idx] || record;
                        const lines = ['DISCHARGE BARRIERS', '='.repeat(40)];
                        (r.dischargeBarriers || []).forEach((b, i) => lines.push(`${i + 1}. ${b}`));
                        copySection(lines.join('\n'), `${recordId}-discharge`);
                      }, idx, 'discharge')}
                      <div className="numbered-rows-wrapper cyan-wireframe">
                        {record.dischargeBarriers
                          .filter(barrier => showAll || shouldShowRow(record, 'Discharge Barrier', barrier))
                          .map((barrier, i) =>
                            renderEditableArrayItem(record, 'dischargeBarriers', barrier, idx, i, 'discharge', `${recordId}-discharge-${i}`)
                          )}
                      </div>
                    </div>
                  );
                })()}

              {/* Interventions - EDITABLE */}
              {record.interventions && (
                Array.isArray(record.interventions) ? record.interventions.length > 0 : String(record.interventions).trim()
              ) && shouldShowSection(record, 'Interventions', Array.isArray(record.interventions) ? record.interventions : [record.interventions]) && (() => {
                const sectionTitleMatches = searchTerm && shouldShowRow(record, 'Interventions', 'interventions');
                const showAll = record._showAllSections || sectionTitleMatches;

                if (Array.isArray(record.interventions)) {
                  return (
                    <div className="section-container">
                      {renderSectionHeader('Interventions', `${recordId}-interventions`, () => {
                        const r = pdfData[idx] || record;
                        const lines = ['INTERVENTIONS', '='.repeat(40)];
                        (r.interventions || []).forEach((item, i) => lines.push(`${i + 1}. ${item}`));
                        copySection(lines.join('\n'), `${recordId}-interventions`);
                      }, idx, 'interventions')}
                      <div className="numbered-rows-wrapper">
                        {record.interventions
                          .filter(item => showAll || shouldShowRow(record, 'Intervention', item))
                          .map((item, i) =>
                            renderEditableArrayItem(record, 'interventions', item, idx, i, 'interventions', `${recordId}-intervention-${i}`)
                          )}
                      </div>
                    </div>
                  );
                } else {
                  // String field
                  return (
                    <div className="section-container">
                      {renderSectionHeader('Interventions', `${recordId}-interventions`, () => {
                        const r = pdfData[idx] || record;
                        copySection(`INTERVENTIONS\n${'='.repeat(40)}\n${r.interventions || record.interventions}`, `${recordId}-interventions`);
                      }, idx, 'interventions')}
                      <div className="numbered-rows-wrapper">
                        {renderEditableField(record, 'interventions', 'Interventions', idx, 'interventions', `${recordId}-interventions-field`)}
                      </div>
                    </div>
                  );
                }
              })()}

              {/* Notes */}
              {record.notes && shouldShowSection(record, 'Notes', record.notes) && (
                <div className="section-container">
                  <h3 className="section-title">{highlightText('Notes')}</h3>
                  <div className="numbered-rows-wrapper">
                    <div className="numbered-row">
                      <div className="numbered-row-content">
                        {highlightText(record.notes)}
                      </div>
                      <button
                        className={`copy-btn ${copiedSectionId === `${recordId}-notes` ? 'copied' : ''}`}
                        onClick={() => copySection(record.notes, `${recordId}-notes`)}
                      >
                        {copiedSectionId === `${recordId}-notes` ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SocialDeterminantsOfHealthDocument;
