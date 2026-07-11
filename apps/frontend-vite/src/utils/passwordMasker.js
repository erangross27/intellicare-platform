// Utility to mask passwords in messages
export const maskPasswordInMessages = (messages) => {
  if (!messages || !Array.isArray(messages)) return messages;
  
  return messages.map((msg, index, allMsgs) => {
    // Skip if already masked
    if (msg.content === '••••••••') return msg;
    
    // Check if previous message asks for password
    const prevMsg = index > 0 ? allMsgs[index - 1] : null;
    const passwordKeywords = [
      'password', 'סיסמה', 'סיסמא', 'סיסמה שלך', 
      'הקלד את הסיסמה', 'enter password', 'your password'
    ];
    
    const isPrevAskingPassword = prevMsg && prevMsg.type === 'agent' &&
      passwordKeywords.some(kw => 
        prevMsg.content?.toLowerCase().includes(kw.toLowerCase())
      );
    
    // Don't check for specific passwords - that's a security risk!
    
    // Check if looks like password (mixed case + special chars)
    const looksLikePassword = msg.type === 'user' && msg.content &&
      msg.content.length >= 6 && // Min length for password
      /[A-Z]/.test(msg.content) && // Has uppercase
      /[a-z]/.test(msg.content) && // Has lowercase  
      /[!@#$%^&*]/.test(msg.content); // Has special char
    
    // Mask if any condition is true
    if (msg.type === 'user' && (isPrevAskingPassword || looksLikePassword)) {
      return { 
        ...msg, 
        content: '••••••••',
        originalContent: msg.content,
        isPassword: true 
      };
    }
    
    return msg;
  });
};

// Check if a message is asking for password
export const isAskingForPassword = (message) => {
  if (!message || typeof message !== 'string') return false;
  
  const passwordKeywords = [
    'password', 'סיסמה', 'סיסמא', 'סיסמה שלך',
    'הקלד את הסיסמה', 'enter password', 'your password'
  ];
  
  const lowerMessage = message.toLowerCase();
  return passwordKeywords.some(keyword => 
    lowerMessage.includes(keyword.toLowerCase())
  );
};