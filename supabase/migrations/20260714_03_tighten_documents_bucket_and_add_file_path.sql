-- The public `documents` bucket serves files via public object URLs, which do
-- not require a SELECT policy on storage.objects. The broad policy only lets
-- any authenticated user LIST every file in the bucket, so remove it.
DROP POLICY IF EXISTS "Authenticated users can read storage documents" ON storage.objects;

-- Store the storage path for employee-uploaded documents so the app can mint
-- short-lived signed URLs on demand instead of persisting a 1-year URL.
ALTER TABLE public.document_completions
  ADD COLUMN IF NOT EXISTS completed_file_path text;
