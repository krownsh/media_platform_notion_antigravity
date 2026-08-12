const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');

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
        },
        {
            name: 'media-collection-hermes-dispatcher',
            cwd: projectRoot,
            script: 'server/scripts/workers/run_hermes_dispatch_worker.js',
            interpreter: 'node',
            autorestart: true,
            watch: false,
            restart_delay: 3000,
            kill_timeout: 10000,
            time: true,
            env: {
                HERMES_DISPATCH_WORKER_ID: 'media-collection-hermes-dispatcher'
            }
        }
    ]
};
