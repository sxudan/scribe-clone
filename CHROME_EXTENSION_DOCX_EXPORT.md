# Chrome Extension Local .docx Export

## Overview

Generate Word documents (.docx) directly in the Chrome extension using only local data from `chrome.storage.local`. No backend, no Supabase, no API calls needed!

## Setup

### 1. Install Dependencies

```bash
npm install docx file-saver
npm install --save-dev @types/file-saver
```

### 2. Update webpack.config.js

Make sure webpack can handle the `docx` library:

```javascript
// webpack.config.js
module.exports = {
  // ... existing config
  resolve: {
    fallback: {
      "buffer": require.resolve("buffer/"),
      "stream": require.resolve("stream-browserify"),
      "util": require.resolve("util/"),
    }
  },
  plugins: [
    // ... existing plugins
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
  ],
};
```

## Implementation

### 1. Create Document Generator Utility

```typescript
// src/utils/generate-docx.ts
import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, AlignmentType } from 'docx';
import { Step } from '../types';
import { saveAs } from 'file-saver';

export async function generateAndDownloadDocx(steps: Step[], title: string = 'Documentation Guide'): Promise<void> {
  const children: (Paragraph | ImageRun)[] = [];

  // Title
  children.push(
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    })
  );

  // Metadata
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated: ${new Date().toLocaleString()}`,
          bold: true,
        }),
      ],
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Total Steps: ${steps.length}`,
          bold: true,
        }),
      ],
    })
  );

  // Add spacing
  children.push(new Paragraph({ text: '' }));

  // Process each step
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepData = step.data;

    // Step header
    const stepTitle = `Step ${step.id}: ${formatActionTitle(step.action)}`;
    children.push(
      new Paragraph({
        text: stepTitle,
        heading: HeadingLevel.HEADING_2,
      })
    );

    // Screenshot (if available)
    if (step.screenshot) {
      try {
        const imageBuffer = await dataUrlToBuffer(step.screenshot);
        if (imageBuffer) {
          children.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: imageBuffer,
                  transformation: {
                    width: 600,
                    height: 400,
                  },
                }),
              ],
            })
          );
        }
      } catch (error) {
        console.error(`Error processing screenshot for step ${step.id}:`, error);
      }
    }

    // Step details
    const details = formatStepDetails(step, stepData);
    const detailLines = details.split('\n').filter(line => line.trim());

    for (const line of detailLines) {
      if (line.includes(':')) {
        const colonIndex = line.indexOf(':');
        const label = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${label}: `,
                bold: true,
              }),
              new TextRun({
                text: value,
              }),
            ],
          })
        );
      } else {
        children.push(
          new Paragraph({
            text: line,
          })
        );
      }
    }

    // Add spacing between steps
    children.push(new Paragraph({ text: '' }));
  }

  // Create document
  const doc = new Document({
    sections: [
      {
        children,
      },
    ],
  });

  // Generate blob and download
  const blob = await Packer.toBlob(doc);
  const fileName = `${title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.docx`;
  saveAs(blob, fileName);
}

function formatActionTitle(action: string): string {
  const actionMap: Record<string, string> = {
    click: 'Click',
    input: 'Enter Text',
    change: 'Change Selection',
    submit: 'Submit Form',
    navigation: 'Navigate',
    page_load: 'Page Load',
  };
  return actionMap[action] || action;
}

function formatStepDetails(step: Step, stepData: any): string {
  let details = '';

  // Element information
  if (stepData.element) {
    const el = stepData.element;
    details += `Element: ${el.tag}`;
    if (el.id) details += ` (ID: ${el.id})`;
    if (el.className) details += ` (Class: ${el.className})`;
    details += '\n';

    if (el.text) {
      details += `Text: ${el.text.substring(0, 100)}\n`;
    }
    if (el.label) {
      details += `Label: ${el.label}\n`;
    }
    if (el.placeholder) {
      details += `Placeholder: ${el.placeholder}\n`;
    }
    if (el.selector) {
      details += `Selector: ${el.selector}\n`;
    }
  }

  // Click coordinates
  if (stepData.coordinates) {
    const coords = stepData.coordinates;
    details += `Click Position: (${Math.round(coords.x)}, ${Math.round(coords.y)})\n`;
    if (coords.relativeX !== undefined && coords.relativeY !== undefined) {
      details += `Relative Position: (${Math.round(coords.relativeX)}, ${Math.round(coords.relativeY)})\n`;
    }
  }

  // Bounding box
  if (stepData.element?.boundingBox) {
    const bb = stepData.element.boundingBox;
    details += `Element Position: x=${Math.round(bb.x)}, y=${Math.round(bb.y)}, width=${Math.round(bb.width)}, height=${Math.round(bb.height)}\n`;
  }

  // Input value
  if (stepData.value !== undefined) {
    const valueStr = typeof stepData.value === 'boolean' 
      ? String(stepData.value) 
      : String(stepData.value).substring(0, 200);
    details += `Value: ${valueStr}\n`;
  }

  // Page metadata
  if (step.url) {
    details += `URL: ${step.url}\n`;
  }
  if (step.title) {
    details += `Page Title: ${step.title}\n`;
  }
  if (stepData.pageMetadata) {
    const pm = stepData.pageMetadata;
    details += `Viewport: ${pm.viewportWidth}x${pm.viewportHeight}\n`;
    details += `Scroll Position: (${pm.scrollX}, ${pm.scrollY})\n`;
  }

  // Timestamp
  if (step.timestamp) {
    details += `Timestamp: ${new Date(step.timestamp).toLocaleString()}\n`;
  }

  return details;
}

// Convert data URL to buffer for docx library
async function dataUrlToBuffer(dataUrl: string): Promise<Buffer | null> {
  try {
    // Remove data URL prefix (e.g., "data:image/png;base64,")
    const base64Data = dataUrl.includes(',') 
      ? dataUrl.split(',')[1] 
      : dataUrl;
    
    // Convert base64 to buffer
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return Buffer.from(bytes);
  } catch (error) {
    console.error('Error converting data URL to buffer:', error);
    return null;
  }
}
```

### 2. Add Export Button to Popup

Update `src/popup.tsx`:

```typescript
// Add import at top
import { generateAndDownloadDocx } from './utils/generate-docx';

// Add state for export loading
const [isExporting, setIsExporting] = useState(false);

// Add export handler
const handleExportDocx = async () => {
  if (steps.length === 0) {
    alert('No steps to export');
    return;
  }

  setIsExporting(true);
  try {
    const title = currentDocument?.title || 'Documentation Guide';
    await generateAndDownloadDocx(steps, title);
  } catch (error) {
    console.error('Export error:', error);
    alert('Failed to export document: ' + (error as Error).message);
  } finally {
    setIsExporting(false);
  }
};

// Add button in the UI (in the recording view)
{steps.length > 0 && (
  <button
    onClick={handleExportDocx}
    disabled={isExporting}
    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {isExporting ? 'Generating...' : 'Export as .docx'}
  </button>
)}
```

### 3. Alternative: Export Without Document Title

If you want to export even when not logged in or no document saved:

```typescript
// In popup.tsx, add export button that works with local steps only
const handleExportLocalDocx = async () => {
  const result = await chrome.storage.local.get(['steps']) as { steps?: Step[] };
  const localSteps = result.steps || [];
  
  if (localSteps.length === 0) {
    alert('No steps to export');
    return;
  }

  setIsExporting(true);
  try {
    // Generate title from first step URL or use default
    const title = localSteps[0]?.title || 'Documentation Guide';
    await generateAndDownloadDocx(localSteps, title);
  } catch (error) {
    console.error('Export error:', error);
    alert('Failed to export document');
  } finally {
    setIsExporting(false);
  }
};
```

## Complete Example: Updated Popup Component

Here's how to integrate it into your existing popup:

```typescript
// src/popup.tsx (additions)

import { generateAndDownloadDocx } from './utils/generate-docx';

// In the component, add state:
const [isExporting, setIsExporting] = useState(false);

// Add export function:
const handleExportDocx = async () => {
  if (steps.length === 0) {
    alert('No steps to export');
    return;
  }

  setIsExporting(true);
  try {
    const title = currentDocument?.title || `Documentation_${new Date().toISOString().split('T')[0]}`;
    await generateAndDownloadDocx(steps, title);
  } catch (error) {
    console.error('Export error:', error);
    alert('Failed to export document');
  } finally {
    setIsExporting(false);
  }
};

// In the JSX, add button near other export options:
{steps.length > 0 && (
  <div className="mt-4 space-x-2">
    <button
      onClick={handleExportDocx}
      disabled={isExporting}
      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
    >
      {isExporting ? 'Generating .docx...' : '📄 Export as Word (.docx)'}
    </button>
  </div>
)}
```

## Package.json Updates

Make sure your `package.json` includes:

```json
{
  "dependencies": {
    "docx": "^8.5.0",
    "file-saver": "^2.0.5"
  },
  "devDependencies": {
    "@types/file-saver": "^2.0.7",
    "buffer": "^6.0.3",
    "stream-browserify": "^3.0.0",
    "util": "^0.12.5"
  }
}
```

## Webpack Configuration (Full Example)

```javascript
// webpack.config.js
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  entry: {
    popup: './src/popup.tsx',
    content: './src/content.ts',
    background: './src/background.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    fallback: {
      "buffer": require.resolve("buffer/"),
      "stream": require.resolve("stream-browserify"),
      "util": require.resolve("util/"),
      "path": require.resolve("path-browserify"),
    }
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'manifest.json' },
        { from: 'popup.html' },
        { from: 'src/popup.css', to: 'popup.css' },
      ],
    }),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
    }),
  ],
};
```

## How It Works

1. **User clicks "Export as .docx"** in the extension popup
2. **Extension reads steps** from `chrome.storage.local`
3. **Generates .docx document** with:
   - Title and metadata
   - Each step with screenshot (converted from data URL)
   - All element information
   - Click coordinates
   - Bounding boxes
   - Input values
   - Page metadata
4. **Downloads file** directly to user's computer
5. **User can open** in Word, Google Docs, or any office suite

## Benefits

✅ **No backend required** - Everything happens in the browser  
✅ **No Supabase needed** - Uses local storage only  
✅ **Works offline** - No internet connection required  
✅ **Privacy** - Data never leaves the user's computer  
✅ **Fast** - No API calls, instant generation  
✅ **Universal format** - .docx works everywhere  

## File Size Considerations

- Screenshots embedded as base64 will increase file size
- Consider compressing images or limiting screenshot resolution
- Typical file: 100-500KB per step (depending on screenshot size)

## Troubleshooting

### "Buffer is not defined"
- Make sure webpack is configured with Buffer polyfill
- Check that `webpack.ProvidePlugin` includes Buffer

### "Cannot find module 'docx'"
- Run `npm install docx`
- Check webpack can resolve the module

### Screenshots not showing
- Verify data URL format is correct
- Check base64 conversion is working
- Ensure image buffer is valid

### File download not working
- Check browser download permissions
- Verify `file-saver` is properly imported
- Check browser console for errors

## Testing

1. Record some steps in the extension
2. Click "Export as .docx"
3. Check downloaded file opens in Word/Google Docs
4. Verify all screenshots are present
5. Check all step details are included

