import { createHash } from 'crypto';
import { supabase } from '../supabaseClient.js';
import { enqueueImageCaptureRequest } from './captureRequestService.js';

export const IMAGE_CAPTURE_BUCKET = process.env.CAPTURE_IMAGE_BUCKET || 'collection_capture_uploads';
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

const IMAGE_TYPES = {
    'image/jpeg': {
        extension: 'jpg',
        matches: (buffer) => buffer.length >= 3
            && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    },
    'image/png': {
        extension: 'png',
        matches: (buffer) => buffer.length >= 8
            && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    },
    'image/webp': {
        extension: 'webp',
        matches: (buffer) => buffer.length >= 12
            && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
            && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    },
    'image/gif': {
        extension: 'gif',
        matches: (buffer) => buffer.length >= 6
            && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))
    }
};

function imageCaptureError(message, statusCode = 400, code = 'INVALID_IMAGE_UPLOAD') {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.code = code;
    return error;
}

export function decodeUploadFilename(value) {
    if (typeof value !== 'string' || !value.trim()) return 'uploaded-image';
    let decoded = value;
    try {
        decoded = decodeURIComponent(value);
    } catch {
        // Keep the original header value when it is not URI encoded.
    }
    return decoded
        .normalize('NFKC')
        .replace(/[\u0000-\u001f\u007f/\\]/g, '_')
        .trim()
        .slice(0, 180) || 'uploaded-image';
}

export function validateImageUpload(buffer, contentType, originalFilename) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw imageCaptureError('image body is required');
    }
    if (buffer.length > MAX_IMAGE_BYTES) {
        throw imageCaptureError('image must be 15 MB or smaller', 413, 'IMAGE_TOO_LARGE');
    }

    const normalizedType = String(contentType || '').split(';')[0].trim().toLowerCase();
    const definition = IMAGE_TYPES[normalizedType];
    if (!definition || !definition.matches(buffer)) {
        throw imageCaptureError('image must be a valid JPEG, PNG, WebP, or GIF file');
    }

    return {
        contentType: normalizedType,
        extension: definition.extension,
        originalFilename: decodeUploadFilename(originalFilename),
        sizeBytes: buffer.length
    };
}

function isDuplicateStorageObject(error) {
    return Number(error?.statusCode || error?.status) === 409
        || /already exists|duplicate/i.test(error?.message || '');
}

export async function uploadAndEnqueueImageCapture(input, supabaseClient = supabase) {
    const image = validateImageUpload(input.buffer, input.contentType, input.originalFilename);
    const objectKey = createHash('sha256')
        .update(`${input.userId}:${input.idempotencyKey}`)
        .digest('hex');
    const storagePath = `${input.userId}/captures/${objectKey}.${image.extension}`;

    const storage = supabaseClient.storage.from(IMAGE_CAPTURE_BUCKET);
    const { error: uploadError } = await storage.upload(storagePath, input.buffer, {
            contentType: image.contentType,
            cacheControl: '3600',
            upsert: false
    });

    if (uploadError && !isDuplicateStorageObject(uploadError)) {
        throw imageCaptureError(`Image storage failed: ${uploadError.message}`, 503, 'IMAGE_STORAGE_FAILED');
    }

    try {
        return await enqueueImageCaptureRequest({
            userId: input.userId,
            storageBucket: IMAGE_CAPTURE_BUCKET,
            storagePath,
            contentType: image.contentType,
            sizeBytes: image.sizeBytes,
            originalFilename: image.originalFilename,
            correlationId: input.correlationId,
            idempotencyKey: input.idempotencyKey,
            priority: input.priority,
            requestMeta: input.requestMeta
        }, supabaseClient);
    } catch (error) {
        // A conflict means an earlier retry owns this object. Only remove an
        // object that this call created, never an existing idempotent upload.
        if (!uploadError && typeof storage.remove === 'function') {
            try {
                const { error: cleanupError } = await storage.remove([storagePath]);
                if (cleanupError) console.warn('[Image capture] Failed to clean up an orphaned upload');
            } catch {
                console.warn('[Image capture] Failed to clean up an orphaned upload');
            }
        }
        throw error;
    }
}
