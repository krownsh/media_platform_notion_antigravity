const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '..');
const linkedProjectRoot = path.join(os.homedir(), 'Projects', 'media_platform_notion_antigravity');
const projectRoot = fs.existsSync(linkedProjectRoot) && fs.statSync(linkedProjectRoot).isDirectory()
    ? linkedProjectRoot
    : repositoryRoot;

module.exports = {
    apps: [
        {
            name: 'media-collection-server',
            cwd: projectRoot,
            script: 'server/index.js',
            interpreter: 'node',
            autorestart: true,
            watch: false,
            restart_delay: 3000,
            kill_timeout: 10000,
            time: true
            // PORT and all secrets continue to come from server/.env.
        },
        {
            name: 'media-collection-capture-worker',
            cwd: projectRoot,
            script: 'server/scripts/workers/run_capture_worker.js',
            interpreter: 'node',
            autorestart: true,
            watch: false,
            restart_delay: 3000,
            kill_timeout: 10000,
            time: true,
            env: {
                CAPTURE_WORKER_ID: 'media-collection-capture-worker'
            }
        }
    ]
};
