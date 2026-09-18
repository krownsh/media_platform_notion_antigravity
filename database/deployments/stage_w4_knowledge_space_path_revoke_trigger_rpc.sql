-- Follow-up for Stage W4: guard trigger functions must never be public RPC endpoints.
revoke execute on function public.enforce_knowledge_space_stage_node_owner() from public, anon, authenticated;
revoke execute on function public.enforce_knowledge_space_stage_transition_owner() from public, anon, authenticated;
