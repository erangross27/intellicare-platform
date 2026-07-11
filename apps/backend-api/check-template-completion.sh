#!/bin/bash

echo "=== TEMPLATE VERIFICATION REPORT ==="
echo ""

total=0
with_search=0
complete=0
no_search=0

for file in *Document.jsx; do
  ((total++))
  
  # Check if template has search functionality
  if grep -q "SearchBar\|useDocumentSearch" "$file"; then
    ((with_search++))
    
    # Check if has toLowerCase()
    if grep -q "toLowerCase()" "$file"; then
      ((complete++))
    fi
  else
    ((no_search++))
  fi
done

echo "Total templates: $total"
echo "Templates with search: $with_search"
echo "Templates with search + toLowerCase(): $complete"
echo "Templates without search: $no_search"
echo ""

if [ $with_search -eq $complete ]; then
  echo "✅ ALL templates with search have proper toLowerCase() implementation!"
else
  echo "❌ Some templates with search are missing toLowerCase()"
  missing=$((with_search - complete))
  echo "Missing: $missing templates"
fi
