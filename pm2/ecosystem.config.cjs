const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// PM2 must always run the deployed copy under ~/Projects. Do not fall back to
// the directory containing this config: an old checkout there can otherwise
// start successfully while serving stale code.
const projectRoot = path.join(os.homedir(), 'Projects', 'media_platform_notion_antigravity');

if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
    throw new Error(`PM2 project directory does not exist: ${projectRoot}`);
}

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
