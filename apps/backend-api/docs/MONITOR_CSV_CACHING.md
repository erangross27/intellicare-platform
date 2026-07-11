# CSV Import Caching Monitor Guide

## ✅ Stanford Patients Deleted
- **Deleted**: 77 patients from `intellicare_practice_stanford`
- **Status**: Ready for fresh import to test caching

## 📊 What to Monitor in Console

### First CSV Import (Cache WRITE):
Look for these indicators:
```
📊 CSV Import Context Detected - Adding comprehensive cached instructions
📊 ANTHROPIC API TOKEN BREAKDOWN (CSV IMPORT):
├─ Input Tokens: [number]
├─ Cache Write: [should be > 0] tokens (to cache)
├─ 📝 CSV Import Cache Created - Will be reused for 5 minutes
```

### Second CSV Import (Cache READ):
Within 5 minutes, import another CSV and look for:
```
📊 ANTHROPIC API TOKEN BREAKDOWN (CSV IMPORT):
├─ Input Tokens: [number]
├─ Cache Read: [should be > 0] tokens (from cache)
├─ 🎯 Cache Hit Rate: [percentage]%
├─ 💰 Tokens Saved: [number]
├─ ✅ CSV Import Cache Active - Validation rules cached
```

## 🔍 Key Metrics to Track

1. **Cache Write Tokens** (First Import)
   - Should see `cache_creation_input_tokens > 0`
   - Indicates system/tools being cached

2. **Cache Read Tokens** (Subsequent Imports)
   - Should see `cache_read_input_tokens > 0`
   - Shows cache is being utilized

3. **Token Savings**
   - Compare input tokens between first and second import
   - Should see 50-90% reduction in billable tokens

## 🚀 How to Test

1. **Upload CSV #1**
   - Go to Stanford practice UI
   - Upload patient CSV file
   - Say: "import patients from CSV"
   - Watch console for cache WRITE

2. **Upload CSV #2** (within 5 minutes)
   - Upload another CSV file
   - Say: "import these patients"
   - Watch console for cache READ
   - Should see significant token savings

## 📈 Expected Results

### Without Caching:
- Input tokens: 12,000-15,000
- Cost: Full price for every import

### With Caching:
- First import: 12,000 tokens (writes to cache)
- Second import: 1,000-2,000 tokens (reads from cache)
- **Savings**: 80-90% reduction!

## 🎯 Current Implementation

The system now includes:
1. **Comprehensive CSV instructions** (1,600+ tokens)
2. **Cache control on system blocks**
3. **Cache control on first 10 tools**
4. **Enhanced logging for CSV imports**

## ⚠️ Note

If you don't see caching working:
- System block caching may not be fully supported by Claude API yet
- Tool caching should still provide some benefits
- The comprehensive instructions still improve accuracy even without caching

---

**Ready to test!** Upload your CSV and monitor the console for caching statistics.