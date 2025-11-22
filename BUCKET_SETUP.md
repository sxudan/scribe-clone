# Quick Bucket Setup Guide

## Create the Screenshots Bucket

1. **Go to Supabase Dashboard**
   - Navigate to your project
   - Click on **Storage** in the left sidebar

2. **Create New Bucket**
   - Click **"New bucket"** button
   - **Name**: `screenshots` (exactly, case-sensitive)
   - **Public**: Choose based on your needs:
     - **Public**: Screenshots accessible via public URLs (easier)
     - **Private**: More secure, requires signed URLs
   - **File size limit**: 5MB (or as needed)
   - **Allowed MIME types**: `image/*` or `image/png,image/jpeg`
   - Click **"Create bucket"**

3. **Set Up Storage Policies**

   Go to **Storage → Policies → screenshots bucket**

   Run this SQL in **SQL Editor**:

   ```sql
   -- Enable RLS
   ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

   -- Drop existing policies if any
   DROP POLICY IF EXISTS "Users can upload screenshots" ON storage.objects;
   DROP POLICY IF EXISTS "Users can view screenshots" ON storage.objects;
   DROP POLICY IF EXISTS "Users can delete screenshots" ON storage.objects;

   -- Create policies (simple version - allows all authenticated users)
   CREATE POLICY "Users can upload screenshots"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'screenshots');

   CREATE POLICY "Users can view screenshots"
   ON storage.objects FOR SELECT
   TO authenticated
   USING (bucket_id = 'screenshots');

   CREATE POLICY "Users can delete screenshots"
   ON storage.objects FOR DELETE
   TO authenticated
   USING (bucket_id = 'screenshots');
   ```

4. **Verify Your .env File**

   Make sure your `.env` file has:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_STORAGE_BUCKET=screenshots
   ```

5. **Rebuild Extension**
   ```bash
   npm run build
   ```

6. **Test**
   - Reload the extension in Chrome
   - Sign in
   - Record some steps
   - Save the document
   - Check browser console for any errors
   - Check Supabase Storage → screenshots bucket to see uploaded files

## Troubleshooting

### "Bucket not found" error
- ✅ Verify bucket name is exactly `screenshots` (case-sensitive)
- ✅ Check `.env` file has `SUPABASE_STORAGE_BUCKET=screenshots`
- ✅ Rebuild extension after changing `.env`
- ✅ Check Supabase Dashboard → Storage to confirm bucket exists

### "Permission denied" error
- ✅ Run the SQL policies above
- ✅ Make sure you're signed in to the extension
- ✅ Check RLS is enabled on storage.objects

### Bucket exists but files not uploading
- ✅ Check browser console for specific error messages
- ✅ Verify storage policies are created
- ✅ Check if bucket is public or private (private buckets need signed URLs)

