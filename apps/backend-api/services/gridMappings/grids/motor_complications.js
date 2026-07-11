module.exports = {
  title: '🧠 Motor Complications',
  columns: ['Date', 'Dyskinesia', 'Wearing Off', 'On/Off Times', 'Neurologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Dyskinesia: getValue(entry.dyskinesia || entry.involuntaryMovements),
      'Wearing Off': getValue(entry.wearingOff || entry.endOfDose),
      'On/Off Times': getValue(entry.onOffTimes || entry.fluctuations),
      Neurologist: getValue(entry.neurologist || entry.provider)
    }));
  }
};
