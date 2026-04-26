-- Add unique constraint to original_url to allow native upsert
ALTER TABLE public.collection_posts ADD CONSTRAINT collection_posts_original_url_key UNIQUE (original_url);
