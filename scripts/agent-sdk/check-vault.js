import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { verifyVaultRoot } from '../../server/services/vaultNoteService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../server/.env'), quiet: true });

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
    const args = process.argv.slice(2);
    const vaultIndex = args.indexOf('--vault');
    const vaultRoot = vaultIndex >= 0 ? args[vaultIndex + 1] : null;
    verifyVaultRoot(vaultRoot)
        .then(root => process.stdout.write(`${JSON.stringify({ ok: true, vault_root: root })}\n`))
        .catch(error => {
            process.stderr.write(`${JSON.stringify({ ok: false, code: error.code || 'ERROR', error: error.message })}\n`);
            process.exitCode = 1;
        });
}
