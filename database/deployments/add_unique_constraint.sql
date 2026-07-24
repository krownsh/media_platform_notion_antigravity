-- Replace the legacy global URL constraint with a tenant-aware constraint.
-- Run this during a low-traffic deployment window after backing up the table.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.collection_posts'::regclass
          AND conname = 'collection_posts_original_url_key'
    ) THEN
        ALTER TABLE public.collection_posts
            DROP CONSTRAINT collection_posts_original_url_key;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.collection_posts'::regclass
          AND conname = 'collection_posts_user_original_url_key'
    ) THEN
        ALTER TABLE public.collection_posts
            ADD CONSTRAINT collection_posts_user_original_url_key UNIQUE (user_id, original_url);
    END IF;
END;
$$;
