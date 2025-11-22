Icons Directory

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
