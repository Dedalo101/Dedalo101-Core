#!/bin/bash
# Dedalo101 - New Artist Site Bootstrap Script

set -e

echo "=== Dedalo101 New Artist Site Creator ==="

if [ -z "$1" ]; then
  echo "Usage: ./new-artist-site.sh domain.com \"Artist Name\""
  echo "Example: ./new-artist-site.sh amoro.club \"Amoro\""
  exit 1
fi

DOMAIN=$1
ARTIST_NAME=${2:-"Artist Name"}
SLUG=$(echo "$DOMAIN" | sed 's/\.com$//; s/\.club$//; s/\.net$//')

echo "Creating new site for: $ARTIST_NAME ($DOMAIN)"

# Create folder
mkdir -p "../$SLUG"
cd "../$SLUG"

# Clone template (you can change this to your preferred base)
echo "Cloning template structure..."
git init
git submodule add https://github.com/Dedalo101/dedalo-core.git _core

# Create basic folders
mkdir -p assets/css assets/images assets/js data releases mixes events

# Create basic files
cat > index.html << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>$ARTIST_NAME | Official Website</title>
    <link rel="stylesheet" href="assets/css/theme.css">
</head>
<body>
    <h1>Welcome to $ARTIST_NAME</h1>
    <!-- Core components will be included here -->
</body>
</html>
EOF

cat > AGENTS.md << EOF
# AGENTS.md - $ARTIST_NAME Site
This site uses Dedalo101 core architecture.
See _core/AGENTS.md for main guidelines.
Artist has full freedom on visual style.
EOF

# Create email setup guide
cat > PORKBUN-EMAIL-SETUP.md << EOF
# Porkbun Email Setup for $DOMAIN

Go to: https://porkbun.com/account/domains
Click the envelope icon next to $DOMAIN and create these forwards:

1. info@$DOMAIN → [your-email]
2. bookings@$DOMAIN → [your-email]
3. contact@$DOMAIN → [your-email]
4. press@$DOMAIN → [your-email] (optional)

After creating them, update the contact form.
EOF

echo ""
echo "✅ Site structure created successfully at: ../$SLUG"
echo ""
echo "Next steps:"
echo "1. cd ../$SLUG"
echo "2. Open PORKBUN-EMAIL-SETUP.md and configure emails"
echo "3. Customize assets/css/theme.css for artistic look"
echo "4. Run: grok \"Initialize this new artist site with core components\""
echo ""
echo "Done!"
