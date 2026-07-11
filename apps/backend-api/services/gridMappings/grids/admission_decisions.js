module.exports = {
  title: '🏥 Admission Decisions',
  columns: ['Date', 'Decision', 'Reason', 'Disposition', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Decision: getValue(entry.decision || entry.admissionDecision),
      Reason: getValue(entry.reason || entry.indication),
      Disposition: getValue(entry.disposition || entry.location),
      Provider: getValue(entry.provider || entry.decidingPhysician)
    }));
  }
};
