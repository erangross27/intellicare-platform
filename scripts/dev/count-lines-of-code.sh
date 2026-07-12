#!/bin/bash

# IntelliCare Lines of Code Counter
# Counts all code files excluding backups, node_modules, and build artifacts

# Run from the repo root regardless of where this script is invoked from
# (this script lives in scripts/dev/, so the repo root is two levels up).
cd "$(dirname "${BASH_SOURCE[0]}")/../.." || exit 1

echo "=========================================="
echo "IntelliCare Project - Lines of Code Count"
echo "=========================================="
echo ""

# Function to count lines for files matching a pattern
count_lines() {
  local pattern=$1
  find . -type f -name "$pattern" \
    -not -path "*/node_modules/*" \
    -not -path "*/dist/*" \
    -not -path "*/build/*" \
    -not -path "*/.git/*" \
    -not -path "*/coverage/*" \
    -not -path "*/.next/*" \
    -not -path "*/backups/*" \
    -not -path "*/backup/*" \
    -not -path "*/old/*" \
    -not -path "*/.cache/*" \
    -not -name "*.min.js" \
    -not -name "*.min.css" \
    -not -name "*.map" \
    -not -name "package-lock.json" \
    -not -name "yarn.lock" \
    -not -name "*backup*" \
    -not -name "*-old.*" \
    -not -name "*.bak" \
    -exec wc -l {} + 2>/dev/null | tail -n 1 | awk '{print $1}'
}

# Function to count files
count_files() {
  local pattern=$1
  find . -type f -name "$pattern" \
    -not -path "*/node_modules/*" \
    -not -path "*/dist/*" \
    -not -path "*/build/*" \
    -not -path "*/.git/*" \
    -not -path "*/coverage/*" \
    -not -path "*/.next/*" \
    -not -path "*/backups/*" \
    -not -path "*/backup/*" \
    -not -path "*/old/*" \
    -not -path "*/.cache/*" \
    -not -name "*.min.js" \
    -not -name "*.min.css" \
    -not -name "*.map" \
    -not -name "package-lock.json" \
    -not -name "yarn.lock" \
    -not -name "*backup*" \
    -not -name "*-old.*" \
    -not -name "*.bak" \
    2>/dev/null | wc -l
}

echo "Backend (Node.js/Express)"
echo "----------------------------------------"
backend_js=$(count_lines "*.js")
backend_js_files=$(count_files "*.js")
backend_json=$(count_lines "*.json")
backend_json_files=$(count_files "*.json")

echo "  JavaScript files:        $(printf "%'15d" ${backend_js:-0}) lines ($(printf "%'d" $backend_js_files) files)"
echo "  JSON files:              $(printf "%'15d" ${backend_json:-0}) lines ($(printf "%'d" $backend_json_files) files)"

backend_total=$((${backend_js:-0} + ${backend_json:-0}))
backend_files=$((backend_js_files + backend_json_files))
echo ""

echo "Frontend (React/Vite)"
echo "----------------------------------------"
frontend_jsx=$(count_lines "*.jsx")
frontend_jsx_files=$(count_files "*.jsx")
frontend_css=$(count_lines "*.css")
frontend_css_files=$(count_files "*.css")
frontend_html=$(count_lines "*.html")
frontend_html_files=$(count_files "*.html")

echo "  JSX files:               $(printf "%'15d" ${frontend_jsx:-0}) lines ($(printf "%'d" $frontend_jsx_files) files)"
echo "  CSS files:               $(printf "%'15d" ${frontend_css:-0}) lines ($(printf "%'d" $frontend_css_files) files)"
echo "  HTML files:              $(printf "%'15d" ${frontend_html:-0}) lines ($(printf "%'d" $frontend_html_files) files)"

frontend_total=$((${frontend_jsx:-0} + ${frontend_css:-0} + ${frontend_html:-0}))
frontend_files=$((frontend_jsx_files + frontend_css_files + frontend_html_files))
echo ""

echo "Configuration & Scripts"
echo "----------------------------------------"
scripts_sh=$(count_lines "*.sh")
scripts_sh_files=$(count_files "*.sh")
scripts_md=$(count_lines "*.md")
scripts_md_files=$(count_files "*.md")
scripts_yml=$(count_lines "*.yml")
scripts_yml_files=$(count_files "*.yml")
scripts_yaml=$(count_lines "*.yaml")
scripts_yaml_files=$(count_files "*.yaml")

echo "  Shell scripts:           $(printf "%'15d" ${scripts_sh:-0}) lines ($(printf "%'d" $scripts_sh_files) files)"
echo "  Markdown docs:           $(printf "%'15d" ${scripts_md:-0}) lines ($(printf "%'d" $scripts_md_files) files)"
echo "  YAML files:              $(printf "%'15d" $((${scripts_yml:-0} + ${scripts_yaml:-0}))) lines ($(printf "%'d" $((scripts_yml_files + scripts_yaml_files))) files)"

scripts_total=$((${scripts_sh:-0} + ${scripts_md:-0} + ${scripts_yml:-0} + ${scripts_yaml:-0}))
scripts_files=$((scripts_sh_files + scripts_md_files + scripts_yml_files + scripts_yaml_files))
echo ""

echo "Database & Data"
echo "----------------------------------------"
db_sql=$(count_lines "*.sql")
db_sql_files=$(count_files "*.sql")
echo "  SQL files:               $(printf "%'15d" ${db_sql:-0}) lines ($(printf "%'d" $db_sql_files) files)"
db_total=${db_sql:-0}
db_files=$db_sql_files
echo ""

# Calculate totals
total_lines=$((backend_total + frontend_total + scripts_total + db_total))
total_files=$((backend_files + frontend_files + scripts_files + db_files))

echo "=========================================="
echo "SUMMARY"
echo "=========================================="
printf "%-25s %'15d lines (%'d files)\n" "Backend:" "$backend_total" "$backend_files"
printf "%-25s %'15d lines (%'d files)\n" "Frontend:" "$frontend_total" "$frontend_files"
printf "%-25s %'15d lines (%'d files)\n" "Config & Scripts:" "$scripts_total" "$scripts_files"
printf "%-25s %'15d lines (%'d files)\n" "Database:" "$db_total" "$db_files"
echo "=========================================="
printf "%-25s %'15d lines (%'d files)\n" "TOTAL PROJECT:" "$total_lines" "$total_files"
echo "=========================================="
echo ""

# Breakdown by major directories
echo "Breakdown by Directory"
echo "----------------------------------------"

# Backend API
backend_lines=$(find ./apps/backend-api -type f \( -name "*.js" -o -name "*.json" \) -not -path "*/node_modules/*" -not -path "*/backup/*" -not -path "*/old/*" -exec wc -l {} + 2>/dev/null | tail -n 1 | awk '{print $1}')
backend_files_count=$(find ./apps/backend-api -type f \( -name "*.js" -o -name "*.json" \) -not -path "*/node_modules/*" -not -path "*/backup/*" -not -path "*/old/*" 2>/dev/null | wc -l)
printf "%-30s %'12d lines (%'d files)\n" "apps/backend-api" "${backend_lines:-0}" "$backend_files_count"

# Frontend Vite
frontend_lines=$(find ./apps/frontend-vite -type f \( -name "*.jsx" -o -name "*.js" -o -name "*.css" -o -name "*.html" \) -not -path "*/node_modules/*" -not -path "*/dist/*" -not -path "*/backup/*" -not -path "*/old/*" -exec wc -l {} + 2>/dev/null | tail -n 1 | awk '{print $1}')
frontend_files_count=$(find ./apps/frontend-vite -type f \( -name "*.jsx" -o -name "*.js" -o -name "*.css" -o -name "*.html" \) -not -path "*/node_modules/*" -not -path "*/dist/*" -not -path "*/backup/*" -not -path "*/old/*" 2>/dev/null | wc -l)
printf "%-30s %'12d lines (%'d files)\n" "apps/frontend-vite" "${frontend_lines:-0}" "$frontend_files_count"

# Scripts
if [ -d "./scripts" ]; then
  scripts_lines=$(find ./scripts -type f 2>/dev/null -exec wc -l {} + 2>/dev/null | tail -n 1 | awk '{print $1}')
  scripts_files_count=$(find ./scripts -type f 2>/dev/null | wc -l)
  printf "%-30s %'12d lines (%'d files)\n" "scripts/" "${scripts_lines:-0}" "$scripts_files_count"
fi

# Root config files
root_lines=$(find . -maxdepth 1 -type f \( -name "*.js" -o -name "*.json" -o -name "*.md" -o -name "*.sh" \) -exec wc -l {} + 2>/dev/null | tail -n 1 | awk '{print $1}')
root_files_count=$(find . -maxdepth 1 -type f \( -name "*.js" -o -name "*.json" -o -name "*.md" -o -name "*.sh" \) 2>/dev/null | wc -l)
printf "%-30s %'12d lines (%'d files)\n" "Root config files" "${root_lines:-0}" "$root_files_count"

echo ""
echo "✓ Analysis complete!"
echo ""
echo "Excluded: node_modules, dist, build, .git, coverage, backups, backup, old"
