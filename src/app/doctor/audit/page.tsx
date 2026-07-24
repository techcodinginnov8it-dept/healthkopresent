"use client";

import { useState } from "react";
import Link from "next/link";
import { getErrorMessage } from "@/lib/errors";
import { uploadFileToStorage } from "../../actions/storage";
import { submitDoctorAudit } from "../../actions/audit";

const SPECIALTIES = [
  { value: "GENERAL_PRACTITIONER", label: "General Practitioner / Family Medicine" },
  { value: "CARDIOLOGIST", label: "Cardiologist (Heart & Vascular)" },
  { value: "DERMATOLOGIST", label: "Dermatologist (Skin Care)" },
  { value: "NEUROLOGIST", label: "Neurologist (Brain & Nervous System)" },
  { value: "PEDIATRICIAN", label: "Pediatrician (Child Development)" },
  { value: "PSYCHIATRIST", label: "Psychiatrist (Mental Health)" },
  { value: "ORTHOPEDIST", label: "Orthopedist (Bones & Joints)" },
  { value: "GYNECOLOGIST", label: "Gynecologist (Women's Health)" },
  { value: "ONCOLOGIST", label: "Oncologist (Cancer Specialist)" },
  { value: "ENDOCRINOLOGIST", label: "Endocrinologist (Hormones & Diabetes)" },
  { value: "OTHER", label: "Other Specialties" },
];

const LICENSE_ISSUING_COUNTRY = "Philippines";
const LICENSE_ISSUER = "PRC";

export default function DoctorAuditPage() {
  const [step, setStep] = useState(1);

  const [npi, setNpi] = useState("");
  const [specialty, setSpecialty] = useState("");

  const [licenseState] = useState(LICENSE_ISSUING_COUNTRY);
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [suffix, setSuffix] = useState("");
  const [yearsExp, setYearsExp] = useState("");
  const [medicalSchool, setMedicalSchool] = useState("");
  const [gradYear, setGradYear] = useState("");

  const [frontFileName, setFrontFileName] = useState("");
  const [frontDocumentUrl, setFrontDocumentUrl] = useState("");
  const [frontUploadProgress, setFrontUploadProgress] = useState(0);
  const [isUploadingFront, setIsUploadingFront] = useState(false);

  const [backFileName, setBackFileName] = useState("");
  const [backDocumentUrl, setBackDocumentUrl] = useState("");
  const [backUploadProgress, setBackUploadProgress] = useState(0);
  const [isUploadingBack, setIsUploadingBack] = useState(false);

  const [selfieFileName, setSelfieFileName] = useState("");
  const [selfieDocumentUrl, setSelfieDocumentUrl] = useState("");
  const [selfieUploadProgress, setSelfieUploadProgress] = useState(0);
  const [isUploadingSelfie, setIsUploadingSelfie] = useState(false);

  const [uploadError, setUploadError] = useState("");

  const [signature, setSignature] = useState("");
  const [consent, setConsent] = useState(false);
  const [doctorEmail, setDoctorEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successData, setSuccessData] = useState<{ auditId: string; linked: boolean } | null>(null);

  const isLicenseInvalid = npi.trim().length > 0 && npi.trim().length < 5;
  const isUploading = isUploadingFront || isUploadingBack || isUploadingSelfie;
  const allRequiredUploadsCompleted = Boolean(frontDocumentUrl && backDocumentUrl && selfieDocumentUrl);

  const compressImageForUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      return file;
    }

    const maxDimension = 1600;
    const quality = 0.82;
    const imageUrl = URL.createObjectURL(file);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Unable to load image for compression."));
        img.src = imageUrl;
      });

      const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");
      if (!context) {
        return file;
      }

      context.drawImage(image, 0, 0, width, height);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((result) => resolve(result), "image/jpeg", quality);
      });

      if (!blob) {
        return file;
      }

      const normalizedName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
      return new File([blob], normalizedName, {
        type: "image/jpeg",
        lastModified: file.lastModified,
      });
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  };

  const handleFileUpload = async (side: "front" | "back" | "selfie", e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowed.includes(file.type)) {
      setUploadError("Only PDF, PNG, JPEG, or WEBP files are accepted for PRC ID uploads.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File size must not exceed 10 MB.");
      return;
    }

    if (side === "front") {
      setFrontFileName(file.name);
      setFrontDocumentUrl("");
      setFrontUploadProgress(5);
      setIsUploadingFront(true);
    } else if (side === "back") {
      setBackFileName(file.name);
      setBackDocumentUrl("");
      setBackUploadProgress(5);
      setIsUploadingBack(true);
    } else {
      setSelfieFileName(file.name);
      setSelfieDocumentUrl("");
      setSelfieUploadProgress(5);
      setIsUploadingSelfie(true);
    }

    setUploadError("");

    try {
      const uploadFile = await compressImageForUpload(file);

      const ticker = setInterval(() => {
        if (side === "front") {
          setFrontUploadProgress((prev) => (prev < 90 ? prev + 5 : prev));
        } else if (side === "back") {
          setBackUploadProgress((prev) => (prev < 90 ? prev + 5 : prev));
        } else {
          setSelfieUploadProgress((prev) => (prev < 90 ? prev + 5 : prev));
        }
      }, 150);

      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("folder", "doctor-credentials");

      const result = await uploadFileToStorage(formData);
      clearInterval(ticker);

      if (!result.success || !result.url) {
        if (side === "front") {
          setIsUploadingFront(false);
          setFrontUploadProgress(0);
          setFrontFileName("");
        } else if (side === "back") {
          setIsUploadingBack(false);
          setBackUploadProgress(0);
          setBackFileName("");
        } else {
          setIsUploadingSelfie(false);
          setSelfieUploadProgress(0);
          setSelfieFileName("");
        }
        setUploadError(result.error || "Upload failed. Please try again.");
        return;
      }

      if (side === "front") {
        setFrontDocumentUrl(result.url);
        setFrontUploadProgress(100);
        setIsUploadingFront(false);
      } else if (side === "back") {
        setBackDocumentUrl(result.url);
        setBackUploadProgress(100);
        setIsUploadingBack(false);
      } else {
        setSelfieDocumentUrl(result.url);
        setSelfieUploadProgress(100);
        setIsUploadingSelfie(false);
      }
    } catch (uploadError: unknown) {
      if (side === "front") {
        setIsUploadingFront(false);
        setFrontUploadProgress(0);
        setFrontFileName("");
      } else if (side === "back") {
        setIsUploadingBack(false);
        setBackUploadProgress(0);
        setBackFileName("");
      } else {
        setIsUploadingSelfie(false);
        setSelfieUploadProgress(0);
        setSelfieFileName("");
      }
      setUploadError(getErrorMessage(uploadError, "An unexpected error occurred during upload."));
    }
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (!npi || npi.trim().length < 5) {
        setError("Please enter a valid PRC license or registration number.");
        return;
      }
      if (!specialty) {
        setError("Please select your medical specialty area.");
        return;
      }
    }

    if (step === 2) {
      if (!npi || !licenseState) {
        setError("Medical state licensure details are required.");
        return;
      }
      if (!firstName.trim() || !lastName.trim()) {
        setError("Please provide your first and last name.");
        return;
      }
      if (!yearsExp || Number(yearsExp) < 0 || Number(yearsExp) > 60) {
        setError("Please input a valid number of years in clinical practice.");
        return;
      }
      if (!medicalSchool || !gradYear || Number(gradYear) < 1960 || Number(gradYear) > new Date().getFullYear()) {
        setError("Please provide a valid medical school and graduation year.");
        return;
      }
    }

    if (step === 3) {
      if (!allRequiredUploadsCompleted) {
        setError("Please upload the front, back, and selfie holding your PRC ID to proceed.");
        return;
      }
      if (isUploading) {
        setError("Please wait for the secure ID upload to complete.");
        return;
      }
    }

    setError("");
    setStep((current) => current + 1);
  };

  const handlePrevStep = () => {
    setError("");
    setStep((current) => current - 1);
  };

  const handleSubmitAudit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!signature) {
      setError("Please sign your legal name to authorize PRC primary source verification.");
      return;
    }

    if (!consent) {
      setError("You must accept the Philippine PRC compliance and credentialing authorization.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await submitDoctorAudit({
        npi,
        licenseNumber: npi,
        licenseState,
        specialty,
        firstName,
        middleName,
        lastName,
        suffix,
        medicalSchool,
        gradYear: Number(gradYear),
        yearsExp: Number(yearsExp),
        approvalType: "PRC_PRIMARY_SOURCE_VERIFICATION",
        documentName: JSON.stringify({
          front: { name: frontFileName, url: frontDocumentUrl },
          back: { name: backFileName, url: backDocumentUrl },
          selfie: { name: selfieFileName, url: selfieDocumentUrl },
        }),
        signature,
        consent,
        doctorEmail: doctorEmail || undefined,
      });

      setLoading(false);
      if (res.success && "auditId" in res && res.auditId) {
        setSuccessData({ auditId: res.auditId, linked: res.linked });
      } else {
        setError("error" in res && res.error ? res.error : "Auditing submission failed. Please verify your PRC details.");
      }
    } catch {
      setLoading(false);
      setError("A connection error occurred. Our verification servers are momentarily loaded.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col justify-between relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-brand-teal/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-brand-red/5 blur-3xl pointer-events-none" />

      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between relative z-10">
        <Link href="/" className="flex items-center space-x-1 select-none">
          <span className="font-display text-2xl tracking-tight">
            <span className="text-brand-red font-black">H</span>
            <span className="text-white font-extrabold">ealth</span>
            <span className="text-brand-teal font-black">K</span>
            <span className="text-white font-extrabold">o</span>
          </span>
          <span className="text-[10px] font-bold text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded ml-2 tracking-wider">
            CREDENTIALING
          </span>
        </Link>
        <Link href="/doctor/signin" className="text-xs font-bold text-slate-450 hover:text-slate-100 transition-colors">
          Return to Portal Sign In
        </Link>
      </header>

      <main className="flex-grow flex items-center justify-center px-4 py-12 relative z-10">
        <div className="max-w-2xl w-full bg-slate-900 border border-slate-850 rounded-2xl p-6 sm:p-10 shadow-2xl">
          {!successData ? (
            <>
              <div className="space-y-2 mb-8">
                <span className="text-[9px] font-black text-brand-teal uppercase bg-brand-teal/10 border border-brand-teal/15 px-2.5 py-1 rounded-full tracking-widest">
                  Primary Source Verification - Philippines
                </span>
                <h1 className="font-display text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Physician Credentials Audit
                </h1>
                <p className="text-slate-400 text-xs sm:text-sm font-medium leading-relaxed">
                  Submit your Philippine PRC credentials and supporting documents to verify your clinical standing for digital consultations.
                </p>
              </div>

              <div className="mb-8">
                <div className="flex items-center justify-between text-xs font-bold text-slate-450 mb-2">
                  <span>
                    Step {step} of 4:{" "}
                    {step === 1
                      ? "Philippine Identity"
                      : step === 2
                        ? "PRC Licensure and Experience"
                        : step === 3
                          ? "Supporting Documents"
                          : "Consent and Linking"}
                  </span>
                  <span>{step * 25}% Complete</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-brand-teal h-full transition-all duration-500 ease-out shadow-lg shadow-brand-teal/30"
                    style={{ width: `${step * 25}%` }}
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-brand-red/10 border border-brand-red/15 text-brand-red font-bold text-xs rounded-xl mb-6 animate-fade-in">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmitAudit} className="space-y-6">
                {step === 1 && (
                  <div className="space-y-5 animate-fade-in">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">
                        PRC License / Registration Number
                      </label>
                      <input
                        type="text"
                        required
                        value={npi}
                        onChange={(e) => setNpi(e.target.value.slice(0, 20))}
                        placeholder="e.g. PRC-12345 or 0123456"
                        className={`w-full px-4 py-3 rounded-xl bg-slate-950 border text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 transition-all ${
                          isLicenseInvalid ? "border-brand-red" : "border-slate-800"
                        }`}
                      />
                      {isLicenseInvalid && (
                        <p className="text-[10px] text-brand-red font-bold mt-1.5">
                          Please enter a valid PRC license or registration number.
                        </p>
                      )}
                      <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                        Your PRC license details will be checked against Philippine credentialing records.
                      </p>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">
                        Primary Clinical Specialty
                      </label>
                      <select
                        required
                        value={specialty}
                        onChange={(e) => setSpecialty(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-300 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 transition-all"
                      >
                        <option value="">Select your medical board specialty...</option>
                        {SPECIALTIES.map((spec) => (
                          <option key={spec.value} value={spec.value} className="bg-slate-950 text-slate-300">
                            {spec.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-5 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">
                          PRC License Number from Step 1
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={npi}
                          className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-100 focus:outline-none"
                        />
                        <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                          This is carried forward from step 1 so you do not need to enter it again.
                        </p>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">
                          First Name
                        </label>
                        <input
                          type="text"
                          required
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="Juan"
                          className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-650 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">
                          Last Name
                        </label>
                        <input
                          type="text"
                          required
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Dela Cruz"
                          className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-650 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">
                          Middle Name
                        </label>
                        <input
                          type="text"
                          value={middleName}
                          onChange={(e) => setMiddleName(e.target.value)}
                          placeholder="Santos"
                          className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-650 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">
                          Suffix
                        </label>
                        <input
                          type="text"
                          value={suffix}
                          onChange={(e) => setSuffix(e.target.value)}
                          placeholder="Jr., III, IV"
                          className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-650 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">
                          Issuing Medical Board Country
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={licenseState}
                          className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-sm font-semibold text-slate-100 focus:outline-none"
                        />
                        <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                          Licenses are issued in the Philippines by the {LICENSE_ISSUER} only.
                        </p>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">
                          Primary Clinical Specialty
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={specialty}
                          className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-100 focus:outline-none"
                        />
                        <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                          This carries over from step 1.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">
                          Years of Clinical Practice
                        </label>
                        <input
                          type="number"
                          required
                          min={0}
                          max={60}
                          value={yearsExp}
                          onChange={(e) => setYearsExp(e.target.value)}
                          placeholder="e.g. 12"
                          className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-650 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">
                          Medical School Graduation Year
                        </label>
                        <input
                          type="number"
                          required
                          min={1960}
                          max={new Date().getFullYear()}
                          value={gradYear}
                          onChange={(e) => setGradYear(e.target.value)}
                          placeholder="e.g. 2012"
                          className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-650 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">
                        Medical School / University
                      </label>
                      <input
                        type="text"
                        required
                        value={medicalSchool}
                        onChange={(e) => setMedicalSchool(e.target.value)}
                        placeholder="e.g. University of the Philippines College of Medicine"
                        className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-650 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 transition-all"
                      />
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-5 animate-fade-in">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        PRC License ID Front
                      </label>
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        Upload a clear photo or PDF of the front of your PRC ID. On mobile, you can use the camera to take the photo directly.
                      </p>

                      <div
                        className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center bg-slate-950 transition-all duration-300 relative group ${
                          frontDocumentUrl ? "border-brand-teal/60 bg-brand-teal/5" : "border-slate-800 hover:bg-slate-900 hover:border-brand-teal/50"
                        }`}
                      >
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          capture="environment"
                          onChange={(event) => handleFileUpload("front", event)}
                          disabled={isUploadingFront}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full disabled:cursor-not-allowed"
                        />

                        <svg className="w-10 h-10 text-slate-500 group-hover:text-brand-teal transition-colors mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>

                        <span className="text-xs font-bold text-slate-200 text-center">
                          {frontDocumentUrl ? "Front side uploaded - tap to replace" : frontFileName || "Tap to upload front side"}
                        </span>
                        <span className="text-[10px] text-slate-500 mt-1 text-center">
                          JPG, PNG, WEBP, or PDF - max 10 MB
                        </span>
                      </div>

                      {frontFileName && (
                        <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold gap-3">
                            <span className="text-slate-300 truncate">{frontFileName}</span>
                            <span className={`${frontUploadProgress === 100 ? "text-brand-teal" : "text-amber-400"} shrink-0`}>
                              {isUploadingFront
                                ? `${frontUploadProgress}% Uploading...`
                                : frontUploadProgress === 100
                                  ? "Verified"
                                  : `${frontUploadProgress}%`}
                            </span>
                          </div>
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 rounded-full ${
                                frontUploadProgress === 100 ? "bg-brand-teal" : "bg-amber-400"
                              }`}
                              style={{ width: `${frontUploadProgress}%` }}
                            />
                          </div>
                          {frontDocumentUrl && (
                            <p className="text-[10px] text-slate-500 break-all">
                              Storage URL: <span className="text-brand-teal/70">{frontDocumentUrl}</span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        PRC License ID Back
                      </label>
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        Upload the back of your PRC ID so we can complete the two-sided verification.
                      </p>

                      <div
                        className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center bg-slate-950 transition-all duration-300 relative group ${
                          backDocumentUrl ? "border-brand-teal/60 bg-brand-teal/5" : "border-slate-800 hover:bg-slate-900 hover:border-brand-teal/50"
                        }`}
                      >
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          capture="environment"
                          onChange={(event) => handleFileUpload("back", event)}
                          disabled={isUploadingBack}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full disabled:cursor-not-allowed"
                        />

                        <svg className="w-10 h-10 text-slate-500 group-hover:text-brand-teal transition-colors mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>

                        <span className="text-xs font-bold text-slate-200 text-center">
                          {backDocumentUrl ? "Back side uploaded - tap to replace" : backFileName || "Tap to upload back side"}
                        </span>
                        <span className="text-[10px] text-slate-500 mt-1 text-center">
                          JPG, PNG, WEBP, or PDF - max 10 MB
                        </span>
                      </div>

                      {backFileName && (
                        <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold gap-3">
                            <span className="text-slate-300 truncate">{backFileName}</span>
                            <span className={`${backUploadProgress === 100 ? "text-brand-teal" : "text-amber-400"} shrink-0`}>
                              {isUploadingBack
                                ? `${backUploadProgress}% Uploading...`
                                : backUploadProgress === 100
                                  ? "Verified"
                                  : `${backUploadProgress}%`}
                            </span>
                          </div>
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 rounded-full ${
                                backUploadProgress === 100 ? "bg-brand-teal" : "bg-amber-400"
                              }`}
                              style={{ width: `${backUploadProgress}%` }}
                            />
                          </div>
                          {backDocumentUrl && (
                            <p className="text-[10px] text-slate-500 break-all">
                              Storage URL: <span className="text-brand-teal/70">{backDocumentUrl}</span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        Selfie Holding PRC ID
                      </label>
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        Capture a clear image of yourself holding your PRC ID so the face and card details are both visible.
                      </p>

                      <div
                        className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center bg-slate-950 transition-all duration-300 relative group ${
                          selfieDocumentUrl ? "border-brand-teal/60 bg-brand-teal/5" : "border-slate-800 hover:bg-slate-900 hover:border-brand-teal/50"
                        }`}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          capture="user"
                          onChange={(event) => handleFileUpload("selfie", event)}
                          disabled={isUploadingSelfie}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full disabled:cursor-not-allowed"
                        />

                        <svg className="w-10 h-10 text-slate-500 group-hover:text-brand-teal transition-colors mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 11c1.657 0 3-1.567 3-3.5S13.657 4 12 4 9 5.567 9 7.5 10.343 11 12 11zm0 2c-3.314 0-6 2.015-6 4.5V19h12v-1.5c0-2.485-2.686-4.5-6-4.5z" />
                        </svg>

                        <span className="text-xs font-bold text-slate-200 text-center">
                          {selfieDocumentUrl ? "Selfie uploaded - tap to replace" : selfieFileName || "Tap to upload selfie with PRC ID"}
                        </span>
                        <span className="text-[10px] text-slate-500 mt-1 text-center">
                          JPG, PNG, WEBP - camera capture recommended
                        </span>
                      </div>

                      {selfieFileName && (
                        <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold gap-3">
                            <span className="text-slate-300 truncate">{selfieFileName}</span>
                            <span className={`${selfieUploadProgress === 100 ? "text-brand-teal" : "text-amber-400"} shrink-0`}>
                              {isUploadingSelfie
                                ? `${selfieUploadProgress}% Uploading...`
                                : selfieUploadProgress === 100
                                  ? "Verified"
                                  : `${selfieUploadProgress}%`}
                            </span>
                          </div>
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 rounded-full ${
                                selfieUploadProgress === 100 ? "bg-brand-teal" : "bg-amber-400"
                              }`}
                              style={{ width: `${selfieUploadProgress}%` }}
                            />
                          </div>
                          {selfieDocumentUrl && (
                            <p className="text-[10px] text-slate-500 break-all">
                              Storage URL: <span className="text-brand-teal/70">{selfieDocumentUrl}</span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="p-4 bg-brand-teal/10 border border-brand-teal/20 rounded-2xl text-[11px] leading-relaxed text-slate-300">
                      <p className="font-extrabold text-white mb-1">Privacy and document handling notice</p>
                      <p>
                        Your PRC ID images are used only for credential verification, stored securely, and reviewed only by authorized HealthKo personnel and validation partners.
                      </p>
                    </div>

                    {uploadError && (
                      <div className="p-3 bg-brand-red/10 border border-brand-red/15 text-brand-red font-bold text-xs rounded-xl animate-fade-in">
                        {uploadError}
                      </div>
                    )}
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-5 animate-fade-in">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">
                        Practitioner Account Link Email (Optional)
                      </label>
                      <input
                        type="email"
                        value={doctorEmail}
                        onChange={(e) => setDoctorEmail(e.target.value)}
                        placeholder="doctor@clinic.com"
                        className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-650 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 transition-all"
                      />
                      <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                        Provide the email linked to your practitioner portal account to automatically attach these PRC credentials to your profile once approved.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-950 border border-slate-850 rounded-2xl text-[11px] leading-relaxed text-slate-400 space-y-3 max-h-40 overflow-y-auto">
                      <p className="font-extrabold text-slate-200">PHILIPPINE PRC DISCLOSURE AND CONSENT</p>
                      <p>
                        By checking the box below and entering your digital signature, you authorize HealthKo Technologies, Inc. and its designated validation agents to conduct primary source verification of your Philippine PRC medical credentials, board certifications, and educational records.
                      </p>
                      <p>
                        This audit will be conducted in accordance with applicable Philippine credentialing and platform compliance standards. You attest that all information submitted is true, correct, and current to the best of your knowledge.
                      </p>
                    </div>

                    <div className="flex items-start">
                      <input
                        type="checkbox"
                        id="attestation-consent"
                        required
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-800 text-brand-teal bg-slate-950 mt-0.5 focus:ring-brand-teal/20"
                      />
                      <label htmlFor="attestation-consent" className="ml-3 block text-xs font-bold text-slate-400 select-none leading-relaxed">
                        I attest that the information provided is accurate, and I consent to a Philippine PRC credentials audit.
                      </label>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">
                        Medical Practitioner Digital Signature
                      </label>
                      <input
                        type="text"
                        required
                        value={signature}
                        onChange={(e) => setSignature(e.target.value)}
                        placeholder="Type your full legal name to sign"
                        className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm font-display italic font-bold text-brand-teal placeholder-slate-650 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 transition-all"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center pt-6 border-t border-slate-850">
                  {step > 1 ? (
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className="px-5 py-3 rounded-xl bg-slate-850 hover:bg-slate-800 text-xs sm:text-sm font-bold text-slate-200 transition-all"
                    >
                      Back
                    </button>
                  ) : (
                    <div />
                  )}

                  {step < 4 ? (
                    <button
                      type="button"
                      onClick={handleNextStep}
                      disabled={step === 3 && isUploading}
                      className="px-6 py-3 rounded-xl bg-brand-teal hover:bg-brand-teal-hover text-xs sm:text-sm font-bold text-white transition-all shadow-md shadow-brand-teal/15 flex items-center space-x-1.5 disabled:opacity-50 disabled:cursor-wait"
                    >
                      <span>Continue</span>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-3 rounded-xl bg-brand-teal hover:bg-brand-teal-hover text-xs sm:text-sm font-bold text-white transition-all shadow-md shadow-brand-teal/15 disabled:bg-slate-800 disabled:shadow-none flex items-center justify-center space-x-2"
                    >
                      {loading ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          <span>Submitting Audit...</span>
                        </>
                      ) : (
                        <span>Authorize and Submit Audit</span>
                      )}
                    </button>
                  )}
                </div>
              </form>
            </>
          ) : (
            <div className="py-8 text-center space-y-6 animate-fade-in">
              <div className="h-16 w-16 rounded-full bg-brand-teal/10 border-2 border-brand-teal/30 flex items-center justify-center text-brand-teal mx-auto">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4" />
                </svg>
              </div>

              <div className="space-y-2">
                <h2 className="font-display text-2xl font-black text-white tracking-tight">
                  Verification Audit Initiated
                </h2>
                <p className="text-slate-400 text-xs sm:text-sm font-medium max-w-md mx-auto leading-relaxed">
                  Your credentials and supporting documents have been securely stored in the HealthKo HIPAA Vault and queued for PRC verification.
                </p>
              </div>

              <div className="p-5 bg-slate-950 border border-slate-850 rounded-2xl max-w-sm mx-auto space-y-3.5 text-left text-xs font-bold text-slate-350">
                <div className="flex justify-between border-b border-slate-900 pb-2">
                  <span>AUDIT RECORD ID</span>
                  <span className="text-white font-mono select-all truncate max-w-[180px]">{successData.auditId}</span>
                </div>
                <div className="flex justify-between border-b border-slate-900 pb-2">
                  <span>DOCUMENT VAULT</span>
                  <span className="text-brand-teal">SECURED</span>
                </div>
                <div className="flex justify-between border-b border-slate-900 pb-2">
                  <span>REGISTRY LOOKUP</span>
                  <span className="text-brand-teal">PENDING PRC VERIFICATION</span>
                </div>
                <div className="flex justify-between">
                  <span>PORTAL STATUS</span>
                  <span className="text-white">{successData.linked ? "LINKED TO ACCOUNT" : "UNRESOLVED ACCOUNT"}</span>
                </div>
              </div>

              <div className="pt-6 space-y-3">
                <Link
                  href="/doctor/signin"
                  className="inline-block bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-xl transition-all"
                >
                  Return to Portal Sign In
                </Link>
                <p className="text-[10px] text-slate-500 max-w-xs mx-auto leading-relaxed">
                  Credential auditing typically completes within 24-48 business hours. You will receive an encrypted verification email once completed.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-slate-900 py-6 px-6 text-center select-none text-[10px] text-slate-550 font-bold uppercase tracking-wider relative z-10">
        {new Date().getFullYear()} HealthKo Technologies, Inc. - HIPAA Compliance Security Vault
      </footer>
    </div>
  );
}
