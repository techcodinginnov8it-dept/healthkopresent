/**
 * Doctor Digital Signature & Clinical E-Sign PDF Helper
 *
 * Automatically retrieves the active clinical e-signature created by the physician
 * in Settings ("Doctor Digital Signature & Clinical E-Sign") and converts it into
 * a transparent-aware PDF Image XObject pair (RGB color + grayscale SMask alpha)
 * for seamless, legitimate-looking digital signature embedding on clinical documents.
 *
 * The SMask approach ensures the signature ink renders directly on the document
 * paper without any white/opaque bounding box.
 */

export interface PdfSignatureImage {
  /** ASCIIHex-encoded JPEG stream for the RGB color XObject */
  hexStream: string;
  length: number;
  width: number;
  height: number;
  /** ASCIIHex-encoded raw grayscale bytes for the SMask alpha XObject */
  maskHexStream?: string;
  maskLength?: number;
}

/**
 * Retrieve the active clinical e-signature dataUrl from browser localStorage.
 * Checks doctor-specific key first, then global active key, then any saved signature.
 */
export function getStoredDoctorSignature(doctorId?: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    if (doctorId) {
      const byId = localStorage.getItem(`healthko_doctor_signature_${doctorId}`);
      if (byId && byId.startsWith("data:image/")) return byId;
    }
    const active = localStorage.getItem("healthko_doctor_signature_active");
    if (active && active.startsWith("data:image/")) return active;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("healthko_doctor_signature_") && !key.includes("meta")) {
        const val = localStorage.getItem(key);
        if (val && val.startsWith("data:image/")) return val;
      }
    }
  } catch {
    // Ignore storage exceptions
  }
  return null;
}

/**
 * Converts any image dataUrl (drawn canvas PNG, uploaded JPEG/PNG/WebP) to a PDF-ready
 * signature image pair:
 *   - RGB color JPEG (ASCIIHex for DCTDecode) — the visible ink
 *   - Grayscale alpha SMask (raw ASCIIHex) — transparency mask
 *
 * The alpha channel is inverted: white paper areas become transparent (mask = 0x00),
 * dark ink areas become fully opaque (mask = 0xFF). This eliminates the white box.
 */
export async function prepareSignatureForPdf(
  dataUrl?: string | null,
  targetWidth = 320,
  targetHeight = 90
): Promise<PdfSignatureImage | null> {
  if (!dataUrl || typeof window === "undefined") return null;

  return new Promise((resolve) => {
    // Safety timeout — if Image never fires onload (e.g. browser CORS/data-URL quirks),
    // resolve with null after 3 s so the PDF download is never silently blocked.
    const timeoutId = setTimeout(() => {
      console.warn("prepareSignatureForPdf: timed out waiting for image load — skipping signature.");
      resolve(null);
    }, 3000);

    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        clearTimeout(timeoutId);
        try {
          const natW = img.naturalWidth || 320;
          const natH = img.naturalHeight || 90;
          const aspect = natW / (natH || 1);

          let w = targetWidth;
          let h = Math.round(targetWidth / aspect);
          if (h > targetHeight * 1.5) {
            h = targetHeight;
            w = Math.round(targetHeight * aspect);
          }

          const canvasW = Math.max(120, Math.min(600, w));
          const canvasH = Math.max(40, Math.min(300, h));

          // ── Draw signature on transparent canvas ──────────────────────────
          const canvas = document.createElement("canvas");
          canvas.width = canvasW;
          canvas.height = canvasH;
          const ctx = canvas.getContext("2d");
          if (!ctx) { resolve(null); return; }

          // NO white fill — keep background transparent for mask extraction
          ctx.clearRect(0, 0, canvasW, canvasH);
          ctx.drawImage(img, 0, 0, canvasW, canvasH);

          // ── Extract RGBA pixel data ───────────────────────────────────────
          const imageData = ctx.getImageData(0, 0, canvasW, canvasH);
          const pixels = imageData.data; // [R,G,B,A, R,G,B,A, ...]

          // ── Build grayscale alpha mask (SMask) ────────────────────────────
          // SMask value = how opaque that pixel is in the final composite.
          // Dark ink pixels → mask near 255 (opaque); white/transparent areas → mask near 0 (invisible).
          let maskHex = "";
          for (let i = 0; i < pixels.length; i += 4) {
            const a = pixels[i + 3]; // alpha channel (0 = transparent, 255 = opaque)
            let maskVal: number;
            if (a < 10) {
              // Fully transparent pixel — paper area, invisible
              maskVal = 0;
            } else {
              const r = pixels[i];
              const g = pixels[i + 1];
              const b = pixels[i + 2];
              // Luminosity: bright = paper area → low opacity; dark = ink → high opacity
              const lum = 0.299 * r + 0.587 * g + 0.114 * b;
              // Invert: white (lum=255) → mask=0; black (lum=0) → mask=255
              // Blend with actual alpha for semi-transparent canvas strokes
              const inkOpacity = Math.round(((255 - lum) / 255) * (a / 255) * 255);
              maskVal = Math.min(255, Math.max(0, inkOpacity));
            }
            maskHex += maskVal.toString(16).padStart(2, "0").toUpperCase();
          }
          maskHex += ">\n";

          // ── Build RGB JPEG color stream (renders ink colors faithfully) ───
          // Composite on white for JPEG encoding (JPEG has no alpha channel)
          const jpegCanvas = document.createElement("canvas");
          jpegCanvas.width = canvasW;
          jpegCanvas.height = canvasH;
          const jpegCtx = jpegCanvas.getContext("2d");
          if (!jpegCtx) { resolve(null); return; }
          jpegCtx.fillStyle = "#ffffff";
          jpegCtx.fillRect(0, 0, canvasW, canvasH);
          jpegCtx.drawImage(canvas, 0, 0);

          const jpegUrl = jpegCanvas.toDataURL("image/jpeg", 0.95);
          const base64 = jpegUrl.split(",")[1];
          if (!base64) { resolve(null); return; }

          const binary = atob(base64);
          let hex = "";
          for (let i = 0; i < binary.length; i++) {
            hex += binary.charCodeAt(i).toString(16).padStart(2, "0").toUpperCase();
          }
          const hexStream = hex + ">\n";

          resolve({
            hexStream,
            length: hexStream.length,
            width: canvasW,
            height: canvasH,
            maskHexStream: maskHex,
            maskLength: maskHex.length,
          });
        } catch (err) {
          clearTimeout(timeoutId);
          console.warn("Failed to process signature for PDF:", err);
          resolve(null);
        }
      };
      img.onerror = () => { clearTimeout(timeoutId); resolve(null); };
      img.src = dataUrl;
    } catch {
      clearTimeout(timeoutId);
      resolve(null);
    }
  });
}
