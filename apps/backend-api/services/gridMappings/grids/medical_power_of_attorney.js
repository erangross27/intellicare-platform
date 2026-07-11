module.exports = {
  title: '⚖️ Medical Power of Attorney',
  columns: ['Date', 'Agent Name', 'Scope', 'Witnesses', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Agent Name': getValue(entry.agentName || entry.agent),
      Scope: getValue(entry.scope || entry.authority),
      Witnesses: getValue(entry.witnesses || entry.signatories),
      Provider: getValue(entry.provider)
    }));
  }
};
