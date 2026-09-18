-- Stage W4 seed: initial, evidence-honest product path for one existing knowledge space.
-- Not executed by this repository. Apply only with the Stage W4 live-schema approval/readback gate.
-- Idempotent: it targets one space, derives its owner from knowledge_spaces, and upserts only path tables.

with target_space as (
  select id, user_id
  from public.knowledge_spaces
  where id = '006ae3e5-a6e7-4334-b6fc-befd5c80dc9b'
), seed_stages(slug, title, objective, position, required_inputs, expected_outputs, gates, coverage_status) as (
  values
    ('market-signal', '市場訊號與問題', '先確認問題、需求與競爭訊號，再決定是否進入產品探索。', 0, '["來源訊號"]'::jsonb, '["問題敘述", "初步需求證據"]'::jsonb, '["需求不可只靠直覺"]'::jsonb, 'supported'),
    ('hypothesis', '使用者、需求與分發假設', '將市場訊號轉成可被驗證或否證的假設。', 1, '["問題敘述"]'::jsonb, '["假設", "驗證設計"]'::jsonb, '["假設須可被否證"]'::jsonb, 'gap'),
    ('preflight', '可行性、平台資格與安全預檢', '在建置前排除平台、政策、憑證與安全邊界風險。', 2, '["假設", "目標平台"]'::jsonb, '["資格與風險清單"]'::jsonb, '["未通過不得進入實作"]'::jsonb, 'supported'),
    ('product-contract', '產品契約、介面與實作切片', '以具體參考、驗收條件與人類審核界線切出可實作範圍。', 3, '["預檢結果", "使用者假設"]'::jsonb, '["介面參考", "可驗收切片"]'::jsonb, '["不可用泛用模板替代驗收"]'::jsonb, 'partial'),
    ('engineering-verification', '工程品質、安全與互動驗證', '以可觀察工具和明確品質門檻驗證實作，而非以完成宣稱取代證據。', 4, '["可執行切片"]'::jsonb, '["測試證據", "風險報告"]'::jsonb, '["未驗證不可視為通過"]'::jsonb, 'supported'),
    ('release-readiness', '發布準備、部署與人工決策', '確認部署、回復、發布條件與最後人類決策。', 5, '["驗證證據"]'::jsonb, '["發布決策", "部署記錄"]'::jsonb, '["發布由人類最終確認"]'::jsonb, 'gap'),
    ('post-release-review', '發布後訊號回顧', '回看使用者與產品訊號，決定迭代、停損或回到前段假設。', 6, '["發布記錄", "回饋訊號"]'::jsonb, '["迭代或停損決策"]'::jsonb, '["回饋需導向下一個可驗證動作"]'::jsonb, 'gap')
)
insert into public.knowledge_space_path_stages (user_id, space_id, slug, title, objective, position, required_inputs, expected_outputs, gates, coverage_status, status)
select target_space.user_id, target_space.id, seed_stages.slug, seed_stages.title, seed_stages.objective, seed_stages.position, seed_stages.required_inputs, seed_stages.expected_outputs, seed_stages.gates, seed_stages.coverage_status, 'published'
from target_space cross join seed_stages
on conflict (space_id, slug) do update set
  title = excluded.title, objective = excluded.objective, position = excluded.position,
  required_inputs = excluded.required_inputs, expected_outputs = excluded.expected_outputs,
  gates = excluded.gates, coverage_status = excluded.coverage_status, status = excluded.status,
  updated_at = now();

with target_space as (
  select id, user_id from public.knowledge_spaces where id = '006ae3e5-a6e7-4334-b6fc-befd5c80dc9b'
), assignments(stage_slug, node_id, position) as (
  values
    ('market-signal', '5b8cad14-6325-4e2a-b0ad-260904b00de1'::uuid, 0),
    ('preflight', '9d5b1eb7-c04d-4c95-b7ef-79632482650a'::uuid, 0),
    ('product-contract', '33c7822d-f0ff-46d7-88b5-967fca59ff5e'::uuid, 0),
    ('product-contract', '7192dbab-00ad-4ed0-aa0a-6faa09c059d4'::uuid, 1),
    ('engineering-verification', 'eecca1fd-e7ba-4f1c-8088-8ac80a112900'::uuid, 0),
    ('engineering-verification', 'a3cb539b-bd05-45d1-95c7-b230a3312bdd'::uuid, 1)
)
insert into public.knowledge_space_stage_nodes (stage_id, node_id, user_id, position)
select stages.id, assignments.node_id, target_space.user_id, assignments.position
from assignments
join target_space on true
join public.knowledge_space_path_stages stages on stages.space_id = target_space.id and stages.slug = assignments.stage_slug
on conflict (stage_id, node_id) do update set position = excluded.position;

with target_space as (
  select id, user_id from public.knowledge_spaces where id = '006ae3e5-a6e7-4334-b6fc-befd5c80dc9b'
), edges(from_slug, to_slug, transition_type, condition) as (
  values
    ('market-signal', 'hypothesis', 'progression', '將訊號寫成可否證假設'),
    ('hypothesis', 'preflight', 'progression', '假設值得進一步驗證'),
    ('preflight', 'product-contract', 'progression', '資格與安全邊界可接受'),
    ('product-contract', 'engineering-verification', 'progression', '切片可實作且可驗收'),
    ('engineering-verification', 'release-readiness', 'progression', '測試與互動證據足夠'),
    ('release-readiness', 'post-release-review', 'progression', '人類完成發布決策'),
    ('post-release-review', 'market-signal', 'feedback', '依回饋回到問題與訊號')
)
insert into public.knowledge_space_stage_transitions (user_id, space_id, from_stage_id, to_stage_id, transition_type, condition)
select target_space.user_id, target_space.id, source_stage.id, target_stage.id, edges.transition_type, edges.condition
from edges
join target_space on true
join public.knowledge_space_path_stages source_stage on source_stage.space_id = target_space.id and source_stage.slug = edges.from_slug
join public.knowledge_space_path_stages target_stage on target_stage.space_id = target_space.id and target_stage.slug = edges.to_slug
on conflict (from_stage_id, to_stage_id, transition_type) do update set condition = excluded.condition;
