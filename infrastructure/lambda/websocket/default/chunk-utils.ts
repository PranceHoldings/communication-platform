/**
 * Chunk Utilities
 * Common functions for sorting and processing audio/video chunks
 */

/**
 * S3 Object interface (minimal subset for chunk operations)
 * Replaces deprecated _Object type from AWS SDK v3
 */
export interface S3Object {
  Key?: string;
  LastModified?: Date;
  Size?: number;
  ETag?: string;
}

/**
 * Sort S3 objects by timestamp and chunk number extracted from filename
 *
 * Expected filename format: {timestamp}-{chunkNumber}.{extension}
 * Example: 1772952987123-5.webm
 *
 * @param chunks - Array of S3 objects to sort
 * @returns Sorted array by timestamp (ascending), then by chunk number (ascending)
 *
 * @example
 * const chunks = [
 *   { Key: 'sessions/xxx/realtime-chunks/1772952987123-10.webm' },
 *   { Key: 'sessions/xxx/realtime-chunks/1772952987123-2.webm' },
 *   { Key: 'sessions/xxx/realtime-chunks/1772952987123-1.webm' },
 * ];
 * const sorted = sortChunksByTimestampAndIndex(chunks);
 * // Result: [...-1.webm, ...-2.webm, ...-10.webm]
 */
export function sortChunksByTimestampAndIndex(chunks: S3Object[]): S3Object[] {
  return chunks.sort((a, b) => {
    const aKey = a.Key || '';
    const bKey = b.Key || '';

    // Extract timestamp and chunk number from filename
    // Pattern: {timestamp}-{chunkNumber}.{extension}
    const aMatch = aKey.match(/(\d+)-(\d+)\.\w+$/);
    const bMatch = bKey.match(/(\d+)-(\d+)\.\w+$/);

    if (!aMatch || !bMatch) {
      // Fallback to lexicographic comparison if pattern doesn't match
      console.warn('[sortChunksByTimestampAndIndex] Filename pattern mismatch:', {
        aKey,
        bKey,
      });
      return aKey.localeCompare(bKey);
    }

    const aTimestamp = parseInt(aMatch[1], 10);
    const bTimestamp = parseInt(bMatch[1], 10);
    const aChunkNum = parseInt(aMatch[2], 10);
    const bChunkNum = parseInt(bMatch[2], 10);

    // Sort by timestamp first (ascending), then by chunk number (ascending)
    if (aTimestamp !== bTimestamp) {
      return aTimestamp - bTimestamp;
    }
    return aChunkNum - bChunkNum;
  });
}

/**
 * Validate chunk order to detect missing or duplicate chunks
 *
 * @param chunks - Sorted array of S3 objects
 * @returns Validation result with details
 */
export function validateChunkOrder(chunks: S3Object[]): {
  isValid: boolean;
  missingChunks: number[];
  duplicateChunks: number[];
  totalChunks: number;
} {
  const chunkNumbers = new Set<number>();
  const duplicates = new Set<number>();

  for (const chunk of chunks) {
    const match = chunk.Key?.match(/(\d+)-(\d+)\.\w+$/);
    if (match) {
      const chunkNum = parseInt(match[2], 10);
      if (chunkNumbers.has(chunkNum)) {
        duplicates.add(chunkNum);
      }
      chunkNumbers.add(chunkNum);
    }
  }

  // Check for missing chunks (assuming chunks start from 1)
  const sortedNumbers = Array.from(chunkNumbers).sort((a, b) => a - b);
  const missing: number[] = [];

  if (sortedNumbers.length > 0) {
    const minChunk = sortedNumbers[0];
    const maxChunk = sortedNumbers[sortedNumbers.length - 1];

    for (let i = minChunk; i <= maxChunk; i++) {
      if (!chunkNumbers.has(i)) {
        missing.push(i);
      }
    }
  }

  return {
    isValid: missing.length === 0 && duplicates.size === 0,
    missingChunks: missing,
    duplicateChunks: Array.from(duplicates),
    totalChunks: chunks.length,
  };
}

/**
 * Log sorted chunks for debugging (first N items)
 *
 * @param chunks - Sorted array of S3 objects
 * @param context - Context label (e.g., 'audio', 'video')
 * @param count - Number of items to log (default: 5)
 */
export function logSortedChunks(chunks: S3Object[], context: string, count: number = 5): void {
  const preview = chunks.slice(0, count).map(c => c.Key?.split('/').pop() || 'unknown');

  console.log(`[${context}] Sorted chunks (first ${count}):`, preview);

  // Log validation result
  const validation = validateChunkOrder(chunks);
  if (!validation.isValid) {
    console.warn(`[${context}] Chunk order validation failed:`, {
      missingChunks: validation.missingChunks,
      duplicateChunks: validation.duplicateChunks,
      totalChunks: validation.totalChunks,
    });
  } else {
    console.log(`[${context}] Chunk order validation passed: ${validation.totalChunks} chunks`);
  }
}

/**
 * Generate S3 key for chunk storage
 *
 * Generates a consistent filename format for audio/video chunks:
 * sessions/{sessionId}/{chunkType}-chunks/{timestamp}-{chunkNumber}.{extension}
 *
 * @param sessionId - Session ID
 * @param chunkType - Type of chunk ('audio' or 'video')
 * @param timestamp - Timestamp in milliseconds
 * @param chunkNumber - Sequential chunk number (starts from 1)
 * @param extension - File extension (e.g., 'webm', 'wav')
 * @returns S3 key path
 *
 * @example
 * generateChunkKey('abc123', 'audio', 1772952987123, 5, 'webm')
 * // Returns: 'sessions/abc123/realtime-chunks/1772952987123-5.webm'
 */
export function generateChunkKey(
  sessionId: string,
  chunkType: 'audio' | 'video',
  timestamp: number,
  chunkNumber: number,
  extension: string
): string {
  return `sessions/${sessionId}/${chunkType}-chunks/${timestamp}-${chunkNumber}.${extension}`;
}

/**
 * Parse chunk key to extract metadata
 *
 * @param chunkKey - S3 key path
 * @returns Parsed metadata or null if format doesn't match
 *
 * @example
 * parseChunkKey('sessions/abc123/realtime-chunks/1772952987123-5.webm')
 * // Returns: { sessionId: 'abc123', chunkType: 'audio', timestamp: 1772952987123, chunkNumber: 5, extension: 'webm' }
 */
export function parseChunkKey(chunkKey: string): {
  sessionId: string;
  chunkType: 'audio' | 'video';
  timestamp: number;
  chunkNumber: number;
  extension: string;
} | null {
  const match = chunkKey.match(/^sessions\/([^\/]+)\/(audio|video)-chunks\/(\d+)-(\d+)\.(\w+)$/);
  if (!match) return null;

  return {
    sessionId: match[1],
    chunkType: match[2] as 'audio' | 'video',
    timestamp: parseInt(match[3], 10),
    chunkNumber: parseInt(match[4], 10),
    extension: match[5],
  };
}

/**
 * Download and combine S3 chunks
 *
 * Downloads multiple chunks from S3, sorts them, and combines into a single buffer.
 * This function replaces duplicated download logic in speech_end and session_end handlers.
 *
 * @param s3Client - S3 client instance
 * @param bucket - S3 bucket name
 * @param prefix - S3 key prefix for chunks (e.g., 'sessions/{id}/realtime-chunks/')
 * @param sortFn - Optional sort function (defaults to sortChunksByTimestampAndIndex)
 * @returns Combined buffer with metadata and individual buffers
 *
 * @example
 * const result = await downloadAndCombineChunks(
 *   s3Client,
 *   'my-bucket',
 *   'sessions/abc123/realtime-chunks/'
 * );
 * console.log(result.chunkCount, result.totalSize);
 * // Use result.buffers for WebM chunk processing (convertMultipleWebMChunksToWav)
 * // Use result.combinedBuffer for direct audio processing
 */
export async function downloadAndCombineChunks(
  s3Client: any, // S3Client type
  bucket: string,
  prefix: string,
  sortFn?: (chunks: S3Object[]) => S3Object[]
): Promise<{
  combinedBuffer: Buffer;
  chunkCount: number;
  totalSize: number;
  chunkKeys: string[];
  buffers: Buffer[]; // Individual buffers before combining (for WebM processing)
}> {
  // 1. List S3 objects
  const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
  const listResponse = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
    })
  );

  if (!listResponse.Contents || listResponse.Contents.length === 0) {
    return {
      combinedBuffer: Buffer.alloc(0),
      chunkCount: 0,
      totalSize: 0,
      chunkKeys: [],
      buffers: [],
    };
  }

  // 2. Sort chunks (use provided sort function or default)
  const sortedChunks = sortFn
    ? sortFn(listResponse.Contents)
    : sortChunksByTimestampAndIndex(listResponse.Contents);

  console.log(`[downloadAndCombineChunks] Found ${sortedChunks.length} chunks in S3:`, prefix);

  // 3. Download all chunks in parallel (max 5 concurrent)
  const { GetObjectCommand } = await import('@aws-sdk/client-s3');
  const chunkKeys: string[] = [];
  const buffers: Buffer[] = [];

  // Process in batches to avoid overwhelming S3
  const BATCH_SIZE = 5;
  for (let i = 0; i < sortedChunks.length; i += BATCH_SIZE) {
    const batch = sortedChunks.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (chunk) => {
      if (!chunk.Key) return null;

      try {
        const getResponse = await s3Client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: chunk.Key,
          })
        );

        if (getResponse.Body) {
          const buffer = await getResponse.Body.transformToByteArray();
          return {
            key: chunk.Key,
            buffer: Buffer.from(buffer),
          };
        }
      } catch (error) {
        console.warn(`[downloadAndCombineChunks] Failed to download chunk ${chunk.Key}:`, error);
        return null;
      }

      return null;
    });

    const results = await Promise.all(promises);

    for (const result of results) {
      if (result) {
        chunkKeys.push(result.key);
        buffers.push(result.buffer);
        console.log(`[downloadAndCombineChunks] Downloaded ${result.key}: ${result.buffer.length} bytes`);
      }
    }
  }

  // 4. Combine buffers
  const combined = Buffer.concat(buffers);

  console.log('[downloadAndCombineChunks] Complete:', {
    prefix,
    chunkCount: buffers.length,
    totalSize: combined.length,
  });

  return {
    combinedBuffer: combined,
    chunkCount: buffers.length,
    totalSize: combined.length,
    chunkKeys,
    buffers, // Return individual buffers for WebM chunk processing
  };
}

/**
 * Clean up S3 chunks after processing
 *
 * Deletes multiple chunks from S3 in parallel batches.
 * Used after audio/video processing is complete to free storage.
 *
 * @param s3Client - S3 client instance
 * @param bucket - S3 bucket name
 * @param chunkKeys - Array of S3 keys to delete
 *
 * @example
 * await cleanupChunks(s3Client, 'my-bucket', [
 *   'sessions/abc123/realtime-chunks/chunk-000000.webm',
 *   'sessions/abc123/realtime-chunks/chunk-000001.webm'
 * ]);
 */
export async function cleanupChunks(
  s3Client: any, // S3Client type
  bucket: string,
  chunkKeys: string[]
): Promise<void> {
  if (chunkKeys.length === 0) {
    console.log('[cleanupChunks] No chunks to delete');
    return;
  }

  const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');

  console.log(`[cleanupChunks] Deleting ${chunkKeys.length} chunks...`);

  // Delete in parallel (max 10 concurrent)
  const BATCH_SIZE = 10;
  for (let i = 0; i < chunkKeys.length; i += BATCH_SIZE) {
    const batch = chunkKeys.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (key) => {
      try {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: key,
          })
        );
        console.log(`[cleanupChunks] Deleted: ${key}`);
      } catch (error) {
        console.warn(`[cleanupChunks] Failed to delete chunk ${key}:`, error);
      }
    });

    await Promise.all(promises);
  }

  console.log('[cleanupChunks] Complete');
}
