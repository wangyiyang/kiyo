export async function getSignedUrl(
  bucket: 'audio' | 'covers',
  path: string,
): Promise<{ signedUrl: string; expiresAt: string }> {
  const res = await fetch('/api/storage/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket, path }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || 'Failed to sign URL')
  }
  return res.json()
}
