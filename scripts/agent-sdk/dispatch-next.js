import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { dispatchHermesWorkflowOnce } from '../../server/workers/hermesDispatchWorker.js';

function readOption(args, name) {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : null;
}

export async function dispatchNext(options = {}) {
    return dispatchHermesWorkflowOnce({
        workerId: options.workerId || 'hermes:manual:dispatch-once'
    });
}

async function main() {
    const args = process.argv.slice(2);
    const result = await dispatchNext({
        workerId: readOption(args, '--worker') || undefined
    });
    process.stdout.write(`${JSON.stringify({ ok: true, ...result })}\n`);
}

const isMainModule = process.argv[1]
    && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
    main().catch(error => {
        process.stderr.write(`${JSON.stringify({
            ok: false,
            code: error.code || 'HERMES_DISPATCH_FAILED',
            error: error.message
        })}\n`);
        process.exitCode = 1;
    });
}
