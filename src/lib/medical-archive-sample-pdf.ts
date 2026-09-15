/**
 * HealthKo Telehealth – Medical Archive Sample PDF Generators
 * Generates official formatted PDF files for seed documents in the
 * Previous Consultations & Medical Documents hub:
 * 1. Previous Outpatient Consultation Summary (Clinical Encounter Record)
 * 2. Annual Comprehensive Metabolic & CBC Panel (Diagnostic Lab Report)
 */

const PAGE_W = 612;
const PAGE_H = 792;
const L = 46;
const R = 566;

function esc(v?: string | number | null): string {
  if (v === undefined || v === null) return "";
  return String(v)
    .replace(/[—–]/g, " - ")
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[•·]/g, "*")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\r\n]+/g, " ")
    .trim();
}

function wrap(text: string, maxChars = 78): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length <= maxChars) {
      cur = (cur + " " + w).trim();
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function buildPdfString(contentStream: string): string {
  const objects = [
    {
      id: 1,
      body: "<< /Type /Catalog /Pages 2 0 R >>",
    },
    {
      id: 2,
      body: "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    },
    {
      id: 3,
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents 6 0 R /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> >>`,
    },
    {
      id: 4,
      body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    },
    {
      id: 5,
      body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    },
    {
      id: 6,
      body: `<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`,
    },
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: Record<number, number> = {};
  for (const obj of objects) {
    offsets[obj.id] = pdf.length;
    pdf += `${obj.id} 0 obj\n${obj.body}\nendobj\n`;
  }
  const xrefOff = pdf.length;
  pdf += `xref\n0 7\n`;
  pdf += `0000000000 65535 f \n`;
  for (let id = 1; id <= 6; id++) {
    pdf += `${String(offsets[id] ?? 0).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size 7 /Root 1 0 R >>\nstartxref\n${xrefOff}\n%%EOF`;
  return pdf;
}

/**
 * Generates a Previous Consultation Summary PDF
 */
export function generateConsultationSummaryPdf(doc?: {
  title?: string;
  doctorOrClinic?: string;
  consultationDate?: string;
  notes?: string;
}): string {
  const doctor = doc?.doctorOrClinic || "St. Luke's Medical Center - Cardiology Clinic";
  const date = doc?.consultationDate || "2025-11-14";
  const notes =
    doc?.notes ||
    "Routine cardiology review. ECG normal sinus rhythm. Continued on lifestyle modifications and preventive lipid management. Follow-up in 6 months.";

  const cmds: string[] = [
    // Top Brand Banner (Slate/Teal)
    `0.05 0.38 0.45 rg 0 740 ${PAGE_W} 52 re f`,
    `BT /F2 16 Tf 1 1 1 rg ${L} 765 Td (HEALTHKO CLINICAL ARCHIVE) Tj ET`,
    `BT /F1 8.5 Tf 0.82 0.94 0.95 rg ${L} 750 Td (PREVIOUS CONSULTATION ENCOUNTER SUMMARY · OFFICIAL ARCHIVED RECORD) Tj ET`,

    // Clinic / Provider Header
    `0.96 0.98 0.99 rg ${L} 670 520 54 re f`,
    `0.85 0.9 0.94 RG 0.5 w ${L} 670 520 54 re S`,
    `BT /F2 11 Tf 0.08 0.15 0.22 rg ${L + 12} 708 Td (${esc(doctor)}) Tj ET`,
    `BT /F1 8 Tf 0.4 0.48 0.55 rg ${L + 12} 694 Td (Outpatient Clinical Encounter · Archived Medical Record) Tj ET`,
    `BT /F1 8 Tf 0.4 0.48 0.55 rg ${L + 12} 680 Td (Encounter Date: ${esc(date)} · Record Status: Archived / Verified) Tj ET`,

    // Metadata Bar
    `0.93 0.95 0.97 rg ${L} 632 520 26 re f`,
    `0.8 0.85 0.9 RG 0.5 w ${L} 632 520 26 re S`,
    `BT /F2 7.5 Tf 0.3 0.4 0.48 rg ${L + 10} 643 Td (DOCUMENT TYPE: ENCOUNTER SUMMARY) Tj ET`,
    `BT /F2 7.5 Tf 0.3 0.4 0.48 rg ${L + 210} 643 Td (CLASSIFICATION: AMBULATORY OUTPATIENT) Tj ET`,
    `BT /F2 7.5 Tf 0.3 0.4 0.48 rg ${L + 420} 643 Td (CONFIDENTIALITY: LEVEL 2) Tj ET`,

    // Section 1: Encounter Details
    `0.05 0.38 0.45 rg ${L} 606 520 14 re f`,
    `BT /F2 8 Tf 1 1 1 rg ${L + 6} 610 Td (1. ENCOUNTER DETAILS & REASON FOR CONSULTATION) Tj ET`,
    `BT /F2 8 Tf 0.3 0.38 0.46 rg ${L} 586 Td (Service Type:) Tj ET`,
    `BT /F1 8.5 Tf 0.1 0.15 0.2 rg ${L + 100} 586 Td (Outpatient Cardiology Comprehensive Follow-up) Tj ET`,
    `BT /F2 8 Tf 0.3 0.38 0.46 rg ${L} 572 Td (Chief Complaint:) Tj ET`,
    `BT /F1 8.5 Tf 0.1 0.15 0.2 rg ${L + 100} 572 Td (Semi-annual cardiovascular health assessment and routine wellness screening) Tj ET`,
    `BT /F2 8 Tf 0.3 0.38 0.46 rg ${L} 558 Td (Clinical Status:) Tj ET`,
    `BT /F1 8.5 Tf 0.1 0.15 0.2 rg ${L + 100} 558 Td (Clinically stable, asymptomatic, no orthopnea or dyspnea on exertion) Tj ET`,

    // Section 2: Vitals Recorded
    `0.05 0.38 0.45 rg ${L} 534 520 14 re f`,
    `BT /F2 8 Tf 1 1 1 rg ${L + 6} 538 Td (2. VITAL SIGNS AT ENCOUNTER) Tj ET`,
    // Vitals grid boxes
    `0.96 0.98 0.99 rg ${L} 492 120 32 re f`,
    `0.85 0.9 0.94 RG 0.5 w ${L} 492 120 32 re S`,
    `BT /F2 7 Tf 0.35 0.45 0.52 rg ${L + 6} 516 Td (BLOOD PRESSURE) Tj ET`,
    `BT /F2 11 Tf 0.05 0.38 0.45 rg ${L + 6} 502 Td (118/78) Tj ET`,
    `BT /F1 7 Tf 0.45 0.5 0.55 rg ${L + 50} 502 Td (mmHg) Tj ET`,

    `0.96 0.98 0.99 rg ${L + 130} 492 120 32 re f`,
    `0.85 0.9 0.94 RG 0.5 w ${L + 130} 492 120 32 re S`,
    `BT /F2 7 Tf 0.35 0.45 0.52 rg ${L + 136} 516 Td (HEART RATE) Tj ET`,
    `BT /F2 11 Tf 0.05 0.38 0.45 rg ${L + 136} 502 Td (72) Tj ET`,
    `BT /F1 7 Tf 0.45 0.5 0.55 rg ${L + 160} 502 Td (bpm regular) Tj ET`,

    `0.96 0.98 0.99 rg ${L + 260} 492 120 32 re f`,
    `0.85 0.9 0.94 RG 0.5 w ${L + 260} 492 120 32 re S`,
    `BT /F2 7 Tf 0.35 0.45 0.52 rg ${L + 266} 516 Td (BODY TEMP) Tj ET`,
    `BT /F2 11 Tf 0.05 0.38 0.45 rg ${L + 266} 502 Td (36.6) Tj ET`,
    `BT /F1 7 Tf 0.45 0.5 0.55 rg ${L + 295} 502 Td (deg C) Tj ET`,

    `0.96 0.98 0.99 rg ${L + 390} 492 130 32 re f`,
    `0.85 0.9 0.94 RG 0.5 w ${L + 390} 492 130 32 re S`,
    `BT /F2 7 Tf 0.35 0.45 0.52 rg ${L + 396} 516 Td (O2 SATURATION) Tj ET`,
    `BT /F2 11 Tf 0.05 0.38 0.45 rg ${L + 396} 502 Td (99%) Tj ET`,
    `BT /F1 7 Tf 0.45 0.5 0.55 rg ${L + 430} 502 Td (room air) Tj ET`,

    // Section 3: Diagnostic Findings & Notes
    `0.05 0.38 0.45 rg ${L} 464 520 14 re f`,
    `BT /F2 8 Tf 1 1 1 rg ${L + 6} 468 Td (3. CLINICAL ASSESSMENT & ATTENDING NOTES) Tj ET`,
  ];

  let curY = 444;
  const wrappedNotes = wrap(notes, 75);
  for (const line of wrappedNotes) {
    cmds.push(`BT /F1 8.5 Tf 0.1 0.15 0.2 rg ${L} ${curY} Td (${esc(line)}) Tj ET`);
    curY -= 12;
  }

  // Section 4: Care Directives & Prescriptions
  curY -= 6;
  cmds.push(`0.05 0.38 0.45 rg ${L} ${curY} 520 14 re f`);
  cmds.push(`BT /F2 8 Tf 1 1 1 rg ${L + 6} ${curY + 4} Td (4. CARE PLAN & PRESCRIBED REGIMEN) Tj ET`);
  curY -= 18;

  const planLines = [
    "* Atorvastatin 20mg orally once daily at bedtime (lipid optimization).",
    "* Daily moderate aerobic activity: 30 minutes, 5 days per week.",
    "* Sodium-restricted Mediterranean-style dietary plan (<2,000 mg/day).",
    "* Maintain routine home blood pressure log twice weekly.",
    "* Annual lipid profile and liver enzymes panel in 6 months prior to next visit.",
  ];
  for (const p of planLines) {
    cmds.push(`BT /F1 8 Tf 0.12 0.18 0.25 rg ${L + 6} ${curY} Td (${esc(p)}) Tj ET`);
    curY -= 13;
  }

  // Verification Seal / Footer
  cmds.push(
    `0.92 0.94 0.96 RG 0.5 w ${L} 120 520 0 re S`,
    `BT /F2 8 Tf 0.2 0.3 0.4 rg ${L} 104 Td (ATTENDING CLINICIAN VERIFICATION) Tj ET`,
    `BT /F1 7.5 Tf 0.4 0.48 0.55 rg ${L} 92 Td (Verified electronically in HealthKo Patient Portal. Encrypted cryptographic clinical record.) Tj ET`,
    `BT /F1 7 Tf 0.5 0.55 0.6 rg ${L} 60 Td (CONFIDENTIAL MEDICAL RECORD - HEALTHKO TELEHEALTH PLATFORM - PRODUCED FOR PATIENT ARCHIVE) Tj ET`,
    `BT /F2 7 Tf 0.05 0.38 0.45 rg ${R - 90} 60 Td (HEALTHKO ARCHIVE) Tj ET`
  );

  return buildPdfString(cmds.join("\n"));
}

/**
 * Generates an Annual Comprehensive Metabolic & CBC Panel Lab Report PDF
 */
export function generateLabReportPdf(doc?: {
  title?: string;
  doctorOrClinic?: string;
  consultationDate?: string;
  notes?: string;
}): string {
  const facility = doc?.doctorOrClinic || "Hi-Precision Diagnostics Central Laboratory";
  const date = doc?.consultationDate || "2025-08-20";
  const notes =
    doc?.notes ||
    "Fasting blood glucose normal (88 mg/dL). HbA1c 5.4%. Lipid panel shows optimal HDL (58 mg/dL) and LDL (92 mg/dL). Renal and liver function within normal reference limits.";

  const cmds: string[] = [
    // Top Diagnostic Banner (Dark Slate Blue)
    `0.1 0.2 0.32 rg 0 740 ${PAGE_W} 52 re f`,
    `BT /F2 15 Tf 1 1 1 rg ${L} 765 Td (DIAGNOSTIC LABORATORY EXAMINATION REPORT) Tj ET`,
    `BT /F1 8.5 Tf 0.8 0.88 0.95 rg ${L} 750 Td (CLINICAL PATHOLOGY & BIOCHEMISTRY · ACCREDITED REFERENCE LABORATORY) Tj ET`,

    // Facility Info Header
    `0.97 0.98 0.99 rg ${L} 672 520 52 re f`,
    `0.85 0.88 0.92 RG 0.5 w ${L} 672 520 52 re S`,
    `BT /F2 10.5 Tf 0.1 0.18 0.28 rg ${L + 12} 708 Td (${esc(facility)}) Tj ET`,
    `BT /F1 7.5 Tf 0.4 0.48 0.55 rg ${L + 12} 694 Td (Specimen: Venous Whole Blood & Serum · Fasting: 10 hours · Specimen ID: #LAB-2025-0820-891) Tj ET`,
    `BT /F1 7.5 Tf 0.4 0.48 0.55 rg ${L + 12} 680 Td (Report Released: ${esc(date)} · Clinical Pathologist: Dr. R. Santos, MD, FPSP) Tj ET`,

    // Section 1: Chemistry & Metabolic Panel Table Header
    `0.1 0.2 0.32 rg ${L} 642 520 15 re f`,
    `BT /F2 7.5 Tf 1 1 1 rg ${L + 6} 646 Td (TEST / ANALYTE) Tj ET`,
    `BT /F2 7.5 Tf 1 1 1 rg ${L + 190} 646 Td (RESULT) Tj ET`,
    `BT /F2 7.5 Tf 1 1 1 rg ${L + 280} 646 Td (REFERENCE RANGE) Tj ET`,
    `BT /F2 7.5 Tf 1 1 1 rg ${L + 420} 646 Td (FLAG / STATUS) Tj ET`,
  ];

  // Lab Table Rows
  const labRows = [
    { test: "Fasting Blood Sugar (FBS)", val: "88 mg/dL", ref: "70 - 99 mg/dL", flag: "NORMAL" },
    { test: "Glycated Hemoglobin (HbA1c)", val: "5.4 %", ref: "< 5.7 %", flag: "NORMAL" },
    { test: "Total Cholesterol", val: "172 mg/dL", ref: "< 200 mg/dL", flag: "DESIRABLE" },
    { test: "Triglycerides", val: "110 mg/dL", ref: "< 150 mg/dL", flag: "NORMAL" },
    { test: "HDL Cholesterol (Good)", val: "58 mg/dL", ref: "> 40 mg/dL", flag: "OPTIMAL" },
    { test: "LDL Cholesterol (Calculated)", val: "92 mg/dL", ref: "< 100 mg/dL", flag: "OPTIMAL" },
    { test: "Blood Urea Nitrogen (BUN)", val: "14 mg/dL", ref: "7 - 20 mg/dL", flag: "NORMAL" },
    { test: "Creatinine (Serum)", val: "0.95 mg/dL", ref: "0.70 - 1.30 mg/dL", flag: "NORMAL" },
    { test: "eGFR (CKD-EPI)", val: "> 90 mL/min", ref: "> 60 mL/min", flag: "NORMAL" },
    { test: "SGPT / ALT (Liver Enzyme)", val: "22 U/L", ref: "7 - 56 U/L", flag: "NORMAL" },
    { test: "SGOT / AST (Liver Enzyme)", val: "24 U/L", ref: "10 - 40 U/L", flag: "NORMAL" },
    { test: "Hemoglobin (CBC)", val: "14.8 g/dL", ref: "13.5 - 17.5 g/dL", flag: "NORMAL" },
    { test: "White Blood Cells (WBC)", val: "6.4 x10^9/L", ref: "4.5 - 11.0 x10^9/L", flag: "NORMAL" },
    { test: "Platelet Count", val: "265 x10^9/L", ref: "150 - 450 x10^9/L", flag: "NORMAL" },
  ];

  let rY = 626;
  labRows.forEach((row, idx) => {
    const isEven = idx % 2 === 0;
    if (isEven) {
      cmds.push(`0.97 0.98 0.99 rg ${L} ${rY - 3} 520 14 re f`);
    }
    cmds.push(
      `BT /F2 7.5 Tf 0.15 0.22 0.3 rg ${L + 6} ${rY} Td (${esc(row.test)}) Tj ET`,
      `BT /F2 7.5 Tf 0.05 0.4 0.35 rg ${L + 190} ${rY} Td (${esc(row.val)}) Tj ET`,
      `BT /F1 7.5 Tf 0.38 0.44 0.5 rg ${L + 280} ${rY} Td (${esc(row.ref)}) Tj ET`,
      `BT /F2 7 Tf 0.1 0.55 0.35 rg ${L + 420} ${rY} Td (${esc(row.flag)}) Tj ET`
    );
    rY -= 14;
  });

  // Section 2: Clinical Impression
  rY -= 8;
  cmds.push(
    `0.1 0.2 0.32 rg ${L} ${rY} 520 15 re f`,
    `BT /F2 7.5 Tf 1 1 1 rg ${L + 6} ${rY + 4} Td (PATHOLOGIST CLINICAL IMPRESSION & INTERPRETATION) Tj ET`
  );
  rY -= 16;
  const wrappedNotes = wrap(notes, 75);
  for (const line of wrappedNotes) {
    cmds.push(`BT /F1 8 Tf 0.15 0.2 0.26 rg ${L + 6} ${rY} Td (${esc(line)}) Tj ET`);
    rY -= 12;
  }

  // Footer & Certification
  cmds.push(
    `0.9 0.92 0.95 RG 0.5 w ${L} 95 520 0 re S`,
    `BT /F2 8 Tf 0.15 0.25 0.35 rg ${L} 82 Td (ELECTRONICALLY SIGNED AND CERTIFIED) Tj ET`,
    `BT /F1 7 Tf 0.4 0.48 0.55 rg ${L} 70 Td (Certified by Medical Technologist & Pathologist on duty. Archived to patient HealthKo electronic vault.) Tj ET`,
    `BT /F1 6.5 Tf 0.55 0.6 0.65 rg ${L} 45 Td (HEALTHKO ARCHIVED RECORD · DOH ACCREDITED FACILITY · CONFIDENTIAL MEDICAL INFORMATION) Tj ET`
  );

  return buildPdfString(cmds.join("\n"));
}

/**
 * Downloads a sample archive PDF based on document metadata
 */
export async function downloadMedicalArchiveSamplePdf(doc: {
  title?: string;
  fileName?: string;
  category?: string;
  doctorOrClinic?: string;
  consultationDate?: string;
  notes?: string;
}): Promise<void> {
  if (typeof window === "undefined") return;

  const isLab =
    doc.category === "lab" ||
    (doc.title && /lab|metabolic|cbc|panel|blood/i.test(doc.title)) ||
    (doc.fileName && /lab|panel/i.test(doc.fileName));

  const pdfString = isLab ? generateLabReportPdf(doc) : generateConsultationSummaryPdf(doc);
  const blob = new Blob([pdfString], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const fallbackName = isLab ? "Lab_Report_Panel.pdf" : "Consultation_Summary.pdf";
  const name = doc.fileName?.toLowerCase().endsWith(".pdf") ? doc.fileName : `${(doc.fileName || fallbackName).replace(/\.[^/.]+$/, "")}.pdf`;
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

