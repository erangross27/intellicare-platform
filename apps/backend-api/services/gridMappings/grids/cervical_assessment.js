module.exports = {
  title: '🔍 Cervical Assessment',
  columns: ['Date', 'Cervical Length', 'Dilation', 'Effacement', 'Obstetrician'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Cervical Length': getValue(entry.cervicalLength || entry.length),
      Dilation: getValue(entry.dilation || entry.dilationCm),
      Effacement: getValue(entry.effacement || entry.effacementPercent),
      Obstetrician: getValue(entry.obstetrician || entry.provider)
    }));
  }
};
