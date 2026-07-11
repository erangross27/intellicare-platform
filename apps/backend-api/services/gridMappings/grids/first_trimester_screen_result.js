module.exports = {
  title: '🤰 First Trimester Screen Result',
  columns: ['Date', 'NT', 'PAPP-A', 'Free Beta-hCG', 'Risk'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      NT: getValue(entry.nt || entry.nuchalTranslucency),
      'PAPP-A': getValue(entry.pappA || entry.pappa),
      'Free Beta-hCG': getValue(entry.freeBetaHcg || entry.betaHcg),
      Risk: getValue(entry.risk || entry.combinedRisk)
    }));
  }
};
