module.exports = {
  title: '💬 Portal Messages',
  columns: ['Date', 'Subject', 'From', 'Status', 'Response'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Subject: getValue(entry.subject || entry.topic),
      From: getValue(entry.from || entry.sender),
      Status: getValue(entry.status || entry.messageStatus),
      Response: getValue(entry.response || entry.reply)
    }));
  }
};
