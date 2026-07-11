module.exports = {
  title: '📋 History of Present Illness',
  columns: ['Date', 'History'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      const text = String(val).trim() || defaultVal;
      if (text === defaultVal) return defaultVal;

      // Add line breaks after sentences for better readability
      // BUT NOT after common titles (Mr., Mrs., Ms., Dr., Prof., Sr., Jr., etc.)
      const titles = ['Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof', 'Sr', 'Jr', 'Rev', 'Hon'];
      let result = text;

      // Replace period+space with line break, except after titles
      result = result.split('. ').map((sentence, index, array) => {
        if (index === array.length - 1) return sentence; // Last item, no period needed

        // Check if this sentence ends with a title
        const trimmed = sentence.trim();
        const isTitle = titles.some(title => trimmed.endsWith(title));

        return isTitle ? sentence + '. ' : sentence + '.\n\n';
      }).join('');

      return result;
    };

    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      History: getValue(entry.history || entry.historyOfPresentIllness || entry.hpi || entry.presentingComplaint)
    }));
  }
};
