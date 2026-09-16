/**
 * HealthKo Telehealth – Medical Archive Sample PDF Generators
 * Generates official clinic-grade PDF files for seed documents in the
 * Previous Consultations & Medical Documents hub:
 * 1. Previous Outpatient Consultation Summary (Clinical Encounter Record)
 * 2. Annual Comprehensive Metabolic & CBC Panel (Diagnostic Lab Report)
 * 3. Historical Prescription (Pharmaceutical Record)
 * 4. Hospital Discharge & Clinical Referral Summary (Handover Record)
 * 5. Official Medical Certificate & Fitness to Work Clearance
 * 6. Diagnostic Radiology & Imaging Report (X-Ray / Ultrasound / CT)
 */

import { pdfStringToBytes, triggerBlobDownload } from "./pdf-download-helper";

const PAGE_W = 612;
const PAGE_H = 792;
const L = 46;
const R = 566;
const BODY_W = 520;

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

function wrap(text: string, maxChars = 75): string[] {
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
    // Outer border
    `0.85 0.90 0.94 RG 1 w 28 28 556 736 re S`,

    // Top Brand Banner (Slate/Teal)
    `0.05 0.38 0.45 rg 28 726 556 38 re f`,
    `BT /F2 13 Tf 1 1 1 rg ${L} 746 Td (HEALTHKO CLINICAL ARCHIVE) Tj ET`,
    `BT /F1 7.5 Tf 0.85 0.95 0.98 rg ${L} 734 Td (PREVIOUS CONSULTATION ENCOUNTER SUMMARY  |  OFFICIAL ARCHIVED RECORD) Tj ET`,

    // Clinic / Provider Header Box
    `0.96 0.98 0.99 rg ${L} 658 ${BODY_W} 54 re f`,
    `0.85 0.90 0.94 RG 0.5 w ${L} 658 ${BODY_W} 54 re S`,
    `BT /F2 10.5 Tf 0.08 0.15 0.22 rg ${L + 12} 694 Td (${esc(doctor)}) Tj ET`,
    `BT /F1 8 Tf 0.40 0.48 0.55 rg ${L + 12} 680 Td (Outpatient Clinical Encounter  |  Archived Medical Record) Tj ET`,
    `BT /F1 8 Tf 0.40 0.48 0.55 rg ${L + 12} 667 Td (Encounter Date: ${esc(date)}  |  Record Status: Verified & Archived) Tj ET`,

    // Metadata Bar
    `0.92 0.95 0.97 rg ${L} 624 ${BODY_W} 24 re f`,
    `0.80 0.85 0.90 RG 0.5 w ${L} 624 ${BODY_W} 24 re S`,
    `BT /F2 7 Tf 0.30 0.40 0.48 rg ${L + 10} 633 Td (DOCUMENT TYPE: ENCOUNTER SUMMARY) Tj ET`,
    `BT /F2 7 Tf 0.30 0.40 0.48 rg ${L + 200} 633 Td (CLASSIFICATION: AMBULATORY OUTPATIENT) Tj ET`,
    `BT /F2 7 Tf 0.30 0.40 0.48 rg ${L + 395} 633 Td (CONFIDENTIALITY: LEVEL 2) Tj ET`,

    // Section 1: Encounter Details
    `0.05 0.38 0.45 rg ${L} 596 ${BODY_W} 15 re f`,
    `BT /F2 7.5 Tf 1 1 1 rg ${L + 8} 600 Td (1. ENCOUNTER DETAILS & REASON FOR CONSULTATION) Tj ET`,
    `BT /F2 8 Tf 0.30 0.38 0.46 rg ${L + 8} 578 Td (Service Type:) Tj ET`,
    `BT /F1 8 Tf 0.10 0.15 0.20 rg ${L + 95} 578 Td (Outpatient Cardiology Comprehensive Follow-up) Tj ET`,
    `BT /F2 8 Tf 0.30 0.38 0.46 rg ${L + 8} 563 Td (Chief Complaint:) Tj ET`,
    `BT /F1 8 Tf 0.10 0.15 0.20 rg ${L + 95} 563 Td (Cardiovascular health assessment and preventive lipid optimization screening) Tj ET`,
    `BT /F2 8 Tf 0.30 0.38 0.46 rg ${L + 8} 548 Td (Clinical Status:) Tj ET`,
    `BT /F1 8 Tf 0.10 0.15 0.20 rg ${L + 95} 548 Td (Clinically stable, asymptomatic, no orthopnea or dyspnea on exertion) Tj ET`,

    // Section 2: Vitals Recorded
    `0.05 0.38 0.45 rg ${L} 522 ${BODY_W} 15 re f`,
    `BT /F2 7.5 Tf 1 1 1 rg ${L + 8} 526 Td (2. VITAL SIGNS AT ENCOUNTER) Tj ET`,

    // Vitals 4-column cards
    `0.96 0.98 0.99 rg ${L} 478 122 34 re f`,
    `0.85 0.90 0.94 RG 0.5 w ${L} 478 122 34 re S`,
    `BT /F2 6.5 Tf 0.35 0.45 0.52 rg ${L + 8} 502 Td (BLOOD PRESSURE) Tj ET`,
    `BT /F2 10.5 Tf 0.05 0.38 0.45 rg ${L + 8} 488 Td (118/78) Tj ET`,
    `BT /F1 7 Tf 0.45 0.50 0.55 rg ${L + 56} 488 Td (mmHg) Tj ET`,

    `0.96 0.98 0.99 rg ${L + 130} 478 122 34 re f`,
    `0.85 0.90 0.94 RG 0.5 w ${L + 130} 478 122 34 re S`,
    `BT /F2 6.5 Tf 0.35 0.45 0.52 rg ${L + 138} 502 Td (HEART RATE) Tj ET`,
    `BT /F2 10.5 Tf 0.05 0.38 0.45 rg ${L + 138} 488 Td (72) Tj ET`,
    `BT /F1 7 Tf 0.45 0.50 0.55 rg ${L + 160} 488 Td (bpm) Tj ET`,

    `0.96 0.98 0.99 rg ${L + 260} 478 122 34 re f`,
    `0.85 0.90 0.94 RG 0.5 w ${L + 260} 478 122 34 re S`,
    `BT /F2 6.5 Tf 0.35 0.45 0.52 rg ${L + 268} 502 Td (BODY TEMP) Tj ET`,
    `BT /F2 10.5 Tf 0.05 0.38 0.45 rg ${L + 268} 488 Td (36.6) Tj ET`,
    `BT /F1 7 Tf 0.45 0.50 0.55 rg ${L + 296} 488 Td (deg C) Tj ET`,

    `0.96 0.98 0.99 rg ${L + 390} 478 130 34 re f`,
    `0.85 0.90 0.94 RG 0.5 w ${L + 390} 478 130 34 re S`,
    `BT /F2 6.5 Tf 0.35 0.45 0.52 rg ${L + 398} 502 Td (O2 SATURATION) Tj ET`,
    `BT /F2 10.5 Tf 0.05 0.38 0.45 rg ${L + 398} 488 Td (99%) Tj ET`,
    `BT /F1 7 Tf 0.45 0.50 0.55 rg ${L + 430} 488 Td (room air) Tj ET`,

    // Section 3: Diagnostic Findings & Notes
    `0.05 0.38 0.45 rg ${L} 448 ${BODY_W} 15 re f`,
    `BT /F2 7.5 Tf 1 1 1 rg ${L + 8} 452 Td (3. CLINICAL ASSESSMENT & ATTENDING NOTES) Tj ET`,
  ];

  let curY = 428;
  const wrappedNotes = wrap(notes, 75);
  for (const line of wrappedNotes) {
    cmds.push(`BT /F1 8 Tf 0.10 0.15 0.20 rg ${L + 8} ${curY} Td (${esc(line)}) Tj ET`);
    curY -= 13;
  }

  // Section 4: Care Directives & Prescriptions
  curY -= 8;
  cmds.push(`0.05 0.38 0.45 rg ${L} ${curY} ${BODY_W} 15 re f`);
  cmds.push(`BT /F2 7.5 Tf 1 1 1 rg ${L + 8} ${curY + 4} Td (4. CARE PLAN & PRESCRIBED REGIMEN) Tj ET`);
  curY -= 18;

  const planLines = [
    "* Atorvastatin 20mg orally once daily at bedtime (lipid optimization).",
    "* Daily moderate aerobic activity: 30 minutes, 5 days per week.",
    "* Sodium-restricted Mediterranean-style dietary plan (<2,000 mg/day).",
    "* Maintain routine home blood pressure log twice weekly.",
    "* Annual lipid profile and liver enzymes panel in 6 months prior to next visit.",
  ];
  for (const p of planLines) {
    cmds.push(`BT /F1 8 Tf 0.12 0.18 0.25 rg ${L + 8} ${curY} Td (${esc(p)}) Tj ET`);
    curY -= 13;
  }

  // Verification Seal / Footer
  cmds.push(
    `0.88 0.92 0.95 RG 0.5 w ${L} 115 ${BODY_W} 0 re S`,
    `BT /F2 8 Tf 0.20 0.30 0.40 rg ${L} 98 Td (ATTENDING CLINICIAN VERIFICATION) Tj ET`,
    `BT /F1 7 Tf 0.40 0.48 0.55 rg ${L} 85 Td (Verified electronically in HealthKo Patient Portal. Cryptographically signed clinical encounter copy.) Tj ET`,
    `BT /F1 6.5 Tf 0.50 0.55 0.60 rg ${L} 52 Td (CONFIDENTIAL MEDICAL RECORD - HEALTHKO TELEHEALTH PLATFORM - ARCHIVED RECORD) Tj ET`,
    `BT /F2 6.5 Tf 0.05 0.38 0.45 rg ${R - 85} 52 Td (HEALTHKO ARCHIVE) Tj ET`
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
    // Outer border
    `0.85 0.88 0.92 RG 1 w 28 28 556 736 re S`,

    // Top Diagnostic Banner (Dark Slate Blue)
    `0.10 0.20 0.32 rg 28 726 556 38 re f`,
    `BT /F2 13 Tf 1 1 1 rg ${L} 746 Td (DIAGNOSTIC LABORATORY EXAMINATION REPORT) Tj ET`,
    `BT /F1 7.5 Tf 0.80 0.88 0.95 rg ${L} 734 Td (CLINICAL PATHOLOGY & BIOCHEMISTRY  |  ACCREDITED REFERENCE LABORATORY) Tj ET`,

    // Facility Info Header
    `0.97 0.98 0.99 rg ${L} 658 ${BODY_W} 54 re f`,
    `0.85 0.88 0.92 RG 0.5 w ${L} 658 ${BODY_W} 54 re S`,
    `BT /F2 10.5 Tf 0.10 0.18 0.28 rg ${L + 12} 694 Td (${esc(facility)}) Tj ET`,
    `BT /F1 7.5 Tf 0.40 0.48 0.55 rg ${L + 12} 680 Td (Specimen: Venous Whole Blood & Serum  |  Fasting: 10 hrs  |  Accession #LAB-2025-0820-891) Tj ET`,
    `BT /F1 7.5 Tf 0.40 0.48 0.55 rg ${L + 12} 667 Td (Report Released: ${esc(date)}  |  Clinical Pathologist: Dr. R. Santos, MD, FPSP) Tj ET`,

    // Chemistry & Metabolic Panel Table Header
    `0.10 0.20 0.32 rg ${L} 632 ${BODY_W} 15 re f`,
    `BT /F2 7 Tf 1 1 1 rg ${L + 8} 636 Td (TEST / ANALYTE) Tj ET`,
    `BT /F2 7 Tf 1 1 1 rg ${L + 185} 636 Td (RESULT) Tj ET`,
    `BT /F2 7 Tf 1 1 1 rg ${L + 275} 636 Td (REFERENCE RANGE) Tj ET`,
    `BT /F2 7 Tf 1 1 1 rg ${L + 415} 636 Td (FLAG / STATUS) Tj ET`,
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

  let rY = 616;
  labRows.forEach((row, idx) => {
    const isEven = idx % 2 === 0;
    if (isEven) {
      cmds.push(`0.97 0.98 0.99 rg ${L} ${rY - 3} ${BODY_W} 13 re f`);
    }
    cmds.push(
      `BT /F2 7 Tf 0.15 0.22 0.30 rg ${L + 8} ${rY} Td (${esc(row.test)}) Tj ET`,
      `BT /F2 7 Tf 0.05 0.40 0.35 rg ${L + 185} ${rY} Td (${esc(row.val)}) Tj ET`,
      `BT /F1 7 Tf 0.38 0.44 0.50 rg ${L + 275} ${rY} Td (${esc(row.ref)}) Tj ET`,
      `BT /F2 6.5 Tf 0.10 0.55 0.35 rg ${L + 415} ${rY} Td (${esc(row.flag)}) Tj ET`
    );
    rY -= 13;
  });

  // Section 2: Clinical Impression
  rY -= 6;
  cmds.push(
    `0.10 0.20 0.32 rg ${L} ${rY} ${BODY_W} 15 re f`,
    `BT /F2 7.5 Tf 1 1 1 rg ${L + 8} ${rY + 4} Td (PATHOLOGIST CLINICAL IMPRESSION & INTERPRETATION) Tj ET`
  );
  rY -= 15;
  const wrappedNotes = wrap(notes, 75);
  for (const line of wrappedNotes) {
    cmds.push(`BT /F1 7.5 Tf 0.15 0.20 0.26 rg ${L + 8} ${rY} Td (${esc(line)}) Tj ET`);
    rY -= 12;
  }

  // Footer & Certification
  cmds.push(
    `0.88 0.90 0.94 RG 0.5 w ${L} 95 ${BODY_W} 0 re S`,
    `BT /F2 7.5 Tf 0.15 0.25 0.35 rg ${L} 80 Td (ELECTRONICALLY SIGNED AND CERTIFIED BY LABORATORY) Tj ET`,
    `BT /F1 7 Tf 0.40 0.48 0.55 rg ${L} 68 Td (Certified by Medical Technologist & Pathologist on duty. Archived to HealthKo electronic vault.) Tj ET`,
    `BT /F1 6.5 Tf 0.55 0.60 0.65 rg ${L} 48 Td (HEALTHKO ARCHIVED RECORD  |  DOH ACCREDITED FACILITY  |  CONFIDENTIAL MEDICAL INFORMATION) Tj ET`
  );

  return buildPdfString(cmds.join("\n"));
}

/**
 * Generates an Archived Past Prescription PDF
 */
export function generatePrescriptionSamplePdf(doc?: {
  title?: string;
  doctorOrClinic?: string;
  consultationDate?: string;
  notes?: string;
}): string {
  const doctor = doc?.doctorOrClinic || "Dr. Maria Luisa Santos, MD · Makati Medical Center";
  const date = doc?.consultationDate || "2026-06-18";
  const notes =
    doc?.notes ||
    "Prescribed: Cetirizine 10mg tab once daily at bedtime (14 days), Fluticasone furoate nasal spray 27.5mcg (1 spray each nostril daily for 30 days).";

  const cmds: string[] = [
    // Outer border
    `0.88 0.84 0.92 RG 1 w 28 28 556 736 re S`,

    // Brand Banner (Purple / Indigo)
    `0.35 0.18 0.55 rg 28 726 556 38 re f`,
    `BT /F2 13 Tf 1 1 1 rg ${L} 746 Td (HEALTHKO ARCHIVED PRESCRIPTION RECORD) Tj ET`,
    `BT /F1 7.5 Tf 0.90 0.85 0.95 rg ${L} 734 Td (ELECTRONIC MEDICAL ARCHIVE  |  HISTORICAL PHARMACEUTICAL ORDERS) Tj ET`,

    // Doctor & Clinic Header
    `0.98 0.96 0.99 rg ${L} 658 ${BODY_W} 54 re f`,
    `0.88 0.82 0.92 RG 0.5 w ${L} 658 ${BODY_W} 54 re S`,
    `BT /F2 10.5 Tf 0.20 0.10 0.35 rg ${L + 12} 694 Td (${esc(doctor)}) Tj ET`,
    `BT /F1 7.5 Tf 0.45 0.40 0.50 rg ${L + 12} 680 Td (Internal Medicine & Immunology  |  PRC Lic #0098741  |  S2 Lic #87124) Tj ET`,
    `BT /F1 7.5 Tf 0.45 0.40 0.50 rg ${L + 12} 667 Td (Prescribed Date: ${esc(date)}  |  Status: Dispensed & Archived) Tj ET`,

    // Rx Symbol Bar
    `0.35 0.18 0.55 rg ${L} 624 ${BODY_W} 24 re f`,
    `BT /F2 10.5 Tf 1 1 1 rg ${L + 10} 632 Td (Rx   -   OFFICIAL HISTORICAL PRESCRIPTION) Tj ET`,

    // Medications Table Header
    `0.92 0.88 0.95 rg ${L} 598 ${BODY_W} 16 re f`,
    `BT /F2 7 Tf 0.25 0.15 0.35 rg ${L + 10} 603 Td (MEDICATION / BRAND / FORM) Tj ET`,
    `BT /F2 7 Tf 0.25 0.15 0.35 rg ${L + 205} 603 Td (DOSAGE & FREQUENCY) Tj ET`,
    `BT /F2 7 Tf 0.25 0.15 0.35 rg ${L + 385} 603 Td (DURATION / QTY) Tj ET`,
  ];

  const rxItems = [
    { name: "Cetirizine 10mg Film-Coated Tablet", dose: "1 tablet once daily at bedtime", dur: "14 days (#14 tabs)" },
    { name: "Fluticasone Furoate 27.5mcg Nasal Spray", dose: "1 spray each nostril once daily", dur: "30 days (1 bottle)" },
    { name: "Saline Nasal Irrigation Wash", dose: "Flush nasal cavities twice daily as needed", dur: "As needed" },
  ];

  let curY = 580;
  rxItems.forEach((rx, idx) => {
    if (idx % 2 === 0) {
      cmds.push(`0.98 0.96 0.99 rg ${L} ${curY - 4} ${BODY_W} 16 re f`);
    }
    cmds.push(
      `BT /F2 7.5 Tf 0.15 0.10 0.25 rg ${L + 10} ${curY} Td (${esc(rx.name)}) Tj ET`,
      `BT /F1 7.5 Tf 0.25 0.20 0.35 rg ${L + 205} ${curY} Td (${esc(rx.dose)}) Tj ET`,
      `BT /F2 7 Tf 0.35 0.18 0.55 rg ${L + 385} ${curY} Td (${esc(rx.dur)}) Tj ET`
    );
    curY -= 18;
  });

  // Instructions & Notes
  curY -= 8;
  cmds.push(
    `0.35 0.18 0.55 rg ${L} ${curY} ${BODY_W} 15 re f`,
    `BT /F2 7.5 Tf 1 1 1 rg ${L + 8} ${curY + 4} Td (PRESCRIBER CLINICAL DIRECTIVES & SPECIAL INSTRUCTIONS) Tj ET`
  );
  curY -= 16;
  const wrappedNotes = wrap(notes, 75);
  for (const line of wrappedNotes) {
    cmds.push(`BT /F1 8 Tf 0.20 0.15 0.25 rg ${L + 8} ${curY} Td (${esc(line)}) Tj ET`);
    curY -= 13;
  }

  // Footer
  cmds.push(
    `0.88 0.84 0.92 RG 0.5 w ${L} 100 ${BODY_W} 0 re S`,
    `BT /F2 7.5 Tf 0.30 0.15 0.40 rg ${L} 84 Td (VALIDATED HISTORICAL RECORD  |  FDA & DOH COMPLIANT ARCHIVE) Tj ET`,
    `BT /F1 7 Tf 0.45 0.40 0.50 rg ${L} 70 Td (This archived electronic copy reflects prescriptions originally validated and signed on HealthKo Telehealth platform.) Tj ET`,
    `BT /F1 6.5 Tf 0.50 0.50 0.55 rg ${L} 48 Td (HEALTHKO ARCHIVE  |  CONFIDENTIAL PATIENT PHARMACEUTICAL RECORD) Tj ET`
  );

  return buildPdfString(cmds.join("\n"));
}

/**
 * Generates an Archived Discharge & Referral Summary PDF
 */
export function generateDischargeSamplePdf(doc?: {
  title?: string;
  doctorOrClinic?: string;
  consultationDate?: string;
  notes?: string;
}): string {
  const facility = doc?.doctorOrClinic || "Cardinal Santos Medical Center - Department of Cardiology";
  const date = doc?.consultationDate || "2026-04-10";
  const notes =
    doc?.notes ||
    "Patient presented for acute chest tightness evaluation. Coronary angiogram negative for critical stenosis. Discharge in stable condition with referral to outpatient cardiology for lifestyle optimization.";

  const cmds: string[] = [
    // Outer border
    `0.85 0.90 0.96 RG 1 w 28 28 556 736 re S`,

    // Blue Brand Banner
    `0.12 0.32 0.58 rg 28 726 556 38 re f`,
    `BT /F2 13 Tf 1 1 1 rg ${L} 746 Td (HOSPITAL DISCHARGE & CLINICAL REFERRAL SUMMARY) Tj ET`,
    `BT /F1 7.5 Tf 0.85 0.92 0.98 rg ${L} 734 Td (DEPARTMENT OF CARDIOLOGY & INPATIENT SERVICES  |  CLINICAL HANDOVER) Tj ET`,

    // Facility Info
    `0.96 0.98 1.00 rg ${L} 658 ${BODY_W} 54 re f`,
    `0.85 0.90 0.95 RG 0.5 w ${L} 658 ${BODY_W} 54 re S`,
    `BT /F2 10.5 Tf 0.10 0.20 0.40 rg ${L + 12} 694 Td (${esc(facility)}) Tj ET`,
    `BT /F1 7.5 Tf 0.40 0.48 0.55 rg ${L + 12} 680 Td (Admission #CSMC-2026-4401  |  Attending: Dr. Roberto Garcia, MD, FPCP, FPCC) Tj ET`,
    `BT /F1 7.5 Tf 0.40 0.48 0.55 rg ${L + 12} 667 Td (Discharge Date: ${esc(date)}  |  Disposition: Discharged Home, Clinically Stable) Tj ET`,

    // Discharge Details Box
    `0.12 0.32 0.58 rg ${L} 624 ${BODY_W} 24 re f`,
    `BT /F2 7.5 Tf 1 1 1 rg ${L + 10} 633 Td (ADMISSION DIAGNOSIS: NON-CARDIAC CHEST DISCOMFORT) Tj ET`,
    `BT /F2 7.5 Tf 1 1 1 rg ${L + 280} 633 Td (FINAL STATUS: RESOLVED / STABLE) Tj ET`,

    // Section 1: Hospital Course & Summary
    `0.12 0.32 0.58 rg ${L} 598 ${BODY_W} 15 re f`,
    `BT /F2 7.5 Tf 1 1 1 rg ${L + 8} 602 Td (1. CLINICAL COURSE & INPATIENT SUMMARY) Tj ET`,
  ];

  let curY = 578;
  const wrappedNotes = wrap(notes, 75);
  for (const line of wrappedNotes) {
    cmds.push(`BT /F1 8 Tf 0.10 0.15 0.25 rg ${L + 8} ${curY} Td (${esc(line)}) Tj ET`);
    curY -= 13;
  }

  // Section 2: Referral Directives
  curY -= 8;
  cmds.push(
    `0.12 0.32 0.58 rg ${L} ${curY} ${BODY_W} 15 re f`,
    `BT /F2 7.5 Tf 1 1 1 rg ${L + 8} ${curY + 4} Td (2. OUTPATIENT REFERRAL & FOLLOW-UP INSTRUCTIONS) Tj ET`
  );
  curY -= 16;
  const referralLines = [
    "* Referral to Outpatient Telehealth Cardiology via HealthKo for ongoing monitoring.",
    "* Repeat 12-Lead ECG in 3 months or upon return of symptoms.",
    "* Continue Low-dose Aspirin 80mg once daily with breakfast.",
    "* Red flag symptoms discussed: severe crushing chest pain radiating to jaw or left arm requires immediate emergency admission.",
  ];
  for (const p of referralLines) {
    cmds.push(`BT /F1 8 Tf 0.12 0.18 0.25 rg ${L + 8} ${curY} Td (${esc(p)}) Tj ET`);
    curY -= 13;
  }

  // Footer
  cmds.push(
    `0.88 0.92 0.96 RG 0.5 w ${L} 100 ${BODY_W} 0 re S`,
    `BT /F2 7.5 Tf 0.15 0.25 0.40 rg ${L} 84 Td (OFFICIAL HOSPITAL DISCHARGE CLEARANCE  |  CERTIFIED COPY) Tj ET`,
    `BT /F1 7 Tf 0.40 0.48 0.55 rg ${L} 70 Td (Produced electronically for patient health record. Medical records department copy archived.) Tj ET`,
    `BT /F1 6.5 Tf 0.50 0.55 0.60 rg ${L} 48 Td (CONFIDENTIAL MEDICAL INFORMATION  |  HEALTHKO HEALTH ARCHIVE SYSTEM) Tj ET`
  );

  return buildPdfString(cmds.join("\n"));
}

/**
 * Generates an Archived Medical Certificate PDF
 */
export function generateCertificateSamplePdf(doc?: {
  title?: string;
  doctorOrClinic?: string;
  consultationDate?: string;
  notes?: string;
}): string {
  const doctor = doc?.doctorOrClinic || "Dr. Maria Luisa Santos, MD · HealthKo Medical Network";
  const date = doc?.consultationDate || "2026-06-18";
  const notes =
    doc?.notes ||
    "To Whom It May Concern: This certifies that the patient was examined and diagnosed with Acute Upper Respiratory Tract Infection and is advised medical leave of absence for 3 days.";

  const cmds: string[] = [
    // Outer border
    `0.92 0.82 0.86 RG 1 w 28 28 556 736 re S`,

    // Rose / Crimson Banner
    `0.62 0.15 0.25 rg 28 726 556 38 re f`,
    `BT /F2 12.5 Tf 1 1 1 rg ${L} 746 Td (OFFICIAL MEDICAL CERTIFICATE & CLEARANCE) Tj ET`,
    `BT /F1 7.5 Tf 0.98 0.88 0.90 rg ${L} 734 Td (CERTIFIED CLINICAL DOCUMENT  |  PRC & DOH ACCREDITED TELEHEALTH PHYSICIAN) Tj ET`,

    // Header Box
    `0.99 0.96 0.97 rg ${L} 658 ${BODY_W} 54 re f`,
    `0.92 0.82 0.86 RG 0.5 w ${L} 658 ${BODY_W} 54 re S`,
    `BT /F2 10.5 Tf 0.40 0.10 0.18 rg ${L + 12} 694 Td (${esc(doctor)}) Tj ET`,
    `BT /F1 7.5 Tf 0.48 0.40 0.44 rg ${L + 12} 680 Td (PRC Board Certified Specialist  |  License #0098741  |  PTR #441209) Tj ET`,
    `BT /F1 7.5 Tf 0.48 0.40 0.44 rg ${L + 12} 667 Td (Certificate Date: ${esc(date)}  |  Reference: #MC-2026-0618-912) Tj ET`,

    // Certificate Box
    `0.62 0.15 0.25 rg ${L} 624 ${BODY_W} 24 re f`,
    `BT /F2 8.5 Tf 1 1 1 rg ${L + 10} 633 Td (CERTIFICATION: MEDICAL SICK LEAVE & FITNESS STATUS) Tj ET`,
  ];

  let curY = 598;
  const wrappedNotes = wrap(notes, 75);
  for (const line of wrappedNotes) {
    cmds.push(`BT /F1 8.5 Tf 0.15 0.10 0.15 rg ${L + 8} ${curY} Td (${esc(line)}) Tj ET`);
    curY -= 14;
  }

  // Recommendations
  curY -= 10;
  cmds.push(
    `0.62 0.15 0.25 rg ${L} ${curY} ${BODY_W} 15 re f`,
    `BT /F2 7.5 Tf 1 1 1 rg ${L + 8} ${curY + 4} Td (RECOMMENDED PERIOD OF REST & RESTRICTIONS) Tj ET`
  );
  curY -= 16;
  const certBullets = [
    "* Recommended Bed Rest Period: 3 Consecutive Days.",
    "* Excused from physical office duties, strenuous manual labor, and physical education activities.",
    "* Fit to resume light work duties from home as tolerated.",
    "* Re-evaluation indicated if fever persists beyond 72 hours.",
  ];
  for (const p of certBullets) {
    cmds.push(`BT /F1 8 Tf 0.15 0.10 0.15 rg ${L + 8} ${curY} Td (${esc(p)}) Tj ET`);
    curY -= 13;
  }

  // Attending Signature Footer
  cmds.push(
    `0.92 0.85 0.88 RG 0.5 w ${L} 100 ${BODY_W} 0 re S`,
    `BT /F2 7.5 Tf 0.40 0.15 0.22 rg ${L} 84 Td (ATTENDING CLINICIAN ELECTRONIC SIGNATURE & VERIFICATION) Tj ET`,
    `BT /F1 7 Tf 0.45 0.40 0.45 rg ${L} 70 Td (Verified electronically through HealthKo Medical Portal. Security Hash: #SHA256-MC912-VERIFIED.) Tj ET`,
    `BT /F1 6.5 Tf 0.50 0.50 0.55 rg ${L} 48 Td (HEALTHKO ARCHIVED DOCUMENT  |  NOT VALID AS MEDICO-LEGAL EXPERT WITNESS TESTIMONY) Tj ET`
  );

  return buildPdfString(cmds.join("\n"));
}

/**
 * Generates an Archived Imaging & Scan Report PDF (X-Ray, Ultrasound, CT, MRI)
 */
export function generateImagingSamplePdf(doc?: {
  title?: string;
  doctorOrClinic?: string;
  consultationDate?: string;
  notes?: string;
}): string {
  const facility = doc?.doctorOrClinic || "St. Luke's Advanced Diagnostic Imaging Center";
  const date = doc?.consultationDate || "2026-03-05";
  const notes =
    doc?.notes ||
    "Examination: 2-View Chest Radiograph (PA & Lateral). Lungs are clear without active infiltrates, consolidation, or pleural effusion. Cardiothoracic ratio is normal (0.46). Bony thorax and diaphragm intact.";

  const cmds: string[] = [
    // Outer border
    `0.85 0.92 0.95 RG 1 w 28 28 556 736 re S`,

    // Cyan / Teal Banner
    `0.08 0.42 0.48 rg 28 726 556 38 re f`,
    `BT /F2 13 Tf 1 1 1 rg ${L} 746 Td (DIAGNOSTIC RADIOLOGY & IMAGING REPORT) Tj ET`,
    `BT /F1 7.5 Tf 0.85 0.95 0.98 rg ${L} 734 Td (DIGITAL RADIOGRAPHY & MEDICAL IMAGING  |  ACCREDITED IMAGING FACILITY) Tj ET`,

    // Facility & Scan Header
    `0.96 0.99 1.00 rg ${L} 658 ${BODY_W} 54 re f`,
    `0.85 0.92 0.95 RG 0.5 w ${L} 658 ${BODY_W} 54 re S`,
    `BT /F2 10.5 Tf 0.05 0.25 0.32 rg ${L + 12} 694 Td (${esc(facility)}) Tj ET`,
    `BT /F1 7.5 Tf 0.35 0.48 0.52 rg ${L + 12} 680 Td (Modality: Digital Radiography (X-Ray)  |  Accession #IMG-2026-0305-182) Tj ET`,
    `BT /F1 7.5 Tf 0.35 0.48 0.52 rg ${L + 12} 667 Td (Exam Date: ${esc(date)}  |  Radiologist: Dr. Alexander Tan, MD, FPCR) Tj ET`,

    // Modality Header Bar
    `0.08 0.42 0.48 rg ${L} 624 ${BODY_W} 24 re f`,
    `BT /F2 7.5 Tf 1 1 1 rg ${L + 10} 633 Td (STUDY: CHEST 2-VIEWS (POSTEROANTERIOR & LATERAL)) Tj ET`,
    `BT /F2 7.5 Tf 1 1 1 rg ${L + 340} 633 Td (CLINICAL STATUS: NORMAL STUDY) Tj ET`,

    // Section 1: Technique & Findings
    `0.08 0.42 0.48 rg ${L} 598 ${BODY_W} 15 re f`,
    `BT /F2 7.5 Tf 1 1 1 rg ${L + 8} 602 Td (1. RADIOLOGICAL OBSERVATIONS & FINDINGS) Tj ET`,
  ];

  let curY = 578;
  const wrappedNotes = wrap(notes, 75);
  for (const line of wrappedNotes) {
    cmds.push(`BT /F1 8 Tf 0.10 0.18 0.22 rg ${L + 8} ${curY} Td (${esc(line)}) Tj ET`);
    curY -= 13;
  }

  // Section 2: Detailed Organ Findings Table
  curY -= 8;
  cmds.push(
    `0.08 0.42 0.48 rg ${L} ${curY} ${BODY_W} 15 re f`,
    `BT /F2 7.5 Tf 1 1 1 rg ${L + 8} ${curY + 4} Td (2. DETAILED ANATOMICAL STRUCTURE EVALUATION) Tj ET`
  );
  curY -= 16;
  const findings = [
    { area: "Trachea & Airways", status: "Midline, patent, no tracheobronchial deviation" },
    { area: "Lungs & Parenchyma", status: "Normal vascularity, clear bilateral lung fields" },
    { area: "Cardiac Silhouette", status: "Normal size and contour, CTR 0.46 (Normal < 0.50)" },
    { area: "Costophrenic Angles", status: "Sharp bilaterally, no pleural thickening or fluid" },
    { area: "Thoracic Skeleton", status: "No acute rib fractures or osteolytic focal lesions" },
  ];
  findings.forEach((item, idx) => {
    if (idx % 2 === 0) {
      cmds.push(`0.96 0.98 0.99 rg ${L} ${curY - 3} ${BODY_W} 14 re f`);
    }
    cmds.push(
      `BT /F2 7 Tf 0.08 0.35 0.40 rg ${L + 8} ${curY} Td (${esc(item.area)}) Tj ET`,
      `BT /F1 7 Tf 0.20 0.28 0.35 rg ${L + 160} ${curY} Td (${esc(item.status)}) Tj ET`
    );
    curY -= 14;
  });

  // Impression
  curY -= 6;
  cmds.push(
    `0.08 0.42 0.48 rg ${L} ${curY} ${BODY_W} 15 re f`,
    `BT /F2 7.5 Tf 1 1 1 rg ${L + 8} ${curY + 4} Td (3. FINAL RADIOLOGIST IMPRESSION) Tj ET`
  );
  curY -= 16;
  cmds.push(`BT /F2 8.5 Tf 0.10 0.45 0.35 rg ${L + 8} ${curY} Td (IMPRESSION: NO ACUTE CARDIOPULMONARY ABNORMALITY DETECTED.) Tj ET`);

  // Footer
  cmds.push(
    `0.88 0.92 0.94 RG 0.5 w ${L} 100 ${BODY_W} 0 re S`,
    `BT /F2 7.5 Tf 0.15 0.30 0.35 rg ${L} 84 Td (BOARD CERTIFIED RADIOLOGIST ELECTRONIC SIGN-OFF) Tj ET`,
    `BT /F1 7 Tf 0.40 0.48 0.52 rg ${L} 70 Td (Report digitally transmitted via PACS and archived to patient HealthKo Medical Cloud.) Tj ET`,
    `BT /F1 6.5 Tf 0.50 0.55 0.60 rg ${L} 48 Td (HEALTHKO ARCHIVED MEDICAL IMAGING  |  PROTECTED HEALTH INFORMATION) Tj ET`
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

  try {
    const cat = doc.category || "";
    const title = (doc.title || "").toLowerCase();
    const file = (doc.fileName || "").toLowerCase();

    let pdfString: string;
    let fallbackName: string;

    if (cat === "lab" || title.includes("lab") || title.includes("cbc") || title.includes("metabolic") || file.includes("lab")) {
      pdfString = generateLabReportPdf(doc);
      fallbackName = "Diagnostic_Lab_Report.pdf";
    } else if (cat === "prescription" || title.includes("prescription") || file.includes("prescription") || title.includes("rx")) {
      pdfString = generatePrescriptionSamplePdf(doc);
      fallbackName = "Archived_Prescription.pdf";
    } else if (cat === "discharge" || title.includes("discharge") || title.includes("referral") || file.includes("discharge")) {
      pdfString = generateDischargeSamplePdf(doc);
      fallbackName = "Discharge_Referral_Summary.pdf";
    } else if (cat === "certificate" || title.includes("certificate") || file.includes("certificate") || title.includes("leave")) {
      pdfString = generateCertificateSamplePdf(doc);
      fallbackName = "Medical_Certificate.pdf";
    } else if (cat === "imaging" || title.includes("x-ray") || title.includes("scan") || title.includes("ultrasound") || title.includes("mri") || file.includes("imaging")) {
      pdfString = generateImagingSamplePdf(doc);
      fallbackName = "Diagnostic_Imaging_Report.pdf";
    } else {
      // Default consultation or other clinical encounter record
      pdfString = generateConsultationSummaryPdf(doc);
      fallbackName = "Consultation_Summary.pdf";
    }

    const name = doc.fileName?.toLowerCase().endsWith(".pdf")
      ? doc.fileName
      : `${(doc.fileName || fallbackName).replace(/\.[^/.]+$/, "")}.pdf`;

    // Use Uint8Array encoding (avoids UTF-16 corruption) + MouseEvent dispatch (Chrome-safe)
    const blob = new Blob([pdfStringToBytes(pdfString)], { type: "application/pdf" });
    triggerBlobDownload(blob, name);
  } catch (err) {
    console.error("downloadMedicalArchiveSamplePdf failed:", err);
  }
}
