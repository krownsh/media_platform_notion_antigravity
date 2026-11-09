-- Enforce the source-record contract: every saved post has a readable title
-- and a non-empty source reference. Run after the capture cutover migrations.

begin;

update public.collection_posts
set title = left(
    coalesce(
        nullif(regexp_replace(btrim(content), E'[\n\r]+.*$', ''), ''),
        case
            when original_url like 'storage://%' then '圖片上傳來源'
            when nullif(btrim(original_url), '') is not null then '來源 · ' || regexp_replace(split_part(regexp_replace(original_url, '^https?://', ''), '/', 1), '^www\.', '')
            else '已保存來源'
        end
    ),
    500
)
where title is null or btrim(title) = '';

alter table public.collection_posts
    alter column title set not null;

alter table public.collection_posts
    drop constraint if exists collection_posts_title_nonempty_check,
    add constraint collection_posts_title_nonempty_check
        check (char_length(btrim(title)) between 1 and 500),
    drop constraint if exists collection_posts_original_url_nonempty_check,
    add constraint collection_posts_original_url_nonempty_check
        check (char_length(btrim(original_url)) between 1 and 4096);

commit;
