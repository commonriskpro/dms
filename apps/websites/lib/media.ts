/**
 * Builds the public photo URL for vehicle images.
 * Use same-origin /api/photo/[fileId] so the browser does not expose the dealer origin.
 * The /api/photo route proxies to the dealer and redirects to the signed URL.
 */
export function getPhotoSrc(fileId: string): string {
  return `/api/photo/${encodeURIComponent(fileId)}`;
}
