#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { supabase, isSupabaseConfigured } from '../../server/supabaseClient.js';
import {
  CANONICAL_SOURCE_TAXONOMY_VERSION,
  canonicalTaxonomyArtifactSha256,
  classifyCanonicalProposal
} from '../../server/services/sourceTaxonomyClassifier.js';

function readArgument(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1] || null;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

export function buildSourceTaxonomyManifest({ posts, classifications, userId, acceptanceConfidence } = {}) {
  if (!isUuid(userId)) throw new Error('Owner user id must be a valid UUID');
  if (!Array.isArray(posts)) throw new Error('Posts must be an array');
  if (!(classifications instanceof Map)) throw new Error('Classifications must be a Map keyed by post id');

  const sourceIds = new Set(posts.map(post => post?.id).filter(Boolean));
  for (const postId of classifications.keys()) {
    if (!sourceIds.has(postId)) throw new Error(`Prediction refers to unknown post: ${postId}`);
  }

  const seen = new Set();
  const proposals = posts.map(post => {
    if (!post?.id) throw new Error('Every source post must have an id');
    if (post.user_id !== userId) throw new Error(`Post ${post.id} does not belong to the requested owner`);
    if (seen.has(post.id)) throw new Error(`Manifest has duplicate post id: ${post.id}`);
    seen.add(post.id);
    return classifyCanonicalProposal({
      source: post,
      classification: classifications.get(post.id),
      acceptanceConfidence
    });
  });

  const accepted = proposals.filter(proposal => proposal.status === 'accepted').length;
  return {
    manifest: {
      taxonomy_version: CANONICAL_SOURCE_TAXONOMY_VERSION,
      taxonomy_artifact_sha256: canonicalTaxonomyArtifactSha256(),
      owner_user_id: userId,
      generated_at: new Date().toISOString(),
      mutation_scope: 'proposal_only_no_post_or_folder_write'
    },
    proposals,
    summary: {
      total_posts: proposals.length,
      accepted,
      needs_review: proposals.length - accepted
    }
  };
}

export function parsePredictionRows(rows) {
  const predictions = new Map();
  for (const row of rows) {
    if (!row?.post_id) throw new Error('Every prediction row requires post_id');
    if (predictions.has(row.post_id)) throw new Error(`Duplicate prediction for post_id: ${row.post_id}`);
    predictions.set(row.post_id, row);
  }
  return predictions;
}

async function loadJsonLines(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return parsePredictionRows(raw.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)));
}

async function fetchOwnerPosts(userId) {
  const posts = [];
  const pageSize = 100;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('collection_posts')
      .select('id,user_id,title,content,full_json,created_at')
      .eq('user_id', userId)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Owner post read failed: ${error.message}`);
    posts.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return posts;
}

async function approvedOutputPath(outputPath) {
  const configuredRoot = '/Volumes/DevSSD/hermes/source-taxonomy-manifests';
  const expectedSsdRoot = '/Volumes/DevSSD/';
  await fs.mkdir(configuredRoot, { recursive: true });
  const root = await fs.realpath(configuredRoot);
  if (!root.startsWith(expectedSsdRoot)) throw new Error(`Manifest root escaped required SSD boundary: ${expectedSsdRoot}`);

  const target = path.resolve(outputPath);
  if (!target.startsWith(`${configuredRoot}${path.sep}`)) throw new Error(`Manifest output must be inside ${configuredRoot}`);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const realParent = await fs.realpath(path.dirname(target));
  if (realParent !== root && !realParent.startsWith(`${root}${path.sep}`)) throw new Error('Manifest output parent escaped approved root via symlink');
  return path.join(realParent, path.basename(target));
}

async function main() {
  const args = process.argv.slice(2);
  const userId = readArgument(args, '--user-id');
  const predictionsPath = readArgument(args, '--predictions');
  const outputPath = readArgument(args, '--out');
  if (!userId || !predictionsPath || !outputPath) {
    throw new Error('Usage: propose-source-taxonomy-backfill.js --user-id <uuid> --predictions <jsonl> --out <manifest.json>');
  }
  if (!isSupabaseConfigured) throw new Error('Supabase credentials are required for the read-only preflight');

  const safeOutputPath = await approvedOutputPath(outputPath);
  const [posts, classifications] = await Promise.all([fetchOwnerPosts(userId), loadJsonLines(predictionsPath)]);
  const result = buildSourceTaxonomyManifest({ posts, classifications, userId });
  const serialized = JSON.stringify(result, null, 2);
  const manifestSha256 = crypto.createHash('sha256').update(serialized, 'utf8').digest('hex');
  await fs.mkdir(path.dirname(safeOutputPath), { recursive: true });
  const file = await fs.open(safeOutputPath, 'wx');
  await file.writeFile(`${serialized}\n`, 'utf8');
  await file.close();
  console.log(JSON.stringify({ ...result.summary, manifest_sha256: manifestSha256, output: safeOutputPath }));
}

const executedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (executedDirectly) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
