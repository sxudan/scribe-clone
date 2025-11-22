# Supabase Storage Policies for Screenshots Bucket

After creating the `screenshots` bucket in Supabase, you need to set up storage policies.

## 1. Create the Bucket

1. Go to Supabase Dashboard → Storage
2. Click "New bucket"
3. Name: `screenshots`
4. Public: **false** (private bucket is more secure)
5. File size limit: 5MB (or as needed)
6. Allowed MIME types: `image/*` or `image/png,image/jpeg`

## 2. Set Up Storage Policies

Go to Storage → Policies → `screenshots` bucket

### Policy 1: Allow Authenticated Users to Upload

**Policy Name**: `Users can upload screenshots`

**Policy Definition** (matches the code's folder structure: `{user_id}/{document_id}/...`):
```sql
CREATE POLICY "Users can upload screenshots"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'screenshots' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

This policy ensures users can only upload to folders named with their user ID.

**Alternative (simpler - any authenticated user can upload)**:
```sql
CREATE POLICY "Users can upload screenshots"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'screenshots');
```

### Policy 2: Allow Authenticated Users to Read

**Policy Name**: `Users can view screenshots`

**Policy Definition**:
```sql
CREATE POLICY "Users can view screenshots"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'screenshots');
```

### Policy 3: Allow Authenticated Users to Delete

**Policy Name**: `Users can delete screenshots`

**Policy Definition**:
```sql
CREATE POLICY "Users can delete screenshots"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'screenshots');
```

## 3. Quick Setup (All-in-One SQL)

Run this in Supabase SQL Editor:

```sql
-- Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can view screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete screenshots" ON storage.objects;

-- Create upload policy
CREATE POLICY "Users can upload screenshots"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'screenshots');

-- Create read policy
CREATE POLICY "Users can view screenshots"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'screenshots');

-- Create delete policy
CREATE POLICY "Users can delete screenshots"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'screenshots');
```

## 4. Verify Setup

1. Make sure you're signed in to the extension
2. Try uploading a document with screenshots
3. Check the browser console for any errors
4. Check Supabase Storage → `screenshots` bucket to see if files appear

## Troubleshooting

### "Bucket not found" error
- Verify the bucket name matches exactly (case-sensitive)
- Check `.env` file has correct `SUPABASE_STORAGE_BUCKET` value
- Rebuild extension after changing `.env`

### "Permission denied" error
- Check that storage policies are created
- Verify you're authenticated (signed in)
- Check RLS is enabled on storage.objects

### Files not appearing in bucket
- Check browser console for upload errors
- Verify blob size is not 0
- Check network tab for failed requests

