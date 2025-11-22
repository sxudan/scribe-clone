# Supabase Setup Guide

This guide will help you set up Supabase for the Documentation Tool extension.

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in
3. Create a new project
4. Note your project URL and anon key from Settings > API

## 2. Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Supabase credentials:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   ```

3. The `.env` file is already in `.gitignore` so your credentials won't be committed to git.

**Note:** After updating `.env`, rebuild the extension:
```bash
npm run build
```

## 3. Run Database Schema

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `src/supabase/schema.sql`
4. Run the SQL script

This will create:
- `documents` table
- `steps` table
- Row Level Security (RLS) policies
- Indexes for performance

## 4. Create Storage Bucket

1. Go to Storage in your Supabase dashboard
2. Create a new bucket (e.g., `Documents`)
3. Configure the bucket:
   - **Public or Private**: Choose based on your needs
     - **Public**: Screenshots will be accessible via public URLs
     - **Private**: You'll need to use signed URLs (more secure)
   - File size limit: 5MB (or as needed)
   - Allowed MIME types: `image/*` or specifically `image/png`, `image/jpeg`

4. Add the bucket name to your `.env` file:
   ```env
   SUPABASE_STORAGE_BUCKET=Documents
   ```

**Note**: If using a private bucket, you may need to generate signed URLs when retrieving screenshots in your React app.

## 5. Enable GraphQL (Optional)

If you want to use GraphQL API:

1. Go to Database > API
2. Enable PostgREST API (already enabled by default)
3. For GraphQL, you can use the PostgREST API with GraphQL queries

## 6. Test the Integration

1. Build the extension: `npm run build`
2. Load the extension in Chrome
3. Sign up/Sign in with your email
4. Create a document and record some steps
5. Save the document - it should upload to Supabase

## Database Schema

### Documents Table
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key to auth.users)
- `title` (TEXT)
- `description` (TEXT, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### Steps Table
- `id` (UUID, Primary Key)
- `document_id` (UUID, Foreign Key to documents)
- `step_number` (INTEGER)
- `action` (TEXT)
- `data` (JSONB)
- `timestamp` (BIGINT)
- `url` (TEXT)
- `title` (TEXT)
- `screenshot_url` (TEXT, nullable)
- `created_at` (TIMESTAMPTZ)

## Security

Row Level Security (RLS) is enabled:
- Users can only access their own documents
- Users can only upload screenshots to their document folders
- All operations are scoped to the authenticated user

## Troubleshooting

### Authentication Issues
- Check that your Supabase URL and anon key are correct
- Verify email confirmation is not required (or confirm your email)

### Storage Issues
- Ensure the `screenshots` bucket exists
- Check storage policies are correctly set
- Verify file size limits

### Database Issues
- Verify the schema was created correctly
- Check RLS policies are active
- Ensure foreign key constraints are working

