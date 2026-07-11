module.exports = {
  title: '🎗️ Survivorship Care Plan',
  columns: ['Date', 'Treatment Summary', 'Follow-up Plan', 'Late Effects', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Treatment Summary': getValue(entry.treatmentSummary || entry.treatments),
      'Follow-up Plan': getValue(entry.followUpPlan || entry.surveillance),
      'Late Effects': getValue(entry.lateEffects || entry.monitoring),
      Provider: getValue(entry.provider)
    }));
  }
};
