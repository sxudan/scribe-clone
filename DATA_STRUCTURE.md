# Data Structure Documentation

This document describes the comprehensive data structure stored in Supabase for the Documentation Tool. This data is designed to support a React visualization/replay application.

## Database Schema

### Documents Table
```sql
- id: UUID (Primary Key)
- user_id: UUID (Foreign Key to auth.users)
- title: TEXT
- description: TEXT (nullable)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

### Steps Table
```sql
- id: UUID (Primary Key)
- document_id: UUID (Foreign Key to documents)
- step_number: INTEGER
- action: TEXT ('click' | 'input' | 'change' | 'submit' | 'navigation' | 'page_load')
- data: JSONB (Full step data - see below)
- timestamp: BIGINT (Unix timestamp in milliseconds)
- url: TEXT
- title: TEXT
- screenshot_url: TEXT (nullable)
- element_id: TEXT (nullable) - Quick access to element ID
- element_selector: TEXT (nullable) - Quick access to CSS selector
- click_x: INTEGER (nullable) - Click X coordinate
- click_y: INTEGER (nullable) - Click Y coordinate
- viewport_width: INTEGER (nullable) - Viewport width when captured
- viewport_height: INTEGER (nullable) - Viewport height when captured
- created_at: TIMESTAMPTZ
```

## Step Data Structure (JSONB)

The `data` field in the steps table contains a comprehensive JSON object:

```typescript
{
  // Element information (if action involves an element)
  element?: {
    // Basic identification
    tag: string;                    // HTML tag name (e.g., "button", "input")
    id: string | null;              // Element ID attribute
    className: string | null;       // Element class names
    name: string | null;            // Element name attribute
    type: string | null;            // Input type (e.g., "text", "checkbox")
    text: string | null;            // Element text content (first 50 chars)
    placeholder: string | null;     // Placeholder text
    label: string | null;           // Associated label text
    selector: string;               // CSS selector for the element
    
    // Position and dimensions for visualization
    boundingBox: {
      x: number;                    // Element X position
      y: number;                    // Element Y position
      width: number;                // Element width
      height: number;               // Element height
      top: number;                  // Top edge
      left: number;                 // Left edge
      right: number;                // Right edge
      bottom: number;               // Bottom edge
    } | null;
    
    // Scroll position when element was interacted with
    scrollPosition: {
      x: number;                    // Horizontal scroll
      y: number;                    // Vertical scroll
    };
    
    // Viewport dimensions
    viewport: {
      width: number;                // Viewport width
      height: number;                // Viewport height
    };
    
    // All element attributes
    attributes: Record<string, string>;  // All HTML attributes
    
    // Parent element info
    parentSelector: string | null;  // CSS selector of parent element
    
    // XPath for element location
    xpath: string | null;           // XPath expression
  };
  
  // Click/interaction coordinates
  coordinates: {
    x: number;                      // Absolute X coordinate
    y: number;                      // Absolute Y coordinate
    relativeX?: number;            // X relative to element
    relativeY?: number;            // Y relative to element
    viewportX: number;             // X relative to viewport
    viewportY: number;              // Y relative to viewport
  } | null;
  
  // Input/change value
  value?: string | boolean;        // Value entered or selected
  
  // Page information
  url: string;                     // Page URL
  title: string;                   // Page title
  
  // Page metadata
  pageMetadata?: {
    viewportWidth: number;          // Viewport width
    viewportHeight: number;         // Viewport height
    scrollX: number;                // Horizontal scroll position
    scrollY: number;                // Vertical scroll position
    userAgent: string;              // Browser user agent
  };
}
```

## Example Step Data

### Click Action
```json
{
  "element": {
    "tag": "button",
    "id": "submit-btn",
    "className": "btn btn-primary",
    "selector": "#submit-btn",
    "boundingBox": {
      "x": 450,
      "y": 300,
      "width": 120,
      "height": 40,
      "top": 300,
      "left": 450,
      "right": 570,
      "bottom": 340
    },
    "scrollPosition": { "x": 0, "y": 0 },
    "viewport": { "width": 1920, "height": 1080 },
    "attributes": {
      "id": "submit-btn",
      "class": "btn btn-primary",
      "type": "button"
    },
    "parentSelector": "form#login-form",
    "xpath": "/html/body/form[1]/button[1]"
  },
  "coordinates": {
    "x": 510,
    "y": 320,
    "relativeX": 60,
    "relativeY": 20,
    "viewportX": 510,
    "viewportY": 320
  },
  "url": "https://example.com/login",
  "title": "Login Page",
  "pageMetadata": {
    "viewportWidth": 1920,
    "viewportHeight": 1080,
    "scrollX": 0,
    "scrollY": 0,
    "userAgent": "Mozilla/5.0..."
  }
}
```

### Input Action
```json
{
  "element": {
    "tag": "input",
    "id": "email",
    "type": "email",
    "name": "email",
    "placeholder": "Enter your email",
    "selector": "#email",
    "boundingBox": { ... },
    ...
  },
  "coordinates": { ... },
  "value": "user@example.com",
  "url": "https://example.com/login",
  "title": "Login Page",
  "pageMetadata": { ... }
}
```

## Usage in React Visualization App

When building your React visualization app, you can:

1. **Query Steps by Document**: Get all steps for a document
2. **Access Quick Fields**: Use `click_x`, `click_y`, `element_id` for fast queries
3. **Full Data**: Access complete `data` JSONB for all details
4. **Screenshots**: Use `screenshot_url` to display step screenshots
5. **Replay**: Use coordinates, bounding boxes, and selectors to recreate interactions

### Example GraphQL Query (using PostgREST)

```graphql
query GetDocumentSteps($documentId: UUID!) {
  steps(
    where: { document_id: { _eq: $documentId } }
    order_by: { step_number: asc }
  ) {
    id
    step_number
    action
    data
    click_x
    click_y
    element_id
    element_selector
    screenshot_url
    timestamp
    url
    title
  }
}
```

### Example REST API Query

```javascript
const { data } = await supabase
  .from('steps')
  .select('*')
  .eq('document_id', documentId)
  .order('step_number', { ascending: true });
```

## Visualization Features Supported

With this data structure, you can build:

1. **Click Animation**: Use `click_x`, `click_y` to show pointer dots
2. **Element Highlighting**: Use `boundingBox` to highlight elements
3. **Scroll Simulation**: Use `scrollPosition` to restore scroll state
4. **Viewport Matching**: Use `viewport` dimensions to match original viewport
5. **Element Selection**: Use `selector`, `xpath`, or `id` to find elements
6. **Screenshot Overlay**: Display screenshots with click indicators
7. **Step-by-step Replay**: Recreate the entire user journey

