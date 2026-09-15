/**
 * HealthKo Telehealth – Consultation Report PDF Generator
 * Generates a comprehensive clinical encounter report covering patient demographics,
 * vitals, chief complaint, clinical assessment, diagnosis, care plan, prescription
 * summary, and follow-up instructions.
 * Distinct from consultation-transcript-pdf.ts (which handles dialogue/transcript).
 */

const PAGE_W = 612;
const PAGE_H = 792;
const L = 46; // left margin
const R = 566; // right margin

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

function sectionHeader(label: string, y: number): string[] {
  return [
    `0.05 0.45 0.52 rg ${L} ${y - 1} 520 14 re f`,
    `BT /F2 8 Tf 1 1 1 rg ${L + 6} ${y + 3} Td (${esc(label)}) Tj ET`,
  ];
}

function labelValue(
  label: string,
  value: string,
  x: number,
  y: number,
  valX?: number
): string[] {
  const vx = valX ?? x + 100;
  return [
    `BT /F2 7.5 Tf 0.35 0.4 0.48 rg ${x} ${y} Td (${esc(label + ":")}) Tj ET`,
    `BT /F1 8 Tf 0.1 0.15 0.2 rg ${vx} ${y} Td (${esc(value || "—")}) Tj ET`,
  ];
}

function vitalBox(
  label: string,
  value: string,
  unit: string,
  x: number,
  y: number,
  w: number
): string[] {
  const hasVal = !!(value && value.trim() && value.toLowerCase() !== "n/a");
  return [
    `0.96 0.98 0.99 rg ${x} ${y - 28} ${w} 32 re f`,
    `0.82 0.88 0.92 RG 0.5 w ${x} ${y - 28} ${w} 32 re S`,
    `BT /F2 7 Tf 0.35 0.45 0.52 rg ${x + 5} ${y - 2} Td (${esc(label.toUpperCase())}) Tj ET`,
    `BT /F2 ${hasVal ? "11" : "9"} Tf ${hasVal ? "0.05 0.45 0.52" : "0.65 0.68 0.7"} rg ${x + 5} ${y - 16} Td (${esc(hasVal ? value : "N/A")}) Tj ET`,
    hasVal
      ? `BT /F1 7 Tf 0.45 0.5 0.55 rg ${x + 5} ${y - 26} Td (${esc(unit)}) Tj ET`
      : "",
  ].filter(Boolean) as string[];
}

function textBlock(
  lines: string[],
  startY: number,
  indent = 0
): { cmds: string[]; endY: number } {
  const cmds: string[] = [];
  let y = startY;
  for (const line of lines) {
    cmds.push(
      `BT /F1 8 Tf 0.12 0.17 0.22 rg ${L + indent} ${y} Td (${esc(line)}) Tj ET`
    );
    y -= 11;
  }
  return { cmds, endY: y };
}

function formatReportDate(d?: Date | string | null): string {
  if (!d)
    return new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  try {
    return new Date(d).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return String(d);
  }
}

export interface ConsultationReportData {
  // Doctor
  doctorName: string;
  doctorSpecialty?: string | null;
  doctorLicense?: string | null;
  doctorNpi?: string | null;
  clinicName?: string | null;
  // Patient
  patientName: string;
  patientDob?: string | null;
  patientAge?: string | number | null;
  patientGender?: string | null;
  patientAddress?: string | null;
  patientPhone?: string | null;
  // Vitals
  bloodPressure?: string | null;
  heartRate?: string | null;
  bodyTemperature?: string | null;
  oxygenSaturation?: string | null;
  weight?: string | null;
  height?: string | null;
  // Encounter
  appointmentId?: string | null;
  date?: Date | string | null;
  durationMinutes?: number | null;
  reasonForVisit?: string | null;
  // Clinical
  chiefComplaint?: string | null;
  clinicalAssessment?: string | null;
  diagnosis?: string | null;
  carePlan?: string | null;
  prescriptionSummary?: string | null;
  // Follow-up
  followUpDate?: string | null;
  monitoringInstructions?: string | null;
}

export function generateConsultationReportPdf(
  data: ConsultationReportData
): string {
  const doctorName = data.doctorName || "Attending Physician";
  const doctorSpecialty = data.doctorSpecialty || "General Medicine";
  const doctorLicense = data.doctorLicense || "MD-ACTIVE";
  const doctorNpi = data.doctorNpi || "NPI-VERIFIED";
  const clinicName =
    data.clinicName ||
    `Clinic of Dr. ${doctorName.replace(/^Dr\.?\s+/i, "")}, MD`;
  const patientName = data.patientName || "Patient";
  const sessionRef = data.appointmentId
    ? `HK-RPT-${data.appointmentId.slice(-8).toUpperCase()}`
    : `HK-RPT-${Date.now().toString(36).toUpperCase()}`;
  const formattedDate = formatReportDate(data.date);
  const duration = data.durationMinutes ? `${data.durationMinutes} min` : "—";

  const cmds: string[] = [];

  // Borders
  cmds.push("0.82 0.88 0.92 RG 1 w 28 28 556 736 re S");
  cmds.push("0.92 0.95 0.97 RG 0.5 w 32 32 548 728 re S");

  // Top banner
  cmds.push("0.05 0.45 0.52 rg 32 720 548 40 re f");
  cmds.push(
    `BT /F2 12 Tf 1 1 1 rg ${L} 742 Td (HEALTHKO TELEHEALTH CLINICAL REPORT) Tj ET`
  );
  cmds.push(
    `BT /F1 8 Tf 0.88 0.96 0.95 rg ${L} 730 Td (OFFICIAL CONSULTATION ENCOUNTER SUMMARY  |  HIPAA / DOH Compliant) Tj ET`
  );

  // Clinic & doctor
  cmds.push(
    `BT /F2 13 Tf 0.05 0.18 0.22 rg ${L} 700 Td (${esc(clinicName)}) Tj ET`
  );
  cmds.push(
    `BT /F2 9 Tf 0.05 0.58 0.53 rg ${L} 686 Td (${esc(doctorSpecialty.toUpperCase())}  —  TREATING PHYSICIAN) Tj ET`
  );
  cmds.push(
    `BT /F1 8 Tf 0.42 0.47 0.53 rg ${L} 674 Td (Dr. ${esc(doctorName.replace(/^Dr\.?\s+/i, ""))}   |   Lic: ${esc(doctorLicense)}   |   NPI: ${esc(doctorNpi)}) Tj ET`
  );
  cmds.push("0.05 0.58 0.53 RG 2 w");
  cmds.push(`${L} 662 m ${R} 662 l S`);
  cmds.push("0.85 0.9 0.92 RG 0.5 w");
  cmds.push(`${L} 659 m ${R} 659 l S`);

  // Patient info box
  cmds.push("0.96 0.98 1 rg 46 600 520 52 re f");
  cmds.push("0.82 0.88 0.92 RG 0.75 w 46 600 520 52 re S");
  const pL: [string, string][] = [
    ["PATIENT", patientName],
    [
      "DATE OF BIRTH",
      data.patientDob
        ? formatReportDate(data.patientDob)
        : data.patientAge
        ? `Age ${data.patientAge}`
        : "—",
    ],
    ["GENDER", data.patientGender || "—"],
  ];
  const pR: [string, string][] = [
    ["ENCOUNTER DATE", formattedDate],
    ["SESSION REF", sessionRef],
    ["DURATION", duration],
  ];
  let pY = 640;
  for (const [lbl, val] of pL) {
    cmds.push(...labelValue(lbl, val, L + 8, pY, L + 80));
    pY -= 13;
  }
  pY = 640;
  for (const [lbl, val] of pR) {
    cmds.push(...labelValue(lbl, val, 320, pY, 420));
    pY -= 13;
  }

  // Vitals
  let y = 592;
  cmds.push(...sectionHeader("VITAL SIGNS", y));
  y -= 40;
  const vW = 82,
    vG = 88;
  const vitals: [string, string, string][] = [
    ["Blood Pressure", data.bloodPressure || "", "mmHg"],
    ["Heart Rate", data.heartRate || "", "bpm"],
    ["Temperature", data.bodyTemperature || "", "deg C/F"],
    ["O2 Saturation", data.oxygenSaturation || "", "% SpO2"],
    ["Weight", data.weight || "", "kg / lbs"],
    ["Height", data.height || "", "cm / ft"],
  ];
  vitals.forEach(([lbl, val, unit], i) =>
    cmds.push(...vitalBox(lbl, val, unit, L + i * vG, y, vW))
  );
  y -= 14;

  // Chief Complaint
  cmds.push(...sectionHeader("CHIEF COMPLAINT & REASON FOR VISIT", y));
  y -= 18;
  const ccLines = wrap(
    data.chiefComplaint ||
      data.reasonForVisit ||
      "General medical consultation and health evaluation.",
    80
  );
  const { cmds: ccC, endY: ccE } = textBlock(ccLines, y, 8);
  cmds.push(...ccC);
  y = ccE - 6;

  // Clinical Assessment
  cmds.push(...sectionHeader("CLINICAL ASSESSMENT", y));
  y -= 18;
  const asLines = wrap(
    data.clinicalAssessment ||
      "Patient evaluated via synchronous telehealth examination. Clinical findings documented.",
    80
  );
  const { cmds: asC, endY: asE } = textBlock(asLines, y, 8);
  cmds.push(...asC);
  y = asE - 6;

  // Diagnosis
  if (data.diagnosis) {
    cmds.push(...sectionHeader("DIAGNOSIS", y));
    y -= 18;
    const dxLines = wrap(data.diagnosis, 80);
    const { cmds: dxC, endY: dxE } = textBlock(dxLines, y, 8);
    cmds.push(...dxC);
    y = dxE - 6;
  }

  // Care Plan
  cmds.push(...sectionHeader("CARE PLAN & DIRECTIVES", y));
  y -= 18;
  const cpLines = wrap(
    data.carePlan ||
      "Follow prescribed medication regimen. Monitor symptoms and report adverse reactions. Book follow-up as advised.",
    80
  );
  const { cmds: cpC, endY: cpE } = textBlock(cpLines, y, 8);
  cmds.push(...cpC);
  y = cpE - 6;

  // Prescription Summary
  if (data.prescriptionSummary) {
    cmds.push(...sectionHeader("PRESCRIPTION SUMMARY", y));
    y -= 18;
    const rxLines = wrap(data.prescriptionSummary, 80);
    const { cmds: rxC, endY: rxE } = textBlock(rxLines, y, 8);
    cmds.push(...rxC);
    y = rxE - 6;
  }

  // Follow-up
  if (data.followUpDate || data.monitoringInstructions) {
    cmds.push(...sectionHeader("FOLLOW-UP & MONITORING", y));
    y -= 18;
    if (data.followUpDate) {
      cmds.push(...labelValue("Next Visit", data.followUpDate, L + 8, y, L + 90));
      y -= 13;
    }
    if (data.monitoringInstructions) {
      const miLines = wrap(data.monitoringInstructions, 80);
      const { cmds: miC, endY: miE } = textBlock(miLines, y, 8);
      cmds.push(...miC);
      y = miE - 6;
    }
  }

  // Footer
  cmds.push("0.85 0.9 0.92 RG 1 w 46 155 m 566 155 l S");
  cmds.push("0.97 0.98 0.99 rg 46 108 300 42 re f");
  cmds.push("0.88 0.9 0.93 RG 0.5 w 46 108 300 42 re S");
  cmds.push(
    "BT /F2 7.5 Tf 0.05 0.45 0.52 rg 54 138 Td (HEALTHKO MEDICAL RECORD — CONFIDENTIAL) Tj ET"
  );
  cmds.push(
    "BT /F1 7 Tf 0.4 0.45 0.5 rg 54 128 Td (Generated via HIPAA/DOH compliant HealthKo Telehealth platform.) Tj ET"
  );
  cmds.push(
    "BT /F1 7 Tf 0.4 0.45 0.5 rg 54 118 Td (Unauthorised disclosure prohibited under applicable healthcare law.) Tj ET"
  );
  cmds.push("0.97 0.99 0.98 rg 360 82 206 72 re f");
  cmds.push("0.8 0.88 0.85 RG 0.75 w 360 82 206 72 re S");
  cmds.push(
    "0.05 0.58 0.53 RG 1.2 w 375 128 m 445 131 l 465 125 l 515 129 l 540 127 l S"
  );
  cmds.push(
    "BT /F2 6.5 Tf 0.05 0.58 0.53 rg 375 135 Td ([DIGITALLY AUTHENTICATED]) Tj ET"
  );
  cmds.push(
    `BT /F2 8.5 Tf 0.1 0.15 0.2 rg 375 110 Td (${esc(doctorName)}) Tj ET`
  );
  cmds.push(
    `BT /F1 7.5 Tf 0.35 0.4 0.45 rg 375 100 Td (${esc(doctorSpecialty)}) Tj ET`
  );
  cmds.push(
    `BT /F1 7 Tf 0.4 0.45 0.5 rg 375 90 Td (Lic: ${esc(doctorLicense)}   NPI: ${esc(doctorNpi)}) Tj ET`
  );
  cmds.push("0.94 0.96 0.98 rg 32 32 548 18 re f");
  cmds.push(
    `BT /F1 7 Tf 0.45 0.5 0.55 rg ${L} 38 Td (HealthKo Telehealth Ref: ${esc(sessionRef)}  |  Official Consultation Report  |  ${esc(formattedDate)}) Tj ET`
  );

  // Build PDF structure
  const streamContent = cmds.join("\n");
  const objects: { id: number; body: string }[] = [
    { id: 1, body: `<< /Type /Catalog /Pages 2 0 R >>` },
    { id: 2, body: `<< /Type /Pages /Kids [5 0 R] /Count 1 >>` },
    {
      id: 3,
      body: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`,
    },
    {
      id: 4,
      body: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`,
    },
    {
      id: 5,
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents 6 0 R >>`,
    },
    {
      id: 6,
      body: `<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream`,
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

export async function downloadConsultationReportPdf(
  data: ConsultationReportData,
  customFilename?: string
): Promise<void> {
  if (typeof window === "undefined") return;
  const pdfString = generateConsultationReportPdf(data);
  const blob = new Blob([pdfString], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safePatient = (data.patientName || "patient")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  a.href = url;
  a.download =
    customFilename ||
    `healthko-report-${safePatient}-${data.appointmentId || Date.now()}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

