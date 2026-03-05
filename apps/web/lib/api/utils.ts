/**
 * API utility functions
 */

/**
 * Build query string from params object
 * Automatically filters out undefined/null values
 *
 * @example
 * buildQueryString({ limit: 20, offset: 0, category: 'test' })
 * // Returns: "?limit=20&offset=0&category=test"
 *
 * buildQueryString({ limit: 20, category: undefined })
 * // Returns: "?limit=20"
 *
 * buildQueryString({})
 * // Returns: ""
 */
export function buildQueryString(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return '';

  const queryParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    // Skip undefined and null values
    if (value !== undefined && value !== null) {
      queryParams.set(key, String(value));
    }
  });

  const queryString = queryParams.toString();
  return queryString ? `?${queryString}` : '';
}
