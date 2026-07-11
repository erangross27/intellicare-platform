module.exports = {
  title: '💊 Proposed ART Switch',
  columns: ['Date', 'Current Regimen', 'Proposed Regimen', 'Reason', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Current Regimen': getValue(entry.currentRegimen || entry.current),
      'Proposed Regimen': getValue(entry.proposedRegimen || entry.proposed),
      Reason: getValue(entry.reason || entry.rationale),
      Provider: getValue(entry.provider)
    }));
  }
};
