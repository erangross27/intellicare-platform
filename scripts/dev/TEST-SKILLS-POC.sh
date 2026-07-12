#!/bin/bash

# SKILLS POC TEST SCRIPT
# Tests the new Skills API approach against current 2-stage selector

BASE_URL="http://localhost:5000"

echo ""
echo "=================================================="
echo "🚀 Claude Skills POC Test Suite"
echo "=================================================="
echo ""
echo "Testing IntelliCare Skills API implementation"
echo "Location: Backend running on $BASE_URL"
echo ""

# Test 1: Check POC structure
echo "=================================================="
echo "TEST 1: Verify POC Structure"
echo "=================================================="
echo ""
echo "Checking if skills are properly created..."
echo "Endpoint: GET /api/test-skills/structure"
echo ""
curl -s "$BASE_URL/api/test-skills/structure" | jq .
echo ""
echo ""

# Test 2: Current approach
echo "=================================================="
echo "TEST 2: Current Approach (2-Stage Function Selection)"
echo "=================================================="
echo ""
echo "Testing token usage with current method..."
echo "Endpoint: POST /api/test-skills/current"
echo ""
curl -s -X POST "$BASE_URL/api/test-skills/current" \
  -H "Content-Type: application/json" \
  -d '{"userMessage": "Show me Helen Cox'"'"'s allergies"}' | jq .
echo ""
echo ""

# Test 3: Skills API approach
echo "=================================================="
echo "TEST 3: New Approach (Skills API)"
echo "=================================================="
echo ""
echo "Testing token usage with Skills API..."
echo "Endpoint: POST /api/test-skills/skills-api"
echo ""
curl -s -X POST "$BASE_URL/api/test-skills/skills-api" \
  -H "Content-Type: application/json" \
  -d '{"userMessage": "Show me Helen Cox'"'"'s allergies"}' | jq .
echo ""
echo ""

# Test 4: Comparison
echo "=================================================="
echo "TEST 4: Detailed Comparison"
echo "=================================================="
echo ""
echo "Comparing both approaches side-by-side..."
echo "Endpoint: GET /api/test-skills/compare"
echo ""
curl -s "$BASE_URL/api/test-skills/compare" | jq .
echo ""
echo ""

# Summary
echo "=================================================="
echo "✨ TEST SUMMARY"
echo "=================================================="
echo ""
echo "Expected Results:"
echo "  ✅ Current approach: 7,500 tokens + 2 API calls"
echo "  ✅ Skills approach: ~500 tokens + 1 API call"
echo "  ✅ Savings: 93% token reduction"
echo ""
echo "Next Steps:"
echo "  1. Review results above"
echo "  2. If verified, run: npm run generate-skills"
echo "  3. Then upload: npm run upload-skills"
echo ""
echo "=================================================="
echo ""
