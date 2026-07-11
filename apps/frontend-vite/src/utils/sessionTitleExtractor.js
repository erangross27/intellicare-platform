// Memoized session title extraction utility
// Optimized for performance - extracts title from chat messages without blocking UI

// Cache for compiled regex patterns
const patternCache = new Map();

// Greeting patterns - compiled once
const GREETING_PATTERNS = [
  /^(שלום|בוקר טוב|ערב טוב|היי|הי|hello|hi|hey|good morning|good evening)[\.!\?\s]*$/i
];

// Action patterns for title extraction
const ACTION_PATTERNS = {
  he: [
    { pattern: /(?:add|create|new|הוסף|צור|חדש).*?(?:patient|מטופל)/i, prefix: 'מטופל חדש' },
    { pattern: /(?:schedule|book|קבע|הזמן).*?(?:appointment|meeting|תור|פגישה)/i, prefix: 'קביעת תור' },
    { pattern: /(?:search|find|look|חפש|מצא).*?(?:patient|record|מטופל|רשומה)/i, prefix: 'חיפוש' },
    { pattern: /(?:update|edit|modify|עדכן|ערוך|שנה)/i, prefix: 'עדכון' },
    { pattern: /(?:prescription|medication|drug|מרשם|תרופה)/i, prefix: 'מרשם' },
    { pattern: /(?:diagnos|symptom|אבחנה|סימפטום|תסמין)/i, prefix: 'אבחנה' },
    { pattern: /(?:document|file|image|מסמך|קובץ|תמונה)/i, prefix: 'מסמך' },
    { pattern: /(?:practice|מרפאה)/i, prefix: 'מרפאה' },
    { pattern: /(?:test|lab|בדיקה|מעבדה)/i, prefix: 'בדיקות' },
    { pattern: /(?:report|summary|דוח|סיכום)/i, prefix: 'דוח' }
  ],
  en: [
    { pattern: /(?:add|create|new|הוסף|צור|חדש).*?(?:patient|מטופל)/i, prefix: 'New Patient' },
    { pattern: /(?:schedule|book|קבע|הזמן).*?(?:appointment|meeting|תור|פגישה)/i, prefix: 'Schedule Appointment' },
    { pattern: /(?:search|find|look|חפש|מצא).*?(?:patient|record|מטופל|רשומה)/i, prefix: 'Search' },
    { pattern: /(?:update|edit|modify|עדכן|ערוך|שנה)/i, prefix: 'Update' },
    { pattern: /(?:prescription|medication|drug|מרשם|תרופה)/i, prefix: 'Prescription' },
    { pattern: /(?:diagnos|symptom|אבחנה|סימפטום|תסמין)/i, prefix: 'Diagnosis' },
    { pattern: /(?:document|file|image|מסמך|קובץ|תמונה)/i, prefix: 'Document' },
    { pattern: /(?:practice|מרפאה)/i, prefix: 'Practice' },
    { pattern: /(?:test|lab|בדיקה|מעבדה)/i, prefix: 'Tests' },
    { pattern: /(?:report|summary|דוח|סיכום)/i, prefix: 'Report' }
  ]
};

// Memoized pattern matcher
const matchPattern = (() => {
  const cache = new Map();

  return (text, patterns) => {
    const cacheKey = `${text.substring(0, 50)}_${patterns.length}`;
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }

    for (const { pattern, prefix } of patterns) {
      if (pattern.test(text)) {
        const match = text.match(pattern);
        if (match) {
          const result = { match, prefix };
          cache.set(cacheKey, result);
          return result;
        }
      }
    }

    cache.set(cacheKey, null);
    return null;
  };
})();

// Check if message is just a greeting
export const isGreeting = (message) => {
  if (!message || message.length > 15) return false;
  const msgLower = message.toLowerCase().trim();
  return GREETING_PATTERNS.some(pattern => pattern.test(msgLower));
};

// Extract title from user message
export const extractTitleFromUserMessage = (userMsg, language = 'en') => {
  if (!userMsg || userMsg.length < 10 || isGreeting(userMsg)) {
    return null;
  }

  const isHebrew = language === 'he';

  // Remove common prefixes
  let cleanMsg = userMsg
    .replace(/^(אני רוצה|I want|I need|Please|בבקשה|תוכל|can you|could you|help me|עזור לי)/gi, '')
    .replace(/^(to|ל|את|the|a|an)/gi, '')
    .trim();

  // Try to match action patterns
  const patterns = ACTION_PATTERNS[isHebrew ? 'he' : 'en'];
  const patternMatch = matchPattern(userMsg, patterns);

  if (patternMatch) {
    const { match, prefix } = patternMatch;
    const afterMatch = userMsg.substring(match.index + match[0].length).trim();
    const nextWords = afterMatch
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 3)
      .join(' ');

    // Only use the action prefix when it carries real detail ("New Patient: Jane", "Search: Cruz").
    // A bare "Report"/"Search"/"Tests" throws away a descriptive message (e.g. "Give me today's
    // summary" -> "Report"), so fall through to the raw first clause below instead — it reads far
    // better. (Kept in sync with mobile's sessionTitle.ts.)
    if (nextWords.length > 3) {
      return `${prefix}: ${nextWords.substring(0, 30)}`;
    }
  }

  // Fallback: use cleaned message
  cleanMsg = cleanMsg.replace(/[?؟]/g, '').trim();
  const firstPart = cleanMsg.match(/^[^.!,;]+/);

  if (firstPart && firstPart[0].length > 10) {
    return firstPart[0].substring(0, 40).trim();
  } else if (cleanMsg.length > 10) {
    return cleanMsg.substring(0, 40).trim();
  }

  return null;
};

// Extract title from agent response (simplified)
export const extractTitleFromAgentResponse = (response, language = 'en') => {
  if (!response || response.length < 30) return null;

  const isHebrew = language === 'he';

  // Quick extraction patterns for common responses
  const quickPatterns = [
    {
      pattern: /(?:הוספתי|Added|Created|רשמתי).*?(?:מטופל|patient).*?(?:בשם|named?)\s+([^\n,\.]+)/i,
      format: (match) => isHebrew ? `מטופל חדש: ${match.substring(0, 30)}` : `New Patient: ${match.substring(0, 30)}`
    },
    {
      pattern: /(?:קבעתי|Scheduled|Booked).*?(?:תור|appointment).*?(?:ל|for)\s+([^\n]+)/i,
      format: (match) => isHebrew ? `תור: ${match.substring(0, 30)}` : `Appointment: ${match.substring(0, 30)}`
    },
    {
      pattern: /(?:מצאתי|Found|Located)\s+(\d+)\s+(?:מטופלים|patients?)/i,
      format: (match) => isHebrew ? `חיפוש: ${match}` : `Search: ${match}`
    }
  ];

  for (const { pattern, format } of quickPatterns) {
    const match = response.match(pattern);
    if (match) {
      return format(match[1] || match[0]);
    }
  }

  return null;
};

// Main title extraction function with memoization
const titleCache = new Map();
const MAX_CACHE_SIZE = 100;

export const extractSessionTitle = (userMsg, agentResponse, sessionId, language = 'en', isFirstMessage = false) => {
  // Create cache key
  const cacheKey = `${sessionId}_${userMsg.substring(0, 50)}`;

  // Check cache
  if (titleCache.has(cacheKey)) {
    return titleCache.get(cacheKey);
  }

  // Clear old cache entries if too large
  if (titleCache.size > MAX_CACHE_SIZE) {
    const entriesToDelete = titleCache.size - MAX_CACHE_SIZE / 2;
    const keys = Array.from(titleCache.keys()).slice(0, entriesToDelete);
    keys.forEach(key => titleCache.delete(key));
  }

  let title = null;

  // Try user message first (faster)
  title = extractTitleFromUserMessage(userMsg, language);

  // If no title from user message and we have agent response, try that
  if (!title && agentResponse) {
    title = extractTitleFromAgentResponse(agentResponse, language);
  }

  // Default title for first message
  if (!title && isFirstMessage && !isGreeting(userMsg)) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString(language === 'he' ? 'he-IL' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
    title = language === 'he' ? `שיחה ${timeStr}` : `Chat ${timeStr}`;
  }

  // Sanitize and validate title
  if (title) {
    title = String(title).replace(/[*_]/g, '').trim();
    if (title.length > 50) {
      title = title.substring(0, 47) + '...';
    }
    if (title === '[object Object]' || title === 'undefined' || !title) {
      title = null;
    }
  }

  // Cache the result
  titleCache.set(cacheKey, title);

  return title;
};

// Debounced title update function
export const createDebouncedTitleUpdater = (delay = 500) => {
  let timeoutId = null;

  return (updateFunction, ...args) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      updateFunction(...args);
      timeoutId = null;
    }, delay);
  };
};