/**
 * Fetch a remote asset and return it as a base64 `data:` URL, suitable
 * for inlining into archival HTML.
 *
 * @throws if the fetch fails or returns a non-OK status.
 */
export async function fetchAndInlineAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch asset: ${url} (${response.status})`);
  const blob = await response.blob();
  return await blobToDataUrl(blob);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
