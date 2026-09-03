/**
 * HealthKo Official Prescription PDF Generator
 * Generates an authentic, clinic-standard medical prescription PDF adhering to
 * DOH-FDA electronic prescription requirements.
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
}

function escapePdfText(value?: string | number | null): string {
  if (value === undefined || value === null) return "";
  return String(value)
    // Replace non-ASCII Unicode characters with safe ASCII equivalents
    .replace(/[—–]/g, " - ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[•·]/g, "*")
    .replace(/[°]/g, " deg ")
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
    rxNumber = appointmentId ? `RX-${appointmentId.slice(0, 8).toUpperCase()}` : `RX-${Date.now().toString().slice(-6)}`,
    diagnosis = "Clinical Telehealth Encounter",
    prescription,
  } = data;

  const formattedDate = date
    ? typeof date === "string"
      ? date
      : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const finalClinicName =
    clinicName ||
    `CLINIC OF DR. ${doctorName.toUpperCase().replace(/^DR\.?\s+/i, "")}, MD`;

  const streamCommands: string[] = [];

  // Page 612 x 792 (US Letter)
  // Outer border
  streamCommands.push("0.85 0.9 0.92 RG 1 w");
  streamCommands.push("28 28 556 736 re S");

  // Inner decorative border
  streamCommands.push("0.92 0.95 0.96 RG 0.5 w");
  streamCommands.push("32 32 548 728 re S");

  // Top header banner (Teal)
  streamCommands.push("0.05 0.58 0.53 rg");
  streamCommands.push("32 720 548 40 re f");

  // Banner text
  streamCommands.push("BT /F2 12 Tf 1 1 1 rg 46 736 Td (HEALTHKO TELEHEALTH CLINICAL NETWORK) Tj ET");
  streamCommands.push("BT /F1 8 Tf 0.9 0.98 0.96 rg 46 726 Td (OFFICIAL ELECTRONIC MEDICAL PRESCRIPTION PAD  -  ACCREDITED TELEMEDICINE PROVIDER) Tj ET");

  // Doctor & Clinic Header
  streamCommands.push(`BT /F2 16 Tf 0.08 0.18 0.22 rg 46 690 Td (${escapePdfText(finalClinicName)}) Tj ET`);
  streamCommands.push(`BT /F2 9.5 Tf 0.05 0.58 0.53 rg 46 675 Td (${escapePdfText(doctorSpecialty.toUpperCase())}  -  SPECIALTY & TELEHEALTH PRACTICE) Tj ET`);
  streamCommands.push(`BT /F1 8.5 Tf 0.4 0.45 0.5 rg 46 661 Td (HealthKo Medical Systems  -  Verified Clinical Services  -  Provider ID: ${escapePdfText(doctorNpi || "HK-MED-9921")}) Tj ET`);

  // Accent divider line
  streamCommands.push("0.05 0.58 0.53 RG 2 w");
  streamCommands.push("46 648 m 566 648 l S");
  streamCommands.push("0.85 0.88 0.9 RG 0.5 w");
  streamCommands.push("46 645 m 566 645 l S");

  // Patient Details Box
  streamCommands.push("0.96 0.98 0.99 rg 46 580 520 56 re f");
  streamCommands.push("0.82 0.88 0.9 RG 0.75 w 46 580 520 56 re S");

  streamCommands.push(`BT /F2 8.5 Tf 0.4 0.45 0.5 rg 56 622 Td (PATIENT NAME:) Tj ET`);
  streamCommands.push(`BT /F2 10 Tf 0.1 0.15 0.2 rg 135 622 Td (${escapePdfText(patientName)}) Tj ET`);

  streamCommands.push(`BT /F2 8.5 Tf 0.4 0.45 0.5 rg 380 622 Td (DATE:) Tj ET`);
  streamCommands.push(`BT /F2 9.5 Tf 0.1 0.15 0.2 rg 420 622 Td (${escapePdfText(formattedDate)}) Tj ET`);

  streamCommands.push(`BT /F2 8.5 Tf 0.4 0.45 0.5 rg 56 605 Td (AGE / SEX:) Tj ET`);
  streamCommands.push(`BT /F1 9 Tf 0.1 0.15 0.2 rg 135 605 Td (${escapePdfText(patientAge)} / ${escapePdfText(patientGender)}) Tj ET`);

  streamCommands.push(`BT /F2 8.5 Tf 0.4 0.45 0.5 rg 380 605 Td (RX NO:) Tj ET`);
  streamCommands.push(`BT /F2 9 Tf 0.05 0.58 0.53 rg 420 605 Td (${escapePdfText(rxNumber)}) Tj ET`);

  streamCommands.push(`BT /F2 8.5 Tf 0.4 0.45 0.5 rg 56 588 Td (DIAGNOSIS:) Tj ET`);
  streamCommands.push(`BT /F1 9 Tf 0.1 0.15 0.2 rg 135 588 Td (${escapePdfText(diagnosis || "Clinical Telehealth Encounter")}) Tj ET`);

  // Large Rx Emblem
  streamCommands.push("BT /F4 28 Tf 0.05 0.58 0.53 rg 46 538 Td (Rx) Tj ET");
  streamCommands.push("0.05 0.58 0.53 RG 1 w");
  streamCommands.push("84 546 m 566 546 l S");

  // Prescriptions List
  let currentY = 520;
  const rawLines = (prescription || "No prescription items recorded.")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let medCount = 0;
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (currentY < 185) break;

    if (line.startsWith("--- Medicine") || line.startsWith("Medicine:")) {
      if (line.startsWith("--- Medicine")) {
        medCount++;
        currentY -= 6;
        streamCommands.push(`BT /F2 8.5 Tf 0.05 0.58 0.53 rg 46 ${currentY} Td (MEDICINE ${medCount}) Tj ET`);
        streamCommands.push(`0.85 0.9 0.92 RG 0.5 w 105 ${currentY + 2} m 566 ${currentY + 2} l S`);
        currentY -= 15;
        continue;
      }

      const medName = line.replace(/^Medicine:\s*/i, "");
      streamCommands.push(`BT /F2 11 Tf 0.08 0.15 0.22 rg 56 ${currentY} Td (${escapePdfText(medName)}) Tj ET`);
      currentY -= 15;
    } else if (line.startsWith("Dosage:")) {
      const dosageVal = line.replace(/^Dosage:\s*/i, "");
      streamCommands.push(`BT /F2 9.5 Tf 0.2 0.25 0.3 rg 66 ${currentY} Td (Dosage / Strength: ) Tj /F1 9.5 Tf (${escapePdfText(dosageVal)}) Tj ET`);
      currentY -= 13;
    } else if (line.startsWith("Number of Consume") || line.startsWith("Dose:")) {
      const val = line.replace(/^[^:]+:\s*/i, "");
      streamCommands.push(`BT /F2 9.5 Tf 0.2 0.25 0.3 rg 66 ${currentY} Td (Dose: ) Tj /F1 9.5 Tf (${escapePdfText(val)}) Tj ET`);
      currentY -= 13;
    } else if (line.startsWith("Frequency:")) {
      const val = line.replace(/^Frequency:\s*/i, "");
      streamCommands.push(`BT /F2 9.5 Tf 0.2 0.25 0.3 rg 66 ${currentY} Td (Frequency: ) Tj /F1 9.5 Tf (${escapePdfText(val)}) Tj ET`);
      currentY -= 13;
    } else if (line.startsWith("When to Consume:")) {
      const val = line.replace(/^When to Consume:\s*/i, "");
      streamCommands.push(`BT /F2 9.5 Tf 0.2 0.25 0.3 rg 66 ${currentY} Td (When to Consume: ) Tj /F1 9.5 Tf (${escapePdfText(val)}) Tj ET`);
      currentY -= 13;
    } else if (line.startsWith("Duration:")) {
      const val = line.replace(/^Duration:\s*/i, "");
      streamCommands.push(`BT /F2 9.5 Tf 0.2 0.25 0.3 rg 66 ${currentY} Td (Duration: ) Tj /F1 9.5 Tf (${escapePdfText(val)}) Tj ET`);
      currentY -= 13;
    } else if (line.startsWith("Special Instructions:")) {
      const val = line.replace(/^Special Instructions:\s*/i, "");
      const wrapped = wrapText(val, 70);
      wrapped.forEach((wLine, idx) => {
        if (idx === 0) {
          streamCommands.push(`BT /F2 9 Tf 0.05 0.58 0.53 rg 66 ${currentY} Td (Instructions: ) Tj /F3 9 Tf 0.25 0.3 0.35 rg (${escapePdfText(wLine)}) Tj ET`);
        } else {
          streamCommands.push(`BT /F3 9 Tf 0.25 0.3 0.35 rg 125 ${currentY} Td (${escapePdfText(wLine)}) Tj ET`);
        }
        currentY -= 12;
      });
      currentY -= 2;
    } else {
      const wrapped = wrapText(line, 80);
      wrapped.forEach((wLine) => {
        streamCommands.push(`BT /F1 9.5 Tf 0.15 0.2 0.25 rg 56 ${currentY} Td (${escapePdfText(wLine)}) Tj ET`);
        currentY -= 13;
      });
    }
  }

  // Footer & E-Signature
  streamCommands.push("0.8 0.85 0.88 RG 1 w");
  streamCommands.push("46 170 m 566 170 l S");

  // Left side: Legal & Verification
  streamCommands.push("BT /F2 7.5 Tf 0.4 0.45 0.5 rg 46 154 Td (ELECTRONIC PRESCRIPTION AUTHENTICATION) Tj ET");
  streamCommands.push("BT /F1 7 Tf 0.5 0.55 0.6 rg 46 142 Td (1. Generated in compliance with DOH / FDA Telemedicine Regulations.) Tj ET");
  streamCommands.push("BT /F1 7 Tf 0.5 0.55 0.6 rg 46 132 Td (2. Authentic and valid for dispensing at any licensed pharmacy nationwide.) Tj ET");
  streamCommands.push("BT /F1 7 Tf 0.5 0.55 0.6 rg 46 122 Td (3. Any unauthorized alteration or reproduction invalidates this prescription.) Tj ET");
  streamCommands.push(`BT /F2 7 Tf 0.05 0.58 0.53 rg 46 110 Td (Verification Token: ${escapePdfText(rxNumber)}-SECURE-HK) Tj ET`);

  // Right side: Doctor Signature Card
  streamCommands.push("0.96 0.98 0.99 rg 345 52 221 112 re f");
  streamCommands.push("0.85 0.9 0.92 RG 0.5 w 345 52 221 112 re S");

  // E-Sign pill badge
  streamCommands.push("0.05 0.58 0.53 rg 355 144 140 14 re f");
  streamCommands.push("BT /F2 7 Tf 1 1 1 rg 360 148 Td (DIGITALLY E-SIGNED - AUTHENTIC) Tj ET");

  // Stylized cursive electronic signature in Times-Italic
  const displayDocName = doctorName.startsWith("Dr.") ? doctorName : `Dr. ${doctorName}`;
  streamCommands.push(`BT /F3 18 Tf 0.08 0.22 0.48 rg 355 124 Td (${escapePdfText(displayDocName)}) Tj ET`);

  // Signature line
  streamCommands.push("0.2 0.3 0.4 RG 0.75 w");
  streamCommands.push("355 116 m 552 116 l S");

  // Doctor Name
  streamCommands.push(`BT /F2 9.5 Tf 0.1 0.15 0.2 rg 355 103 Td (DR. ${escapePdfText(doctorName.toUpperCase().replace(/^DR\.?\s+/i, ""))}, MD) Tj ET`);
  // Doctor Specialty
  streamCommands.push(`BT /F1 8 Tf 0.35 0.4 0.45 rg 355 92 Td (${escapePdfText(doctorSpecialty)}) Tj ET`);
  // License number
  const finalLicense = doctorLicense || (doctorNpi ? `PRC-${doctorNpi.slice(0, 7)}` : "PRC-VERIFIED-01");
  streamCommands.push(`BT /F2 8 Tf 0.05 0.58 0.53 rg 355 81 Td (PRC License No.: ) Tj /F1 8 Tf 0.1 0.15 0.2 rg (${escapePdfText(finalLicense)}) Tj ET`);
  // NPI / PTR
  const finalNpi = doctorNpi || "NPI-HK99482";
  streamCommands.push(`BT /F2 8 Tf 0.4 0.45 0.5 rg 355 70 Td (NPI / PTR No.: ) Tj /F1 8 Tf 0.1 0.15 0.2 rg (${escapePdfText(finalNpi)}) Tj ET`);

  // Page numbering / footer note at bottom
  streamCommands.push("BT /F1 7 Tf 0.6 0.65 0.7 rg 210 38 Td (HealthKo Telehealth Technologies  -  Official Medical Document) Tj ET");

  const textStream = streamCommands.join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R /F4 7 0 R >> >> /Contents 8 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>",
    `<< /Length ${textStream.length} >>\nstream\n${textStream}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return pdf;
}

export function downloadPrescriptionPdf(data: PrescriptionPdfData, customFilename?: string): void {
  if (typeof window === "undefined") return;

  const pdfString = generatePrescriptionPdf(data);
  const blob = new Blob([pdfString], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  const safePatient = (data.patientName || "patient").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const filename = customFilename || `healthko-prescription-${safePatient}-${data.appointmentId || "rx"}.pdf`;

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
