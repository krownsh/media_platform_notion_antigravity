import { dispatchHermesWorkflowOnce } from '../../workers/hermesDispatchWorker.js';

dispatchHermesWorkflowOnce().then(result => {
    process.stdout.write(`${JSON.stringify(result)}\n`);
}).catch((error) => {
    console.error('[HermesDispatchWorker] fatal error:', error);
    process.exitCode = 1;
});
