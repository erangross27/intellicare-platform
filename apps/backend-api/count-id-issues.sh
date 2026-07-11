#!/bin/bash
cd /c/Users/Eran\ Gross/IntelliCare/apps/backend-api

echo "=== Files with _id query issues and their counts ==="
echo ""

for file in services/*.js services/agentService/*.js services/learning/*.js; do
  if [ -f "$file" ]; then
    # Skip backup, old, test files
    if [[ "$file" == *"backup"* ]] || [[ "$file" == *"old"* ]] || [[ "$file" == *"test"* ]] || [[ "$file" == *"mock"* ]]; then
      continue
    fi
    
    count=$(grep "{ _id:" "$file" 2>/dev/null | grep -v "typeof" | wc -l)
    if [ $count -gt 0 ]; then
      echo "$count - $(basename $file)"
    fi
  fi
done | sort -rn