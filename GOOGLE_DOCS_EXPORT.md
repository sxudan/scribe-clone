# Google Docs Export - Phase 1 Documentation Generation

## Overview

Instead of building a full React visualization app, Phase 1 can generate comprehensive documentation in Google Docs using the Google Docs API. This allows you to create shareable, editable documentation with all captured data including screenshots, click coordinates, element information, and step-by-step instructions.

## What Gets Exported

Each step will include:
- **Screenshot** (embedded image)
- **Step number and action type** (Click, Input, etc.)
- **Click coordinates** (x, y)
- **Element information** (tag, id, class, selector, text, etc.)
- **Bounding box** (position and size)
- **Page metadata** (URL, title, viewport dimensions)
- **Input values** (for input/change actions)
- **Timestamp** and duration

## Setup

### 1. Enable Google Docs API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Google Docs API**
4. Create credentials (OAuth 2.0 Client ID)
5. Download credentials JSON file

### 2. Install Dependencies

```bash
npm install googleapis google-auth-library
```

### 3. Environment Variables

Add to `.env.local`:

```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

## Implementation Options

### Option A: Next.js API Route (Recommended)

Create a Next.js API route that fetches data from Supabase and generates Google Docs.

### Option B: Standalone Node.js Script

Create a script that can be run to generate docs from Supabase data.

### Option C: Chrome Extension Integration

Add export functionality directly in the extension popup.

## Implementation: Next.js API Route

### 1. Create API Route

```typescript
// app/api/documents/[id]/export-google-docs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { graphqlClient } from '@/lib/graphql-client';
import { GET_DOCUMENT_WITH_STEPS } from '@/lib/graphql/queries';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get auth token from request
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch document and steps from Supabase
    const { documents } = await graphqlClient.request(GET_DOCUMENT_WITH_STEPS, {
      documentId: params.id,
    });

    const document = documents[0];
    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Initialize Google Docs API
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Set credentials (you'll need to handle OAuth flow separately)
    // For now, assume token is passed in request
    const token = request.headers.get('google-token');
    if (!token) {
      return NextResponse.json({ error: 'Google token required' }, { status: 401 });
    }
    oauth2Client.setCredentials({ access_token: token });

    const docs = google.docs({ version: 'v1', auth: oauth2Client });

    // Create new Google Doc
    const doc = await docs.documents.create({
      requestBody: {
        title: document.title || 'Documentation Guide',
      },
    });

    const documentId = doc.data.documentId!;

    // Generate document content
    await generateDocumentContent(docs, documentId, document, supabase);

    return NextResponse.json({
      success: true,
      documentId,
      documentUrl: `https://docs.google.com/document/d/${documentId}/edit`,
    });
  } catch (error) {
    console.error('Google Docs export error:', error);
    return NextResponse.json(
      { error: 'Failed to export to Google Docs' },
      { status: 500 }
    );
  }
}

async function generateDocumentContent(
  docs: any,
  documentId: string,
  document: any,
  supabase: any
) {
  const requests: any[] = [];

  // Add title
  requests.push({
    insertText: {
      location: { index: 1 },
      text: `${document.title}\n\n`,
    },
  });

  // Add document metadata
  requests.push({
    insertText: {
      location: { index: 1 },
      text: `Generated: ${new Date(document.created_at).toLocaleString()}\n`,
    },
  });
  requests.push({
    insertText: {
      location: { index: 1 },
      text: `Total Steps: ${document.steps.length}\n\n`,
    },
  });

  let currentIndex = 1;

  // Process each step
  for (let i = 0; i < document.steps.length; i++) {
    const step = document.steps[i];
    const stepData = step.data;

    // Add step header
    const stepTitle = `Step ${step.step_number}: ${formatActionTitle(step.action)}\n`;
    requests.push({
      insertText: {
        location: { index: currentIndex },
        text: stepTitle,
      },
    });
    currentIndex += stepTitle.length;

    // Add screenshot if available
    if (step.screenshot_url) {
      // Get screenshot as blob
      const screenshotBlob = await getScreenshotBlob(step.screenshot_url, supabase);
      
      if (screenshotBlob) {
        // Insert image (requires base64 encoding)
        const base64Image = await blobToBase64(screenshotBlob);
        
        requests.push({
          insertInlineImage: {
            location: { index: currentIndex },
            uri: base64Image,
            objectSize: {
              height: { magnitude: 400, unit: 'PT' }, // Adjust size as needed
              width: { magnitude: 600, unit: 'PT' },
            },
          },
        });
        currentIndex += 1; // Image takes 1 index
      }
    }

    // Add step details
    const details = formatStepDetails(step, stepData);
    requests.push({
      insertText: {
        location: { index: currentIndex },
        text: details + '\n\n',
      },
    });
    currentIndex += details.length + 2;
  }

  // Execute all requests
  await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests,
    },
  });
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

function formatStepDetails(step: any, stepData: any): string {
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
    if (el.selector) {
      details += `Selector: ${el.selector}\n`;
    }
  }

  // Click coordinates
  if (step.click_x !== null && step.click_y !== null) {
    details += `Click Position: (${step.click_x}, ${step.click_y})\n`;
  }

  // Bounding box
  if (stepData.element?.boundingBox) {
    const bb = stepData.element.boundingBox;
    details += `Element Position: x=${bb.x}, y=${bb.y}, width=${bb.width}, height=${bb.height}\n`;
  }

  // Input value
  if (stepData.value !== undefined) {
    details += `Value: ${stepData.value}\n`;
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
    details += `Scroll: (${pm.scrollX}, ${pm.scrollY})\n`;
  }

  // Timestamp
  if (step.timestamp) {
    details += `Time: ${new Date(step.timestamp).toLocaleString()}\n`;
  }

  return details;
}

async function getScreenshotBlob(
  screenshotUrl: string,
  supabase: any
): Promise<Blob | null> {
  try {
    // If it's a full URL, fetch it
    if (screenshotUrl.startsWith('http')) {
      const response = await fetch(screenshotUrl);
      return await response.blob();
    }

    // If it's a storage path, get signed URL
    const { data } = await supabase.storage
      .from('screenshots')
      .createSignedUrl(screenshotUrl, 3600);

    if (data?.signedUrl) {
      const response = await fetch(data.signedUrl);
      return await response.blob();
    }

    return null;
  } catch (error) {
    console.error('Error fetching screenshot:', error);
    return null;
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

### 2. OAuth Flow Setup

You'll need to implement Google OAuth flow to get access tokens:

```typescript
// app/api/auth/google/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  const scopes = [
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/drive.file',
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
  });

  return NextResponse.redirect(url);
}

// app/api/auth/google/callback/route.ts
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 });
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  const { tokens } = await oauth2Client.getToken(code);
  
  // Store tokens (in session, database, or return to client)
  // For security, store in httpOnly cookie or database
  
  return NextResponse.redirect('/documents?google_auth=success');
}
```

### 3. Client Component to Trigger Export

```typescript
// components/ExportToGoogleDocs.tsx
'use client';

import { useState } from 'react';

export function ExportToGoogleDocs({ documentId }: { documentId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setLoading(true);
    setError(null);

    try {
      // First, check if user is authenticated with Google
      // If not, redirect to OAuth
      const response = await fetch(`/api/documents/${documentId}/export-google-docs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        // Redirect to Google OAuth
        window.location.href = '/api/auth/google';
        return;
      }

      const data = await response.json();

      if (data.success) {
        // Open the Google Doc
        window.open(data.documentUrl, '_blank');
      } else {
        setError(data.error || 'Export failed');
      }
    } catch (err) {
      setError('Failed to export to Google Docs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
    >
      {loading ? 'Exporting...' : 'Export to Google Docs'}
    </button>
  );
}
```

## Alternative: Standalone Node.js Script

If you prefer a standalone script:

```typescript
// scripts/export-to-google-docs.ts
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { graphqlClient } from '../lib/graphql-client';
import { GET_DOCUMENT_WITH_STEPS } from '../lib/graphql/queries';

async function exportDocument(documentId: string) {
  // Initialize clients
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  // Fetch document
  const { documents } = await graphqlClient.request(GET_DOCUMENT_WITH_STEPS, {
    documentId,
  });

  const document = documents[0];

  // Initialize Google Docs API
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  );

  // Set credentials (use stored refresh token)
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
  });

  const docs = google.docs({ version: 'v1', auth: oauth2Client });

  // Create and populate document
  // ... (same logic as above)
}

// Run script
const documentId = process.argv[2];
if (!documentId) {
  console.error('Usage: ts-node scripts/export-to-google-docs.ts <document-id>');
  process.exit(1);
}

exportDocument(documentId);
```

## Document Structure

The generated Google Doc will have:

1. **Header Section**
   - Document title
   - Generation date
   - Total step count

2. **For Each Step:**
   - Step number and action type (bold heading)
   - Screenshot image (embedded)
   - Element details (tag, id, class, selector)
   - Click coordinates
   - Bounding box information
   - Input values (if applicable)
   - Page URL and title
   - Viewport and scroll information
   - Timestamp

3. **Formatting:**
   - Headings for step titles
   - Images for screenshots
   - Bullet points or structured text for details
   - Clear separation between steps

## Benefits of Google Docs Export

1. **Shareable**: Easy to share with team members
2. **Editable**: Can be edited and customized
3. **Collaborative**: Multiple people can comment/edit
4. **Accessible**: Works on any device with Google Docs
5. **Version History**: Google Docs tracks changes
6. **No Development Required**: Faster than building full React app
7. **Professional**: Looks polished and professional

## Limitations

1. **No Interactive Replay**: Can't replay steps interactively
2. **Static Images**: Screenshots are static (no animations)
3. **Manual Navigation**: Users navigate by scrolling, not step-by-step
4. **No Real-time Updates**: Document is generated once, not live

## Next Steps

After Phase 1 (Google Docs export), you can:
- Build Phase 2: Basic React viewer with step navigation
- Build Phase 3: Interactive replay with animations
- Build Phase 4: Full visualization with pointer dots and highlights

## Testing

1. Record some steps using the Chrome extension
2. Save to Supabase
3. Call the export API endpoint
4. Verify Google Doc is created with all data
5. Check that screenshots are embedded correctly
6. Verify all step details are present

## Troubleshooting

### Screenshots not showing
- Check Supabase Storage permissions
- Verify screenshot URLs are accessible
- Ensure images are properly converted to base64

### OAuth errors
- Verify client ID and secret
- Check redirect URI matches
- Ensure scopes include documents and drive.file

### API rate limits
- Google Docs API has rate limits
- Implement retry logic with exponential backoff
- Consider batching requests