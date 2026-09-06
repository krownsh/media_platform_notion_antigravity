const fs = require('node:fs');
const path = require('node:path');

// Do not infer the deployed checkout from this file or a home-directory
// convention. The Mac host must name its intended checkout explicitly, so an
// old clone can never start successfully while serving stale code.
const configuredRoot = process.env.MEDIA_PLATFORM_PROJECT_ROOT;
if (!configuredRoot) {
    throw new Error('Set MEDIA_PLATFORM_PROJECT_ROOT to the deployed repository before starting PM2');
}

const projectRoot = path.resolve(configuredRoot);

if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
    throw new Error(`PM2 project directory does not exist: ${projectRoot}`);
}

for (const requiredPath of ['server/index.js', 'server/scripts/workers/run_capture_worker.js', 'server/.env']) {
    const absolutePath = path.join(projectRoot, requiredPath);
    if (!fs.existsSync(absolutePath)) {
        throw new Error(`PM2 deployment is incomplete; missing ${absolutePath}`);
    }
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
