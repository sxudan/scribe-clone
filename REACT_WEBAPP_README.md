# Documentation Visualization Web App - Next.js with Supabase GraphQL

## Project Setup

This web application uses Next.js 14+ with App Router and Supabase Postgres GraphQL for data fetching.

## Overview

This is a Next.js web application that visualizes and replays user documentation steps recorded by the Chrome extension. The app fetches data from Supabase using Postgres GraphQL and provides an interactive, step-by-step visualization of user actions with screenshots, click animations, and element highlighting.

## Purpose

Create a web-based viewer that allows users to:
- View their saved documentation guides
- See step-by-step replays of recorded actions
- Visualize clicks with pointer dot animations
- Highlight elements that were interacted with
- Display screenshots for each step
- Navigate through steps with a timeline/stepper UI

## Tech Stack

- **Next.js 14+** (App Router with TypeScript)
- **Supabase Postgres GraphQL** (via PostgREST GraphQL endpoint)
- **GraphQL Client** (`@apollo/client` or `graphql-request`)
- **Tailwind CSS** (for styling)
- **Next.js Server Components** (for data fetching)
- **React Server Actions** (for mutations)
- **Zustand** or **Context API** (for client-side state)

## Supabase Integration

### Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SUPABASE_GRAPHQL_URL=https://your-project.supabase.co/graphql/v1
```

### Supabase GraphQL Setup

Supabase provides a Postgres GraphQL endpoint at: `https://your-project.supabase.co/graphql/v1`

#### Option 1: Using Apollo Client

```typescript
// lib/apollo-client.ts
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_SUPABASE_GRAPHQL_URL,
});

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('supabase.auth.token');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    },
  };
});

export const apolloClient = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});
```

#### Option 2: Using graphql-request

```typescript
// lib/graphql-client.ts
import { GraphQLClient } from 'graphql-request';

const getAuthToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('supabase.auth.token');
  }
  return null;
};

export const graphqlClient = new GraphQLClient(
  process.env.NEXT_PUBLIC_SUPABASE_GRAPHQL_URL!,
  {
    headers: {
      'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      'Authorization': `Bearer ${getAuthToken() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
    },
  }
);
```

### Authentication

Use Supabase Auth for authentication. The GraphQL endpoint requires authentication headers.

```typescript
// lib/supabase-auth.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Store auth token for GraphQL requests
supabase.auth.onAuthStateChange((event, session) => {
  if (session?.access_token) {
    localStorage.setItem('supabase.auth.token', session.access_token);
  } else {
    localStorage.removeItem('supabase.auth.token');
  }
});
```

## Data Structure

### Database Schema

#### Documents Table
```typescript
interface Document {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}
```

#### Steps Table
```typescript
interface Step {
  id: string;                    // UUID
  document_id: string;
  step_number: number;
  action: 'click' | 'input' | 'change' | 'submit' | 'navigation' | 'page_load';
  data: StepData;                // JSONB - full step data
  timestamp: number;              // Unix timestamp in milliseconds
  url: string;
  title: string;
  screenshot_url: string | null;
  element_id: string | null;
  element_selector: string | null;
  click_x: number | null;
  click_y: number | null;
  viewport_width: number | null;
  viewport_height: number | null;
  created_at: string;
}
```

#### StepData Structure (from `data` JSONB field)
```typescript
interface StepData {
  element?: {
    tag: string;
    id: string | null;
    className: string | null;
    name: string | null;
    type: string | null;
    text: string | null;
    placeholder: string | null;
    label: string | null;
    selector: string;
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
      top: number;
      left: number;
      right: number;
      bottom: number;
    } | null;
    scrollPosition: { x: number; y: number };
    viewport: { width: number; height: number };
    attributes: Record<string, string>;
    parentSelector: string | null;
    xpath: string | null;
  };
  coordinates: {
    x: number;                   // Absolute X coordinate
    y: number;                   // Absolute Y coordinate
    relativeX?: number;           // X relative to element
    relativeY?: number;          // Y relative to element
    viewportX: number;           // X relative to viewport
    viewportY: number;           // Y relative to viewport
  } | null;
  value?: string | boolean;
  url: string;
  title: string;
  pageMetadata?: {
    viewportWidth: number;
    viewportHeight: number;
    scrollX: number;
    scrollY: number;
    userAgent: string;
  };
}
```

## TODO: Features to Build

### 1. Authentication & User Management
- [ ] Set up Supabase authentication
- [ ] Create login/signup pages
- [ ] Implement session management
- [ ] Add protected routes
- [ ] Display user profile/logout

### 2. Document List View
- [ ] Fetch user's documents from Supabase
- [ ] Display documents in a grid/list
- [ ] Show document metadata (title, date, step count)
- [ ] Add search/filter functionality
- [ ] Implement document deletion
- [ ] Add document creation date sorting

### 3. Document Detail/Viewer Page
- [ ] Fetch document with all steps
- [ ] Display document title and metadata
- [ ] Show step count and duration
- [ ] Create step navigation (previous/next buttons)
- [ ] Add step timeline/progress indicator
- [ ] Implement step auto-play functionality

### 4. Step Visualization
- [ ] Display screenshot for each step
- [ ] Show click coordinates with animated pointer dot
- [ ] Highlight element bounding box
- [ ] Display element information (tag, id, text, etc.)
- [ ] Show action type badge (Click, Input, etc.)
- [ ] Display step timestamp
- [ ] Show page URL and title

### 5. Interactive Replay
- [ ] Implement step-by-step navigation
- [ ] Add play/pause/next/previous controls
- [ ] Auto-scroll to highlighted elements
- [ ] Match viewport dimensions from original recording
- [ ] Restore scroll position for each step
- [ ] Animate transitions between steps
- [ ] Show loading state while fetching screenshots

### 6. Pointer Dot Animation
- [ ] Create animated pointer/cursor component
- [ ] Position pointer at click coordinates (click_x, click_y)
- [ ] Animate pointer appearance (fade in, scale, pulse)
- [ ] Show click ripple effect
- [ ] Handle different viewport sizes (responsive positioning)
- [ ] Use relative coordinates for accurate positioning

### 7. Element Highlighting
- [ ] Highlight element using boundingBox data
- [ ] Draw overlay box around element
- [ ] Add glow/pulse animation
- [ ] Show element selector in tooltip
- [ ] Display element attributes on hover
- [ ] Handle elements that might not exist in current DOM

### 8. Screenshot Display
- [ ] Load screenshots from Supabase Storage URLs
- [ ] Handle private bucket (generate signed URLs if needed)
- [ ] Add image loading states
- [ ] Implement image zoom/lightbox
- [ ] Show screenshot overlay with click indicators
- [ ] Handle missing screenshots gracefully

### 9. Step Information Panel
- [ ] Display step details sidebar/panel
- [ ] Show action type and description
- [ ] Display element information
- [ ] Show coordinates
- [ ] Display page metadata (URL, title, viewport)
- [ ] Show timestamp and duration
- [ ] Display input values (for input/change actions)

### 10. Export Functionality
- [ ] Export documentation as PDF
- [ ] Export as Markdown
- [ ] Export as HTML
- [ ] Generate shareable links
- [ ] Print-friendly view

### 11. UI/UX Enhancements
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Dark mode support
- [ ] Smooth animations and transitions
- [ ] Loading skeletons
- [ ] Error boundaries
- [ ] Toast notifications
- [ ] Keyboard shortcuts (arrow keys for navigation)

## GraphQL Queries

### GraphQL Query Definitions

Create a `lib/graphql/queries.ts` file:

```typescript
import { gql } from '@apollo/client';
// or: import { gql } from 'graphql-request';

export const GET_USER_DOCUMENTS = gql`
  query GetUserDocuments($userId: UUID!) {
    documents(
      where: { user_id: { _eq: $userId } }
      order_by: { created_at: desc }
    ) {
      id
      user_id
      title
      description
      created_at
      updated_at
    }
  }
`;

export const GET_DOCUMENT_WITH_STEPS = gql`
  query GetDocumentWithSteps($documentId: UUID!) {
    documents(where: { id: { _eq: $documentId } }) {
      id
      user_id
      title
      description
      created_at
      updated_at
      steps(
        where: { document_id: { _eq: $documentId } }
        order_by: { step_number: asc }
      ) {
        id
        document_id
        step_number
        action
        data
        timestamp
        url
        title
        screenshot_url
        element_id
        element_selector
        click_x
        click_y
        viewport_width
        viewport_height
        created_at
      }
    }
  }
`;

export const GET_STEPS_BY_ACTION = gql`
  query GetStepsByAction($documentId: UUID!, $action: String!) {
    steps(
      where: { 
        document_id: { _eq: $documentId }
        action: { _eq: $action }
      }
      order_by: { step_number: asc }
    ) {
      id
      step_number
      action
      data
      click_x
      click_y
      screenshot_url
    }
  }
`;

export const DELETE_DOCUMENT = gql`
  mutation DeleteDocument($documentId: UUID!) {
    delete_documents(where: { id: { _eq: $documentId } }) {
      affected_rows
    }
  }
`;
```

### Using Queries in Next.js

#### Server Component Example

```typescript
// app/documents/[id]/page.tsx
import { graphqlClient } from '@/lib/graphql-client';
import { GET_DOCUMENT_WITH_STEPS } from '@/lib/graphql/queries';

export default async function DocumentPage({ params }: { params: { id: string } }) {
  const { documents } = await graphqlClient.request(GET_DOCUMENT_WITH_STEPS, {
    documentId: params.id,
  });

  const document = documents[0];
  
  return (
    <div>
      <h1>{document.title}</h1>
      <StepViewer steps={document.steps} />
    </div>
  );
}
```

#### Client Component Example

```typescript
// components/DocumentList.tsx
'use client';

import { useQuery } from '@apollo/client';
import { GET_USER_DOCUMENTS } from '@/lib/graphql/queries';

export function DocumentList({ userId }: { userId: string }) {
  const { data, loading, error } = useQuery(GET_USER_DOCUMENTS, {
    variables: { userId },
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data.documents.map((doc) => (
        <DocumentCard key={doc.id} document={doc} />
      ))}
    </div>
  );
}
```

### Get Screenshot (if bucket is private, use signed URL)

For screenshots, you'll still need to use Supabase Storage API (not GraphQL):

```typescript
// lib/storage.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function getScreenshotUrl(screenshotUrl: string | null) {
  if (!screenshotUrl) return null;
  
  // For public bucket
  if (screenshotUrl.startsWith('http')) {
    return screenshotUrl;
  }
  
  // For private bucket - generate signed URL
  const { data } = await supabase.storage
    .from('screenshots')
    .createSignedUrl(screenshotUrl, 3600);
    
  return data?.signedUrl || null;
}
```

## Next.js App Structure

```
app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx
│   └── signup/
│       └── page.tsx
├── (dashboard)/
│   ├── documents/
│   │   ├── page.tsx              # Document list (Server Component)
│   │   └── [id]/
│   │       └── page.tsx          # Document viewer (Server Component)
│   └── layout.tsx
├── api/
│   └── auth/
│       └── callback/
│           └── route.ts          # Supabase auth callback
├── layout.tsx
└── page.tsx

components/
├── auth/
│   ├── LoginForm.tsx             # Client Component
│   └── SignUpForm.tsx            # Client Component
├── documents/
│   ├── DocumentList.tsx          # Client Component
│   ├── DocumentCard.tsx          # Client Component
│   └── DocumentViewer.tsx       # Client Component
├── steps/
│   ├── StepViewer.tsx            # Client Component
│   ├── StepNavigation.tsx        # Client Component
│   ├── StepInfo.tsx              # Client Component
│   ├── PointerDot.tsx            # Client Component
│   ├── ElementHighlight.tsx      # Client Component
│   └── ScreenshotViewer.tsx      # Client Component
└── common/
    ├── Loading.tsx
    └── ErrorBoundary.tsx

lib/
├── graphql/
│   ├── client.ts                 # GraphQL client setup
│   └── queries.ts                # GraphQL queries
├── supabase/
│   ├── client.ts                 # Supabase client (for auth/storage)
│   └── auth.ts                   # Auth helpers
├── storage.ts                    # Storage utilities
└── types.ts                      # TypeScript types

hooks/
├── useDocument.ts                # Client hook for document data
├── useSteps.ts                   # Client hook for steps
└── useAuth.ts                    # Auth hook
```

## Key Implementation Details

### Pointer Dot Animation

```typescript
// Position pointer at click coordinates
// Use viewportX/viewportY for accurate positioning
// Animate: fade in → scale up → pulse → fade out
// Duration: ~1-2 seconds per step
```

### Element Highlighting

```typescript
// Use boundingBox data to draw overlay
// Calculate position relative to screenshot
// Add border/glow effect
// Show tooltip with element info
```

### Viewport Matching

```typescript
// Match original viewport dimensions
// Scale screenshot if viewport sizes differ
// Maintain aspect ratio
// Handle responsive layouts
```

### Step Replay

```typescript
// Auto-play: show each step for 2-3 seconds
// Manual: user controls with prev/next
// Smooth transitions between steps
// Show progress indicator
```

## Data Flow

1. User signs in → Get user ID
2. Fetch documents → Display in list
3. User selects document → Fetch document + steps
4. Render step viewer → Load screenshot
5. Display step data → Show pointer, highlight element
6. User navigates → Update current step
7. Repeat for each step

## Styling Guidelines

- Use Tailwind CSS for rapid development
- Create reusable component styles
- Implement responsive breakpoints
- Add smooth animations (framer-motion recommended)
- Use consistent color scheme
- Ensure good contrast for accessibility

## Performance Considerations

- **Server Components**: Use for initial data fetching (faster, no client JS)
- **Client Components**: Only for interactive features
- **Image Optimization**: Use Next.js Image component for screenshots
- **Lazy Loading**: Lazy load step components and screenshots
- **Caching**: Use Next.js caching strategies (revalidate, cache)
- **GraphQL Caching**: Configure Apollo Client cache or implement request caching
- **Virtual Scrolling**: For long step lists
- **Code Splitting**: Use dynamic imports for heavy components
- **Streaming**: Use Suspense boundaries for progressive loading

## Testing Requirements

- **Unit Tests**: Jest + React Testing Library
- **GraphQL Mocking**: Mock GraphQL responses
- **Component Tests**: Test visualization components
- **Server Component Tests**: Test data fetching logic
- **E2E Tests**: Playwright or Cypress
- **Viewport Testing**: Test with different screen sizes
- **Error Handling**: Test with missing data, network errors
- **Accessibility**: Test with screen readers

## Future Enhancements

- Real-time collaboration
- Comments on steps
- Step editing/reordering
- Multiple document versions
- Team sharing
- Analytics dashboard
- Video export

## Getting Started

1. **Create Next.js app:**
   ```bash
   npx create-next-app@latest documentation-viewer --typescript --tailwind --app
   cd documentation-viewer
   ```

2. **Install dependencies:**
   ```bash
   npm install @apollo/client graphql
   # or
   npm install graphql-request graphql
   npm install @supabase/supabase-js
   npm install zustand  # or your preferred state management
   ```

3. **Set up environment variables:**
   Create `.env.local` with Supabase credentials

4. **Configure GraphQL client:**
   Set up Apollo Client or graphql-request in `lib/graphql/client.ts`

5. **Set up Supabase Auth:**
   Configure authentication in `lib/supabase/auth.ts`

6. **Create GraphQL queries:**
   Define queries in `lib/graphql/queries.ts`

7. **Build Next.js pages:**
   - Create app router structure
   - Use Server Components for data fetching
   - Use Client Components for interactivity

8. **Implement features:**
   - Authentication pages
   - Document list (Server Component)
   - Document viewer (Server Component with Client Components)
   - Step visualization components

9. **Add visualizations:**
   - Pointer dot animation
   - Element highlighting
   - Screenshot display

## Next.js Specific Patterns

### Server Components for Data Fetching

```typescript
// app/documents/page.tsx (Server Component)
import { graphqlClient } from '@/lib/graphql-client';
import { GET_USER_DOCUMENTS } from '@/lib/graphql/queries';
import { DocumentList } from '@/components/documents/DocumentList';

export default async function DocumentsPage() {
  const userId = await getUserId(); // Get from session
  
  const { documents } = await graphqlClient.request(GET_USER_DOCUMENTS, {
    userId,
  });

  return <DocumentList initialDocuments={documents} />;
}
```

### Client Components for Interactivity

```typescript
// components/steps/StepViewer.tsx
'use client';

import { useState } from 'react';
import { PointerDot } from './PointerDot';
import { ElementHighlight } from './ElementHighlight';

export function StepViewer({ steps }: { steps: Step[] }) {
  const [currentStep, setCurrentStep] = useState(0);
  // ... interactive logic
}
```

### API Routes (if needed)

```typescript
// app/api/documents/[id]/route.ts
import { graphqlClient } from '@/lib/graphql-client';
import { GET_DOCUMENT_WITH_STEPS } from '@/lib/graphql/queries';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { documents } = await graphqlClient.request(GET_DOCUMENT_WITH_STEPS, {
    documentId: params.id,
  });
  
  return Response.json(documents[0]);
}
```

## Additional GraphQL Query Examples

### Complete Document with Steps (Single Query)

```graphql
query GetDocumentWithSteps($documentId: UUID!) {
  documents(where: { id: { _eq: $documentId } }) {
    id
    user_id
    title
    description
    created_at
    updated_at
    steps(
      where: { document_id: { _eq: $documentId } }
      order_by: { step_number: asc }
    ) {
      id
      step_number
      action
      data
      timestamp
      url
      title
      screenshot_url
      element_id
      element_selector
      click_x
      click_y
      viewport_width
      viewport_height
      created_at
    }
  }
}
```

### Filter Steps by Action Type

```graphql
query GetClickSteps($documentId: UUID!) {
  steps(
    where: { 
      document_id: { _eq: $documentId }
      action: { _eq: "click" }
    }
    order_by: { step_number: asc }
  ) {
    id
    step_number
    action
    click_x
    click_y
    screenshot_url
    data
  }
}
```

## GraphQL Endpoint Configuration

Supabase provides a Postgres GraphQL endpoint. To enable it:

1. Go to Supabase Dashboard → API → GraphQL
2. The endpoint is available at: `https://your-project.supabase.co/graphql/v1`
3. Use your anon key for authentication
4. For authenticated requests, include the user's access token in the Authorization header

### GraphQL Schema

The GraphQL schema is automatically generated from your Postgres schema. Tables become queryable types:

- `documents` → `documents` query type
- `steps` → `steps` query type

### GraphQL Query Syntax

Supabase GraphQL uses Hasura-style syntax:

```graphql
query {
  documents(where: { user_id: { _eq: "user-uuid" } }) {
    id
    title
    steps(order_by: { step_number: asc }) {
      step_number
      action
      data
    }
  }
}
```

### Common GraphQL Operators

- `_eq`: equals
- `_neq`: not equals
- `_gt`, `_gte`: greater than, greater than or equal
- `_lt`, `_lte`: less than, less than or equal
- `_in`: in array
- `_is_null`: is null check
- `_like`: pattern matching
- `order_by`: sorting
- `limit`, `offset`: pagination

## Reference Files

- See `DATA_STRUCTURE.md` for complete data schema and examples
- See `SUPABASE_SETUP.md` for Supabase configuration
- See `STORAGE_POLICIES.md` for storage setup
- See `BUCKET_SETUP.md` for bucket creation guide

## Priority Implementation Order

1. **Phase 1: Core Setup**
   - Supabase client setup
   - Authentication
   - Document list view

2. **Phase 2: Basic Viewer**
   - Document detail page
   - Step list display
   - Screenshot display

3. **Phase 3: Visualization**
   - Pointer dot animation
   - Element highlighting
   - Step navigation

4. **Phase 4: Enhanced Features**
   - Auto-play
   - Export functionality
   - UI polish

