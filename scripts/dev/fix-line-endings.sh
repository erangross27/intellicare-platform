#!/bin/bash

echo "🔧 Converting all project files to Unix line endings (LF)..."
echo "=================================================="

# Check if dos2unix is installed
if ! command -v dos2unix &> /dev/null; then
    echo "📦 Installing dos2unix..."
    sudo apt-get update
    sudo apt-get install -y dos2unix
fi

echo "🔄 Converting all text files in the project..."

# Find all text files and convert them
find /home/erangross/Development/IntelliCare -type f \( \
    -name "*.js" -o \
    -name "*.jsx" -o \
    -name "*.ts" -o \
    -name "*.tsx" -o \
    -name "*.json" -o \
    -name "*.md" -o \
    -name "*.yml" -o \
    -name "*.yaml" -o \
    -name "*.sh" -o \
    -name "*.bash" -o \
    -name "*.ps1" -o \
    -name "*.bat" -o \
    -name "*.cmd" -o \
    -name "*.txt" -o \
    -name "*.css" -o \
    -name "*.scss" -o \
    -name "*.html" -o \
    -name "*.xml" -o \
    -name "*.env" -o \
    -name "*.env.*" -o \
    -name ".gitignore" -o \
    -name ".npmignore" -o \
    -name ".eslintrc*" -o \
    -name ".prettierrc*" -o \
    -name "Dockerfile" -o \
    -name "docker-compose.yml" -o \
    -name "package.json" -o \
    -name "package-lock.json" \
\) -exec dos2unix {} \; 2>/dev/null

echo "✅ Line endings converted successfully!"

# Configure git to always use LF
echo ""
echo "🔧 Configuring Git to use Unix line endings..."
cd /home/erangross/Development/IntelliCare

# Set core.autocrlf to input (converts CRLF to LF on commit)
git config core.autocrlf input

# Create .gitattributes file to enforce LF
cat > .gitattributes << 'EOF'
# Set default behavior to automatically normalize line endings
* text=auto eol=lf

# Explicitly declare text files you want to always be normalized
*.js text eol=lf
*.jsx text eol=lf
*.ts text eol=lf
*.tsx text eol=lf
*.json text eol=lf
*.md text eol=lf
*.yml text eol=lf
*.yaml text eol=lf
*.sh text eol=lf
*.bash text eol=lf
*.css text eol=lf
*.scss text eol=lf
*.html text eol=lf
*.xml text eol=lf
*.txt text eol=lf
*.env text eol=lf
.gitignore text eol=lf
.eslintrc* text eol=lf
.prettierrc* text eol=lf
Dockerfile text eol=lf

# Windows-specific files should keep CRLF
*.bat text eol=crlf
*.cmd text eol=crlf
*.ps1 text eol=crlf

# Binary files
*.png binary
*.jpg binary
*.jpeg binary
*.gif binary
*.ico binary
*.pdf binary
*.zip binary
*.tar binary
*.gz binary
EOF

echo "✅ Git configured to use Unix line endings"

# Create .editorconfig for consistent formatting
cat > .editorconfig << 'EOF'
# EditorConfig is awesome: https://EditorConfig.org

# top-most EditorConfig file
root = true

# Unix-style newlines with a newline ending every file
[*]
end_of_line = lf
insert_final_newline = true
charset = utf-8
indent_style = space
indent_size = 2

# JavaScript/TypeScript files
[*.{js,jsx,ts,tsx}]
indent_size = 2

# JSON files
[*.json]
indent_size = 2

# YAML files
[*.{yml,yaml}]
indent_size = 2

# Markdown files
[*.md]
trim_trailing_whitespace = false

# Shell scripts
[*.sh]
end_of_line = lf

# Windows batch files
[*.{bat,cmd}]
end_of_line = crlf

# PowerShell scripts
[*.ps1]
end_of_line = crlf
EOF

echo "✅ Created .editorconfig for consistent formatting"

echo ""
echo "🎉 All done! Your project now uses Unix line endings (LF)"
echo ""
echo "Changes made:"
echo "  ✅ Converted all text files to LF endings"
echo "  ✅ Configured Git to handle line endings properly"
echo "  ✅ Created .gitattributes to enforce LF in repository"
echo "  ✅ Created .editorconfig for IDE consistency"
echo ""
echo "Now all scripts should work without line ending issues!"