// Simple script to create placeholder icons
// Run with: node scripts/create-icons.js

const fs = require('fs');
const path = require('path');

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, '..', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// For now, create a simple note file explaining how to add icons
const readmePath = path.join(iconsDir, 'README.txt');
const readmeContent = `Icons Directory

Place your extension icons here:
- icon16.png (16x16 pixels)
- icon48.png (48x48 pixels)  
- icon128.png (128x128 pixels)

You can:
1. Create icons using an image editor
2. Use an online icon generator
3. Use the create-icons.html file in the project root to generate simple placeholder icons

After adding icons, update manifest.json to include:
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
`;

fs.writeFileSync(readmePath, readmeContent);
console.log('Icons directory created. See icons/README.txt for instructions.');

