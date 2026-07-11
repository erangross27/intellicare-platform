// Lightweight in-memory rate limiter (per IP + route)
// For production replace with robust store (Redis) and express-rate-limit library.

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 120; // per window per key

const buckets = new Map();

function rateLimit(options = {}) {
  const windowMs = options.windowMs || WINDOW_MS;
  const max = options.max || MAX_REQUESTS;

  return function(req, res, next) {
    const key = `${req.ip}:${req.baseUrl}${req.path}`;
    const now = Date.now();
    let entry = buckets.get(key);

    if (!entry || now - entry.start > windowMs) {
      entry = { start: now, count: 0 };
      buckets.set(key, entry);
    }

    entry.count++;

    if (entry.count > max) {
      return res.status(429).json({
        success: false,
        message: {
          en: 'Too many requests. Please slow down.',
          he: 'יותר מדי בקשות. אנא האט.'
        }
      });
    }

    // Lightweight cleanup occasionally
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) {
        if (now - v.start > windowMs) buckets.delete(k);
      }
    }

    next();
  };
}

module.exports = rateLimit;
