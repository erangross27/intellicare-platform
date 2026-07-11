# Claude API Caching Fix

## The Problem
Claude's API `cache_control` feature **ONLY works in the messages array**, not in the system parameter.

When we pass:
```javascript
{
  system: systemBlocks,  // ❌ cache_control NOT supported here
  messages: [...]
}
```

The cache_control blocks in system are **completely ignored**.

## The Solution
Move cacheable content to the messages array as a prefixed user message:

```javascript
messages: [
  {
    role: "user",
    content: [{
      type: "text",
      text: "System context + tools",
      cache_control: { type: "ephemeral" }  // ✅ Works here!
    }]
  },
  {
    role: "assistant",
    content: "Understood"
  },
  // ... rest of conversation
]
```

## Implementation
The fix adds system content as the first message pair (user + assistant) to enable caching while maintaining the conversation flow.