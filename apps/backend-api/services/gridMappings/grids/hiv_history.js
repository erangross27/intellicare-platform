module.exports = {
  title: '🦠 HIV History',
  columns: ['Date', 'CD4 Count', 'Viral Load', 'ART Regimen', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'CD4 Count': getValue(entry.cd4Count || entry.cd4),
      'Viral Load': getValue(entry.viralLoad || entry.vl),
      'ART Regimen': getValue(entry.artRegimen || entry.medications),
      Provider: getValue(entry.provider)
    }));
  }
};
