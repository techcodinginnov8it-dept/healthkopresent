"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { approveDoctorAudit, rejectDoctorAudit, getPendingDoctorAudits } from "@/app/actions/audit";

type DoctorAudit = {
  id: string;
  npi: string;
  licenseNumber: string;
  licenseState: string;
  specialty: string;
  medicalSchool: string;
  gradYear: number;
  yearsExp: number;
  status: string;
  submittedAt: Date;
  doctor: {
    id: string;
    name: string;
    email: string;
    specialty: string;
  } | null;
};

export default function DoctorManagementPage() {
  const [audits, setAudits] = useState<DoctorAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchPendingAudits();
  }, []);

  async function fetchPendingAudits() {
    setLoading(true);
    try {
      const result = await getPendingDoctorAudits();
      if (result.success) {
        setAudits(result.audits || []);
      } else {
        setError(result.error || "Failed to fetch pending audits");
      }
    } catch (err) {
      setError("An error occurred while fetching audits");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(auditId: string) {
    setApproving(auditId);
    setError("");
    setSuccess("");
    try {
      const result = await approveDoctorAudit(auditId);
      if (result.success) {
        setSuccess(`${result.message} The doctor can now log in and use their account.`);
        setAudits((prev) => prev.filter((a) => a.id !== auditId));
      } else {
        setError(result.error || "Failed to approve doctor");
      }
    } catch (err) {
      setError("An error occurred while approving the doctor");
    } finally {
      setApproving(null);
    }
  }

  async function handleReject(auditId: string) {
    const reason = prompt("Enter rejection reason (optional):");
    if (reason === null) return; // User cancelled

    setRejecting(auditId);
    setError("");
    setSuccess("");
    try {
      const result = await rejectDoctorAudit(auditId, reason);
      if (result.success) {
        setSuccess(result.message || "Doctor credentials rejected");
        setAudits((prev) => prev.filter((a) => a.id !== auditId));
      } else {
        setError(result.error || "Failed to reject doctor");
      }
    } catch (err) {
      setError("An error occurred while rejecting the doctor");
    } finally {
      setRejecting(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-teal">DOCTOR MANAGEMENT</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Screening & Approvals</h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-400">
              Review, screen, and approve new doctors joining the HealthKo platform.
            </p>
          </div>
          <Link href="/admin/dashboard" className="text-sm font-semibold text-brand-teal hover:text-brand-teal-hover">
            ← Back to Dashboard
          </Link>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-brand-red/20 bg-brand-red/10 p-4 text-sm font-semibold text-brand-red">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-xl border border-brand-teal/20 bg-brand-teal/10 p-4 text-sm font-semibold text-brand-teal">
            {success}
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 text-center">
            <p className="text-slate-400">Loading pending audits...</p>
          </div>
        ) : audits.length === 0 ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 text-center">
            <p className="text-lg font-bold text-slate-300">No pending doctor audits</p>
            <p className="mt-2 text-sm text-slate-400">All doctor applications have been reviewed.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {audits.map((audit) => (
              <div key={audit.id} className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
                <div className="grid gap-6 lg:grid-cols-3">
                  {/* Doctor Info */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Doctor Information</p>
                    <div className="mt-4 space-y-3">
                      <div>
                        <p className="text-sm text-slate-400">Name</p>
                        <p className="mt-1 font-bold text-white">{audit.doctor?.name || "Unlinked"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Email</p>
                        <p className="mt-1 font-bold text-white">{audit.doctor?.email || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">NPI</p>
                        <p className="mt-1 font-mono text-sm font-bold text-white">{audit.npi}</p>
                      </div>
                    </div>
                  </div>

                  {/* Credentials */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Credentials</p>
                    <div className="mt-4 space-y-3">
                      <div>
                        <p className="text-sm text-slate-400">License Number</p>
                        <p className="mt-1 font-bold text-white">{audit.licenseNumber}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">License State</p>
                        <p className="mt-1 font-bold text-white">{audit.licenseState}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Medical School</p>
                        <p className="mt-1 font-bold text-white">{audit.medicalSchool}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Years of Experience</p>
                        <p className="mt-1 font-bold text-white">{audit.yearsExp} years</p>
                      </div>
                    </div>
                  </div>

                  {/* Specialty & Actions */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Specialty & Actions</p>
                    <div className="mt-4 space-y-4">
                      <div>
                        <p className="text-sm text-slate-400">Specialty</p>
                        <p className="mt-1 font-bold text-white">{audit.specialty}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Graduated</p>
                        <p className="mt-1 font-bold text-white">{audit.gradYear}</p>
                      </div>

                      <div className="pt-4 space-y-2">
                        <button
                          onClick={() => handleApprove(audit.id)}
                          disabled={approving === audit.id}
                          className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                        >
                          {approving === audit.id ? "Approving..." : "✓ Approve & Activate"}
                        </button>
                        <button
                          onClick={() => handleReject(audit.id)}
                          disabled={rejecting === audit.id}
                          className="w-full rounded-xl border border-brand-red/30 bg-brand-red/10 px-4 py-3 text-sm font-semibold text-brand-red hover:bg-brand-red/20 disabled:opacity-50"
                        >
                          {rejecting === audit.id ? "Rejecting..." : "✗ Reject"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-700 pt-4">
                  <p className="text-xs text-slate-500">
                    Submitted: {new Date(audit.submittedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
