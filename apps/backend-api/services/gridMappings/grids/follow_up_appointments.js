const getValue = (val, defaultVal = '-') => {
  if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
    return defaultVal;
  }
  const strVal = String(val).trim();
  return strVal || defaultVal;
};

module.exports = {
  title: '📋 Recommended Follow-Ups',
  columns: ['Date', 'Type', 'Provider', 'Reason', 'Status'],
  mapper: (entry) => {
    const isRecommendation = entry.source === 'batch_document_extraction' || !entry.appointmentId;
    const status = isRecommendation ? '⚠️ Needs Scheduling' : 'Scheduled';

    return { 'Date': entry.appointmentDate || entry.date || entry.scheduledDate ?
        new Date(entry.appointmentDate || entry.date || entry.scheduledDate).toLocaleDateString() : '-', 'Type': getValue(entry.specialty || entry.type || entry.appointmentType || entry.department, 'General'), 'Provider': getValue(entry.provider || entry.doctor || entry.providerName || entry.providerId), 'Reason': getValue(entry.reason || entry.title || entry.description || entry.appointmentReason), 'Status': status
    };
  }
};
