-- Stage S: retain an AI-generated display title without replacing the source title.
-- Deployment source only. Review against the live schema before applying.

begin;

alter table public.collection_post_analysis
    add column if not exists generated_title text,
    add column if not exists title_generated_at timestamptz,
    add column if not exists title_generation_source text;

comment on column public.collection_post_analysis.generated_title is
    'AI-generated display title used only when collection_posts.title is absent; never replaces the captured source title.';
comment on column public.collection_post_analysis.title_generated_at is
    'UTC time at which generated_title was written.';
comment on column public.collection_post_analysis.title_generation_source is
    'Trusted workflow that produced generated_title, such as capture_ai, hermes_preprocess, or codex_db_preprocess.';

-- A later capture is allowed to improve a source title, but a crawler that
-- returns no title must not erase a title already supplied by the source.
create or replace function public.collection_preserve_source_title()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
    if nullif(btrim(coalesce(new.title, '')), '') is null then
        new.title := old.title;
    end if;
    return new;
end;
$$;

drop trigger if exists preserve_collection_post_source_title on public.collection_posts;
create trigger preserve_collection_post_source_title
before update of title on public.collection_posts
for each row execute function public.collection_preserve_source_title();

revoke all on function public.collection_preserve_source_title() from public, anon, authenticated;

commit;
