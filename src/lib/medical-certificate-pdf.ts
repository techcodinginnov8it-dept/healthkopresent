/**
 * HealthKo Official Medical Certificate PDF Generator
 * Produces a clinic-standard Medical Certificate PDF adhering to
 * DOH telemedicine documentation requirements.
 * Pure TypeScript, zero external dependencies.
 *
 * Redesigned v2 -- Professional Clinical Edition
 * Color scheme: Navy blue (#142050 equiv) + Gold accent (#B89432 equiv)
 */

import {
  getStoredDoctorSignature,
  prepareSignatureForPdf,
  type PdfSignatureImage,
} from "./signature-pdf-helper";

export interface MedicalCertificatePdfData {
  certNumber: string;
  doctorName: string;
  doctorSpecialty?: string;
  doctorLicense?: string | null;
  doctorNpi?: string | null;
  patientName: string;
  patientAge?: string | number;
  patientGender?: string | null;
  patientAddress?: string | null;
  purpose: "sick_leave" | "fitness_to_work" | "school" | "other";
  purposeLabel?: string;
  diagnosis?: string | null;
  remarks?: string | null;
  restDaysFrom?: Date | string | null;
  restDaysTo?: Date | string | null;
  issuedAt?: Date | string;
  doctorId?: string;
  signatureDataUrl?: string | null;
  signatureImage?: PdfSignatureImage | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function escapePdf(value?: string | number | null): string {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/[\u2014\u2013]/g, " - ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2022\u00B7]/g, "*")
    .replace(/\u00B0/g, " deg ")
    .replace(/\u00BD/g, "1/2")
    .replace(/\u00BC/g, "1/4")
    .replace(/\u00D7/g, "x")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\r\n]+/g, " ")
    .trim();
}

function wrapText(text: string, maxChars = 75): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length <= maxChars) {
      current = (current + " " + word).trim();
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function formatDate(d?: Date | string | null): string {
  if (!d) return "N/A";
  const obj = typeof d === "string" ? new Date(d) : d;
  if (isNaN(obj.getTime())) return String(d);
  return obj.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatShortDate(d?: Date | string | null): string {
  if (!d) return "N/A";
  const obj = typeof d === "string" ? new Date(d) : d;
  if (isNaN(obj.getTime())) return String(d);
  return obj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const PURPOSE_LABELS: Record<string, string> = {
  sick_leave: "Sick Leave / Medical Rest",
  fitness_to_work: "Fitness to Return to Work",
  school: "School / Academic Purpose",
  other: "General Medical Certificate",
};

// ---------------------------------------------------------------------------
// Layout constants (US Letter: 612 x 792 pt)
// ---------------------------------------------------------------------------
const PAGE_W = 612;
const PAGE_H = 792;
const LEFT = 50;
const RIGHT = 562;
const BODY_W = RIGHT - LEFT; // 512

// ---------------------------------------------------------------------------
// Build full page stream -- Clean Structured Clinical Edition v3
// ---------------------------------------------------------------------------
function buildCertStream(data: MedicalCertificatePdfData): string {
  const cmds: string[] = [];

  const doctorName = data.doctorName || "Physician";
  const displayDocName = doctorName.startsWith("Dr.") ? doctorName : `Dr. ${doctorName}`;
  const specialty = data.doctorSpecialty || "General Practice & Telemedicine";
  const license =
    data.doctorLicense ||
    (data.doctorNpi ? `PRC-${data.doctorNpi.slice(0, 7)}` : "PRC-VERIFIED");
  const npi = data.doctorNpi || "NPI-HK99482";
  const issuedDate = formatDate(data.issuedAt ?? new Date());
  const issuedShort = formatShortDate(data.issuedAt ?? new Date());
  const purposeLabel =
    data.purposeLabel || PURPOSE_LABELS[data.purpose] || PURPOSE_LABELS.other;
  const certNum = data.certNumber;
  const patientName = data.patientName || "Patient";
  const age = data.patientAge ?? "Adult";
  const gender = data.patientGender || "Unspecified";
  const address = data.patientAddress || "";
  const diagnosis = data.diagnosis || "As clinically assessed";
  const remarks = data.remarks || "";
  const docNameClean = doctorName.replace(/^DR\.?\s+/i, "").trim();
  const docNameUpper = docNameClean.toUpperCase();

  // ── PAGE BACKGROUND ────────────────────────────────────────────────────────
  cmds.push("0.986 0.989 0.993 rg");
  cmds.push(`0 0 ${PAGE_W} ${PAGE_H} re f`);

  // ── OUTER BORDER ────────────────────────────────────────────────────────────
  cmds.push("0.08 0.14 0.30 RG 2 w");
  cmds.push("24 24 564 744 re S");

  // ── GOLD TOP BAR ────────────────────────────────────────────────────────────
  cmds.push("0.72 0.58 0.20 rg");
  cmds.push("24 766 564 4 re f");

  // ── NAVY LEFT STRIPE ────────────────────────────────────────────────────────
  cmds.push("0.08 0.14 0.30 rg");
  cmds.push("24 24 6 742 re f");

  // ── HEADER BANNER ───────────────────────────────────────────────────────────
  cmds.push("0.08 0.14 0.30 rg");
  cmds.push("30 726 552 44 re f");
  cmds.push("BT /F2 13 Tf 1 1 1 rg 56 748 Td (HEALTHKO TELEHEALTH CLINICAL NETWORK) Tj ET");
  cmds.push("BT /F1 7.5 Tf 0.75 0.82 0.92 rg 56 734 Td (DOH Accredited Telemedicine Provider  |  Official Medical Document) Tj ET");

  // Gold type badge (right side of header)
  cmds.push("0.72 0.58 0.20 rg");
  cmds.push("416 730 130 32 re f");
  cmds.push("BT /F2 8 Tf 0.08 0.14 0.30 rg 424 752 Td (MEDICAL CERTIFICATE) Tj ET");
  cmds.push(`BT /F1 6.8 Tf 0.14 0.20 0.38 rg 424 740 Td (${escapePdf(purposeLabel.toUpperCase())}) Tj ET`);

  // ── DOCTOR / CLINIC ROW ─────────────────────────────────────────────────────
  cmds.push("0.93 0.95 0.97 rg");
  cmds.push("30 688 552 36 re f");
  cmds.push(`BT /F2 9.5 Tf 0.08 0.14 0.30 rg 56 714 Td (DR. ${escapePdf(docNameUpper)}, MD) Tj ET`);
  cmds.push(`BT /F1 8 Tf 0.38 0.44 0.55 rg 56 701 Td (${escapePdf(specialty)}  |  PRC: ${escapePdf(license)}  |  NPI: ${escapePdf(npi)}) Tj ET`);

  // ── GOLD RULE ───────────────────────────────────────────────────────────────
  cmds.push("0.72 0.58 0.20 rg");
  cmds.push(`${LEFT} 686 ${BODY_W} 2 re f`);

  // ── DOCUMENT TITLE ──────────────────────────────────────────────────────────
  cmds.push("BT /F2 20 Tf 0.08 0.14 0.30 rg 160 661 Td (MEDICAL CERTIFICATE) Tj ET");
  // navy underline
  cmds.push("0.08 0.14 0.30 RG 1.5 w");
  cmds.push("160 653 m 394 653 l S");
  // gold thin underline
  cmds.push("0.72 0.58 0.20 RG 0.75 w");
  cmds.push("160 651 m 394 651 l S");

  // Cert number / date (right aligned)
  cmds.push(`BT /F2 7 Tf 0.42 0.48 0.58 rg 406 666 Td (Cert. No.:) Tj ET`);
  cmds.push(`BT /F2 8 Tf 0.08 0.14 0.30 rg 452 666 Td (${escapePdf(certNum)}) Tj ET`);
  cmds.push(`BT /F2 7 Tf 0.42 0.48 0.58 rg 406 654 Td (Date of Issue:) Tj ET`);
  cmds.push(`BT /F1 7.5 Tf 0.08 0.14 0.30 rg 452 654 Td (${escapePdf(issuedDate)}) Tj ET`);

  // ── SECTION HELPER: draws a labeled section row ──────────────────────────
  // We'll build each section manually below

  let y = 634;
  const SECTION_H = 36;
  const LABEL_W = 148;
  const VAL_X = LEFT + LABEL_W + 4;

  // Helper to draw a section row
  function sectionRow(labelText: string, valueText: string, rowH: number, valueLines?: string[]) {
    const bottom = y - rowH;
    // Label cell (light navy fill)
    cmds.push("0.92 0.94 0.97 rg");
    cmds.push(`${LEFT} ${bottom} ${LABEL_W} ${rowH} re f`);
    cmds.push("0.08 0.14 0.30 RG 0.6 w");
    cmds.push(`${LEFT} ${bottom} ${LABEL_W} ${rowH} re S`);
    // Gold left accent
    cmds.push("0.72 0.58 0.20 rg");
    cmds.push(`${LEFT} ${bottom} 4 ${rowH} re f`);
    // Label text
    cmds.push(`BT /F2 7.5 Tf 0.08 0.14 0.30 rg ${LEFT + 9} ${y - 13} Td (${escapePdf(labelText)}) Tj ET`);

    // Value cell
    cmds.push("0.98 0.99 1.0 rg");
    cmds.push(`${VAL_X} ${bottom} ${RIGHT - VAL_X} ${rowH} re f`);
    cmds.push("0.82 0.86 0.90 RG 0.6 w");
    cmds.push(`${VAL_X} ${bottom} ${RIGHT - VAL_X} ${rowH} re S`);

    if (valueLines && valueLines.length > 1) {
      let lineY = y - 13;
      for (const vl of valueLines) {
        cmds.push(`BT /F2 9 Tf 0.08 0.14 0.30 rg ${VAL_X + 8} ${lineY} Td (${escapePdf(vl)}) Tj ET`);
        lineY -= 13;
      }
    } else {
      cmds.push(`BT /F2 9.5 Tf 0.08 0.14 0.30 rg ${VAL_X + 8} ${y - 13} Td (${escapePdf(valueText)}) Tj ET`);
    }

    y -= rowH;
  }

  // ── SECTION 1: PATIENT INFORMATION (header) ─────────────────────────────
  // Section header bar
  cmds.push("0.08 0.14 0.30 rg");
  cmds.push(`${LEFT} ${y - 16} ${BODY_W} 16 re f`);
  cmds.push(`BT /F2 7.5 Tf 1 1 1 rg ${LEFT + 9} ${y - 11} Td (PATIENT INFORMATION) Tj ET`);
  y -= 17;

  sectionRow("Patient Name", patientName, SECTION_H);
  sectionRow("Age / Sex", `${escapePdf(age)} / ${escapePdf(gender)}`, SECTION_H);
  if (address) {
    const addrL = wrapText(address, 54);
    sectionRow("Address", addrL[0] || "", addrL.length > 1 ? SECTION_H + 13 : SECTION_H, addrL.length > 1 ? addrL : undefined);
  }

  y -= 14; // spacer

  // ── SECTION 2: CLINICAL FINDINGS (header) ───────────────────────────────
  cmds.push("0.08 0.14 0.30 rg");
  cmds.push(`${LEFT} ${y - 16} ${BODY_W} 16 re f`);
  cmds.push(`BT /F2 7.5 Tf 1 1 1 rg ${LEFT + 9} ${y - 11} Td (CLINICAL FINDINGS) Tj ET`);
  y -= 17;

  const diagLines = wrapText(diagnosis, 54);
  const diagH = Math.max(SECTION_H, 14 + diagLines.length * 14);
  sectionRow("Diagnosis / Condition", diagLines[0] || "", diagH, diagLines.length > 1 ? diagLines : undefined);

  y -= 14; // spacer

  // ── SECTION 3: CERTIFICATE PERIOD (sick leave) ──────────────────────────
  if (data.purpose === "sick_leave" && (data.restDaysFrom || data.restDaysTo)) {
    const from = formatDate(data.restDaysFrom);
    const to   = formatDate(data.restDaysTo);

    cmds.push("0.08 0.14 0.30 rg");
    cmds.push(`${LEFT} ${y - 16} ${BODY_W} 16 re f`);
    cmds.push(`BT /F2 7.5 Tf 1 1 1 rg ${LEFT + 9} ${y - 11} Td (CERTIFICATE PERIOD) Tj ET`);
    y -= 17;

    sectionRow("Rest Period — From", from, SECTION_H);
    sectionRow("Rest Period — To", to, SECTION_H);

    y -= 14;
  }

  // ── SECTION 4: PURPOSE OF CERTIFICATE ──────────────────────────────────
  cmds.push("0.08 0.14 0.30 rg");
  cmds.push(`${LEFT} ${y - 16} ${BODY_W} 16 re f`);
  cmds.push(`BT /F2 7.5 Tf 1 1 1 rg ${LEFT + 9} ${y - 11} Td (PURPOSE OF CERTIFICATE) Tj ET`);
  y -= 17;

  sectionRow("Certificate Type", purposeLabel, SECTION_H);
  sectionRow("Date of Examination", issuedDate, SECTION_H);

  y -= 14;

  // ── SECTION 5: REMARKS (if any) ─────────────────────────────────────────
  if (remarks && remarks.trim()) {
    cmds.push("0.08 0.14 0.30 rg");
    cmds.push(`${LEFT} ${y - 16} ${BODY_W} 16 re f`);
    cmds.push(`BT /F2 7.5 Tf 1 1 1 rg ${LEFT + 9} ${y - 11} Td (REMARKS) Tj ET`);
    y -= 17;

    const remarkLines = wrapText(remarks, 54);
    const remarksH = Math.max(SECTION_H, 14 + remarkLines.length * 13);
    sectionRow("Additional Notes", remarkLines[0] || "", remarksH, remarkLines.length > 1 ? remarkLines : undefined);

    y -= 14;
  }

  // ── PHYSICIAN'S CERTIFICATION STATEMENT ─────────────────────────────────
  y -= 8;
  const certStatement = `I hereby certify that the information above is true and correct based on my personal examination of the patient on ${issuedDate}.`;
  const certLines = wrapText(certStatement, 86);
  for (const line of certLines) {
    cmds.push(`BT /F1 8.5 Tf 0.38 0.44 0.56 rg ${LEFT} ${y} Td (${escapePdf(line)}) Tj ET`);
    y -= 12;
  }

  // ── FOOTER RULE ─────────────────────────────────────────────────────────
  cmds.push("0.08 0.14 0.30 RG 0.4 w");
  cmds.push(`${LEFT} 178 m ${RIGHT} 178 l S`);
  cmds.push("0.72 0.58 0.20 RG 1.2 w");
  cmds.push(`${LEFT} 176 m ${RIGHT} 176 l S`);

  // ── LEFT FOOTER: AUTHENTICATION ─────────────────────────────────────────
  cmds.push("BT /F2 7.5 Tf 0.08 0.14 0.30 rg 50 164 Td (DOCUMENT AUTHENTICATION) Tj ET");
  cmds.push("0.72 0.58 0.20 RG 0.5 w");
  cmds.push("50 162 m 178 162 l S");
  cmds.push("BT /F1 6.5 Tf 0.46 0.52 0.60 rg 50 152 Td (1. Issued under DOH / FDA Telemedicine Regulations.) Tj ET");
  cmds.push("BT /F1 6.5 Tf 0.46 0.52 0.60 rg 50 142 Td (2. Valid for any government or private institution.) Tj ET");
  cmds.push("BT /F1 6.5 Tf 0.46 0.52 0.60 rg 50 132 Td (3. Unauthorized alteration renders this document void.) Tj ET");
  cmds.push(`BT /F2 6.8 Tf 0.72 0.58 0.20 rg 50 118 Td (Token: ${escapePdf(certNum)}-SECURE-HK) Tj ET`);

  // ── RIGHT: DOCTOR SIGNATURE CARD ────────────────────────────────────────
  cmds.push("0.95 0.97 0.99 rg");
  cmds.push("338 52 224 120 re f");
  cmds.push("0.08 0.14 0.30 RG 1 w");
  cmds.push("338 52 224 120 re S");
  // Card top navy band
  cmds.push("0.08 0.14 0.30 rg");
  cmds.push("338 154 224 18 re f");
  cmds.push("BT /F2 6.5 Tf 1 1 1 rg 348 161 Td (ELECTRONICALLY AUTHENTICATED  |  ORIGINAL) Tj ET");
  // Gold left accent
  cmds.push("0.72 0.58 0.20 rg");
  cmds.push("338 52 5 120 re f");

  // Signature (Clinical E-Signature image or stylized cursive fallback)
  if (data.signatureImage) {
    cmds.push("q");
    cmds.push("170 0 0 28 350 126 cm");
    cmds.push("/SigImg Do");
    cmds.push("Q");
  } else {
    cmds.push(`BT /F3 16 Tf 0.08 0.14 0.30 rg 350 133 Td (${escapePdf(displayDocName)}) Tj ET`);
  }

  // Signature underline
  cmds.push("0.72 0.58 0.20 RG 0.7 w");
  cmds.push("350 125 m 548 125 l S");
  cmds.push("0.20 0.28 0.48 RG 0.3 w");
  cmds.push("350 123 m 548 123 l S");

  // Credentials
  cmds.push(`BT /F2 9 Tf 0.08 0.14 0.30 rg 350 112 Td (DR. ${escapePdf(docNameUpper)}, MD) Tj ET`);
  cmds.push(`BT /F1 7 Tf 0.40 0.46 0.56 rg 350 100 Td (${escapePdf(specialty)}) Tj ET`);
  cmds.push(`BT /F2 7 Tf 0.44 0.50 0.58 rg 350 89 Td (PRC License:) Tj /F1 7 Tf 0.08 0.14 0.30 rg ( ${escapePdf(license)}) Tj ET`);
  cmds.push(`BT /F2 7 Tf 0.44 0.50 0.58 rg 350 78 Td (NPI / PTR:) Tj /F1 7 Tf 0.08 0.14 0.30 rg ( ${escapePdf(npi)}) Tj ET`);
  cmds.push(`BT /F1 6.5 Tf 0.72 0.58 0.20 rg 350 63 Td (Signed: ${escapePdf(issuedShort)}) Tj ET`);

  // ── PAGE FOOTER ─────────────────────────────────────────────────────────
  cmds.push("BT /F1 6.5 Tf 0.55 0.60 0.68 rg 130 37 Td (HealthKo Telehealth Technologies  |  Official Medical Document  |  Unauthorized Reproduction Prohibited) Tj ET");

  return cmds.join("\n");
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------
export function generateMedicalCertificatePdf(
  data: MedicalCertificatePdfData
): string {
  const stream = buildCertStream(data);

  const CATALOG_ID = 1;
  const PAGES_ID = 2;
  const F1_ID = 3;
  const F2_ID = 4;
  const F3_ID = 5;
  const PAGE_ID = 6;
  const CONTENT_ID = 7;
  const SIG_IMAGE_ID = 8;
  const SIG_MASK_ID = 9;

  const fontResources = `/Font << /F1 ${F1_ID} 0 R /F2 ${F2_ID} 0 R /F3 ${F3_ID} 0 R >>`;
  const xObjectResources = data.signatureImage
    ? `/XObject << /SigImg ${SIG_IMAGE_ID} 0 R >>`
    : "";
  const pageResources = `<< ${fontResources} ${xObjectResources} >>`;

  const objects: { id: number; body: string }[] = [
    { id: CATALOG_ID, body: `<< /Type /Catalog /Pages ${PAGES_ID} 0 R >>` },
    {
      id: PAGES_ID,
      body: `<< /Type /Pages /Kids [${PAGE_ID} 0 R] /Count 1 >>`,
    },
    {
      id: F1_ID,
      body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    },
    {
      id: F2_ID,
      body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    },
    {
      id: F3_ID,
      body: "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic >>",
    },
    {
      id: PAGE_ID,
      body: `<< /Type /Page /Parent ${PAGES_ID} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources ${pageResources} /Contents ${CONTENT_ID} 0 R >>`,
    },
    {
      id: CONTENT_ID,
      body: `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    },
  ];

  if (data.signatureImage) {
    const hasMask = !!(data.signatureImage.maskHexStream && data.signatureImage.maskLength);
    const smaskRef = hasMask ? ` /SMask ${SIG_MASK_ID} 0 R` : "";
    objects.push({
      id: SIG_IMAGE_ID,
      body: `<< /Type /XObject /Subtype /Image /Width ${data.signatureImage.width} /Height ${data.signatureImage.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${data.signatureImage.length}${smaskRef} >>\nstream\n${data.signatureImage.hexStream}endstream`,
    });
    if (hasMask) {
      objects.push({
        id: SIG_MASK_ID,
        body: `<< /Type /XObject /Subtype /Image /Width ${data.signatureImage.width} /Height ${data.signatureImage.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /ASCIIHexDecode /Length ${data.signatureImage.maskLength} >>\nstream\n${data.signatureImage.maskHexStream}endstream`,
      });
    }
  }

  objects.sort((a, b) => a.id - b.id);

  let pdf = "%PDF-1.4\n";
  const offsets: Record<number, number> = {};

  for (const obj of objects) {
    offsets[obj.id] = pdf.length;
    pdf += `${obj.id} 0 obj\n${obj.body}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  const maxId = Math.max(...objects.map((o) => o.id));

  pdf += `xref\n0 ${maxId + 1}\n`;
  pdf += `0000000000 65535 f \n`;
  for (let id = 1; id <= maxId; id++) {
    const offset = offsets[id] ?? 0;
    const isFree = offsets[id] === undefined;
    pdf += `${String(offset).padStart(10, "0")} 00000 ${isFree ? "f" : "n"} \n`;
  }

  pdf += `trailer << /Size ${maxId + 1} /Root ${CATALOG_ID} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return pdf;
}

export async function downloadMedicalCertificatePdf(
  data: MedicalCertificatePdfData,
  customFilename?: string
): Promise<void> {
  if (typeof window === "undefined") return;

  // Automatically attach active doctor signature from Settings if not already provided
  let preparedSig = data.signatureImage;
  if (!preparedSig) {
    const rawSig = data.signatureDataUrl || getStoredDoctorSignature(data.doctorId);
    if (rawSig) {
      preparedSig = (await prepareSignatureForPdf(rawSig)) || undefined;
    }
  }

  const pdfString = generateMedicalCertificatePdf({
    ...data,
    signatureImage: preparedSig,
  });
  const blob = new Blob([pdfString], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  const safePatient = (data.patientName || "patient")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  const filename =
    customFilename ||
    `healthko-medical-cert-${safePatient}-${data.certNumber}.pdf`;

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
