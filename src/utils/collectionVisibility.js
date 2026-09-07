export function isLegacyAutoCollection(collection) {
  return String(collection?.description || '').includes('Hermes 自動建立');
}

export function visibleCollections(collections) {
  return (Array.isArray(collections) ? collections : []).filter(collection => !isLegacyAutoCollection(collection));
}
