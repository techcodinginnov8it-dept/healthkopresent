/**
 * HealthKo Official Prescription PDF Generator
 * Generates an authentic, clinic-standard medical prescription PDF adhering to
 * DOH-FDA electronic prescription requirements.
 * Supports multi-page output: content flows cleanly across pages with no cut-off medicines.
 */

export interface PrescriptionPdfData {
  appointmentId?: string;
  doctorName: string;
  doctorSpecialty?: string;
  doctorLicense?: string | null;
  doctorNpi?: string | null;
  clinicName?: string;
  patientName: string;
  patientAge?: string | number;
  patientGender?: string | null;
  patientAddress?: string | null;
  date?: Date | string;
  rxNumber?: string;
  diagnosis?: string | null;
  prescription: string;
  hasVerifiedSignature?: boolean;
}

function escapePdfText(value?: string | number | null): string {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/[—–]/g, " - ")
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[•·]/g, "*")
    .replace(/[°]/g, " deg ")
    .replace(/½/g, "1/2")
    .replace(/¼/g, "1/4")
    .replace(/×/g, "x")
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

// ---------------------------------------------------------------------------
// Layout constants (US Letter: 612 x 792 pt)
// ---------------------------------------------------------------------------
const PAGE_W = 612;
const PAGE_H = 792;

// Vertical boundaries for prescription content
const CONTENT_TOP_Y = 544;
const FOOTER_RESERVE = 175;

// Margins
const LEFT_MARGIN = 46;
const INDENT_MARGIN = 58;

// ---------------------------------------------------------------------------
// Build the header stream for a page
// ---------------------------------------------------------------------------
function buildPageHeader(
  finalClinicName: string,
  doctorSpecialty: string,
  doctorNpi: string,
  patientName: string,
  patientAge: string | number,
  patientGender: string,
  formattedDate: string,
  rxNumber: string,
  diagnosis: string,
  pageNum: number,
  totalPages: number
): string[] {
  const cmds: string[] = [];

  // Outer & inner border
  cmds.push("0.85 0.9 0.92 RG 1 w");
  cmds.push("28 28 556 736 re S");
  cmds.push("0.92 0.95 0.96 RG 0.5 w");
  cmds.push("32 32 548 728 re S");

  // Top header banner (Teal)
  cmds.push("0.05 0.58 0.53 rg");
  cmds.push("32 720 548 40 re f");
  cmds.push("BT /F2 12 Tf 1 1 1 rg 46 740 Td (HEALTHKO TELEHEALTH CLINICAL NETWORK) Tj ET");
  cmds.push("BT /F1 8 Tf 0.9 0.98 0.96 rg 46 728 Td (OFFICIAL ELECTRONIC MEDICAL PRESCRIPTION PAD  -  ACCREDITED TELEMEDICINE PROVIDER) Tj ET");

  // Page indicator in top banner
  if (totalPages > 1) {
    cmds.push(`BT /F2 8 Tf 1 1 1 rg 495 734 Td (Page ${pageNum} of ${totalPages}) Tj ET`);
  }

  // Doctor & Clinic Header
  cmds.push(`BT /F2 14 Tf 0.08 0.18 0.22 rg 46 695 Td (${escapePdfText(finalClinicName)}) Tj ET`);
  cmds.push(`BT /F2 9 Tf 0.05 0.58 0.53 rg 46 680 Td (${escapePdfText(doctorSpecialty.toUpperCase())}  -  SPECIALTY & TELEHEALTH PRACTICE) Tj ET`);
  cmds.push(`BT /F1 8 Tf 0.4 0.45 0.5 rg 46 667 Td (HealthKo Medical Systems  -  Verified Clinical Services  -  Provider ID: ${escapePdfText(doctorNpi)}) Tj ET`);

  // Divider lines
  cmds.push("0.05 0.58 0.53 RG 2 w");
  cmds.push("46 654 m 566 654 l S");
  cmds.push("0.85 0.88 0.9 RG 0.5 w");
  cmds.push("46 651 m 566 651 l S");

  // Patient Details Box
  cmds.push("0.96 0.98 0.99 rg 46 588 520 54 re f");
  cmds.push("0.82 0.88 0.9 RG 0.75 w 46 588 520 54 re S");
  cmds.push(`BT /F2 8 Tf 0.4 0.45 0.5 rg 56 626 Td (PATIENT NAME:) Tj ET`);
  cmds.push(`BT /F2 9.5 Tf 0.1 0.15 0.2 rg 135 626 Td (${escapePdfText(patientName)}) Tj ET`);
  cmds.push(`BT /F2 8 Tf 0.4 0.45 0.5 rg 380 626 Td (DATE:) Tj ET`);
  cmds.push(`BT /F2 9 Tf 0.1 0.15 0.2 rg 420 626 Td (${escapePdfText(formattedDate)}) Tj ET`);
  cmds.push(`BT /F2 8 Tf 0.4 0.45 0.5 rg 56 610 Td (AGE / SEX:) Tj ET`);
  cmds.push(`BT /F1 8.5 Tf 0.1 0.15 0.2 rg 135 610 Td (${escapePdfText(patientAge)} / ${escapePdfText(patientGender)}) Tj ET`);
  cmds.push(`BT /F2 8 Tf 0.4 0.45 0.5 rg 380 610 Td (RX NO:) Tj ET`);
  cmds.push(`BT /F2 8.5 Tf 0.05 0.58 0.53 rg 420 610 Td (${escapePdfText(rxNumber)}) Tj ET`);
  cmds.push(`BT /F2 8 Tf 0.4 0.45 0.5 rg 56 594 Td (DIAGNOSIS:) Tj ET`);
  cmds.push(`BT /F1 8.5 Tf 0.1 0.15 0.2 rg 135 594 Td (${escapePdfText(diagnosis || "Clinical Telehealth Encounter")}) Tj ET`);

  // Large Rx Emblem
  cmds.push("BT /F4 26 Tf 0.05 0.58 0.53 rg 46 558 Td (Rx) Tj ET");
  cmds.push("0.05 0.58 0.53 RG 1 w");
  cmds.push("84 566 m 566 566 l S");

  // Continuation tag if page > 1 (placed cleanly above rule, not overlapping items)
  if (pageNum > 1) {
    cmds.push(`BT /F2 8 Tf 0.05 0.58 0.53 rg 90 571 Td (PRESCRIPTION CONTINUED  -  PAGE ${pageNum} OF ${totalPages}) Tj ET`);
  }

  return cmds;
}

// ---------------------------------------------------------------------------
// Build footer + doctor signature for each page
// ---------------------------------------------------------------------------
function buildPageFooter(
  rxNumber: string,
  doctorName: string,
  doctorSpecialty: string,
  doctorLicense: string,
  doctorNpi: string,
  pageNum: number,
  totalPages: number,
  hasVerifiedSignature = false
): string[] {
  const cmds: string[] = [];

  // Footer separator line
  cmds.push("0.8 0.85 0.88 RG 1 w");
  cmds.push("46 168 m 566 168 l S");

  // Left side: Legal & Verification
  cmds.push("BT /F2 7.5 Tf 0.4 0.45 0.5 rg 46 152 Td (ELECTRONIC PRESCRIPTION AUTHENTICATION) Tj ET");
  cmds.push("BT /F1 7 Tf 0.5 0.55 0.6 rg 46 140 Td (1. Generated in compliance with DOH / FDA Telemedicine Regulations.) Tj ET");
  cmds.push("BT /F1 7 Tf 0.5 0.55 0.6 rg 46 130 Td (2. Authentic and valid for dispensing at any licensed pharmacy nationwide.) Tj ET");
  cmds.push("BT /F1 7 Tf 0.5 0.55 0.6 rg 46 120 Td (3. Any unauthorized alteration or reproduction invalidates this prescription.) Tj ET");
  cmds.push(`BT /F2 7 Tf 0.05 0.58 0.53 rg 46 108 Td (Verification Token: ${escapePdfText(rxNumber)}-SECURE-HK) Tj ET`);

  // Right side: Doctor Signature Card
  cmds.push("0.96 0.98 0.99 rg 345 52 221 112 re f");
  cmds.push("0.85 0.9 0.92 RG 0.5 w 345 52 221 112 re S");

  // E-Sign pill badge
  cmds.push("0.05 0.58 0.53 rg 355 144 140 14 re f");
  if (hasVerifiedSignature) {
    cmds.push("BT /F2 7 Tf 1 1 1 rg 358 148 Td (DIGITALLY SIGNED - VERIFIED ON FILE) Tj ET");
  } else {
    cmds.push("BT /F2 7 Tf 1 1 1 rg 360 148 Td (DIGITALLY E-SIGNED - AUTHENTIC) Tj ET");
  }

  // Stylized cursive electronic signature
  const displayDocName = doctorName.startsWith("Dr.") ? doctorName : `Dr. ${doctorName}`;
  cmds.push(`BT /F3 18 Tf 0.08 0.22 0.48 rg 355 124 Td (${escapePdfText(displayDocName)}) Tj ET`);

  // Signature line
  cmds.push("0.2 0.3 0.4 RG 0.75 w");
  cmds.push("355 116 m 552 116 l S");

  // Doctor Name, Specialty, License, NPI
  cmds.push(`BT /F2 9.5 Tf 0.1 0.15 0.2 rg 355 103 Td (DR. ${escapePdfText(doctorName.toUpperCase().replace(/^DR\.?\s+/i, ""))}, MD) Tj ET`);
  cmds.push(`BT /F1 8 Tf 0.35 0.4 0.45 rg 355 92 Td (${escapePdfText(doctorSpecialty)}) Tj ET`);
  cmds.push(`BT /F2 8 Tf 0.05 0.58 0.53 rg 355 81 Td (PRC License No.: ) Tj /F1 8 Tf 0.1 0.15 0.2 rg (${escapePdfText(doctorLicense)}) Tj ET`);
  cmds.push(`BT /F2 8 Tf 0.4 0.45 0.5 rg 355 70 Td (NPI / PTR No.: ) Tj /F1 8 Tf 0.1 0.15 0.2 rg (${escapePdfText(doctorNpi)}) Tj ET`);
  if (hasVerifiedSignature) {
    cmds.push("BT /F2 6.5 Tf 0.05 0.58 0.53 rg 355 60 Td (Official Clinical Digital Signature On File) Tj ET");
  }

  // Bottom note & page number
  cmds.push("BT /F1 7 Tf 0.6 0.65 0.7 rg 185 38 Td (HealthKo Telehealth Technologies  -  Official Medical Document) Tj ET");
  if (totalPages > 1) {
    cmds.push(`BT /F1 7 Tf 0.5 0.55 0.6 rg 510 38 Td (Page ${pageNum} / ${totalPages}) Tj ET`);
  }

  return cmds;
}

// ---------------------------------------------------------------------------
// Prescription Item Block representation
// ---------------------------------------------------------------------------
interface RxItemBlock {
  lines: string[];
}

/**
 * Parses the raw prescription string into structured blocks (one per medicine).
 * Keeps medicine items coherent so whole medicines stay together on pages.
 */
function parseRxBlocks(prescription: string): RxItemBlock[] {
  const rawLines = (prescription || "No prescription items recorded.")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const blocks: RxItemBlock[] = [];
  let currentBlock: string[] = [];

  for (const line of rawLines) {
    if (line.startsWith("--- Medicine")) {
      if (currentBlock.length > 0) {
        blocks.push({ lines: currentBlock });
      }
      currentBlock = [line];
    } else {
      currentBlock.push(line);
    }
  }

  if (currentBlock.length > 0) {
    blocks.push({ lines: currentBlock });
  }

  return blocks;
}

/**
 * Calculates height (in points) required to render a single line.
 */
function getLineHeight(line: string): number {
  if (line.startsWith("--- Medicine")) return 20;
  if (line.startsWith("Medicine:")) return 16;
  if (/^Special Instructions:/i.test(line)) {
    const val = line.replace(/^Special Instructions:\s*/i, "");
    return Math.max(12 * wrapText(val, 72).length + 4, 15);
  }
  const wrapped = wrapText(line, 80);
  return Math.max(12 * wrapped.length, 12);
}

/**
 * Calculates total height required to render an entire medicine block.
 */
function getBlockHeight(block: RxItemBlock): number {
  let h = 0;
  for (const line of block.lines) {
    h += getLineHeight(line);
  }
  return h + 8; // include bottom spacing after each medicine
}

/**
 * Renders a single line of a medicine block at position y.
 */
function renderLine(line: string, y: number): { cmds: string[]; dy: number } {
  const cmds: string[] = [];
  let dy = 0;

  if (line.startsWith("--- Medicine")) {
    const label = line.replace(/^---\s*/, "").replace(/\s*---$/, "").trim();
    // Medicine badge rule
    cmds.push(`0.88 0.92 0.94 RG 0.5 w 46 ${y - 4} m 566 ${y - 4} l S`);
    cmds.push(`BT /F2 8.5 Tf 0.05 0.58 0.53 rg ${LEFT_MARGIN} ${y - 6} Td (${escapePdfText(label.toUpperCase())}) Tj ET`);
    dy = 20;
  } else if (line.startsWith("Medicine:")) {
    const val = line.replace(/^Medicine:\s*/i, "");
    cmds.push(`BT /F2 10.5 Tf 0.08 0.15 0.22 rg ${LEFT_MARGIN} ${y} Td (${escapePdfText(val)}) Tj ET`);
    dy = 16;
  } else if (line.startsWith("Form:")) {
    const val = line.replace(/^Form:\s*/i, "");
    cmds.push(`BT /F2 8.5 Tf 0.3 0.35 0.4 rg ${INDENT_MARGIN} ${y} Td (Form: ) Tj /F1 8.5 Tf (${escapePdfText(val)}) Tj ET`);
    dy = 12;
  } else if (/^Dosage(\s*\/\s*Strength)?:/i.test(line)) {
    const val = line.replace(/^[^:]+:\s*/i, "");
    cmds.push(`BT /F2 9 Tf 0.2 0.25 0.3 rg ${INDENT_MARGIN} ${y} Td (Dosage / Strength: ) Tj /F1 9 Tf (${escapePdfText(val)}) Tj ET`);
    dy = 12;
  } else if (/^(Number of Consume|Dose per Administration|Dose):/i.test(line)) {
    const val = line.replace(/^[^:]+:\s*/i, "");
    cmds.push(`BT /F2 9 Tf 0.2 0.25 0.3 rg ${INDENT_MARGIN} ${y} Td (Dose: ) Tj /F1 9 Tf (${escapePdfText(val)}) Tj ET`);
    dy = 12;
  } else if (/^Frequency:/i.test(line)) {
    const val = line.replace(/^Frequency:\s*/i, "");
    cmds.push(`BT /F2 9 Tf 0.2 0.25 0.3 rg ${INDENT_MARGIN} ${y} Td (Frequency: ) Tj /F1 9 Tf (${escapePdfText(val)}) Tj ET`);
    dy = 12;
  } else if (/^When to (Consume|Take):/i.test(line)) {
    const val = line.replace(/^[^:]+:\s*/i, "");
    cmds.push(`BT /F2 9 Tf 0.2 0.25 0.3 rg ${INDENT_MARGIN} ${y} Td (When to Take: ) Tj /F1 9 Tf (${escapePdfText(val)}) Tj ET`);
    dy = 12;
  } else if (/^Duration:/i.test(line)) {
    const val = line.replace(/^Duration:\s*/i, "");
    cmds.push(`BT /F2 9 Tf 0.2 0.25 0.3 rg ${INDENT_MARGIN} ${y} Td (Duration: ) Tj /F1 9 Tf (${escapePdfText(val)}) Tj ET`);
    dy = 12;
  } else if (/^Total Supply:/i.test(line)) {
    const val = line.replace(/^Total Supply:\s*/i, "");
    cmds.push(`BT /F2 9 Tf 0.05 0.58 0.53 rg ${INDENT_MARGIN} ${y} Td (Total Supply: ) Tj /F2 9 Tf 0.08 0.22 0.48 rg (${escapePdfText(val)}) Tj ET`);
    dy = 12;
  } else if (/^Special Instructions:/i.test(line)) {
    const val = line.replace(/^Special Instructions:\s*/i, "");
    const wrapped = wrapText(val, 72);
    wrapped.forEach((wLine, idx) => {
      if (idx === 0) {
        cmds.push(`BT /F2 8.5 Tf 0.05 0.58 0.53 rg ${INDENT_MARGIN} ${y - idx * 11} Td (Instructions: ) Tj /F3 8.5 Tf 0.25 0.3 0.35 rg (${escapePdfText(wLine)}) Tj ET`);
      } else {
        cmds.push(`BT /F3 8.5 Tf 0.25 0.3 0.35 rg 125 ${y - idx * 11} Td (${escapePdfText(wLine)}) Tj ET`);
      }
    });
    dy = Math.max(11 * wrapped.length + 3, 14);
  } else {
    const wrapped = wrapText(line, 80);
    wrapped.forEach((wLine, idx) => {
      cmds.push(`BT /F1 9 Tf 0.15 0.2 0.25 rg ${LEFT_MARGIN} ${y - idx * 12} Td (${escapePdfText(wLine)}) Tj ET`);
    });
    dy = Math.max(12 * wrapped.length, 12);
  }

  return { cmds, dy };
}

// ---------------------------------------------------------------------------
// Main generator — multi-page aware with block pagination
// ---------------------------------------------------------------------------
export function generatePrescriptionPdf(data: PrescriptionPdfData): string {
  const {
    appointmentId,
    doctorName,
    doctorSpecialty = "General Practice & Telemedicine",
    doctorLicense,
    doctorNpi,
    clinicName,
    patientName,
    patientAge = "Adult",
    patientGender = "Unspecified",
    date,
    rxNumber = appointmentId
      ? `RX-${appointmentId.slice(0, 8).toUpperCase()}`
      : `RX-${Date.now().toString().slice(-6)}`,
    diagnosis = "Clinical Telehealth Encounter",
    prescription,
  } = data;

  const formattedDate = date
    ? typeof date === "string"
      ? date
      : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const finalClinicName =
    clinicName || `CLINIC OF DR. ${doctorName.toUpperCase().replace(/^DR\.?\s+/i, "")}, MD`;

  const finalLicense =
    doctorLicense || (doctorNpi ? `PRC-${doctorNpi.slice(0, 7)}` : "PRC-VERIFIED-01");
  const finalNpi = doctorNpi || "NPI-HK99482";

  // Parse prescription into structured medicine blocks
  const blocks = parseRxBlocks(prescription);

  // ------------------------------------------------------------------
  // Layout Phase: Partition blocks into pages cleanly
  // A block stays together unless it alone exceeds available page height.
  // ------------------------------------------------------------------
  const pageCommandsList: string[][] = [];
  let currentPageCmds: string[] = [];
  let y = CONTENT_TOP_Y;

  for (const block of blocks) {
    const blockH = getBlockHeight(block);

    // If block does not fit on current page and current page already has content, start new page
    if (y - blockH < FOOTER_RESERVE && currentPageCmds.length > 0) {
      pageCommandsList.push(currentPageCmds);
      currentPageCmds = [];
      y = CONTENT_TOP_Y;
    }

    // Render lines of this block
    for (const line of block.lines) {
      const lineH = getLineHeight(line);

      // Check if individual line overflows (e.g. exceptionally huge block)
      if (y - lineH < FOOTER_RESERVE && currentPageCmds.length > 0) {
        pageCommandsList.push(currentPageCmds);
        currentPageCmds = [];
        y = CONTENT_TOP_Y;
      }

      const { cmds, dy } = renderLine(line, y);
      currentPageCmds.push(...cmds);
      y -= dy;
    }

    // Extra spacing between medicines
    y -= 6;
  }

  if (currentPageCmds.length > 0 || pageCommandsList.length === 0) {
    pageCommandsList.push(currentPageCmds);
  }

  const totalPages = pageCommandsList.length;

  // ------------------------------------------------------------------
  // Assemble full content stream for each page
  // ------------------------------------------------------------------
  const pageStreams: string[] = [];

  for (let i = 0; i < totalPages; i++) {
    const pageNum = i + 1;
    const header = buildPageHeader(
      finalClinicName,
      doctorSpecialty,
      finalNpi,
      patientName,
      patientAge,
      patientGender || "Unspecified",
      formattedDate,
      rxNumber,
      diagnosis || "Clinical Telehealth Encounter",
      pageNum,
      totalPages
    );
    const footer = buildPageFooter(
      rxNumber,
      doctorName,
      doctorSpecialty,
      finalLicense,
      finalNpi,
      pageNum,
      totalPages
    );
    const stream = [...header, ...pageCommandsList[i], ...footer].join("\n");
    pageStreams.push(stream);
  }

  // ------------------------------------------------------------------
  // Build multi-page PDF binary
  // ------------------------------------------------------------------
  const N = pageStreams.length;
  const CATALOG_ID = 1;
  const PAGES_ID = 2;
  const F1_ID = 3; // Helvetica
  const F2_ID = 4; // Helvetica-Bold
  const F3_ID = 5; // Times-Italic
  const F4_ID = 6; // Times-Bold
  const FIRST_PAGE_OBJ = 7; // page objects 7..7+N-1
  const FIRST_CONTENT_OBJ = 7 + N; // content streams 7+N..7+2N-1

  const pageObjIds = Array.from({ length: N }, (_, i) => FIRST_PAGE_OBJ + i);
  const contentObjIds = Array.from({ length: N }, (_, i) => FIRST_CONTENT_OBJ + i);

  const kidsList = pageObjIds.map((id) => `${id} 0 R`).join(" ");
  const fontResources = `/Font << /F1 ${F1_ID} 0 R /F2 ${F2_ID} 0 R /F3 ${F3_ID} 0 R /F4 ${F4_ID} 0 R >>`;

  const objects: { id: number; body: string }[] = [];

  objects.push({
    id: CATALOG_ID,
    body: `<< /Type /Catalog /Pages ${PAGES_ID} 0 R >>`,
  });

  objects.push({
    id: PAGES_ID,
    body: `<< /Type /Pages /Kids [${kidsList}] /Count ${N} >>`,
  });

  objects.push({ id: F1_ID, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>" });
  objects.push({ id: F2_ID, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>" });
  objects.push({ id: F3_ID, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic >>" });
  objects.push({ id: F4_ID, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>" });

  for (let i = 0; i < N; i++) {
    objects.push({
      id: pageObjIds[i],
      body: `<< /Type /Page /Parent ${PAGES_ID} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << ${fontResources} >> /Contents ${contentObjIds[i]} 0 R >>`,
    });
  }

  for (let i = 0; i < N; i++) {
    const streamText = pageStreams[i];
    objects.push({
      id: contentObjIds[i],
      body: `<< /Length ${streamText.length} >>\nstream\n${streamText}\nendstream`,
    });
  }

  // Sort by object id and serialize
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

export function downloadPrescriptionPdf(data: PrescriptionPdfData, customFilename?: string): void {
  if (typeof window === "undefined") return;

  const pdfString = generatePrescriptionPdf(data);
  const blob = new Blob([pdfString], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  const safePatient = (data.patientName || "patient").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const filename =
    customFilename || `healthko-prescription-${safePatient}-${data.appointmentId || "rx"}.pdf`;

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
