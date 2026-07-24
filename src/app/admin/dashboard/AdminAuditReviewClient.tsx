"use client";

import Link from "next/link";
import { useState } from "react";
import { rejectDoctorAudit, createDoctorAccountByAdmin } from "@/app/actions/audit";

type DoctorAudit = {
  id: string;
  doctorId: string | null;
  npi: string;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  suffix?: string | null;
  licenseNumber: string;
  licenseState: string;
  specialty: string;
  medicalSchool: string;
  gradYear: number;
  yearsExp: number;
  documentName: string | null;
  approvalType?: string;
  status: string;
  signature: string;
  consent: boolean;
  doctorEmail?: string | null;
  submittedAt: string;
  updatedAt: string;
  doctor: {
    id: string;
    name: string;
    email: string;
    specialty: string;
  } | null;
};

/** Parse the JSON-encoded documentName field into typed document objects */
function parseDocumentName(raw: string | null): {
  front: { name: string; url: string } | null;
  back: { name: string; url: string } | null;
  selfie: { name: string; url: string } | null;
  plain: string | null;
} {
  if (!raw) return { front: null, back: null, selfie: null, plain: null };
  try {
    const parsed = JSON.parse(raw);
    return {
      front: parsed.front?.url ? parsed.front : null,
      back: parsed.back?.url ? parsed.back : null,
      selfie: parsed.selfie?.url ? parsed.selfie : null,
      plain: null,
    };
  } catch {
    return { front: null, back: null, selfie: null, plain: raw };
  }
}

function DocThumbnail({
  label,
  doc,
}: {
  label: string;
  doc: { name: string; url: string };
}) {
  const isPdf = doc.name?.toLowerCase().endsWith(".pdf") || doc.url?.includes(".pdf");
  return (
    <a
      href={doc.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-slate-950/60 p-3 text-center hover:border-brand-teal/40 hover:bg-brand-teal/5 transition-all"
    >
      {isPdf ? (
        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-brand-red/10 border border-brand-red/20">
          <svg className="h-7 w-7 text-brand-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={doc.url}
          alt={label}
          className="h-14 w-14 rounded-lg object-cover border border-white/10 group-hover:border-brand-teal/40"
        />
      )}
      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 group-hover:text-brand-teal">
        {label}
      </span>
      <span className="text-[9px] text-slate-500 truncate max-w-[80px]">{doc.name}</span>
    </a>
  );
}

export default function AdminAuditReviewClient({ initialAudits }: { initialAudits: DoctorAudit[] }) {
  const [audits, setAudits] = useState(initialAudits);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [selectedAudit, setSelectedAudit] = useState<DoctorAudit | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  // Doctor Account Creation Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: "",
    password: "",
    npi: "",
    firstName: "",
    middleName: "",
    lastName: "",
    suffix: "",
    specialty: "General Medicine",
    licenseNumber: "",
    licenseState: "Philippines",
    yearsExp: 5,
    consultFee: 500,
    auditId: "",
  });
  const [createdResult, setCreatedResult] = useState<{
    email: string;
    npi: string;
    password: string;
    name: string;
  } | null>(null);

  // Filter tabs
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  const filteredAudits = audits.filter((audit) => {
    if (activeTab === "pending") return audit.status === "PENDING";
    if (activeTab === "approved") return audit.status === "APPROVED";
    if (activeTab === "rejected") return audit.status === "REJECTED";
    return true;
  });

  /**
   * "Approve" now opens the account-creation modal.
   * The audit is only tagged APPROVED after account creation succeeds.
   */
  function handleApprove(audit: DoctorAudit) {
    handleOpenCreateForAudit(audit);
  }

  async function handleReject(auditId: string) {
    const reason = window.prompt("Enter rejection reason (optional):") ?? undefined;
    setWorkingId(auditId);
    setError("");
    setFeedback("");

    try {
      const result = await rejectDoctorAudit(auditId, reason);
      if (!result.success) {
        setError(("error" in result ? result.error : undefined) ?? "Failed to reject doctor credentials.");
        return;
      }

      setFeedback(result.message || "Doctor credentials rejected.");
      setAudits((prev) =>
        prev.map((audit) => (audit.id === auditId ? { ...audit, status: "REJECTED" } : audit))
      );
      if (selectedAudit?.id === auditId) {
        setSelectedAudit((prev) => (prev ? { ...prev, status: "REJECTED" } : null));
      }
    } catch {
      setError("An error occurred while rejecting the audit.");
    } finally {
      setWorkingId(null);
    }
  }

  function handleOpenCreateForAudit(audit: DoctorAudit) {
    const nameParts = (audit.signature || audit.doctor?.name || "").split(" ");
    const firstName = audit.firstName || nameParts[0] || "";
    const lastName = audit.lastName || (nameParts.length > 1 ? nameParts[nameParts.length - 1] : "");
    const generatedPass = `HkDoc${Math.floor(1000 + Math.random() * 9000)}!`;

    setCreateForm({
      email: audit.doctorEmail || audit.doctor?.email || "",
      password: generatedPass,
      npi: audit.npi,
      firstName,
      middleName: audit.middleName || "",
      lastName,
      suffix: audit.suffix || "",
      specialty: audit.specialty || "General Medicine",
      licenseNumber: audit.licenseNumber,
      licenseState: audit.licenseState || "Philippines",
      yearsExp: audit.yearsExp || 5,
      consultFee: 500,
      auditId: audit.id,
    });
    setCreatedResult(null);
    setShowCreateModal(true);
  }

  function generateRandomPassword() {
    const pass = `DocHk2026!${Math.floor(100 + Math.random() * 900)}`;
    setCreateForm((prev) => ({ ...prev, password: pass }));
  }

  async function handleSubmitCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    setCreatingAccount(true);
    setError("");
    setFeedback("");

    try {
      const res = await createDoctorAccountByAdmin(createForm);
      setCreatingAccount(false);

      if (!res.success) {
        setError(res.error || "Failed to create doctor account.");
        return;
      }

      setFeedback(res.message || "Doctor account created and approved successfully!");
      setCreatedResult({
        email: createForm.email,
        npi: createForm.npi,
        password: createForm.password,
        name: res.doctor?.name || `Dr. ${createForm.lastName}`,
      });

      // Mark the audit as APPROVED in local state
      if (createForm.auditId) {
        setAudits((prev) =>
          prev.map((audit) =>
            audit.id === createForm.auditId ? { ...audit, status: "APPROVED" } : audit
          )
        );
        // If the inspection modal is open for this audit, update it too
        if (selectedAudit?.id === createForm.auditId) {
          setSelectedAudit((prev) => (prev ? { ...prev, status: "APPROVED" } : null));
        }
      }
    } catch (err: unknown) {
      setCreatingAccount(false);
      setError("An unexpected error occurred while creating doctor account.");
      console.error(err);
    }
  }

  return (
    <section className="space-y-6">
      {/* ── Dashboard Action & Filter Header ── */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl backdrop-blur sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-teal">
                Practitioner Credential Vault
              </p>
            </div>
            <h2 className="mt-2 font-display text-2xl font-black tracking-tight text-white sm:text-3xl">
              Doctor Review &amp; Approval Portal
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
              Inspect submitted PRC licenses, medical school qualifications, supporting documents, and legal
              signatures. Approving a doctor immediately provisions their login credentials.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin/doctors"
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              Full Queue View
            </Link>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-6">
          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === "pending"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            Pending Review ({audits.filter((a) => a.status === "PENDING").length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("approved")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === "approved"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            Approved ({audits.filter((a) => a.status === "APPROVED").length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("rejected")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === "rejected"
                ? "bg-brand-red/20 text-brand-red border border-brand-red/40"
                : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            Rejected ({audits.filter((a) => a.status === "REJECTED").length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === "all"
                ? "bg-brand-teal/20 text-brand-teal border border-brand-teal/40"
                : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            All Submissions ({audits.length})
          </button>
        </div>
      </div>

      {/* ── Status Notifications ── */}
      {error && (
        <div className="rounded-2xl border border-brand-red/30 bg-brand-red/10 p-4 text-sm font-semibold text-brand-red">
          ⚠️ {error}
        </div>
      )}

      {feedback && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-300">
          ✅ {feedback}
        </div>
      )}

      {/* ── Doctor Audits Grid ── */}
      <div className="grid gap-6">
        {filteredAudits.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-12 text-center text-slate-400">
            <svg className="mx-auto h-12 w-12 text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-base font-bold text-white">No practitioner audits found for this status.</p>
            <p className="mt-1 text-xs text-slate-400">New doctor partnership audits submitted from `/doctor/audit` will appear here automatically.</p>
          </div>
        ) : (
          filteredAudits.map((audit) => (
            <article
              key={audit.id}
              className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur transition-all duration-200 hover:border-white/20"
            >
              <div className="flex flex-col gap-6 lg:grid lg:grid-cols-12">
                {/* Column 1: Practitioner Identity (4 cols) */}
                <div className="lg:col-span-4 space-y-3 pr-4 lg:border-r lg:border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-brand-teal bg-brand-teal/10 border border-brand-teal/20 px-2.5 py-1 rounded-lg">
                      Doctor Profile
                    </span>
                    <span
                      className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border ${
                        audit.status === "APPROVED"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : audit.status === "REJECTED"
                          ? "bg-brand-red/10 text-brand-red border-brand-red/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      }`}
                    >
                      {audit.status}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-display text-lg font-black text-white">
                      {audit.signature || audit.doctor?.name || "Dr. Practitioner"}
                    </h3>
                    <p className="text-xs font-semibold text-slate-400 mt-0.5">
                      Specialty: <span className="text-white font-bold">{audit.specialty}</span>
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">PRC License / NPI:</span>
                      <span className="font-mono font-bold text-white">{audit.npi}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Account Link:</span>
                      <span className="font-semibold text-white">
                        {audit.doctorEmail || audit.doctor?.email ? (audit.doctorEmail || audit.doctor?.email) : <span className="text-amber-400 font-bold">Unlinked (Audit Only)</span>}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Submitted:</span>
                      <span className="text-slate-300">{new Date(audit.submittedAt).toISOString().split("T")[0]}</span>
                    </div>
                  </div>
                </div>

                {/* Column 2: PRC Credentials & Schooling (4 cols) */}
                <div className="lg:col-span-4 space-y-3 pr-4 lg:border-r lg:border-white/10">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Primary Source Credentials
                  </span>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                      <p className="text-[10px] font-bold uppercase text-slate-400">PRC Reg. Number</p>
                      <p className="mt-1 font-mono text-sm font-bold text-white">{audit.licenseNumber}</p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Medical Board</p>
                      <p className="mt-1 font-bold text-white">{audit.licenseState}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-300">
                    <p>
                      <span className="text-slate-400">Medical School:</span>{" "}
                      <strong className="text-white">{audit.medicalSchool}</strong>
                    </p>
                    <p>
                      <span className="text-slate-400">Graduation Year:</span>{" "}
                      <strong className="text-white">{audit.gradYear}</strong> ({audit.yearsExp} Years Exp.)
                    </p>
                    <p>
                      <span className="text-slate-400">Digital Signature:</span>{" "}
                      <strong className="text-brand-teal italic">{audit.signature}</strong>
                    </p>
                  </div>
                </div>

                {/* Column 3: Verification & Actions (4 cols) */}
                <div className="lg:col-span-4 flex flex-col justify-between space-y-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Supporting Documents
                    </span>
                    <div className="mt-2 rounded-xl border border-white/10 bg-slate-950/60 p-3 text-xs">
                      {(() => {
                        const docs = parseDocumentName(audit.documentName);
                        if (docs.plain) {
                          return (
                            <div className="flex items-center space-x-2 text-slate-200">
                              <svg className="h-4 w-4 text-brand-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                              </svg>
                              <span className="font-semibold truncate">{docs.plain}</span>
                            </div>
                          );
                        }
                        const anyDoc = docs.front || docs.back || docs.selfie;
                        if (!anyDoc) {
                          return <p className="text-slate-400 italic">No documents uploaded</p>;
                        }
                        return (
                          <div className="flex gap-2 flex-wrap">
                            {docs.front && <DocThumbnail label="ID Front" doc={docs.front} />}
                            {docs.back && <DocThumbnail label="ID Back" doc={docs.back} />}
                            {docs.selfie && <DocThumbnail label="Selfie" doc={docs.selfie} />}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedAudit(audit)}
                      className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-white/20"
                    >
                      Inspect Full Details
                    </button>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleApprove(audit)}
                        disabled={workingId === audit.id || audit.status === "APPROVED"}
                        className="flex-1 rounded-xl bg-emerald-500 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-600 disabled:opacity-40"
                      >
                        {audit.status === "APPROVED" ? "✓ Approved" : "Approve & Create Account"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(audit.id)}
                        disabled={workingId === audit.id || audit.status === "REJECTED"}
                        className="flex-1 rounded-xl border border-brand-red/30 bg-brand-red/10 px-3 py-2.5 text-xs font-bold text-brand-red transition hover:bg-brand-red/20 disabled:opacity-40"
                      >
                        {audit.status === "REJECTED" ? "Rejected" : "Reject"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      {/* ── Inspection Modal ── */}
      {selectedAudit && (() => {
        const docs = parseDocumentName(selectedAudit.documentName);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl text-white space-y-6">
              <div className="flex items-start justify-between border-b border-white/10 pb-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-brand-teal bg-brand-teal/10 px-2 py-0.5 rounded">
                    Credential Audit Record #{selectedAudit.id.substring(0, 8)}
                  </span>
                  <h3 className="font-display text-2xl font-black text-white mt-1">
                    {selectedAudit.signature || selectedAudit.doctor?.name || "Dr. Practitioner"}
                  </h3>
                  <span
                    className={`inline-block mt-1 text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border ${
                      selectedAudit.status === "APPROVED"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : selectedAudit.status === "REJECTED"
                        ? "bg-brand-red/10 text-brand-red border-brand-red/20"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    }`}
                  >
                    {selectedAudit.status}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAudit(null)}
                  className="text-slate-400 hover:text-white p-2 rounded-xl bg-white/5"
                >
                  ✕
                </button>
              </div>

              {/* Details Grid */}
              <div className="grid gap-4 text-xs sm:grid-cols-2">
                <div className="rounded-2xl border border-white/5 bg-slate-950 p-4 space-y-2">
                  <p className="text-[10px] font-black uppercase text-slate-400">Personal &amp; Legal Info</p>
                  <p><span className="text-slate-400">Full Name:</span> <strong className="text-white">{selectedAudit.signature}</strong></p>
                  <p><span className="text-slate-400">NPI Number:</span> <strong className="text-white font-mono">{selectedAudit.npi}</strong></p>
                  <p><span className="text-slate-400">Email:</span> <strong className="text-white">{selectedAudit.doctorEmail || selectedAudit.doctor?.email || "Not Provided"}</strong></p>
                  <p><span className="text-slate-400">Digital Signature:</span> <strong className="text-brand-teal">{selectedAudit.signature}</strong></p>
                  <p><span className="text-slate-400">HIPAA Legal Consent:</span> <strong className="text-emerald-400">{selectedAudit.consent ? "Granted Yes" : "No"}</strong></p>
                </div>

                <div className="rounded-2xl border border-white/5 bg-slate-950 p-4 space-y-2">
                  <p className="text-[10px] font-black uppercase text-slate-400">PRC Credentials &amp; School</p>
                  <p><span className="text-slate-400">PRC License:</span> <strong className="text-white font-mono">{selectedAudit.licenseNumber}</strong></p>
                  <p><span className="text-slate-400">Issuing State:</span> <strong className="text-white">{selectedAudit.licenseState}</strong></p>
                  <p><span className="text-slate-400">Specialty:</span> <strong className="text-white">{selectedAudit.specialty}</strong></p>
                  <p><span className="text-slate-400">Medical School:</span> <strong className="text-white">{selectedAudit.medicalSchool}</strong></p>
                  <p><span className="text-slate-400">Graduation Year:</span> <strong className="text-white">{selectedAudit.gradYear} ({selectedAudit.yearsExp} Years Exp)</strong></p>
                </div>
              </div>

              {/* Supporting Documents Section */}
              <div className="rounded-2xl border border-white/5 bg-slate-950 p-4 space-y-3">
                <p className="text-[10px] font-black uppercase text-slate-400">Supporting Documents</p>
                {docs.plain ? (
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <svg className="h-4 w-4 text-brand-teal shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <span>{docs.plain}</span>
                  </div>
                ) : (docs.front || docs.back || docs.selfie) ? (
                  <div className="flex flex-wrap gap-3">
                    {docs.front && <DocThumbnail label="ID Front" doc={docs.front} />}
                    {docs.back && <DocThumbnail label="ID Back" doc={docs.back} />}
                    {docs.selfie && <DocThumbnail label="Selfie / Verification" doc={docs.selfie} />}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No supporting documents were uploaded with this submission.</p>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex gap-3 pt-2 border-t border-white/10">
                {selectedAudit.status !== "APPROVED" && selectedAudit.status !== "REJECTED" && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAudit(null);
                      handleOpenCreateForAudit(selectedAudit);
                    }}
                    className="flex-1 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-600 transition"
                  >
                    Approve &amp; Create Doctor Account
                  </button>
                )}
                {selectedAudit.status !== "APPROVED" && selectedAudit.status !== "REJECTED" && (
                  <button
                    type="button"
                    onClick={() => {
                      const id = selectedAudit.id;
                      setSelectedAudit(null);
                      handleReject(id);
                    }}
                    className="rounded-xl border border-brand-red/30 bg-brand-red/10 px-4 py-3 text-sm font-bold text-brand-red hover:bg-brand-red/20 transition"
                  >
                    Reject
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedAudit(null)}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-white hover:bg-white/10"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Admin Doctor Account Creation & Approval Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-900 p-6 sm:p-8 shadow-2xl text-white space-y-6">
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                  Final Approval Step
                </span>
                <h3 className="font-display text-2xl font-black text-white mt-1">
                  Approve &amp; Create Doctor Login
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Completing this form will save the doctor to the <strong className="text-white">users</strong> and <strong className="text-white">doctors</strong> tables and mark their audit as <strong className="text-emerald-400">APPROVED</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white p-2 rounded-xl bg-white/5"
              >
                ✕
              </button>
            </div>

            {createdResult ? (
              <div className="space-y-6">
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 space-y-3">
                  <div className="flex items-center space-x-2 text-emerald-400 font-bold">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Doctor Account Created &amp; Audit Approved!</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Hand off these login credentials to <strong className="text-white">{createdResult.name}</strong> to log into the HealthKo Doctor Portal.
                  </p>

                  <div className="rounded-xl bg-slate-950 p-4 space-y-2 font-mono text-xs text-white">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Portal Signin:</span>
                      <span className="text-brand-teal">/doctor/signin</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Email:</span>
                      <strong>{createdResult.email}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">NPI Number:</span>
                      <strong>{createdResult.npi}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Password:</span>
                      <strong className="text-emerald-400">{createdResult.password}</strong>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-full rounded-xl bg-brand-teal py-3 font-bold text-white hover:bg-brand-teal-hover"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitCreateAccount} className="space-y-4 text-xs">
                {error && (
                  <div className="rounded-xl border border-brand-red/30 bg-brand-red/10 p-3 text-xs font-semibold text-brand-red">
                    ⚠️ {error}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={createForm.firstName}
                      onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                      placeholder="e.g. Maria"
                      className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-white focus:outline-none focus:border-brand-teal"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={createForm.lastName}
                      onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                      placeholder="e.g. Santos"
                      className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-white focus:outline-none focus:border-brand-teal"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                      Doctor Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={createForm.email}
                      onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                      placeholder="dr.santos@clinic.com"
                      className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-white focus:outline-none focus:border-brand-teal"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                      NPI / PRC ID Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={createForm.npi}
                      onChange={(e) => setCreateForm({ ...createForm, npi: e.target.value })}
                      placeholder="e.g. 1982736450"
                      className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-white focus:outline-none focus:border-brand-teal"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[10px] font-black uppercase text-slate-400">
                      Login Password *
                    </label>
                    <button
                      type="button"
                      onClick={generateRandomPassword}
                      className="text-[10px] font-bold text-brand-teal hover:underline"
                    >
                      🎲 Generate Secure Password
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 font-mono text-white focus:outline-none focus:border-brand-teal"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                      Specialty *
                    </label>
                    <select
                      value={createForm.specialty}
                      onChange={(e) => setCreateForm({ ...createForm, specialty: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white focus:outline-none focus:border-brand-teal"
                    >
                      <option value="General Medicine">General Medicine</option>
                      <option value="Cardiology">Cardiology</option>
                      <option value="Dermatology">Dermatology</option>
                      <option value="Pediatrics">Pediatrics</option>
                      <option value="Neurology">Neurology</option>
                      <option value="Psychiatry">Psychiatry</option>
                      <option value="Orthopedics">Orthopedics</option>
                      <option value="Obstetrics & Gynecology">Obstetrics &amp; Gynecology</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                      PRC License Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={createForm.licenseNumber}
                      onChange={(e) => setCreateForm({ ...createForm, licenseNumber: e.target.value })}
                      placeholder="PRC-0098765"
                      className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-white focus:outline-none focus:border-brand-teal"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                      Years of Experience
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      value={createForm.yearsExp}
                      onChange={(e) => setCreateForm({ ...createForm, yearsExp: Number(e.target.value) })}
                      className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-white focus:outline-none focus:border-brand-teal"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                      Consult Fee (₱)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={createForm.consultFee}
                      onChange={(e) => setCreateForm({ ...createForm, consultFee: Number(e.target.value) })}
                      className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-white focus:outline-none focus:border-brand-teal"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 font-bold text-white hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingAccount}
                    className="rounded-xl bg-emerald-500 px-6 py-2.5 font-bold text-white hover:bg-emerald-600 disabled:opacity-50 transition"
                  >
                    {creatingAccount ? "Creating Account..." : "Approve & Save Doctor Account"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
