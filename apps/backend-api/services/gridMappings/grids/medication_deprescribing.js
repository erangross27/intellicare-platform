module.exports = {
  title: '💊 Medication Deprescribing',
  columns: ['Date', 'Medication', 'Rationale', 'Taper Plan', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Medication: getValue(entry.medication || entry.drug),
      Rationale: getValue(entry.rationale || entry.reason),
      'Taper Plan': getValue(entry.taperPlan || entry.schedule),
      Provider: getValue(entry.provider)
    }));
  }
};
