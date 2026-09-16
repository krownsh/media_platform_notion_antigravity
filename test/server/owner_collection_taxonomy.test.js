import assert from 'node:assert/strict';
import test from 'node:test';
import { folderRoutingPolicyForUser } from '../../server/config/ownerCollectionTaxonomy.js';

const OWNER_USER_ID = '50984520-69ad-4e64-b9c1-503f5c1b0e63';
const APPROVED_COLLECTION_IDS = [
  '76945268-b2e1-4c8e-bece-11a2000af0a6', 'ea5d6493-8b3e-4139-84b9-3dec4d70d109',
  'a9f086bc-5041-4157-9ae3-bfd73ccc9ae6', 'aef97ffe-9063-49a6-984c-f71245da76ae',
  'e29f4e0a-91d2-4eff-8606-f79f535558e9', '57d4a857-193c-40d6-9779-bcc3b617bbfe',
  'c6c52278-3827-4a9a-b8cf-137758a35570', '2bbf3989-268f-40dd-8c5c-31c9d5eb34bc',
  '68e4be51-6a94-492d-bac2-9a6aa11d5a15', '0dbf7c12-48f1-4d69-995f-4908be7ba4a9',
  '34ab6683-d000-47e3-a8f2-a634d74e1763', '6cbc331a-060a-4b1b-96ef-8ea440315316',
  '3e2328d0-c904-4416-9d89-1eda3d56b1cd', 'cb934189-6dd4-4448-a423-1f3d8b5730ec',
  'a2697b52-a8d3-4f5c-ad1a-064900d589c7', '2f26f840-db76-46a8-884a-8c7515aa17ba',
  '41cb8bc2-4c62-4ea8-a1bc-7314549bf2ce', 'a7bfa5b1-a5fb-4bd3-9a5b-6cc81e044b4f',
  'dfb65351-5d97-4cd3-b0e6-65061f8b1af0', '57ccf24f-4d3e-45bd-99eb-63de93c1e468'
];
const AUTO_FOLDER_ID = '6366b2e1-5ec2-4e4c-a0e5-35c43c85f7fb';

test('owner taxonomy exposes exactly the approved K1 IDs and no auto IDs', () => {
  const policy = folderRoutingPolicyForUser(OWNER_USER_ID);

  assert.equal(policy.approvedCollectionIds.size, 20);
  assert.deepEqual([...policy.approvedCollectionIds].sort(), [...APPROVED_COLLECTION_IDS].sort());
  assert.equal(policy.approvedCollectionIds.has(AUTO_FOLDER_ID), false);
  assert.equal(policy.folderTopicMappingMode, 'none');
});

test('unknown users fail closed with no permitted collection IDs', () => {
  const policy = folderRoutingPolicyForUser('different-user');

  assert.equal(policy.approvedCollectionIds.size, 0);
});
