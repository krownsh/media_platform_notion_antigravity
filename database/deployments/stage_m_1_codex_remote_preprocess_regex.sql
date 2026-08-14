-- Stage M.1: repair the SQL regex literals in Stage M.
-- PostgreSQL's standard-conforming strings require one backslash in the
-- regular-expression pattern; the first deployment used two and treated
-- every decimal confidence as zero.

begin;

do $migration$
declare
    v_definition text;
begin
    select pg_get_functiondef('public.codex_stage_collection_preprocess(uuid,jsonb,text)'::regprocedure)
    into v_definition;
    v_definition := replace(v_definition, '\\', '\');
    execute v_definition;
end
$migration$;

commit;
