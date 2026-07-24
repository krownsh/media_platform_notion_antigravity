-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Posts Table
-- Stores the core information of a social media post.
-- -----------------------------------------------------------------------------
CREATE TABLE public.collection_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('instagram', 'facebook', 'twitter', 'threads', 'generic', 'notion', 'youtube', 'github')),
    original_url TEXT NOT NULL,
    platform_post_id VARCHAR(255), -- ID from the original platform
    author_name VARCHAR(255),
    author_id VARCHAR(255), -- ID of the author on the platform
    author_avatar_url TEXT,
    content TEXT, -- The main text content of the post
    posted_at TIMESTAMP WITH TIME ZONE, -- When it was originally posted
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    full_json JSONB,
    source_domains TEXT[] NOT NULL DEFAULT '{}', -- Normalized outbound hostnames discovered during capture
    collection_id UUID, -- Optional linkage to a collection
    CONSTRAINT collection_posts_user_original_url_key UNIQUE (user_id, original_url)
);

COMMENT ON TABLE public.collection_posts IS 'Core table storing social media posts.';
COMMENT ON COLUMN public.collection_posts.platform IS 'Source platform: instagram, facebook, twitter, threads';
COMMENT ON COLUMN public.collection_posts.original_url IS 'The original URL input by the user';
COMMENT ON COLUMN public.collection_posts.source_domains IS 'Normalized source hostnames discovered during capture; empty when none are found.';

-- RLS for collection_posts
ALTER TABLE public.collection_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own posts" ON public.collection_posts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own posts" ON public.collection_posts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts" ON public.collection_posts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts" ON public.collection_posts
    FOR DELETE USING (auth.uid() = user_id);


-- -----------------------------------------------------------------------------
-- 2. Post Media Table
-- Stores images and videos associated with a post.
-- -----------------------------------------------------------------------------
CREATE TABLE public.collection_post_media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.collection_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(20) CHECK (type IN ('image', 'video', 'carousel_album')),
    url TEXT NOT NULL, -- URL to the media (could be external or internal storage)
    thumbnail_url TEXT,
    "order" INTEGER DEFAULT 0, -- For ordering in a carousel
    meta_data JSONB DEFAULT '{}'::jsonb, -- Extra info like width, height, duration
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.collection_post_media IS 'Stores media attachments for posts.';
COMMENT ON COLUMN public.collection_post_media.meta_data IS 'JSONB for extra properties: width, height, duration, etc.';

-- RLS for collection_post_media
ALTER TABLE public.collection_post_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own post media" ON public.collection_post_media
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own post media" ON public.collection_post_media
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own post media" ON public.collection_post_media
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own post media" ON public.collection_post_media
    FOR DELETE USING (auth.uid() = user_id);


-- -----------------------------------------------------------------------------
-- 3. Post Comments Table
-- Stores comments captured from the original post.
-- -----------------------------------------------------------------------------
CREATE TABLE public.collection_post_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.collection_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    author_name VARCHAR(255),
    content TEXT,
    commented_at TIMESTAMP WITH TIME ZONE,
    raw_data JSONB DEFAULT '{}'::jsonb, -- Full raw object from API/Crawler
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.collection_post_comments IS 'Comments scraped from the original post.';

-- RLS for collection_post_comments
ALTER TABLE public.collection_post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own post comments" ON public.collection_post_comments
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own post comments" ON public.collection_post_comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own post comments" ON public.collection_post_comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own post comments" ON public.collection_post_comments
    FOR DELETE USING (auth.uid() = user_id);


-- -----------------------------------------------------------------------------
-- 4. Post Snapshots Table
-- Stores raw HTML or full-page screenshots for backup.
-- -----------------------------------------------------------------------------
CREATE TABLE public.collection_post_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.collection_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    snapshot_type VARCHAR(20) CHECK (snapshot_type IN ('html', 'screenshot_full', 'screenshot_visible')),
    storage_path TEXT, -- Path in Supabase Storage or URL
    content TEXT, -- For raw HTML content if stored directly
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.collection_post_snapshots IS 'Backup of the post state: Raw HTML or Screenshot.';

-- RLS for collection_post_snapshots
ALTER TABLE public.collection_post_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own post snapshots" ON public.collection_post_snapshots
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own post snapshots" ON public.collection_post_snapshots
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own post snapshots" ON public.collection_post_snapshots
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own post snapshots" ON public.collection_post_snapshots
    FOR DELETE USING (auth.uid() = user_id);


-- -----------------------------------------------------------------------------
-- 5. Post Analysis Table
-- Stores AI-generated insights, tags, and summaries.
-- -----------------------------------------------------------------------------
CREATE TABLE public.collection_post_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.collection_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    summary TEXT,
    tags TEXT[], -- Array of strings for hashtags
    topics TEXT[], -- Main topics identified
    sentiment VARCHAR(50),
    insights JSONB DEFAULT '[]'::jsonb, -- List of key insights or "remix ideas"
    primary_category VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.collection_post_analysis IS 'AI analysis results: summary, tags, insights.';

-- RLS for collection_post_analysis
ALTER TABLE public.collection_post_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own post analysis" ON public.collection_post_analysis
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own post analysis" ON public.collection_post_analysis
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own post analysis" ON public.collection_post_analysis
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own post analysis" ON public.collection_post_analysis
    FOR DELETE USING (auth.uid() = user_id);


-- -----------------------------------------------------------------------------
-- 6. Collections Table
-- User-defined collections (like folders or boards).
-- -----------------------------------------------------------------------------
CREATE TABLE public.collection_collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    cover_image_url TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.collection_collections IS 'User collections for organizing posts.';

-- RLS for collection_collections
ALTER TABLE public.collection_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own collections" ON public.collection_collections
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own collections" ON public.collection_collections
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own collections" ON public.collection_collections
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own collections" ON public.collection_collections
    FOR DELETE USING (auth.uid() = user_id);


-- -----------------------------------------------------------------------------
-- 7. Collection Post Map Table
-- Many-to-Many relationship between Collections and Posts.
-- -----------------------------------------------------------------------------
CREATE TABLE public.collection_collection_post_map (
    collection_id UUID NOT NULL REFERENCES public.collection_collections(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES public.collection_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "order" INTEGER DEFAULT 0, -- For manual sorting within the collection
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (collection_id, post_id)
);

COMMENT ON TABLE public.collection_collection_post_map IS 'Mapping posts to collections with ordering.';

-- RLS for collection_collection_post_map
ALTER TABLE public.collection_collection_post_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own collection map" ON public.collection_collection_post_map
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own collection map" ON public.collection_collection_post_map
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own collection map" ON public.collection_collection_post_map
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own collection map" ON public.collection_collection_post_map
    FOR DELETE USING (auth.uid() = user_id);


-- -----------------------------------------------------------------------------
-- 8. User Annotations Table
-- User notes and highlights on posts.
-- -----------------------------------------------------------------------------
CREATE TABLE public.collection_user_annotations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.collection_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'note', -- 'note', 'highlight'
    target_text TEXT, -- If highlighting specific text
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.collection_user_annotations IS 'User notes and highlights on posts.';

-- RLS for collection_user_annotations
ALTER TABLE public.collection_user_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own annotations" ON public.collection_user_annotations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own annotations" ON public.collection_user_annotations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own annotations" ON public.collection_user_annotations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own annotations" ON public.collection_user_annotations
    FOR DELETE USING (auth.uid() = user_id);


-- -----------------------------------------------------------------------------
-- Function to automatically update updated_at timestamp
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION collection_update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables
CREATE TRIGGER update_collection_posts_updated_at BEFORE UPDATE ON public.collection_posts FOR EACH ROW EXECUTE PROCEDURE collection_update_updated_at_column();
CREATE TRIGGER update_collection_post_media_updated_at BEFORE UPDATE ON public.collection_post_media FOR EACH ROW EXECUTE PROCEDURE collection_update_updated_at_column();
CREATE TRIGGER update_collection_post_comments_updated_at BEFORE UPDATE ON public.collection_post_comments FOR EACH ROW EXECUTE PROCEDURE collection_update_updated_at_column();
CREATE TRIGGER update_collection_post_snapshots_updated_at BEFORE UPDATE ON public.collection_post_snapshots FOR EACH ROW EXECUTE PROCEDURE collection_update_updated_at_column();
CREATE TRIGGER update_collection_post_analysis_updated_at BEFORE UPDATE ON public.collection_post_analysis FOR EACH ROW EXECUTE PROCEDURE collection_update_updated_at_column();
CREATE TRIGGER update_collection_collections_updated_at BEFORE UPDATE ON public.collection_collections FOR EACH ROW EXECUTE PROCEDURE collection_update_updated_at_column();
CREATE TRIGGER update_collection_user_annotations_updated_at BEFORE UPDATE ON public.collection_user_annotations FOR EACH ROW EXECUTE PROCEDURE collection_update_updated_at_column();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_collection_posts_full_json ON public.collection_posts USING gin (full_json);
