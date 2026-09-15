import { runCaptureWorker } from '../../workers/captureWorker.js';
import { exitAfterCaptureWorkerFatal } from '../../workers/captureWorkerRuntime.js';

const controller = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => controller.abort());
}

runCaptureWorker({ signal: controller.signal }).catch((error) => {
    exitAfterCaptureWorkerFatal(error);
});
