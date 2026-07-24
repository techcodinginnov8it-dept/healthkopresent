"use client";

import Link from "next/link";
import { useState } from "react";

import { approveDoctorAudit, rejectDoctorAudit } from "@/app/actions/audit";

type DoctorAudit = {
  id: string;
  doctorId: string | null;
  npi: string;
  licenseNumber: string;
  licenseState: string;
  specialty: string;
  medicalSchool: string;
  gradYear: number;
  yearsExp: number;
  documentName: string | null;
  status: string;
  signature: string;
  consent: boolean;
  submittedAt: string;
  updatedAt: string;
  doctor: {
    id: string;
    name: string;
    email: string;
    specialty: string;
  } | null;
};

export default function AdminAuditReviewClient({ initialAudits }: { initialAudits: DoctorAudit[] }) {
  const [audits, setAudits] = useState(initialAudits);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  async function handleApprove(auditId: string) {
    setWorkingId(auditId);
    setError("");
    setFeedback("");

    try {
      const result = await approveDoctorAudit(auditId);
      if (!result.success) {
        setError(result.error || "Failed to approve doctor credentials.");
        return;
      }

      setFeedback(result.message || "Doctor credentials approved.");
      setAudits((prev) => prev.filter((audit) => audit.id !== auditId));
    } catch {
      setError("An error occurred while approving the audit.");
    } finally {
      setWorkingId(null);
    }
  }

  async function handleReject(auditId: string) {
    const reason = window.prompt("Enter rejection reason (optional):") ?? undefined;
    setWorkingId(auditId);
    setError("");
    setFeedback("");

    try {
      const result = await rejectDoctorAudit(auditId, reason);
      if (!result.success) {
        setError(result.error || "Failed to reject doctor credentials.");
        return;
      }

      setFeedback(result.message || "Doctor credentials rejected.");
      setAudits((prev) => prev.filter((audit) => audit.id !== auditId));
    } catch {
      setError("An error occurred while rejecting the audit.");
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-teal">Partnership Review</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight">Pending doctor partner requests</h2>
          <p className="mt-3 max-w-2xl text-sm text-slate-300">
            Review the details doctors submitted from the HealthKo partnership flow and approve or reject them here.
          </p>
        </div>

        <Link href="/admin/doctors" className="text-sm font-bold text-brand-teal hover:underline">
          Open review dashboard
        </Link>
      </div>

      {error && (
        <div className="mt-6 rounded-2xl border border-brand-red/20 bg-brand-red/10 p-4 text-sm font-semibold text-brand-red">
          {error}
        </div>
      )}

      {feedback && (
        <div className="mt-6 rounded-2xl border border-brand-teal/20 bg-brand-teal/10 p-4 text-sm font-semibold text-brand-teal">
          {feedback}
        </div>
      )}

      <div className="mt-6 grid gap-4">
        {audits.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-6 text-sm text-slate-300">
            No pending partner requests right now. New doctor submissions will appear here for approval.
          </div>
        ) : (
          audits.map((audit) => (
            <article key={audit.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-5">
              <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr_1fr]">
                <div className="space-y-3">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-400">Doctor</p>
                  <div>
                    <p className="text-sm text-slate-400">Name</p>
                    <p className="font-bold text-white">{audit.doctor?.name || "Unlinked submission"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Email</p>
                    <p className="font-bold text-white">{audit.doctor?.email || "Not linked"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">NPI</p>
                    <p className="font-mono text-sm font-bold text-white">{audit.npi}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Signature</p>
                    <p className="font-bold text-white">{audit.signature}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-400">Credentials</p>
                  <div>
                    <p className="text-sm text-slate-400">License</p>
                    <p className="font-bold text-white">
                      {audit.licenseNumber} / {audit.licenseState}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Medical school</p>
                    <p className="font-bold text-white">{audit.medicalSchool}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Specialty</p>
                    <p className="font-bold text-white">{audit.specialty}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Experience</p>
                    <p className="font-bold text-white">
                      {audit.yearsExp} years, graduating {audit.gradYear}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-slate-400">Submission</p>
                    <p className="mt-2 text-sm text-slate-300">
                      {audit.documentName ? (
                        <span className="break-all">{audit.documentName}</span>
                      ) : (
                        "No credential document attached."
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-400">Submitted</p>
                    <p className="font-bold text-white">{new Date(audit.submittedAt).toLocaleString()}</p>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => handleApprove(audit.id)}
                      disabled={workingId === audit.id}
                      className="flex-1 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-600 disabled:opacity-50"
                    >
                      {workingId === audit.id ? "Working..." : "Approve"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(audit.id)}
                      disabled={workingId === audit.id}
                      className="flex-1 rounded-xl border border-brand-red/30 bg-brand-red/10 px-4 py-3 text-sm font-bold text-brand-red transition hover:bg-brand-red/20 disabled:opacity-50"
                    >
                      {workingId === audit.id ? "Working..." : "Reject"}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
