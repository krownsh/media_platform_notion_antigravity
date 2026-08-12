import { runHermesDispatchWorker } from '../../workers/hermesDispatchWorker.js';

const controller = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => controller.abort());
}

runHermesDispatchWorker({ signal: controller.signal }).catch((error) => {
    console.error('[HermesDispatchWorker] fatal error:', error);
    process.exitCode = 1;
});
