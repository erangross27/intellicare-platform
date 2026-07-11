module.exports = {
  title: '🎗️ Oncology Consultation',
  columns: ['Date', 'Cancer Type', 'Stage', 'Treatment Plan', 'Oncologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Cancer Type': getValue(entry.cancerType || entry.diagnosis),
      Stage: getValue(entry.stage || entry.staging),
      'Treatment Plan': getValue(entry.treatmentPlan || entry.plan),
      Oncologist: getValue(entry.oncologist || entry.provider)
    }));
  }
};
