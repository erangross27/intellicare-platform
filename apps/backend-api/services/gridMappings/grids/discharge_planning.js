module.exports = {
  title: '🚪 Discharge Planning',
  columns: ['Date', 'Discharge To', 'Equipment Needed', 'Follow-Up', 'Case Manager'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : (entry.dischargeDate ? new Date(entry.dischargeDate).toLocaleDateString() : '-'),
      'Discharge To': getValue(entry.dischargeTo || entry.disposition),
      'Equipment Needed': getValue(entry.equipment || entry.dme),
      'Follow-Up': getValue(entry.followUp || entry.appointments),
      'Case Manager': getValue(entry.caseManager || entry.provider)
    }));
  }
};
