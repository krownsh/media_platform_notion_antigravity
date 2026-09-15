export function exitAfterCaptureWorkerFatal(error, {
    log = console,
    exit = code => process.exit(code)
} = {}) {
    log.error('[CaptureWorker] fatal error:', error);
    exit(1);
}
