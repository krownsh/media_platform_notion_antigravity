import { API_BASE_URL } from './config';
import { authenticatedFetch } from './authenticatedFetch';

async function request(path, options) {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/owner-knowledge${path}`, options);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Owner knowledge request failed');
    return body;
}

export const listOwnerTopics = () => request('/topics');
export const createOwnerTopic = label => request('/topics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ label }) });
export const listProjectCatalog = () => request('/projects');
export const createProjectCatalogEntry = input => request('/projects', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
export const listLegacyProjects = () => request('/legacy-projects');
export const importLegacyProjectToCatalog = projectId => request(`/legacy-projects/${encodeURIComponent(projectId)}/import`, { method: 'POST' });
export const listProjectReferences = () => request('/project-references');
export const createPocProposal = (referenceId, objective, isolationSpec = {}) => request(`/project-references/${referenceId}/poc-proposals`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ objective, isolation_spec: isolationSpec }) });
export const decidePocProposal = (proposalId, action, expectedVersion) => request(`/poc-proposals/${proposalId}/${action}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expected_version: expectedVersion }) });
