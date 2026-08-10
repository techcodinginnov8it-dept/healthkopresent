"use client";

import { useEffect, useState, useTransition } from "react";
import type { CarePlanSnapshot, DashboardRole } from "@/lib/dashboard/types";

function splitParagraphText(text?: string | null) {
  const normalized = (text || "").trim();

  if (!normalized) {
    return [];
  }

  return normalized
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export function CarePlanCard({
  plan,
  role,
  editableContext,
  onSave,
}: {
  plan: CarePlanSnapshot;
  role: DashboardRole;
  editableContext?: {
    consultationId: string;
    prescription: string | null;
    consultation: string | null;
  } | null;
  onSave?: (consultationId: string, data: { prescription: string; consultation: string }) => Promise<{ success: boolean; error?: string | null }>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftPrescription, setDraftPrescription] = useState(editableContext?.prescription || "");
  const [draftConsultation, setDraftConsultation] = useState(editableContext?.consultation || "");
  const [saveError, setSaveError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (isEditing) {
      return;
    }

    setDraftPrescription(editableContext?.prescription || "");
    setDraftConsultation(editableContext?.consultation || "");
  }, [editableContext?.consultation, editableContext?.prescription, isEditing]);

  const badgeText = plan.canEdit ? (isEditing ? "Editing" : "Doctor editable") : "Read only";

  const handleSave = () => {
    if (!editableContext || !onSave) {
      return;
    }

    startTransition(async () => {
      const result = await onSave(editableContext.consultationId, {
        prescription: draftPrescription,
        consultation: draftConsultation,
      });

      if (result.success) {
        setSaveError("");
        setIsEditing(false);
      } else {
        setSaveError(result.error || "Could not update this treatment plan.");
      }
    });
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Care Plan</p>
          <h3 className="mt-1 text-base font-black text-slate-950">Clinical Summary</h3>
        </div>
        {plan.canEdit ? (
          <button
            type="button"
            onClick={() => {
              setSaveError("");
              setIsEditing((value) => !value);
            }}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition ${
              isEditing
                ? "border-brand-teal bg-brand-teal text-slate-950"
                : "border-slate-200 bg-slate-50 text-slate-500 hover:border-brand-teal hover:text-brand-teal"
            }`}
          >
            {badgeText}
          </button>
        ) : (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
            {badgeText}
          </span>
        )}
      </div>

      <dl className="mt-4 space-y-3 text-sm">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">Next Visit</dt>
          <dd className="mt-1 font-semibold text-slate-700">{plan.nextVisit}</dd>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">Prescription</dt>
          {isEditing ? (
            <textarea
              value={draftPrescription}
              onChange={(event) => setDraftPrescription(event.target.value)}
              rows={5}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold leading-7 text-slate-700 outline-none focus:border-brand-teal"
              placeholder="Edit prescription"
            />
          ) : (
            <dd className="mt-2 space-y-3 text-sm font-semibold leading-7 text-slate-700">
              {splitParagraphText(plan.currentMedication).length ? (
                splitParagraphText(plan.currentMedication).map((paragraph, index) => (
                  <p key={`med-${index}`} className="whitespace-pre-line break-words">
                    {paragraph}
                  </p>
                ))
              ) : (
                <p className="whitespace-pre-line break-words">No details available.</p>
              )}
            </dd>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">Consultation</dt>
          {isEditing ? (
            <textarea
              value={draftConsultation}
              onChange={(event) => setDraftConsultation(event.target.value)}
              rows={5}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold leading-7 text-slate-700 outline-none focus:border-brand-teal"
              placeholder="Edit consultation"
            />
          ) : (
            <dd className="mt-2 space-y-3 text-sm font-semibold leading-7 text-slate-700">
              {splitParagraphText(plan.doctorSummary).length ? (
                splitParagraphText(plan.doctorSummary).map((paragraph, index) => (
                  <p key={`summary-${index}`} className="whitespace-pre-line break-words">
                    {paragraph}
                  </p>
                ))
              ) : (
                <p className="whitespace-pre-line break-words">No details available.</p>
              )}
            </dd>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">Clinical Status</dt>
          <dd className="mt-1 font-semibold text-slate-700">{plan.followUpStatus}</dd>
        </div>
      </dl>

      {isEditing && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="rounded-lg bg-brand-teal px-3 py-2 text-xs font-black text-slate-950 disabled:bg-slate-100"
          >
            {isPending ? "Saving..." : "Save changes"}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsEditing(false);
              setDraftPrescription(editableContext?.prescription || "");
              setDraftConsultation(editableContext?.consultation || "");
              setSaveError("");
            }}
            className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-950"
          >
            Cancel
          </button>
        </div>
      )}

      {saveError && <p className="mt-3 text-xs font-semibold text-red-600">{saveError}</p>}

      <p className="mt-3 text-[11px] font-semibold leading-relaxed text-slate-500">
        {role === "doctor"
          ? "Update the underlying consultation, prescription, and follow-up records from the doctor workflow."
          : "This is a read-only view of the shared care plan from your care team."}
      </p>
    </section>
  );
}
