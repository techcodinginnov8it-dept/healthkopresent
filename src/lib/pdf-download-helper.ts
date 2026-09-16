/**
 * HealthKo PDF Download Utility
 *
 * Provides a reliable PDF download trigger that works across Chrome, Safari, and Firefox.
 *
 * Two root causes of broken downloads in Chromium/React:
 * 1. `.click()` on a dynamically created anchor can be intercepted by React's synthetic
 *    event system, causing Chrome to ignore the `download` attribute and fall back to
 *    the blob UUID as the filename.
 * 2. Creating a `Blob` from a JS string uses UTF-16 encoding internally, which corrupts
 *    PDF binary bytes. PDFs must be encoded as latin-1 (1 byte per char, code-point & 0xFF).
 */

/**
 * Convert a PDF string (ISO-8859-1 byte values) to an ArrayBuffer correctly.
 * This avoids UTF-16 / UTF-8 corruption that occurs when passing a raw JS string to Blob.
 * Returns an ArrayBuffer (not Uint8Array) to satisfy strict TypeScript BlobPart typing.
 */
export function pdfStringToBytes(pdfString: string): ArrayBuffer {
  const bytes = new Uint8Array(pdfString.length);
  for (let i = 0; i < pdfString.length; i++) {
    bytes[i] = pdfString.charCodeAt(i) & 0xff;
  }
  return bytes.buffer as ArrayBuffer;
}

/**
 * Reliably trigger a file download in the browser.
 *
 * Uses `MouseEvent` dispatch instead of `.click()` to bypass React's synthetic event
 * system, ensuring Chrome picks up the `download` attribute for the filename.
 * The blob URL is revoked after a 2-second delay so the browser has time to start the download.
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.style.position = "fixed";
  link.style.top = "-9999px";
  link.style.left = "-9999px";
  link.href = url;
  link.download = filename;

  document.body.appendChild(link);

  // Use native MouseEvent dispatch — this is what Chrome actually listens to for
  // the `download` attribute. React's synthetic `.click()` can be silently swallowed.
  link.dispatchEvent(
    new MouseEvent("click", {
      bubbles: false,
      cancelable: true,
      view: window,
    })
  );

  // Small delay before cleanup so Chrome has time to queue the download
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 2000);
}
