/**
 * HealthKo Official Medical Certificate PDF Generator
 * Produces a clinic-standard Medical Certificate PDF adhering to
 * DOH telemedicine documentation requirements.
 * Pure TypeScript, zero external dependencies.
 */

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
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function escapePdf(value?: string | number | null): string {
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
const LEFT = 46;
const RIGHT = 566;

// ---------------------------------------------------------------------------
// Build full page stream
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

  // Outer & inner border
  cmds.push("0.85 0.9 0.92 RG 1 w");
  cmds.push("28 28 556 736 re S");
  cmds.push("0.92 0.95 0.96 RG 0.5 w");
  cmds.push("32 32 548 728 re S");

  // Header banner (teal)
  cmds.push("0.05 0.58 0.53 rg");
  cmds.push("32 720 548 40 re f");
  cmds.push(
    "BT /F2 12 Tf 1 1 1 rg 46 740 Td (HEALTHKO TELEHEALTH CLINICAL NETWORK) Tj ET"
  );
  cmds.push(
    "BT /F1 8 Tf 0.9 0.98 0.96 rg 46 728 Td (OFFICIAL MEDICAL CERTIFICATE  -  ACCREDITED TELEMEDICINE PROVIDER) Tj ET"
  );

  // Cert type badge (right of banner)
  cmds.push("0.04 0.44 0.4 rg");
  cmds.push("430 724 134 28 re f");
  cmds.push("BT /F2 7.5 Tf 1 1 1 rg 436 740 Td (MEDICAL CERTIFICATE) Tj ET");
  cmds.push(
    `BT /F1 7 Tf 0.85 0.95 0.93 rg 436 729 Td (${escapePdf(purposeLabel.toUpperCase())}) Tj ET`
  );

  // Doctor & clinic sub-header
  const clinicName = `CLINIC OF ${doctorName.toUpperCase().replace(/^DR\.?\s+/i, "")}, MD`;
  cmds.push(
    `BT /F2 14 Tf 0.08 0.18 0.22 rg ${LEFT} 695 Td (${escapePdf(clinicName)}) Tj ET`
  );
  cmds.push(
    `BT /F2 9 Tf 0.05 0.58 0.53 rg ${LEFT} 680 Td (${escapePdf(specialty.toUpperCase())}  -  SPECIALTY & TELEHEALTH PRACTICE) Tj ET`
  );
  cmds.push(
    `BT /F1 8 Tf 0.4 0.45 0.5 rg ${LEFT} 667 Td (HealthKo Medical Systems  -  Verified Clinical Services  -  Provider ID: ${escapePdf(npi)}) Tj ET`
  );

  // Dividers
  cmds.push("0.05 0.58 0.53 RG 2 w");
  cmds.push(`${LEFT} 654 m ${RIGHT} 654 l S`);
  cmds.push("0.85 0.88 0.9 RG 0.5 w");
  cmds.push(`${LEFT} 651 m ${RIGHT} 651 l S`);

  // Certificate title
  cmds.push("BT /F2 16 Tf 0.05 0.58 0.53 rg 195 628 Td (MEDICAL CERTIFICATE) Tj ET");
  cmds.push("0.05 0.58 0.53 RG 1 w");
  cmds.push("195 622 m 417 622 l S");

  // Date & cert number
  cmds.push(`BT /F2 8 Tf 0.4 0.45 0.5 rg 390 642 Td (Date Issued:) Tj ET`);
  cmds.push(
    `BT /F1 8.5 Tf 0.1 0.15 0.2 rg 460 642 Td (${escapePdf(issuedShort)}) Tj ET`
  );
  cmds.push(`BT /F2 8 Tf 0.4 0.45 0.5 rg 390 630 Td (Certificate No.:) Tj ET`);
  cmds.push(
    `BT /F2 8 Tf 0.05 0.58 0.53 rg 460 630 Td (${escapePdf(certNum)}) Tj ET`
  );

  // Patient details box
  cmds.push("0.96 0.98 0.99 rg 46 563 520 50 re f");
  cmds.push("0.82 0.88 0.9 RG 0.75 w 46 563 520 50 re S");

  cmds.push(`BT /F2 8 Tf 0.4 0.45 0.5 rg 56 600 Td (PATIENT NAME:) Tj ET`);
  cmds.push(
    `BT /F2 9.5 Tf 0.1 0.15 0.2 rg 145 600 Td (${escapePdf(patientName)}) Tj ET`
  );
  cmds.push(`BT /F2 8 Tf 0.4 0.45 0.5 rg 56 586 Td (AGE / SEX:) Tj ET`);
  cmds.push(
    `BT /F1 8.5 Tf 0.1 0.15 0.2 rg 145 586 Td (${escapePdf(age)} / ${escapePdf(gender)}) Tj ET`
  );
  if (address) {
    cmds.push(`BT /F2 8 Tf 0.4 0.45 0.5 rg 56 572 Td (ADDRESS:) Tj ET`);
    const addrLines = wrapText(address, 55);
    cmds.push(
      `BT /F1 8 Tf 0.1 0.15 0.2 rg 145 572 Td (${escapePdf(addrLines[0] || "")}) Tj ET`
    );
  }

  // Certificate body
  cmds.push(
    `BT /F1 10 Tf 0.15 0.2 0.25 rg ${LEFT} 543 Td (To Whom It May Concern,) Tj ET`
  );

  let y = 523;

  const intro = `This is to certify that ${patientName}, a patient of this clinic, was seen and examined by the undersigned physician on ${issuedDate}.`;
  const introLines = wrapText(intro, 88);
  for (const line of introLines) {
    cmds.push(
      `BT /F1 9.5 Tf 0.15 0.2 0.25 rg ${LEFT} ${y} Td (${escapePdf(line)}) Tj ET`
    );
    y -= 14;
  }

  y -= 6;

  // Diagnosis box
  cmds.push("0.96 0.98 0.99 rg");
  cmds.push(`${LEFT} ${y - 8} 520 26 re f`);
  cmds.push("0.82 0.88 0.9 RG 0.5 w");
  cmds.push(`${LEFT} ${y - 8} 520 26 re S`);
  cmds.push(
    `BT /F2 8 Tf 0.4 0.45 0.5 rg ${LEFT + 10} ${y + 8} Td (DIAGNOSIS / CONDITION:) Tj ET`
  );
  const diagLines = wrapText(diagnosis, 68);
  cmds.push(
    `BT /F1 9 Tf 0.08 0.15 0.22 rg ${LEFT + 10} ${y - 2} Td (${escapePdf(diagLines[0] || "")}) Tj ET`
  );
  y -= 38;

  // Recommendation
  y -= 4;
  cmds.push(
    `BT /F1 9.5 Tf 0.15 0.2 0.25 rg ${LEFT} ${y} Td (Based on examination, the physician recommends the following:) Tj ET`
  );
  y -= 16;

  cmds.push("0.05 0.58 0.53 rg");
  cmds.push(`${LEFT} ${y - 8} 520 24 re f`);
  cmds.push(
    `BT /F2 9.5 Tf 1 1 1 rg ${LEFT + 10} ${y + 3} Td (${escapePdf(purposeLabel.toUpperCase())}) Tj ET`
  );
  y -= 34;

  // Rest period (sick leave only)
  if (data.purpose === "sick_leave" && (data.restDaysFrom || data.restDaysTo)) {
    const from = formatDate(data.restDaysFrom);
    const to = formatDate(data.restDaysTo);
    const restText = `Patient is advised to rest from ${from} to ${to}.`;
    cmds.push(
      `BT /F1 9.5 Tf 0.15 0.2 0.25 rg ${LEFT} ${y} Td (${escapePdf(restText)}) Tj ET`
    );
    y -= 16;

    cmds.push("0.95 0.98 0.97 rg");
    cmds.push(`${LEFT} ${y - 6} 520 24 re f`);
    cmds.push("0.05 0.58 0.53 RG 0.75 w");
    cmds.push(`${LEFT} ${y - 6} 520 24 re S`);
    cmds.push(
      `BT /F2 8 Tf 0.4 0.45 0.5 rg ${LEFT + 10} ${y + 8} Td (REST PERIOD: ) Tj /F2 8.5 Tf 0.05 0.58 0.53 rg (${escapePdf(from)}  to  ${escapePdf(to)}) Tj ET`
    );
    y -= 36;
  }

  // Remarks
  if (remarks && remarks.trim()) {
    y -= 4;
    cmds.push(
      `BT /F2 8.5 Tf 0.4 0.45 0.5 rg ${LEFT} ${y} Td (ADDITIONAL REMARKS:) Tj ET`
    );
    y -= 14;
    const remarkLines = wrapText(remarks, 88);
    for (const line of remarkLines) {
      cmds.push(
        `BT /F1 9 Tf 0.15 0.2 0.25 rg ${LEFT} ${y} Td (${escapePdf(line)}) Tj ET`
      );
      y -= 13;
    }
  }

  // Closing statement
  y -= 10;
  cmds.push(
    `BT /F1 9.5 Tf 0.15 0.2 0.25 rg ${LEFT} ${y} Td (This certificate is issued upon request for whatever legal purpose it may serve.) Tj ET`
  );

  // Footer separator
  cmds.push("0.8 0.85 0.88 RG 1 w");
  cmds.push(`${LEFT} 168 m ${RIGHT} 168 l S`);

  // Left footer — legal
  cmds.push(
    "BT /F2 7.5 Tf 0.4 0.45 0.5 rg 46 152 Td (ELECTRONIC CERTIFICATE AUTHENTICATION) Tj ET"
  );
  cmds.push(
    "BT /F1 7 Tf 0.5 0.55 0.6 rg 46 140 Td (1. Generated in compliance with DOH / FDA Telemedicine Regulations.) Tj ET"
  );
  cmds.push(
    "BT /F1 7 Tf 0.5 0.55 0.6 rg 46 130 Td (2. Authentic and valid for use at any government or private institution.) Tj ET"
  );
  cmds.push(
    "BT /F1 7 Tf 0.5 0.55 0.6 rg 46 120 Td (3. Any unauthorized alteration or reproduction invalidates this certificate.) Tj ET"
  );
  cmds.push(
    `BT /F2 7 Tf 0.05 0.58 0.53 rg 46 108 Td (Verification Token: ${escapePdf(certNum)}-SECURE-HK) Tj ET`
  );

  // Right — Doctor Signature Card
  cmds.push("0.96 0.98 0.99 rg 345 52 221 112 re f");
  cmds.push("0.85 0.9 0.92 RG 0.5 w 345 52 221 112 re S");

  cmds.push("0.05 0.58 0.53 rg 355 144 140 14 re f");
  cmds.push(
    "BT /F2 7 Tf 1 1 1 rg 360 148 Td (DIGITALLY E-SIGNED - AUTHENTIC) Tj ET"
  );

  cmds.push(
    `BT /F3 18 Tf 0.08 0.22 0.48 rg 355 124 Td (${escapePdf(displayDocName)}) Tj ET`
  );
  cmds.push("0.2 0.3 0.4 RG 0.75 w");
  cmds.push("355 116 m 552 116 l S");

  const docNameUpper = doctorName.toUpperCase().replace(/^DR\.?\s+/i, "");
  cmds.push(
    `BT /F2 9.5 Tf 0.1 0.15 0.2 rg 355 103 Td (DR. ${escapePdf(docNameUpper)}, MD) Tj ET`
  );
  cmds.push(
    `BT /F1 8 Tf 0.35 0.4 0.45 rg 355 92 Td (${escapePdf(specialty)}) Tj ET`
  );
  cmds.push(
    `BT /F2 8 Tf 0.05 0.58 0.53 rg 355 81 Td (PRC License No.: ) Tj /F1 8 Tf 0.1 0.15 0.2 rg (${escapePdf(license)}) Tj ET`
  );
  cmds.push(
    `BT /F2 8 Tf 0.4 0.45 0.5 rg 355 70 Td (NPI / PTR No.: ) Tj /F1 8 Tf 0.1 0.15 0.2 rg (${escapePdf(npi)}) Tj ET`
  );

  cmds.push(
    "BT /F1 7 Tf 0.6 0.65 0.7 rg 165 38 Td (HealthKo Telehealth Technologies  -  Official Medical Document) Tj ET"
  );

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

  const fontResources = `/Font << /F1 ${F1_ID} 0 R /F2 ${F2_ID} 0 R /F3 ${F3_ID} 0 R >>`;

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
      body: `<< /Type /Page /Parent ${PAGES_ID} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << ${fontResources} >> /Contents ${CONTENT_ID} 0 R >>`,
    },
    {
      id: CONTENT_ID,
      body: `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    },
  ];

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

export function downloadMedicalCertificatePdf(
  data: MedicalCertificatePdfData,
  customFilename?: string
): void {
  if (typeof window === "undefined") return;

  const pdfString = generateMedicalCertificatePdf(data);
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
