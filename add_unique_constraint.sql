-- Add unique constraint to original_url to allow native upsert
ALTER TABLE public.posts ADD CONSTRAINT posts_original_url_key UNIQUE (original_url);
