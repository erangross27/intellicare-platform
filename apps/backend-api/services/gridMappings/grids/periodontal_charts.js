module.exports = {
  title: '🦷 Periodontal Charts',
  columns: ['Date', 'Pocket Depths', 'Bleeding', 'Diagnosis', 'Periodontist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Pocket Depths': getValue(entry.pocketDepths || entry.probingDepths),
      Bleeding: getValue(entry.bleeding || entry.bleedingOnProbing),
      Diagnosis: getValue(entry.diagnosis || entry.periodontalDiagnosis),
      Periodontist: getValue(entry.periodontist || entry.provider)
    }));
  }
};
