module.exports = {
  title: '🎗️ Myeloma Specific Data',
  columns: ['Date', 'M-Protein', 'FLC Ratio', 'Bone Lesions', 'Oncologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'M-Protein': getValue(entry.mProtein || entry.mSpike),
      'FLC Ratio': getValue(entry.flcRatio || entry.freeLightChainRatio),
      'Bone Lesions': getValue(entry.boneLesions || entry.osteolytic),
      Oncologist: getValue(entry.oncologist || entry.provider)
    }));
  }
};
