import { runCaptureWorker } from '../../workers/captureWorker.js';

const controller = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => controller.abort());
}

runCaptureWorker({ signal: controller.signal }).catch((error) => {
    console.error('[CaptureWorker] fatal error:', error);
    process.exitCode = 1;
});
