# Claude Prompt Caching Strategy Guide

## Overview
Anthropic's prompt caching allows you to cache large static content (like function definitions) and reuse it across multiple requests at a 90% discount.

## Cache Duration Options

### 5-Minute Cache (Default)
**When to use:**
- Development/testing environments
- Frequently changing function definitions
- Low traffic (< 10 requests/hour)
- Short user sessions
- Rapid iteration on functions

**Configuration:**
```bash
# Default behavior (no env var needed)
node server.js
```

**Cost Example (with Haiku):**
- First request: $0.07 (caches 57K tokens)
- Next 5 minutes: $0.003 per request
- Break-even: After 2 requests

### 60-Minute Cache (Production)
**When to use:**
- Production environments
- Stable function definitions
- High traffic (> 100 requests/hour)
- Multiple concurrent users
- Long user sessions

**Configuration:**
```bash
# Set environment variable
CLAUDE_CACHE_DURATION=60 node server.js
```

**Cost Example (with Haiku):**
- First request: $0.07 (caches 57K tokens)
- Next 60 minutes: $0.003 per request
- Break-even: After 2 requests
- **Savings at scale**: 100 requests = save $6.70/hour

## How Anthropic's Cache Works

### Cache Creation
1. First request with `cache_control: { type: 'ephemeral' }` creates cache
2. Cache write costs 25% more than regular tokens
3. Cache is stored on Anthropic's servers

### Cache Usage
1. Subsequent requests automatically use cached content
2. Cached tokens cost 90% less
3. Cache hit/miss tracked in response usage metrics

### Cache Expiration
- **5-minute cache**: Expires 5 minutes after last access
- **60-minute cache**: Can persist longer based on usage patterns
- Anthropic may extend cache duration for frequently accessed content

## Implementation Details

### Current Setup
```javascript
// In agentServiceClaudeCached.js
this.cacheDurationMinutes = process.env.CLAUDE_CACHE_DURATION === '60' ? 60 : 5;

// Cache is created with:
cache_control: { type: 'ephemeral' }
```

### What Gets Cached
1. **System prompt** (instructions for Claude)
2. **All 218 function definitions** (57K tokens)
3. Total cache size: ~108KB

### Monitoring Cache Performance
```javascript
// Cache stats available in responses
{
  cacheHits: 10,
  totalSaved: 0.67,  // dollars saved
  cacheAge: 15        // minutes since cache created
}
```

## Best Practices

### For Development
```bash
# Use 5-minute cache for rapid iteration
node server.js

# Clear cache by waiting 5 minutes
# Or restart the service
```

### For Production
```bash
# Use 60-minute cache for cost savings
CLAUDE_CACHE_DURATION=60 NODE_ENV=production node server.js

# Monitor cache hit rate
# Aim for > 90% cache hit rate
```

### Cache Warming
```javascript
// Consider warming cache on startup
async function warmCache() {
  await agent.processChatMessage(
    "test",
    "cache-warm",
    "en",
    { country: "Israel" }
  );
}
```

## Cost Analysis

### Development (5-min cache, 10 requests/hour)
- Cache creates: 12 times/hour
- Hourly cost: $0.84
- Per request: $0.084

### Production (60-min cache, 100 requests/hour)
- Cache creates: 1 time/hour
- Hourly cost: $0.37
- Per request: $0.0037
- **95% cheaper than dev!**

### Production (60-min cache, 1000 requests/hour)
- Cache creates: 1 time/hour
- Hourly cost: $3.07
- Per request: $0.00307
- **96% cheaper than no cache!**

## Recommendations

1. **Always use 60-minute cache in production**
   - Massive cost savings
   - Better performance (no cache misses)
   - Predictable costs

2. **Use 5-minute cache for development**
   - Allows function changes
   - Still provides cost benefits
   - Easy to test changes

3. **Monitor cache metrics**
   - Track hit rate
   - Watch for cache misses
   - Alert on high miss rates

4. **Consider cache warming**
   - Warm cache before peak hours
   - Prevent first-user penalty
   - Ensure consistent performance

## Environment Variables

```bash
# Cache duration (5 or 60 minutes)
CLAUDE_CACHE_DURATION=60

# Force production mode
NODE_ENV=production

# Claude API key
CLAUDE_API_KEY=sk-ant-api03-...

# Optional: Disable caching entirely
USE_CLAUDE_CACHE=false
```

## Troubleshooting

### High Cache Miss Rate
- Check if functions are changing frequently
- Verify cache duration setting
- Look for service restarts

### Unexpected Costs
- Verify cache is being used (check logs)
- Confirm Haiku model is selected
- Check for cache creation frequency

### Performance Issues
- Ensure cache is warm
- Check network latency to Anthropic
- Verify function count isn't excessive

## Summary

- **5-minute cache**: Best for development, testing, and low traffic
- **60-minute cache**: Essential for production and high traffic
- **Cost savings**: 90% discount on cached tokens
- **Break-even**: Just 2 requests
- **At scale**: 95%+ cost reduction possible

With proper cache configuration, you can handle thousands of requests per hour at a fraction of the cost!