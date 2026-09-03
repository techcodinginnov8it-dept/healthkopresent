"use client";

import { useRouter } from "next/navigation";
import type { ChangeEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  updateDoctorPassword,
  updateDoctorProfile,
  updatePatientPassword,
  updatePatientProfile,
  requestDoctorPasswordOtp,
  requestPatientPasswordOtp,
  requestDoctorContactUpdateOtp,
} from "@/app/actions/settings";
import { formatDate } from "@/lib/dashboard/format";

type DoctorSettingsData = {
  id: string;
  name: string;
  username?: string | null;
  email: string;
  image?: string | null;
  specialty: string;
  availability: string;
  status?: string | null;
  npi: string;
  licenseNumber?: string | null;
  licenseState?: string | null;
  bio?: string | null;
  consultFee?: number | null;
  consultationDuration?: number | null;
  consultationDurationUnit?: string | null;
  yearsExp?: number | null;
  isVerified: boolean;
  createdAt: Date | string;
  audits?: {
    id: string;
    status: string;
    submittedAt: Date | string;
    updatedAt: Date | string;
    licenseNumber: string;
    licenseState: string;
  }[];
  bookings?: {
    id: string;
    scheduledAt: Date | string;
    status: string;
    reason?: string | null;
    duration?: number | null;
    createdAt?: Date | string;
    patient?: {
      id?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      image?: string | null;
    } | null;
  }[];
};

type PatientSettingsData = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  image?: string | null;
  countryCode?: string;
  phone: string;
  dob: string;
  gender: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  height?: string | null;
  weight?: string | null;
  bloodType?: string | null;
  allergies?: string | null;
  existingConditions?: string | null;
  currentMedications?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  emailVerified: boolean;
  createdAt: Date | string;
};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  otp: string;
};

type SettingsSection<TId extends string> = {
  id: TId;
  label: string;
  description: string;
};

type DoctorProfileFormState = {
  name: string;
  username?: string;
  email: string;
  image: string;
  specialty: string;
  phone: string;
  availability: string;
  status: string;
  licenseNumber: string;
  licenseState: string;
  bio: string;
  consultFee: string;
  yearsExp: string;
  consultationDuration: string;
  consultationDurationUnit: string;
  admitMode: string;
};

type PatientProfileFormState = {
  firstName: string;
  lastName: string;
  email: string;
  image: string;
  countryCode: string;
  phone: string;
  dob: string;
  gender: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  height: string;
  weight: string;
  bloodType: string;
  allergies: string;
  existingConditions: string;
  currentMedications: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
};

const blankPasswordForm: PasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
  otp: "",
};

const SETTINGS_DRAFT_VERSION = 1;

const patientSections = [
  { id: "profile", label: "Profile Management", description: "" },
  { id: "medical", label: "Medical Profile", description: "" },
  { id: "security", label: "Account Security", description: "" },
  { id: "notifications", label: "Notifications", description: "" },
  { id: "privacy", label: "Privacy", description: "" },
  { id: "support", label: "Support & Help", description: "" },
] as const satisfies readonly SettingsSection<string>[];

const doctorSections = [
  { id: "professional", label: "Professional Profile", description: "" },
  { id: "schedule", label: "Schedule & Availability", description: "" },
  { id: "consultation", label: "Consultation Settings", description: "" },
  { id: "security", label: "Account Security", description: "" },
  { id: "notifications", label: "Notification Settings", description: "" },
  { id: "prescriptions", label: "Prescription Settings", description: "" },
  { id: "privacy", label: "Privacy & Consent", description: "" },
  { id: "support", label: "Support & Help", description: "" },
] as const satisfies readonly SettingsSection<string>[];

type PatientSectionId = (typeof patientSections)[number]["id"];
type DoctorSectionId = (typeof doctorSections)[number]["id"];

import { createContext, useContext } from "react";

type SettingsTheme = "light" | "dark";
const ThemeContext = createContext<SettingsTheme>("light");
const useSettingsTheme = () => useContext(ThemeContext);

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  disabled = false,
  readOnly = false,
  helperText,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  helperText?: string;
}) {
  const tone = useSettingsTheme();
  const isDark = tone === "dark";
  const isLocked = disabled || readOnly;

  return (
    <label className={`space-y-1 text-xs font-black uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
      <span className="flex items-center justify-between">
        <span>{label}</span>
        {isLocked && (
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold lowercase tracking-normal ${
            isDark ? "text-slate-500" : "text-slate-400"
          }`}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
              <path fillRule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clipRule="evenodd" />
            </svg>
            verified / locked
          </span>
        )}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        className={`mt-1 h-11 w-full rounded-xl border px-3.5 text-sm font-semibold normal-case outline-none transition ${
          isLocked
            ? isDark
              ? "cursor-not-allowed border-slate-800/80 bg-slate-950/40 text-slate-400 select-none"
              : "cursor-not-allowed border-slate-200/80 bg-slate-100/70 text-slate-500 select-none"
            : isDark
              ? "border-slate-800 bg-slate-950 text-white placeholder-slate-500 focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
              : "border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
        }`}
      />
      {helperText ? (
        <span className={`block text-[11px] font-medium lowercase tracking-normal ${isDark ? "text-slate-500" : "text-slate-400"}`}>
          {helperText}
        </span>
      ) : null}
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const tone = useSettingsTheme();
  const isDark = tone === "dark";

  return (
    <label className={`space-y-1 text-xs font-black uppercase tracking-wider md:col-span-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={2}
        className={`mt-1 min-h-20 w-full rounded-xl border px-3.5 py-2.5 text-sm font-semibold normal-case outline-none transition ${
          isDark
            ? "border-slate-800 bg-slate-950 text-white placeholder-slate-500 focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
            : "border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
        }`}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const tone = useSettingsTheme();
  const isDark = tone === "dark";

  return (
    <label className={`space-y-1 text-xs font-black uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1 h-11 w-full rounded-xl border px-3.5 text-sm font-semibold normal-case outline-none transition ${
          isDark
            ? "border-slate-800 bg-slate-950 text-white focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
            : "border-slate-200 bg-white text-slate-900 focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
        }`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function SettingsCard({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children: ReactNode;
}) {
  const tone = useSettingsTheme();
  const isDark = tone === "dark";

  return (
    <section className={`rounded-2xl border p-6 transition-colors ${
      isDark ? "border-slate-850 bg-slate-900 text-white shadow-xs" : "border-slate-200 bg-white text-slate-900 shadow-xs"
    }`}>
      <div className="mb-5 border-b pb-4" style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
        <h2 className={`text-xl font-black ${isDark ? "text-white" : "text-slate-950"}`}>{title}</h2>
        {body && <p className={`mt-1 text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>{body}</p>}
      </div>
      {children}
    </section>
  );
}

function FieldGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const tone = useSettingsTheme();
  const isDark = tone === "dark";

  return (
    <section className={`rounded-xl border p-5 transition-colors ${
      isDark ? "border-slate-800 bg-slate-950/70" : "border-slate-100 bg-slate-50/80"
    }`}>
      <div className="mb-4">
        <h3 className={`text-xs font-black uppercase tracking-[0.16em] ${isDark ? "text-slate-200" : "text-slate-950"}`}>{title}</h3>
        {description ? <p className={`mt-1 text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>{description}</p> : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

function SettingsToastStack({ toasts }: { toasts: { id: string; tone: "success" | "error"; message: string }[] }) {
  return (
    <div className="pointer-events-none fixed right-5 top-5 z-[90] flex w-[min(24rem,calc(100vw-2.5rem))] flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-xl border px-4 py-3 text-sm font-bold shadow-2xl backdrop-blur ${
            toast.tone === "success"
              ? "border-emerald-200 bg-emerald-50/95 text-emerald-700"
              : "border-red-200 bg-red-50/95 text-red-700"
          }`}
          role="status"
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}

function isRenderableProfileImage(src?: string | null) {
  if (!src) {
    return false;
  }

  return /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(src) || /^https?:\/\//i.test(src) || src.startsWith("/");
}

function getSettingsDraftKey(role: "doctor" | "patient", accountId: string) {
  return `healthko:settings-draft:${role}:${accountId}`;
}

function readSettingsDraft<T>(key: string): T | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { version?: number; form?: T };
    if (!parsed || parsed.version !== SETTINGS_DRAFT_VERSION || !parsed.form) {
      return null;
    }

    return parsed.form;
  } catch {
    return null;
  }
}

function writeSettingsDraft<T>(key: string, form: T) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        version: SETTINGS_DRAFT_VERSION,
        savedAt: Date.now(),
        form,
      }),
    );
  } catch {
    // Ignore storage quota and privacy-mode failures.
  }
}

function clearSettingsDraft(key: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}

function ProfileImagePreviewModal({
  label,
  image,
  onClose,
}: {
  label: string;
  image: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`${label} profile image preview`}
      onClick={onClose}
    >
      <div
        className="relative flex w-[min(92vw,56rem)] max-w-full items-center justify-center rounded-[2rem] border border-white/10 bg-slate-950 p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-end">
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-xl font-black text-white hover:bg-white/10"
            aria-label="Close preview"
          >
            ×
          </button>
        </div>
        <div className="relative aspect-square w-full overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/20">
          <img src={image} alt={`${label} profile preview`} className="h-full w-full object-cover" />
        </div>
      </div>
    </div>
  );
}

function ProfileHeader({
  label,
  description,
  image,
  onUpload,
  onRemove,
  onPreview,
  onToast,
}: {
  label: string;
  description: string;
  image?: string | null;
  onUpload: (file: File) => void;
  onRemove: () => void;
  onPreview: () => void;
  onToast: (tone: "success" | "error", message: string) => void;
}) {
  const tone = useSettingsTheme();
  const isDark = tone === "dark";

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      onToast("error", "Upload an image file for the profile picture.");
      return;
    }

    if (file.size > 750_000) {
      onToast("error", "Profile image must be 750 KB or smaller.");
      return;
    }

    onUpload(file);
  };

  return (
    <div className={`flex w-full flex-col gap-4 rounded-2xl border p-5 shadow-xs transition-colors lg:flex-row lg:items-center lg:justify-between ${
      isDark ? "border-slate-800 bg-slate-950/70" : "border-slate-100 bg-slate-50/80"
    }`}>
      <div className="flex min-w-0 items-center gap-4">
        {isRenderableProfileImage(image) ? (
          <button
            type="button"
            onClick={onPreview}
            className={`group relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-4 shadow-sm ring-1 transition hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-brand-teal ${
              isDark ? "border-slate-800 ring-slate-700 bg-slate-900" : "border-white ring-slate-200 bg-white"
            }`}
            aria-label={`View enlarged profile image for ${label}`}
          >
            <img src={image ?? ""} alt={`${label} profile image`} className="h-full w-full object-cover transition duration-200 group-hover:scale-105" />
            <span className="absolute inset-x-0 bottom-0 bg-slate-950/75 px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white opacity-0 transition group-hover:opacity-100">
              View
            </span>
          </button>
        ) : (
          <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 text-xl font-black shadow-sm ring-1 ${
            isDark
              ? "border-slate-800 bg-brand-teal/20 text-brand-teal ring-slate-700"
              : "border-white bg-brand-teal/10 text-brand-teal ring-slate-200"
          }`}>
            {label
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className={`truncate text-base font-black ${isDark ? "text-white" : "text-slate-950"}`}>{label}</p>
          {description ? <p className={`mt-0.5 text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>{description}</p> : null}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
        <label className="cursor-pointer rounded-xl bg-brand-teal px-4 py-2.5 text-xs font-black text-white shadow-xs hover:bg-teal-600 transition">
          Upload Photo
          <input type="file" accept="image/*" onChange={handleFile} className="sr-only" />
        </label>
        {image && (
          <button
            type="button"
            onClick={onRemove}
            className={`rounded-xl border px-4 py-2.5 text-xs font-black transition ${
              isDark ? "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            Remove Photo
          </button>
        )}
      </div>
    </div>
  );
}

function StickyActionBar({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: "light" | "dark";
}) {
  const contextTone = useSettingsTheme();
  const currentTone = tone || contextTone;
  const isDark = currentTone === "dark";

  return (
    <div
      className={`sticky bottom-0 z-20 -mx-6 -mb-6 mt-4 flex flex-col gap-3 rounded-b-2xl border-t px-6 py-3.5 backdrop-blur-md sm:flex-row sm:justify-end md:col-span-2 xl:col-span-3 transition-colors ${
        isDark ? "border-slate-800 bg-slate-900/90" : "border-slate-100 bg-white/90"
      }`}
    >
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked = true,
}: {
  label: string;
  description: string;
  checked?: boolean;
}) {
  const tone = useSettingsTheme();
  const isDark = tone === "dark";

  return (
    <label className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5 transition-colors cursor-pointer ${
      isDark ? "border-slate-800 bg-slate-950/70 hover:border-slate-700" : "border-slate-200 bg-white hover:border-slate-300"
    }`}>
      <span>
        <span className={`block text-sm font-black ${isDark ? "text-slate-100" : "text-slate-800"}`}>{label}</span>
        <span className={`mt-0.5 block text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>{description}</span>
      </span>
      <input type="checkbox" checked={checked} readOnly className="h-4 w-4 shrink-0 accent-brand-teal" />
    </label>
  );
}

function ReadOnlyTile({ label, value }: { label: string; value: string }) {
  const tone = useSettingsTheme();
  const isDark = tone === "dark";

  return (
    <div className={`rounded-xl border p-4 transition-colors ${
      isDark ? "border-slate-800 bg-slate-950/70" : "border-slate-100 bg-slate-50/80"
    }`}>
      <p className={`text-[10px] font-black uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>{label}</p>
      <p className={`mt-1.5 text-sm font-black ${isDark ? "text-white" : "text-slate-800"}`}>{value}</p>
    </div>
  );
}

function PlaceholderTile({ title, body }: { title: string; body: string }) {
  const tone = useSettingsTheme();
  const isDark = tone === "dark";

  return (
    <div className={`rounded-xl border border-dashed p-4 transition-colors ${
      isDark ? "border-slate-800 bg-slate-950/50" : "border-slate-300 bg-slate-50/80"
    }`}>
      <p className={`text-sm font-black ${isDark ? "text-slate-200" : "text-slate-800"}`}>{title}</p>
      <p className={`mt-1 text-xs font-semibold leading-relaxed ${isDark ? "text-slate-400" : "text-slate-500"}`}>{body}</p>
    </div>
  );
}

function SettingsLayout<TId extends string>({
  role,
  sections,
  activeSection,
  onSectionChange,
  title,
  subtitle,
  children,
}: {
  role: "doctor" | "patient";
  sections: readonly SettingsSection<TId>[];
  activeSection: TId;
  onSectionChange: (section: TId) => void;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const tone = useSettingsTheme();
  const isDark = tone === "dark";

  return (
    <section className="grid min-h-[calc(100vh-9rem)] gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
      {/* Mobile Horizontal Tabs */}
      <nav className={`flex gap-2 overflow-x-auto rounded-xl border p-2 xl:hidden ${
        isDark ? "border-slate-850 bg-slate-900" : "border-slate-200 bg-white"
      }`} aria-label={`${role} settings sections`}>
        {sections.map((section) => {
          const active = activeSection === section.id;

          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSectionChange(section.id)}
              className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-black transition ${
                active
                  ? "bg-brand-teal text-white shadow-xs"
                  : isDark ? "bg-slate-950 text-slate-300" : "bg-slate-100 text-slate-700"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {section.label}
            </button>
          );
        })}
      </nav>

      {/* Desktop Aside Navigation */}
      <aside className={`hidden rounded-2xl border p-5 xl:block transition-colors self-start sticky top-4 ${
        isDark ? "border-slate-850 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900 shadow-xs"
      }`}>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Preferences</p>
        <h2 className={`mt-1 text-xl font-black ${isDark ? "text-white" : "text-slate-950"}`}>{title}</h2>
        {subtitle && <p className={`mt-1 text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>{subtitle}</p>}
        
        <nav className="mt-5 space-y-1.5" aria-label={`${role} settings sections`}>
          {sections.map((section) => {
            const active = activeSection === section.id;

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onSectionChange(section.id)}
                className={`w-full rounded-xl border px-3.5 py-2.5 text-left transition-all ${
                  active
                    ? "border-brand-teal bg-brand-teal text-white shadow-sm font-black"
                    : isDark
                      ? "border-transparent bg-transparent text-slate-300 hover:border-slate-800 hover:bg-slate-950"
                      : "border-transparent bg-transparent text-slate-700 hover:border-slate-100 hover:bg-slate-50"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <span className="block text-xs font-black">{section.label}</span>
                {section.description ? (
                  <span className={`mt-0.5 block text-[10px] font-semibold ${
                    active ? "text-white/80" : isDark ? "text-slate-500" : "text-slate-400"
                  }`}>
                    {section.description}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0 space-y-4">{children}</div>
    </section>
  );
}

function useSettingsToasts() {
  const [toasts, setToasts] = useState<{ id: string; tone: "success" | "error"; message: string }[]>([]);

  const showToast = useCallback((tone: "success" | "error", message: string) => {
    const id = `settings-toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((current) => [...current, { id, tone, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 5000);
  }, []);

  return { toasts, showToast };
}

function PasswordManagement({
  role,
  onToast,
}: {
  role: "doctor" | "patient";
  onToast: (tone: "success" | "error", message: string) => void;
}) {
  const tone = useSettingsTheme();
  const isDark = tone === "dark";
  const [form, setForm] = useState<PasswordForm>(blankPasswordForm);
  const [isPending, startTransition] = useTransition();
  // OTP flow stages: "form" → "sending" → "otp" → done
  const [otpStage, setOtpStage] = useState<"form" | "sending" | "otp">("form");
  const [otpError, setOtpError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [sentToEmail, setSentToEmail] = useState("");

  const setField = (field: keyof PasswordForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  // Countdown ticker for resend cooldown
  useEffect(() => {
    if (countdown <= 0) return;
    const t = window.setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [countdown]);

  function handleRequestOtp() {
    // Basic client-side validation before sending OTP
    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      setOtpError("Please fill in all password fields first.");
      return;
    }
    if (form.newPassword.length < 8) {
      setOtpError("New password must be at least 8 characters.");
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setOtpError("New password and confirmation do not match.");
      return;
    }
    if (form.currentPassword === form.newPassword) {
      setOtpError("New password must differ from the current password.");
      return;
    }
    setOtpError("");
    setOtpStage("sending");

    startTransition(async () => {
      const result =
        role === "doctor"
          ? await requestDoctorPasswordOtp()
          : await requestPatientPasswordOtp();

      if (!result.success) {
        setOtpError(result.error || "Could not send the verification code.");
        setOtpStage("form");
        return;
      }

      if (result.targetEmail) {
        setSentToEmail(result.targetEmail);
      }
      setOtpStage("otp");
      setCountdown(60); // 60-second resend cooldown
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.otp.trim()) {
      setOtpError("Please enter the verification code.");
      return;
    }
    setOtpError("");
    startTransition(async () => {
      const result =
        role === "doctor"
          ? await updateDoctorPassword(form)
          : await updatePatientPassword(form);

      if (!result.success) {
        onToast("error", result.error || "Could not update password.");
        // If the OTP was wrong/expired, stay on OTP step so they can retry
        if (result.error?.toLowerCase().includes("code") || result.error?.toLowerCase().includes("verif")) {
          setOtpError(result.error ?? "");
        }
        return;
      }

      setForm(blankPasswordForm);
      setOtpStage("form");
      setCountdown(0);
      onToast("success", "Password updated successfully.");
    });
  }

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const inputBase = `mt-1 h-11 w-full rounded-xl border pl-3.5 pr-10 text-sm font-semibold outline-none transition ${
    isDark
      ? "border-slate-800 bg-slate-950 text-white placeholder-slate-500 focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
      : "border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
  }`;

  return (
    <SettingsCard title="Password Management" body="">
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Step 1: password fields with visibility toggles ── */}
        <div className={`grid gap-4 md:grid-cols-3 transition-opacity ${
          otpStage === "otp" ? "pointer-events-none opacity-40" : ""
        }`}>
          {/* Current Password */}
          <div className="space-y-1">
            <label className={`block text-xs font-black uppercase tracking-wider ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}>
              Current password
            </label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                value={form.currentPassword}
                onChange={(e) => setField("currentPassword", e.target.value)}
                disabled={otpStage === "otp"}
                className={inputBase}
                autoComplete="current-password"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((prev) => !prev)}
                disabled={otpStage === "otp"}
                aria-label={showCurrent ? "Hide current password" : "Show current password"}
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 transition ${
                  isDark ? "text-slate-400 hover:text-white" : "text-slate-400 hover:text-slate-700"
                }`}
              >
                {showCurrent ? (
                  /* Eye Slash Icon (Hide) */
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.029 10.029 0 0 0 3.3-4.38 1.651 1.651 0 0 0 0-1.185A10.004 10.004 0 0 0 9.999 3a9.956 9.956 0 0 0-4.744 1.194L3.28 2.22ZM7.752 6.69l1.092 1.092a2.5 2.5 0 0 1 3.374 3.375l1.091 1.091a4 4 0 0 0-5.557-5.557Z" clipRule="evenodd" />
                    <path d="m10.748 13.93 2.523 2.523a9.987 9.987 0 0 1-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 0 1 0-1.186A10.007 10.007 0 0 1 2.839 6.02L6.07 9.252a4 4 0 0 0 4.678 4.678Z" />
                  </svg>
                ) : (
                  /* Eye Icon (Show) */
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                    <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-1">
            <label className={`block text-xs font-black uppercase tracking-wider ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}>
              New password
            </label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={form.newPassword}
                onChange={(e) => setField("newPassword", e.target.value)}
                disabled={otpStage === "otp"}
                className={inputBase}
                autoComplete="new-password"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowNew((prev) => !prev)}
                disabled={otpStage === "otp"}
                aria-label={showNew ? "Hide new password" : "Show new password"}
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 transition ${
                  isDark ? "text-slate-400 hover:text-white" : "text-slate-400 hover:text-slate-700"
                }`}
              >
                {showNew ? (
                  /* Eye Slash Icon (Hide) */
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.029 10.029 0 0 0 3.3-4.38 1.651 1.651 0 0 0 0-1.185A10.004 10.004 0 0 0 9.999 3a9.956 9.956 0 0 0-4.744 1.194L3.28 2.22ZM7.752 6.69l1.092 1.092a2.5 2.5 0 0 1 3.374 3.375l1.091 1.091a4 4 0 0 0-5.557-5.557Z" clipRule="evenodd" />
                    <path d="m10.748 13.93 2.523 2.523a9.987 9.987 0 0 1-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 0 1 0-1.186A10.007 10.007 0 0 1 2.839 6.02L6.07 9.252a4 4 0 0 0 4.678 4.678Z" />
                  </svg>
                ) : (
                  /* Eye Icon (Show) */
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                    <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className={`block text-xs font-black uppercase tracking-wider ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}>
                Confirm password
              </label>
              {/* Real-time Match Indicator Badge */}
              {form.confirmPassword && (
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                  form.newPassword === form.confirmPassword
                    ? "text-emerald-500"
                    : "text-rose-500"
                }`}>
                  {form.newPassword === form.confirmPassword ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                        <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                      </svg>
                      Passwords match
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                        <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                      </svg>
                      Passwords do not match
                    </>
                  )}
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={form.confirmPassword}
                onChange={(e) => setField("confirmPassword", e.target.value)}
                disabled={otpStage === "otp"}
                className={`mt-1 h-11 w-full rounded-xl border pl-3.5 pr-10 text-sm font-semibold outline-none transition ${
                  form.confirmPassword
                    ? form.newPassword === form.confirmPassword
                      ? "border-emerald-500/70 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      : "border-rose-500/70 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                    : isDark
                      ? "border-slate-800 focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
                      : "border-slate-200 focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
                } ${
                  isDark
                    ? "bg-slate-950 text-white placeholder-slate-500"
                    : "bg-white text-slate-900 placeholder-slate-400"
                }`}
                autoComplete="new-password"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((prev) => !prev)}
                disabled={otpStage === "otp"}
                aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 transition ${
                  isDark ? "text-slate-400 hover:text-white" : "text-slate-400 hover:text-slate-700"
                }`}
              >
                {showConfirm ? (
                  /* Eye Slash Icon (Hide) */
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.029 10.029 0 0 0 3.3-4.38 1.651 1.651 0 0 0 0-1.185A10.004 10.004 0 0 0 9.999 3a9.956 9.956 0 0 0-4.744 1.194L3.28 2.22ZM7.752 6.69l1.092 1.092a2.5 2.5 0 0 1 3.374 3.375l1.091 1.091a4 4 0 0 0-5.557-5.557Z" clipRule="evenodd" />
                    <path d="m10.748 13.93 2.523 2.523a9.987 9.987 0 0 1-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 0 1 0-1.186A10.007 10.007 0 0 1 2.839 6.02L6.07 9.252a4 4 0 0 0 4.678 4.678Z" />
                  </svg>
                ) : (
                  /* Eye Icon (Show) */
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                    <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Step 2: OTP entry (shown after code is sent) ── */}
        {otpStage === "otp" && (
          <div className={`rounded-2xl border p-5 ${
            isDark ? "border-brand-teal/30 bg-brand-teal/5" : "border-brand-teal/20 bg-teal-50"
          }`}>
            <div className="mb-4 flex items-start gap-3">
              {/* Shield icon */}
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-teal text-white">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M10 1a.75.75 0 0 1 .697.47l2.14 5.14 5.555.807a.75.75 0 0 1 .416 1.279l-4.017 3.914.948 5.528a.75.75 0 0 1-1.088.79L10 16.347l-4.65 2.445a.75.75 0 0 1-1.088-.79l.948-5.528L1.192 8.696a.75.75 0 0 1 .416-1.279l5.554-.807 2.14-5.14A.75.75 0 0 1 10 1Z" clipRule="evenodd" />
                </svg>
              </span>
              <div>
                <p className={`text-sm font-black ${ isDark ? "text-white" : "text-slate-900"}` }>
                  Check your email
                </p>
                <p className={`mt-0.5 text-xs font-semibold ${ isDark ? "text-slate-400" : "text-slate-500" }`}>
                  A 6-digit verification code was sent to {sentToEmail ? <strong className={isDark ? "text-brand-teal" : "text-slate-800"}>{sentToEmail}</strong> : "your registered account email"}. Enter it below to confirm your password change.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className={`flex-1 space-y-1 text-xs font-black uppercase tracking-wider ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}>
                Verification code
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={form.otp}
                  onChange={(e) => { setOtpError(""); setField("otp", e.target.value.replace(/\D/g, "")); }}
                  placeholder="000000"
                  autoFocus
                  className={`mt-1 h-14 w-full rounded-xl border px-4 text-2xl font-black tracking-[0.3em] outline-none transition ${
                    isDark
                      ? "border-slate-700 bg-slate-950 text-white placeholder-slate-700 focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
                      : "border-slate-300 bg-white text-slate-900 placeholder-slate-300 focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
                  }`}
                />
              </label>

              <button
                type="button"
                disabled={countdown > 0 || isPending}
                onClick={handleRequestOtp}
                className={`h-14 shrink-0 rounded-xl border px-4 text-xs font-black transition ${
                  countdown > 0 || isPending
                    ? isDark ? "border-slate-800 bg-slate-950 text-slate-500 cursor-not-allowed" : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                    : isDark ? "border-slate-700 bg-slate-900 text-slate-300 hover:border-brand-teal hover:text-brand-teal" : "border-slate-200 bg-white text-slate-700 hover:border-brand-teal hover:text-brand-teal"
                }`}
              >
                {countdown > 0 ? `Resend in ${countdown}s` : "Resend code"}
              </button>
            </div>
          </div>
        )}

        {/* ── Error message ── */}
        {otpError && (
          <p className="rounded-xl bg-red-500/10 px-4 py-2.5 text-xs font-semibold text-red-500">
            {otpError}
          </p>
        )}

        {/* ── Action buttons ── */}
        <div className="flex flex-wrap justify-end gap-2">
          {otpStage === "form" && (
            <button
              type="button"
              disabled={isPending}
              onClick={handleRequestOtp}
              className={`rounded-xl px-5 py-3 text-sm font-black transition ${
                isPending
                  ? "cursor-not-allowed bg-slate-500 text-white"
                  : isDark ? "bg-brand-teal text-white hover:bg-teal-600" : "bg-slate-900 text-white hover:bg-slate-800"
              }`}
            >
              {isPending ? "Sending code..." : "Send Verification Code"}
            </button>
          )}

          {otpStage === "sending" && (
            <button disabled className="cursor-not-allowed rounded-xl bg-slate-500 px-5 py-3 text-sm font-black text-white">
              Sending code…
            </button>
          )}

          {otpStage === "otp" && (
            <>
              <button
                type="button"
                onClick={() => { setOtpStage("form"); setField("otp", ""); setOtpError(""); }}
                className={`rounded-xl border px-5 py-3 text-sm font-black transition ${
                  isDark ? "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isPending || form.otp.length !== 6}
                className={`rounded-xl px-5 py-3 text-sm font-black text-white transition ${
                  isPending || form.otp.length !== 6
                    ? "cursor-not-allowed bg-slate-500"
                    : "bg-brand-teal hover:bg-teal-600"
                }`}
              >
                {isPending ? "Verifying…" : "Update Password"}
              </button>
            </>
          )}
        </div>
      </form>
    </SettingsCard>
  );
}

function AccountSecurityContent({
  role,
  verified,
  createdAt,
  onToast,
}: {
  role: "doctor" | "patient";
  verified: boolean;
  createdAt: Date | string;
  onToast: (tone: "success" | "error", message: string) => void;
}) {
  return (
    <div className="space-y-4">
      <PasswordManagement role={role} onToast={onToast} />
      <SettingsCard title="Security Overview" body="">
        <div className="grid gap-3 md:grid-cols-3">
          <ReadOnlyTile label="Account Status" value={verified ? "Verified" : "Verification pending"} />
          <ReadOnlyTile label="Joined" value={formatDate(createdAt)} />
          <ReadOnlyTile label="Current Session" value="Active on this device" />
        </div>
      </SettingsCard>
      {role === "patient" && (
        <SettingsCard title="Two-Factor, Devices, Login Activity, and Recovery" body="">
          <div className="grid gap-3 md:grid-cols-2">
            <PlaceholderTile title="Two-Factor Authentication" body="Not yet stored in the active account schema." />
            <PlaceholderTile title="Login Activity History" body="Security event history needs an account activity table." />
            <PlaceholderTile title="Device Management" body="Remote device revocation needs session inventory storage." />
            <PlaceholderTile title="Account Recovery Options" body="Recovery settings currently use the OTP and password reset workflows." />
          </div>
        </SettingsCard>
      )}
    </div>
  );
}

function AuditSupportSection({ doctor }: { doctor: DoctorSettingsData & { audits?: { id: string; status: string; licenseNumber: string; licenseState: string; submittedAt: Date | string }[] } }) {
  const tone = useSettingsTheme();
  const isDark = tone === "dark";

  return (
    <SettingsCard title="Support & Help" body="">
      <div className="space-y-3">
        <ReadOnlyTile label="NPI" value={doctor.npi} />
        {doctor.audits?.length ? (
          doctor.audits.map((audit) => (
            <article key={audit.id} className={`rounded-xl border p-4 text-sm transition-colors ${
              isDark ? "border-slate-800 bg-slate-950/70" : "border-slate-200 bg-white"
            }`}>
              <p className={`font-black ${isDark ? "text-white" : "text-slate-950"}`}>{audit.status}</p>
              <p className={`mt-1 font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>License {audit.licenseNumber}, {audit.licenseState}</p>
              <p className={`mt-1 text-xs font-semibold ${isDark ? "text-slate-500" : "text-slate-400"}`}>Submitted {formatDate(audit.submittedAt)}</p>
            </article>
          ))
        ) : (
          <PlaceholderTile title="Credential Audit" body="No credential audit activity is available for this account yet." />
        )}
      </div>
    </SettingsCard>
  );
}

function DoctorEarningsHistory({
  doctor,
  consultFee,
}: {
  doctor: DoctorSettingsData;
  consultFee: number;
}) {
  const tone = useSettingsTheme();
  const isDark = tone === "dark";

  // Derive transactions from completed/confirmed bookings
  const bookings = doctor.bookings ?? [];
  const completedBookings = bookings.filter((b) => b.status === "COMPLETED");
  const pendingBookings = bookings.filter((b) => b.status === "CONFIRMED" || b.status === "PENDING");

  const totalCompletedEarnings = completedBookings.length * consultFee;
  const pendingEarnings = pendingBookings.length * consultFee;
  const totalVolume = bookings.length * consultFee;

  return (
    <section className={`rounded-2xl border p-5 transition-colors ${
      isDark ? "border-slate-800 bg-slate-950/70" : "border-slate-100 bg-slate-50/80"
    }`}>
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className={`text-xs font-black uppercase tracking-[0.16em] ${isDark ? "text-slate-200" : "text-slate-950"}`}>
            Earnings & Transaction History
          </h3>
          <p className={`mt-0.5 text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Clinical payout records and completed consultation receipts
          </p>
        </div>
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Payouts Active
          </span>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid gap-3 sm:grid-cols-3 mb-5">
        <div className={`rounded-xl border p-3.5 transition-colors ${
          isDark ? "border-slate-800 bg-slate-900/90" : "border-slate-200 bg-white"
        }`}>
          <p className={`text-[10px] font-black uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Total Realized Earnings
          </p>
          <p className="mt-1 text-xl font-black text-emerald-500">
            ${totalCompletedEarnings.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className={`mt-0.5 text-[11px] font-medium ${isDark ? "text-slate-500" : "text-slate-400"}`}>
            {completedBookings.length} completed {completedBookings.length === 1 ? "session" : "sessions"}
          </p>
        </div>

        <div className={`rounded-xl border p-3.5 transition-colors ${
          isDark ? "border-slate-800 bg-slate-900/90" : "border-slate-200 bg-white"
        }`}>
          <p className={`text-[10px] font-black uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Pending / Escrow
          </p>
          <p className={`mt-1 text-xl font-black ${isDark ? "text-amber-400" : "text-amber-600"}`}>
            ${pendingEarnings.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className={`mt-0.5 text-[11px] font-medium ${isDark ? "text-slate-500" : "text-slate-400"}`}>
            {pendingBookings.length} upcoming appointments
          </p>
        </div>

        <div className={`rounded-xl border p-3.5 transition-colors ${
          isDark ? "border-slate-800 bg-slate-900/90" : "border-slate-200 bg-white"
        }`}>
          <p className={`text-[10px] font-black uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Per-Session Rate
          </p>
          <p className={`mt-1 text-xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>
            ${consultFee.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className={`mt-0.5 text-[11px] font-medium ${isDark ? "text-slate-500" : "text-slate-400"}`}>
            Standard consult rate
          </p>
        </div>
      </div>

      {/* Transaction History Table */}
      <div className={`overflow-hidden rounded-xl border transition-colors ${
        isDark ? "border-slate-800 bg-slate-900/60" : "border-slate-200 bg-white"
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className={`border-b text-[10px] font-black uppercase tracking-wider ${
                isDark ? "border-slate-800 bg-slate-950/80 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"
              }`}>
                <th className="px-4 py-3">Transaction / Patient</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className={`divide-y font-semibold ${
              isDark ? "divide-slate-800/80 text-slate-300" : "divide-slate-100 text-slate-700"
            }`}>
              {bookings.length > 0 ? (
                bookings.map((booking) => {
                  const isCompleted = booking.status === "COMPLETED";
                  const isCancelled = booking.status === "CANCELLED";
                  const patientName = booking.patient
                    ? `${booking.patient.firstName || ""} ${booking.patient.lastName || ""}`.trim() || "Confidential Patient"
                    : "Patient Consultation";

                  return (
                    <tr key={booking.id} className={`transition ${
                      isDark ? "hover:bg-slate-800/40" : "hover:bg-slate-50"
                    }`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-black ${
                            isDark ? "bg-slate-800 text-brand-teal" : "bg-teal-50 text-brand-teal"
                          }`}>
                            TX
                          </div>
                          <div>
                            <p className={`font-black ${isDark ? "text-white" : "text-slate-900"}`}>{patientName}</p>
                            <p className={`text-[10px] font-medium ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                              ID: {booking.id.slice(0, 8)}...
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-[11px]">
                        {formatDate(booking.scheduledAt)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-[11px]">
                        Telehealth Consult
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isCompleted
                            ? "bg-emerald-500/10 text-emerald-500"
                            : isCancelled
                              ? "bg-red-500/10 text-red-400"
                              : "bg-amber-500/10 text-amber-500"
                        }`}>
                          <span className={`h-1 w-1 rounded-full ${
                            isCompleted ? "bg-emerald-500" : isCancelled ? "bg-red-400" : "bg-amber-500"
                          }`} />
                          {isCompleted ? "Settled" : isCancelled ? "Cancelled" : "Pending"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className={`font-black ${
                          isCompleted
                            ? "text-emerald-500"
                            : isCancelled
                              ? isDark ? "text-slate-600 line-through" : "text-slate-400 line-through"
                              : isDark ? "text-slate-300" : "text-slate-700"
                        }`}>
                          ${consultFee.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className={`px-4 py-8 text-center text-xs font-semibold ${
                    isDark ? "text-slate-500" : "text-slate-400"
                  }`}>
                    No transactions recorded yet. Completed consultations will automatically appear here with settlement details.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}


export function DoctorSettingsModule({
  doctor,
  onProfileUpdated,
  onProfileImageChange,
  onToast,
  tone,
}: {
  doctor: DoctorSettingsData;
  onProfileUpdated?: (profile: { availability: string; status: string }) => void;
  onProfileImageChange?: (image: string) => void;
  onToast?: (tone: "success" | "error", message: string) => void;
  tone?: "light" | "dark";
}) {
  const router = useRouter();
  const { toasts, showToast: showLocalToast } = useSettingsToasts();
  const showToast = onToast ?? showLocalToast;
  const [activeSection, setActiveSection] = useState<DoctorSectionId>("professional");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const draftKey = getSettingsDraftKey("doctor", doctor.id);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [form, setForm] = useState<DoctorProfileFormState>(() => ({
    name: doctor.name,
    username: doctor.username || doctor.licenseNumber || "",
    email: doctor.email,
    image: doctor.image || "",
    specialty: doctor.specialty,
    phone: "",
    availability: doctor.availability,
    status: doctor.status || "ONLINE",
    licenseNumber: doctor.licenseNumber || "",
    licenseState: doctor.licenseState || "",
    bio: doctor.bio || "",
    consultFee: doctor.consultFee?.toString() || "",
    yearsExp: doctor.yearsExp?.toString() || "",
    consultationDuration: doctor.consultationDuration?.toString() || "30",
    consultationDurationUnit: doctor.consultationDurationUnit || "minutes",
    admitMode: "manual",
  }));
  const [isPending, startTransition] = useTransition();

  const setField = useCallback((field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const restored = readSettingsDraft<DoctorProfileFormState>(draftKey);
      if (restored) {
        setForm((current) => ({ ...current, ...restored }));
      }

      setDraftHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [draftKey, showToast]);

  useEffect(() => {
    onProfileImageChange?.(form.image);
  }, [form.image, onProfileImageChange]);

  useEffect(() => {
    if (!draftHydrated) {
      return;
    }

    const timer = window.setTimeout(() => {
      writeSettingsDraft(draftKey, form);
    }, 200);

    return () => window.clearTimeout(timer);
  }, [draftHydrated, draftKey, form]);

  const [showContactOtpModal, setShowContactOtpModal] = useState(false);
  const [contactOtpDigits, setContactOtpDigits] = useState(["", "", "", "", "", ""]);
  const [contactOtpLoading, setContactOtpLoading] = useState(false);
  const [contactOtpError, setContactOtpError] = useState("");
  const [contactDebugOtp, setContactDebugOtp] = useState<string | undefined>(undefined);
  const [contactCooldown, setContactCooldown] = useState(0);

  useEffect(() => {
    if (contactCooldown <= 0) return;
    const timer = setInterval(() => setContactCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [contactCooldown]);

  const handleContactOtpDigitChange = useCallback((val: string, idx: number) => {
    const clean = val.replace(/\D/g, "");
    if (!clean) {
      setContactOtpDigits((prev) => {
        const next = [...prev];
        next[idx] = "";
        return next;
      });
      return;
    }

    if (clean.length > 1) {
      const chars = clean.slice(0, 6).split("");
      setContactOtpDigits((prev) => {
        const next = [...prev];
        chars.forEach((c, i) => {
          if (idx + i < 6) next[idx + i] = c;
        });
        return next;
      });
      const nextFocus = Math.min(idx + chars.length, 5);
      document.getElementById(`doctor-contact-otp-${nextFocus}`)?.focus();
      return;
    }

    setContactOtpDigits((prev) => {
      const next = [...prev];
      next[idx] = clean;
      return next;
    });

    if (idx < 5 && clean) {
      document.getElementById(`doctor-contact-otp-${idx + 1}`)?.focus();
    }
  }, []);

  const handleContactOtpKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === "Backspace" && !contactOtpDigits[idx] && idx > 0) {
      document.getElementById(`doctor-contact-otp-${idx - 1}`)?.focus();
    }
  }, [contactOtpDigits]);

  const saveDoctorProfile = useCallback((message: string) => {
    startTransition(async () => {
      const result = await updateDoctorProfile(form);
      if (!result.success) {
        showToast("error", result.error || "Could not update profile.");
        return;
      }

      showToast("success", message);
      onProfileUpdated?.({ availability: form.availability, status: form.status });
      clearSettingsDraft(draftKey);
      router.refresh();
    });
  }, [draftKey, form, onProfileUpdated, router, showToast]);

  const handleProfessionalSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    const emailChanged = form.email.trim().toLowerCase() !== (doctor.email || "").trim().toLowerCase();

    if (emailChanged) {
      setContactOtpLoading(true);
      setContactOtpError("");
      const res = await requestDoctorContactUpdateOtp(form.email.trim());
      setContactOtpLoading(false);

      if (!res.success) {
        showToast("error", res.error || "Failed to send verification code.");
        return;
      }

      setContactDebugOtp(res.debugOtp);
      setContactOtpDigits(["", "", "", "", "", ""]);
      setShowContactOtpModal(true);
      setContactCooldown(60);
      showToast("success", `Verification code sent to ${form.email}`);
      return;
    }

    saveDoctorProfile("Professional profile updated.");
  }, [doctor.email, form, saveDoctorProfile, showToast]);

  const handleVerifyAndSaveContact = useCallback(async () => {
    const code = contactOtpDigits.join("").trim();
    if (code.length !== 6) {
      setContactOtpError("Please enter the complete 6-digit verification code.");
      return;
    }
    setContactOtpLoading(true);
    setContactOtpError("");

    startTransition(async () => {
      const result = await updateDoctorProfile({
        ...form,
        otp: code,
      });
      setContactOtpLoading(false);

      if (!result.success) {
        setContactOtpError(result.error || "Invalid or expired verification code.");
        return;
      }

      setShowContactOtpModal(false);
      showToast("success", "Professional profile and contact details updated successfully.");
      onProfileUpdated?.({ availability: form.availability, status: form.status });
      clearSettingsDraft(draftKey);
      router.refresh();
    });
  }, [contactOtpDigits, draftKey, form, onProfileUpdated, router, showToast]);

  const handleResendContactOtp = useCallback(async () => {
    if (contactCooldown > 0 || contactOtpLoading) return;
    setContactOtpLoading(true);
    setContactOtpError("");
    const res = await requestDoctorContactUpdateOtp(form.email.trim());
    setContactOtpLoading(false);
    if (!res.success) {
      setContactOtpError(res.error || "Failed to resend code.");
      return;
    }
    setContactDebugOtp(res.debugOtp);
    setContactCooldown(60);
    showToast("success", `New code sent to ${form.email}`);
  }, [contactCooldown, contactOtpLoading, form.email, showToast]);

  const activeContent = useMemo(() => {
    if (activeSection === "professional") {
      return (
        <SettingsCard title="Professional Profile" body="">
          <form
            onSubmit={handleProfessionalSubmit}
            className="space-y-5"
          >
            <ProfileHeader
              label={form.name}
              description=""
              image={form.image}
              onUpload={(file) => {
                const reader = new FileReader();
                reader.onload = () => {
                  if (typeof reader.result === "string") {
                    setField("image", reader.result);
                  }
                };
                reader.readAsDataURL(file);
              }}
              onPreview={() => setPreviewImage(form.image ?? null)}
              onRemove={() => setField("image", "")}
              onToast={showToast}
            />

            {/* Professional Bio (above Professional Identity) */}
            <FieldGroup title="Professional Bio">
              <TextAreaField label="Professional bio" value={form.bio} onChange={(value) => setField("bio", value)} />
            </FieldGroup>

            {/* Professional Identity (without Portal Username) */}
            <FieldGroup title="Professional Identity" description="Verified practitioner credentials are unchangeable to ensure telehealth compliance.">
              <Field
                label="Full name"
                value={form.name}
                readOnly
                helperText="Name is bound to your verified medical registration."
              />
              <Field
                label="Medical specialty"
                value={form.specialty}
                onChange={(value) => setField("specialty", value)}
                required
              />
              <Field
                label="License number"
                value={form.licenseNumber}
                readOnly
                helperText="Medical license number verified with regulatory board. Can also be used for portal login."
              />
              <Field
                label="License state / jurisdiction"
                value={form.licenseState}
                readOnly
                helperText="Verified licensing jurisdiction."
              />
            </FieldGroup>

            {/* Contact (below Professional Identity) */}
            <FieldGroup title="Contact" description="Updating your email requires a 6-digit OTP verification code.">
              <Field label="Email" type="email" value={form.email} onChange={(value) => setField("email", value)} required />
              <Field label="Phone number" value={form.phone} onChange={(value) => setField("phone", value)} />
            </FieldGroup>

            {/* Credentials & Practice */}
            <FieldGroup title="Credentials & Practice">
              <Field label="Years experience" type="number" value={form.yearsExp} onChange={(value) => setField("yearsExp", value)} />
              <Field label="Consultation fee ($)" type="number" value={form.consultFee} onChange={(value) => setField("consultFee", value)} />
            </FieldGroup>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isPending || contactOtpLoading}
                className="rounded-xl bg-brand-teal px-5 py-3 text-sm font-black text-white transition hover:bg-teal-600 disabled:opacity-50"
              >
                {isPending || contactOtpLoading ? "Saving..." : "Save Professional Profile"}
              </button>
            </div>

            {/* Earnings on the LOWEST part */}
            <DoctorEarningsHistory
              doctor={doctor}
              consultFee={Number(form.consultFee) > 0 ? Number(form.consultFee) : (doctor.consultFee ?? 75)}
            />
          </form>
        </SettingsCard>
      );
    }

    if (activeSection === "schedule") {
      return (
        <SettingsCard title="Schedule & Availability" body="">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              saveDoctorProfile("Schedule and availability updated.");
            }}
            className="grid gap-4 md:grid-cols-2"
          >
            <Field label="Working hours" value={form.availability} onChange={(value) => setField("availability", value)} required />
            <SelectField
              label="Availability Status"
              value={form.status}
              onChange={(value) => setField("status", value)}
              options={[
                { value: "ONLINE", label: "Online" },
                { value: "BUSY", label: "Busy" },
                { value: "OFFLINE", label: "Offline" },
              ]}
            />
            <Field label="Consultation duration" type="number" value={form.consultationDuration} onChange={(value) => setField("consultationDuration", value)} />
            <SelectField
              label="Duration unit"
              value={form.consultationDurationUnit}
              onChange={(value) => setField("consultationDurationUnit", value)}
              options={[
                { value: "minutes", label: "Minutes" },
                { value: "hours", label: "Hours" },
              ]}
            />
            <div className="flex justify-end pt-1">
              <button type="submit" disabled={isPending} className="rounded-xl bg-brand-teal px-5 py-3 text-sm font-black text-white transition hover:bg-teal-600 disabled:opacity-50">
                {isPending ? "Saving..." : "Save Schedule"}
              </button>
            </div>
          </form>
        </SettingsCard>
      );
    }

    if (activeSection === "consultation") {
      return (
        <SettingsCard title="Consultation Settings" body="">
          <div className="grid gap-3 md:grid-cols-2">
            <PlaceholderTile title="Camera Selection" body="Managed inside the active live consultation room device selector." />
            <PlaceholderTile title="Microphone Selection" body="Managed inside the active live consultation room device selector." />
            <ToggleRow label="Manual Admit Patients" description="Current WebRTC flow lets the doctor start the room before patients join." checked={form.admitMode === "manual"} />
            <ToggleRow label="Auto Admit Patients" description="Future workflow option once waiting-room admission policies are modeled." checked={false} />
          </div>
        </SettingsCard>
      );
    }

    if (activeSection === "security") {
      return <AccountSecurityContent role="doctor" verified={doctor.isVerified} createdAt={doctor.createdAt} onToast={showToast} />;
    }

    if (activeSection === "notifications") {
      return (
        <SettingsCard title="Notification Settings" body="">
          <div className="grid gap-3 md:grid-cols-2">
            <ToggleRow label="Appointment Updates" description="New requests, approvals, reschedules, and cancellations." />
            <ToggleRow label="Consultation Reminders" description="Live room and follow-up reminders." />
            <ToggleRow label="Communication Preferences" description="Messages and clinical workflow notifications." />
            <ToggleRow label="Email Notifications" description="Email delivery is handled by account communication services." />
          </div>
        </SettingsCard>
      );
    }

    if (activeSection === "prescriptions") {
      return (
        <SettingsCard title="Prescription Settings" body="">
          <div className="grid gap-3 md:grid-cols-2">
            <PlaceholderTile title="Digital Signature Upload" body="Requires a secure file storage field before upload persistence can be enabled." />
            <PlaceholderTile title="Prescription Templates" body="Reusable templates need a prescription template table." />
          </div>
        </SettingsCard>
      );
    }

    if (activeSection === "privacy") {
      return (
        <SettingsCard title="Privacy & Consent" body="">
          <div className="grid gap-3 md:grid-cols-2">
            <ToggleRow label="Patient Data Access Permissions" description="Access is limited to assigned consultations and patient records." />
            <ToggleRow label="Telehealth Compliance Acknowledgment" description="Doctor account operates under Healthko telehealth workflow policies." checked={doctor.isVerified} />
          </div>
        </SettingsCard>
      );
    }

    return (
      <AuditSupportSection doctor={doctor} />
    );
  }, [activeSection, contactOtpLoading, doctor, form, handleProfessionalSubmit, isPending, saveDoctorProfile, setField, showToast]);

  return (
    <ThemeContext.Provider value={tone ?? "dark"}>
      {!onToast && <SettingsToastStack toasts={toasts} />}
      {previewImage ? (
        <ProfileImagePreviewModal
          label={form.name}
          image={previewImage}
          onClose={() => setPreviewImage(null)}
        />
      ) : null}
      {showContactOtpModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-white shadow-2xl sm:p-8">
            <div className="space-y-6">
              <div className="space-y-3 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-brand-teal/20 bg-brand-teal/10 text-brand-teal">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="space-y-2">
                  <h3 className="font-display text-xl font-black tracking-tight">Verify Contact Update</h3>
                  <p className="mx-auto max-w-xs text-xs leading-relaxed text-slate-400">
                    We've sent a 6-digit verification code to confirm this email change.
                  </p>
                  <p className="text-xs font-black tracking-wider text-brand-teal">
                    {form.email}
                  </p>
                </div>
              </div>

              {contactOtpError && (
                <div className="rounded-xl border border-brand-red/20 bg-brand-red/10 p-3 text-center text-xs font-bold text-brand-red">
                  {contactOtpError}
                </div>
              )}

              {contactDebugOtp && (
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-center text-xs font-bold text-amber-200">
                  Local dev OTP: <span className="font-black tracking-[0.3em]">{contactDebugOtp}</span>
                </div>
              )}

              <div className="flex justify-center gap-2 py-2 sm:gap-3">
                {contactOtpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`doctor-contact-otp-${idx}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    autoFocus={idx === 0}
                    onChange={(e) => handleContactOtpDigitChange(e.target.value, idx)}
                    onKeyDown={(e) => handleContactOtpKeyDown(e, idx)}
                    className="h-12 w-10 rounded-xl border border-slate-700 bg-slate-800 text-center text-xl font-black text-white transition focus:border-brand-teal focus:outline-none sm:h-14 sm:w-12"
                  />
                ))}
              </div>

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={handleVerifyAndSaveContact}
                  disabled={contactOtpLoading || contactOtpDigits.join("").length !== 6}
                  className="w-full rounded-xl bg-brand-teal py-3 text-sm font-black text-white transition hover:bg-teal-600 disabled:opacity-50"
                >
                  {contactOtpLoading ? "Verifying & Saving..." : "Verify & Save Update"}
                </button>

                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={handleResendContactOtp}
                    disabled={contactCooldown > 0 || contactOtpLoading}
                    className="font-bold text-brand-teal hover:underline disabled:opacity-50"
                  >
                    {contactCooldown > 0 ? `Resend in ${contactCooldown}s` : "Resend Code"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowContactOtpModal(false);
                      setContactOtpError("");
                    }}
                    className="font-semibold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <SettingsLayout
        role="doctor"
        sections={doctorSections}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        title="Doctor Settings"
        subtitle=""
      >
        {activeContent}
      </SettingsLayout>
    </ThemeContext.Provider>
  );
}

export function PatientSettingsModule({
  patient,
  onProfileImageChange,
  onToast,
  tone,
}: {
  patient: PatientSettingsData;
  onProfileImageChange?: (image: string) => void;
  onToast?: (tone: "success" | "error", message: string) => void;
  tone?: "light" | "dark";
}) {
  const router = useRouter();
  const { toasts, showToast: showLocalToast } = useSettingsToasts();
  const showToast = onToast ?? showLocalToast;
  const [activeSection, setActiveSection] = useState<PatientSectionId>("profile");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const draftKey = getSettingsDraftKey("patient", patient.id);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [form, setForm] = useState<PatientProfileFormState>(() => ({
    firstName: patient.firstName,
    lastName: patient.lastName,
    email: patient.email,
    image: patient.image || "",
    countryCode: patient.countryCode || "+1",
    phone: patient.phone,
    dob: patient.dob,
    gender: patient.gender || "",
    address: patient.address || "",
    city: patient.city || "",
    state: patient.state || "",
    zipCode: patient.zipCode || "",
    country: patient.country || "",
    height: patient.height || "",
    weight: patient.weight || "",
    bloodType: patient.bloodType || "",
    allergies: patient.allergies || "",
    existingConditions: patient.existingConditions || "",
    currentMedications: patient.currentMedications || "",
    emergencyContactName: patient.emergencyContactName || "",
    emergencyContactPhone: patient.emergencyContactPhone || "",
    emergencyContactRelation: patient.emergencyContactRelation || "",
  }));
  const [isPending, startTransition] = useTransition();

  const setField = useCallback((field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const restored = readSettingsDraft<PatientProfileFormState>(draftKey);
      if (restored) {
        setForm((current) => ({ ...current, ...restored }));
      }

      setDraftHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [draftKey, showToast]);

  useEffect(() => {
    onProfileImageChange?.(form.image);
  }, [form.image, onProfileImageChange]);

  useEffect(() => {
    if (!draftHydrated) {
      return;
    }

    const timer = window.setTimeout(() => {
      writeSettingsDraft(draftKey, form);
    }, 200);

    return () => window.clearTimeout(timer);
  }, [draftHydrated, draftKey, form]);

  const activeContent = useMemo(() => {
    if (activeSection === "profile") {
      return (
        <SettingsCard title="Profile Management" body="">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                const result = await updatePatientProfile(form);
                if (!result.success) {
                  showToast("error", result.error || "Could not update profile.");
                  return;
                }

                showToast("success", "Patient profile updated.");
                clearSettingsDraft(draftKey);
                router.refresh();
              });
            }}
            className="space-y-5"
          >
            <ProfileHeader
              label={`${form.firstName} ${form.lastName}`}
              description=""
              image={form.image}
              onUpload={(file) => {
                const reader = new FileReader();
                reader.onload = () => {
                  if (typeof reader.result === "string") {
                    setField("image", reader.result);
                  }
                };
                reader.readAsDataURL(file);
              }}
              onPreview={() => setPreviewImage(form.image)}
              onRemove={() => setField("image", "")}
              onToast={showToast}
            />

            <FieldGroup title="Personal Information">
              <Field label="First name" value={form.firstName} onChange={(value) => setField("firstName", value)} required />
              <Field label="Last name" value={form.lastName} onChange={(value) => setField("lastName", value)} required />
              <Field label="Date of birth" type="date" value={form.dob} onChange={(value) => setField("dob", value)} required />
              <Field label="Gender" value={form.gender} onChange={(value) => setField("gender", value)} />
            </FieldGroup>

            <FieldGroup title="Contact Information">
              <Field label="Email address" type="email" value={form.email} onChange={(value) => setField("email", value)} required />
              <Field label="Country code" value={form.countryCode} onChange={(value) => setField("countryCode", value)} required />
              <Field label="Contact number" value={form.phone} onChange={(value) => setField("phone", value)} required />
            </FieldGroup>

            <FieldGroup title="Address Details">
              <div className="md:col-span-2 xl:col-span-3">
                <Field label="Address" value={form.address} onChange={(value) => setField("address", value)} />
              </div>
              <Field label="City" value={form.city} onChange={(value) => setField("city", value)} />
              <Field label="State" value={form.state} onChange={(value) => setField("state", value)} />
              <Field label="ZIP code" value={form.zipCode} onChange={(value) => setField("zipCode", value)} />
              <Field label="Country" value={form.country} onChange={(value) => setField("country", value)} />
            </FieldGroup>

            <div className="flex justify-end pt-1">
              <button type="submit" disabled={isPending} className="rounded-xl bg-brand-teal px-5 py-3 text-sm font-black text-white transition hover:bg-teal-600 disabled:opacity-50">
                {isPending ? "Saving..." : "Save Patient Profile"}
              </button>
            </div>
          </form>
        </SettingsCard>
      );
    }

    if (activeSection === "medical") {
      return (
        <SettingsCard title="Medical Profile" body="">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                const result = await updatePatientProfile(form);
                if (!result.success) {
                  showToast("error", result.error || "Could not update medical profile.");
                  return;
                }

                showToast("success", "Medical profile updated.");
                clearSettingsDraft(draftKey);
                router.refresh();
              });
            }}
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            <Field label="Height" value={form.height} onChange={(value) => setField("height", value)} placeholder="e.g. 170 cm" />
            <Field label="Weight" value={form.weight} onChange={(value) => setField("weight", value)} placeholder="e.g. 68 kg" />
            <Field label="Blood type" value={form.bloodType} onChange={(value) => setField("bloodType", value)} placeholder="e.g. O+" />
            <TextAreaField label="Allergies" value={form.allergies} onChange={(value) => setField("allergies", value)} />
            <TextAreaField label="Existing medical conditions" value={form.existingConditions} onChange={(value) => setField("existingConditions", value)} />
            <TextAreaField label="Current medications" value={form.currentMedications} onChange={(value) => setField("currentMedications", value)} />
            <FieldGroup title="Emergency Contact Information">
              <Field label="Contact name" value={form.emergencyContactName} onChange={(value) => setField("emergencyContactName", value)} />
              <Field label="Contact phone" value={form.emergencyContactPhone} onChange={(value) => setField("emergencyContactPhone", value)} />
              <Field label="Relation" value={form.emergencyContactRelation} onChange={(value) => setField("emergencyContactRelation", value)} />
            </FieldGroup>
            <StickyActionBar>
              <button type="submit" disabled={isPending} className="rounded-xl bg-brand-teal px-5 py-3 text-sm font-black text-white transition hover:bg-teal-600 disabled:opacity-50">
                {isPending ? "Saving..." : "Save Medical Profile"}
              </button>
            </StickyActionBar>
          </form>
        </SettingsCard>
      );
    }

    if (activeSection === "security") {
      return <AccountSecurityContent role="patient" verified={patient.emailVerified} createdAt={patient.createdAt} onToast={showToast} />;
    }

    if (activeSection === "notifications") {
      return (
        <SettingsCard title="Notifications" body="">
          <div className="grid gap-3 md:grid-cols-2">
            <ToggleRow label="Appointment Reminders" description="Pending, confirmed, and rescheduled appointment reminders." />
            <ToggleRow label="Consultation Notifications" description="Live room, session, and consultation status alerts." />
            <ToggleRow label="Email Preferences" description="Email alerts for appointment workflow updates." />
            <ToggleRow label="SMS Preferences" description="SMS delivery can be enabled when SMS preferences are stored." checked={false} />
          </div>
        </SettingsCard>
      );
    }

    if (activeSection === "privacy") {
      return (
        <SettingsCard title="Privacy" body="">
          <div className="grid gap-3 md:grid-cols-2">
            <ToggleRow label="Teleconsultation Consent" description="Consent is required before participating in telehealth consultations." />
            <ToggleRow label="Data Privacy Consent" description="Healthko protects clinical access through role-based dashboard sessions." checked={patient.emailVerified} />
          </div>
        </SettingsCard>
      );
    }

    return (
      <SettingsCard title="Support & Help" body="">
        <div className="grid gap-3 md:grid-cols-2">
          <ReadOnlyTile label="Account Email" value={patient.email} />
          <ReadOnlyTile label="Joined" value={formatDate(patient.createdAt)} />
          <PlaceholderTile title="Support Center" body="Contact Healthko support for account, booking, or consultation access issues." />
          <PlaceholderTile title="Help Documentation" body="Patient help articles can be linked here when the support knowledge base is connected." />
        </div>
      </SettingsCard>
    );
  }, [activeSection, draftKey, form, isPending, patient.createdAt, patient.email, patient.emailVerified, router, setField, showToast]);

  return (
    <ThemeContext.Provider value={tone ?? "light"}>
      {!onToast && <SettingsToastStack toasts={toasts} />}
      {previewImage ? (
        <ProfileImagePreviewModal
          label={`${form.firstName} ${form.lastName}`}
          image={previewImage}
          onClose={() => setPreviewImage(null)}
        />
      ) : null}
      <SettingsLayout
        role="patient"
        sections={patientSections}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        title="Patient Settings"
        subtitle=""
      >
        {activeContent}
      </SettingsLayout>
    </ThemeContext.Provider>
  );
}
