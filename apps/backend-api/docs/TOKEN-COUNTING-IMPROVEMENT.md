# Token Counting Improvement Implementation

## Date: August 21, 2025

## Summary
Successfully implemented accurate token counting using Anthropic's official `count_tokens` API endpoint, replacing the crude character-based estimation that was previously in use.

## Changes Made

### 1. Added Accurate Token Counting Method
- **File**: `services/agentServiceClaude.js`
- **Method**: `countTokens(messages, model, system, tools)`
- Uses Anthropic's `/messages/count_tokens` endpoint for precise token counting
- Includes fallback to estimation if API fails
- Handles edge cases (empty messages, system-only prompts)

### 2. Improved Fallback Estimation
- **Method**: `estimateTokensFallback(messages)`
- More conservative estimation: ~1 token per 3 characters (was 1 per 4)
- Better accounts for Hebrew text which typically uses fewer characters per token

### 3. Updated Context Window Management
- Replaced crude `estimateTokens` function with API-based `countTokens`
- Smart trimming now uses accurate token counts for better context management
- Individual message token counting for precise context window optimization

## Test Results

### Accuracy Improvement
- **Old estimation**: 52 tokens for test messages
- **Accurate count**: 118 tokens (same messages)
- **Variance**: 55.9% - the old method was significantly underestimating

### Performance Trade-off
- **API counting**: ~200ms per call
- **Fallback estimation**: <1ms
- The accuracy improvement justifies the minimal latency increase

### Cost Calculation Verification
The implementation correctly:
- Tracks regular input tokens at full price
- Applies 90% discount for cached tokens
- Adds 25% premium for cache writes
- Converts to ILS with proper exchange rate

## Benefits

1. **Accurate Cost Tracking**: Precise token counts ensure accurate billing and cost monitoring
2. **Better Context Management**: Smart trimming based on real token counts prevents context overflow
3. **Cache Optimization**: Accurate counting helps maximize cache utilization (90% cost savings)
4. **Compliance**: Using official API ensures compatibility with Anthropic's billing system

## Technical Details

### API Requirements
- Requires at least one non-empty message
- Supports system prompts and tool definitions
- Returns `input_tokens` count for the request

### Error Handling
- Graceful fallback to estimation if API fails
- Proper error logging for debugging
- Edge case handling for empty conversations

## Testing
Created comprehensive test suite (`test-token-counting.js`) that validates:
- Basic message token counting
- System prompt token counting
- Large conversation management
- Cost calculation accuracy
- Performance comparison

## Recommendations

1. **Monitor API Usage**: The count_tokens endpoint has its own rate limits
2. **Cache Token Counts**: Consider caching counts for frequently used messages
3. **Batch Counting**: When possible, count multiple messages in one API call
4. **Regular Audits**: Periodically compare estimated vs actual tokens from API responses

## References
- [Anthropic Token Counting Documentation](https://docs.anthropic.com/en/docs/build-with-claude/token-counting)
- Test Script: `test-token-counting.js`
- Implementation: `services/agentServiceClaude.js`