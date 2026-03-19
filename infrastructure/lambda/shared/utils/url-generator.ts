/**
 * URL Generation Utilities
 *
 * Centralized URL generation for CDN and signed URLs
 * Prevents hardcoded S3 URLs and ensures CloudFront usage
 */

/**
 * Generate public CDN URL for static content
 * Uses CloudFront distribution
 */
export function generateCdnUrl(key: string): string {
  const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN;

  if (!CLOUDFRONT_DOMAIN) {
    throw new Error(
      'CLOUDFRONT_DOMAIN environment variable is required for URL generation'
    );
  }

  // Remove leading slash if present
  const normalizedKey = key.startsWith('/') ? key.slice(1) : key;

  return `https://${CLOUDFRONT_DOMAIN}/${normalizedKey}`;
}

/**
 * Generate signed URL for protected content
 * Note: Requires cloudfront-signer.ts implementation (Phase 1.1)
 *
 * @param key - S3 object key
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 */
export async function generateProtectedUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  // TODO: Implement after cloudfront-signer.ts is created (Phase 1.1)
  // For now, return CDN URL (unsigned)
  console.warn(
    '[URL Generator] CloudFront signed URLs not yet implemented. Returning unsigned CDN URL.'
  );
  return generateCdnUrl(key);

  // Future implementation:
  // const { generateSignedUrl } = await import('./cloudfront-signer');
  // return generateSignedUrl(key, expiresIn);
}

/**
 * Generate recording URL (signed)
 * Used for video/audio playback
 */
export async function generateRecordingUrl(
  sessionId: string,
  expiresIn: number = 3600
): Promise<string> {
  const key = `recordings/${sessionId}.webm`;
  return generateProtectedUrl(key, expiresIn);
}

/**
 * Generate PDF report URL (signed, 2 hour expiration)
 * Used for report download
 */
export async function generateReportUrl(
  sessionId: string,
  expiresIn: number = 7200
): Promise<string> {
  const key = `reports/${sessionId}.pdf`;
  return generateProtectedUrl(key, expiresIn);
}

/**
 * Generate avatar image URL (public)
 * Used for avatar display
 */
export function generateAvatarUrl(avatarId: string, extension: string = 'png'): string {
  const key = `avatars/${avatarId}.${extension}`;
  return generateCdnUrl(key);
}

/**
 * Generate frame analysis URL (public or signed based on config)
 * Used for frame-by-frame analysis results
 */
export async function generateFrameUrl(
  sessionId: string,
  frameNumber: number,
  signed: boolean = false
): Promise<string> {
  const key = `frames/${sessionId}/frame-${frameNumber}.jpg`;

  if (signed) {
    return generateProtectedUrl(key, 3600);
  }

  return generateCdnUrl(key);
}

/**
 * Parse S3 URL and extract key
 * Useful for migrating from S3 direct URLs to CDN URLs
 *
 * @param s3Url - S3 URL (https://bucket.s3.amazonaws.com/key or https://bucket.s3.region.amazonaws.com/key)
 * @returns S3 key
 */
export function extractS3Key(s3Url: string): string {
  try {
    const url = new URL(s3Url);

    // Pattern 1: https://bucket.s3.amazonaws.com/key
    // Pattern 2: https://bucket.s3.region.amazonaws.com/key
    if (url.hostname.includes('.s3.')) {
      return url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
    }

    throw new Error('Invalid S3 URL format');
  } catch (error) {
    throw new Error(`Failed to extract S3 key from URL: ${s3Url}`);
  }
}

/**
 * Convert S3 direct URL to CDN URL
 * Migration helper
 */
export function migrateS3UrlToCdn(s3Url: string): string {
  const key = extractS3Key(s3Url);
  return generateCdnUrl(key);
}
