const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env');

try {
    // Try reading as UTF-16LE first (common for PowerShell output)
    let content = fs.readFileSync(envPath, 'utf16le');

    // Check if it looks like valid env content
    if (!content.includes('VITE_SUPABASE_URL')) {
        // Fallback to UTF-8 if it wasn't UTF-16
        content = fs.readFileSync(envPath, 'utf8');
    }

    // Clean up the content
    // Remove BOM if present
    content = content.replace(/^\uFEFF/, '');

    // Fix potential corruption (null bytes, etc)
    content = content.replace(/\0/g, '');

    console.log('Original content length:', content.length);
    console.log('Content preview:', content.substring(0, 100));

    // Write back as UTF-8
    fs.writeFileSync(envPath, content, 'utf8');
    console.log('Successfully converted .env to UTF-8');
} catch (err) {
    console.error('Error fixing .env:', err);
}
