import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const topicsPage = read('src/pages/TopicsPage.jsx');
const collectionBoard = read('src/components/CollectionBoard.jsx');
const collectionFolder = read('src/components/CollectionFolder.jsx');
const collectionModal = read('src/components/CollectionModal.jsx');
const sortablePostCard = read('src/components/SortablePostCard.jsx');

test('topic workspace loads authenticated responses and keeps archived topics out of the active workspace', () => {
    assert.match(topicsPage, /responseData\(await authenticatedFetch\(`\$\{API_BASE_URL\}\/api\/topics`\)\)/);
    assert.match(topicsPage, /responseData\(await authenticatedFetch\(`\$\{API_BASE_URL\}\/api\/projects`\)\)/);
    assert.match(topicsPage, /const activeTopics = topics\.filter\(\(topic\) => topic\.origin === 'user' && topic\.status === 'active'\)/);
    assert.match(topicsPage, /const activeTopicGroups = projects\.map/);
    assert.match(topicsPage, /查看歷史主題/);
    assert.match(topicsPage, /封存主題不參與新的來源匹配、研究或 POC/);
});

test('legacy auto collections stay accessible but cannot receive or mutate posts', () => {
    assert.match(collectionBoard, /includes\('Hermes 自動建立'\)/);
    assert.match(collectionBoard, /const activeCollections = useMemo\(\(\) => collections\.filter\(\(collection\) => !isLegacyAutoCollection\(collection\)\)/);
    assert.match(collectionBoard, /over\.data\.current\?\.type === 'collection' && !isLegacyAutoCollection\(over\.data\.current\.collection\)/);
    assert.match(collectionBoard, /readOnly=\{selectedCollectionIsLegacy\}/);
    assert.match(collectionFolder, /disabled: readOnly/);
    assert.match(collectionFolder, /!readOnly && <button/);
    assert.match(collectionModal, /disabled: readOnly/);
    assert.match(collectionModal, /disabled=\{readOnly\}/);
    assert.match(sortablePostCard, /useSortable\(\{ id: post\.id, disabled \}\)/);
    assert.match(sortablePostCard, /disabled \? \{\} : listeners/);
});
