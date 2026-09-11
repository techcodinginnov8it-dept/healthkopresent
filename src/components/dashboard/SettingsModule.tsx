"use client";

import { useRouter } from "next/navigation";
import type { ChangeEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
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
  { id: "practice", label: "Practice Settings", description: "" },
  { id: "security", label: "Account Security", description: "" },
  { id: "notifications", label: "Notification Settings", description: "" },
  { id: "earnings", label: "Earnings & Billing", description: "" },
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

const WORKING_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
type WorkingDay = (typeof WORKING_DAYS)[number];

const DAY_FULL_NAMES: Record<WorkingDay, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

const WORKING_TIME_OPTIONS = [
  "06:00 AM", "06:30 AM", "07:00 AM", "07:30 AM", "08:00 AM", "08:30 AM",
  "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "12:00 PM", "12:30 PM", "01:00 PM", "01:30 PM", "02:00 PM", "02:30 PM",
  "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM", "05:00 PM", "05:30 PM",
  "06:00 PM", "06:30 PM", "07:00 PM", "07:30 PM", "08:00 PM", "08:30 PM",
  "09:00 PM", "09:30 PM", "10:00 PM", "10:30 PM", "11:00 PM",
];

function parseWorkingHoursString(str: string) {
  const match = (str || "")
    .replace(/\s+/g, " ")
    .trim()
    .match(/^([A-Za-z]{3})\s*(?:-\s*([A-Za-z]{3}))?,\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))$/i);

  const normalizeTime = (t?: string) => {
    if (!t) return "09:00 AM";
    const m = t.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (!m) return "09:00 AM";
    const h = m[1].padStart(2, "0");
    const min = (m[2] || "00").padStart(2, "0");
    const meridiem = m[3].toUpperCase();
    return `${h}:${min} ${meridiem}`;
  };

  const capitalize = (s: string): WorkingDay => {
    const c = (s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()) as WorkingDay;
    return WORKING_DAYS.includes(c) ? c : "Mon";
  };

  if (match) {
    const startDay = capitalize(match[1]);
    const endDay = match[2] ? capitalize(match[2]) : startDay;
    const startTime = normalizeTime(match[3]);
    const endTime = normalizeTime(match[4]);
    return {
      startDay,
      endDay,
      startTime,
      endTime,
    };
  }

  return {
    startDay: "Mon" as WorkingDay,
    endDay: "Fri" as WorkingDay,
    startTime: "09:00 AM",
    endTime: "05:00 PM",
  };
}

function WorkingHoursTimeSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const tone = useSettingsTheme();
  const isDark = tone === "dark";

  const parsed = useMemo(() => parseWorkingHoursString(value), [value]);
  const [startDay, setStartDay] = useState<WorkingDay>(parsed.startDay);
  const [endDay, setEndDay] = useState<WorkingDay>(parsed.endDay);
  const [startTime, setStartTime] = useState(parsed.startTime);
  const [endTime, setEndTime] = useState(parsed.endTime);

  useEffect(() => {
    const p = parseWorkingHoursString(value);
    setStartDay(p.startDay);
    setEndDay(p.endDay);
    setStartTime(p.startTime);
    setEndTime(p.endTime);
  }, [value]);

  const updateSchedule = (newStartDay: WorkingDay, newEndDay: WorkingDay, newStartTime: string, newEndTime: string) => {
    setStartDay(newStartDay);
    setEndDay(newEndDay);
    setStartTime(newStartTime);
    setEndTime(newEndTime);
    const formatted = `${newStartDay} - ${newEndDay}, ${newStartTime} - ${newEndTime}`;
    onChange(formatted);
  };

  const offDaysText = useMemo(() => {
    if (startDay === "Mon" && endDay === "Fri") return "Saturday & Sunday (Full Day Off)";
    if (startDay === "Mon" && endDay === "Sat") return "Sunday (Full Day Off)";
    if (startDay === "Mon" && endDay === "Sun") return "None (Available All 7 Days)";
    return `Days outside ${startDay} – ${endDay}`;
  }, [startDay, endDay]);

  return (
    <div
      className="md:col-span-2 space-y-4 rounded-2xl border p-4 sm:p-5 transition-colors"
      style={{
        backgroundColor: isDark ? "rgba(15, 23, 42, 0.6)" : "rgba(248, 250, 252, 0.9)",
        borderColor: isDark ? "rgba(51, 65, 85, 0.6)" : "rgba(226, 232, 240, 0.9)",
      }}
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Working Hours Configuration</p>
          <h3 className={`text-base font-black ${isDark ? "text-white" : "text-slate-900"}`}>Doctor Availability & Time Selection</h3>
          <p className={`text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Select the times you are available. Times outside this window will be marked as Not Available in your calendar and closed for patient booking.
          </p>
        </div>
      </div>

      {/* Quick Day Presets */}
      <div>
        <span className={`block text-[10px] font-black uppercase tracking-wider mb-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          Working Days Preset
        </span>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Mon – Fri (Weekdays)", start: "Mon" as WorkingDay, end: "Fri" as WorkingDay },
            { label: "Mon – Sat", start: "Mon" as WorkingDay, end: "Sat" as WorkingDay },
            { label: "Mon – Sun (All Week)", start: "Mon" as WorkingDay, end: "Sun" as WorkingDay },
          ].map((preset) => {
            const active = startDay === preset.start && endDay === preset.end;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => updateSchedule(preset.start, preset.end, startTime, endTime)}
                className={`rounded-xl px-3 py-1.5 text-xs font-black transition border ${
                  active
                    ? "border-brand-teal bg-brand-teal text-white shadow-xs"
                    : isDark
                    ? "border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700 hover:text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Days & Time Selection Grid */}
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <label className={`space-y-1 text-xs font-black uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          Start Day
          <select
            value={startDay}
            onChange={(e) => updateSchedule(e.target.value as WorkingDay, endDay, startTime, endTime)}
            className={`mt-1 h-11 w-full rounded-xl border px-3 text-sm font-semibold normal-case outline-none transition ${
              isDark
                ? "border-slate-800 bg-slate-950 text-white focus:border-brand-teal"
                : "border-slate-200 bg-white text-slate-900 focus:border-brand-teal"
            }`}
          >
            {WORKING_DAYS.map((d) => (
              <option key={`start-${d}`} value={d}>{DAY_FULL_NAMES[d]} ({d})</option>
            ))}
          </select>
        </label>

        <label className={`space-y-1 text-xs font-black uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          End Day
          <select
            value={endDay}
            onChange={(e) => updateSchedule(startDay, e.target.value as WorkingDay, startTime, endTime)}
            className={`mt-1 h-11 w-full rounded-xl border px-3 text-sm font-semibold normal-case outline-none transition ${
              isDark
                ? "border-slate-800 bg-slate-950 text-white focus:border-brand-teal"
                : "border-slate-200 bg-white text-slate-900 focus:border-brand-teal"
            }`}
          >
            {WORKING_DAYS.map((d) => (
              <option key={`end-${d}`} value={d}>{DAY_FULL_NAMES[d]} ({d})</option>
            ))}
          </select>
        </label>

        <label className={`space-y-1 text-xs font-black uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          Available From (Start)
          <select
            value={startTime}
            onChange={(e) => updateSchedule(startDay, endDay, e.target.value, endTime)}
            className={`mt-1 h-11 w-full rounded-xl border px-3 text-sm font-semibold normal-case outline-none transition ${
              isDark
                ? "border-slate-800 bg-slate-950 text-white focus:border-brand-teal"
                : "border-slate-200 bg-white text-slate-900 focus:border-brand-teal"
            }`}
          >
            {WORKING_TIME_OPTIONS.map((t) => (
              <option key={`start-time-${t}`} value={t}>{t}</option>
            ))}
          </select>
        </label>

        <label className={`space-y-1 text-xs font-black uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          Available To (End)
          <select
            value={endTime}
            onChange={(e) => updateSchedule(startDay, endDay, startTime, e.target.value)}
            className={`mt-1 h-11 w-full rounded-xl border px-3 text-sm font-semibold normal-case outline-none transition ${
              isDark
                ? "border-slate-800 bg-slate-950 text-white focus:border-brand-teal"
                : "border-slate-200 bg-white text-slate-900 focus:border-brand-teal"
            }`}
          >
            {WORKING_TIME_OPTIONS.map((t) => (
              <option key={`end-time-${t}`} value={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Visual Live Schedule Breakdown (Available vs Not Available) */}
      <div className="grid gap-3 sm:grid-cols-2 pt-2">
        {/* Available Consultation Card */}
        <div className={`rounded-xl border p-3.5 transition-colors ${
          isDark
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
            : "border-emerald-200 bg-emerald-50 text-emerald-950"
        }`}>
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-500/20 text-emerald-400">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            <span className="text-xs font-black uppercase tracking-wider text-emerald-500">Doctor Available</span>
          </div>
          <div className="mt-2.5">
            <p className="text-sm font-black">{startTime} – {endTime}</p>
            <p className={`mt-0.5 text-xs font-semibold ${isDark ? "text-emerald-200/80" : "text-emerald-800"}`}>
              {DAY_FULL_NAMES[startDay]} through {DAY_FULL_NAMES[endDay]}
            </p>
            <span className={`inline-block mt-2 rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
              isDark ? "border-emerald-400/30 bg-emerald-400/20 text-emerald-200" : "border-emerald-300 bg-white text-emerald-800"
            }`}>
              Open for Patient Bookings
            </span>
          </div>
        </div>

        {/* Unavailable / Off-Duty Card */}
        <div className={`rounded-xl border p-3.5 transition-colors ${
          isDark
            ? "border-slate-700/60 bg-slate-900/60 text-slate-300"
            : "border-slate-200 bg-slate-100/90 text-slate-800"
        }`}>
          <div className="flex items-center gap-2">
            <span className={`grid h-6 w-6 place-items-center rounded-full ${
              isDark ? "bg-slate-800 text-slate-400" : "bg-slate-200 text-slate-600"
            }`}>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
              </svg>
            </span>
            <span className={`text-xs font-black uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              Doctor Not Available
            </span>
          </div>
          <div className="mt-2.5 text-xs space-y-1">
            <p className="font-semibold">
              <span className={`font-black ${isDark ? "text-slate-400" : "text-slate-600"}`}>Workdays Off:</span> 12:00 AM – {startTime} & {endTime} – 11:59 PM
            </p>
            <p className="font-semibold">
              <span className={`font-black ${isDark ? "text-slate-400" : "text-slate-600"}`}>Days Off:</span> {offDaysText}
            </p>
            <span className={`inline-block mt-2 rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
              isDark ? "border-slate-700 bg-slate-800 text-slate-400" : "border-slate-300 bg-white text-slate-600"
            }`}>
              Calendar Marked Not Available · Booking Blocked
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

type SignaturePoint = { x: number; y: number };
type SignatureStroke = {
  points: SignaturePoint[];
  color: string;
  width: number;
};

const SIGNATURE_INK_COLORS = [
  { id: "navy", label: "Navy Blue", value: "#0f2942", dotClass: "bg-[#0f2942]" },
  { id: "black", label: "Midnight Black", value: "#0f172a", dotClass: "bg-[#0f172a]" },
  { id: "royal", label: "Royal Blue", value: "#1d4ed8", dotClass: "bg-[#1d4ed8]" },
] as const;

const SIGNATURE_STROKE_WIDTHS = [
  { id: "fine", label: "Fine", value: 2 },
  { id: "medium", label: "Medium", value: 2.5 },
  { id: "bold", label: "Bold", value: 3.5 },
] as const;

function DoctorDigitalSignatureSection({
  doctor,
  onToast,
}: {
  doctor: DoctorSettingsData;
  onToast: (tone: "success" | "error", message: string) => void;
}) {
  const tone = useSettingsTheme();
  const isDark = tone === "dark";

  // Signature state
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [savedMeta, setSavedMeta] = useState<{ mode: string; savedAt: string } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<"draw" | "upload">("draw");

  // Draw Pad state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<SignatureStroke | null>(null);
  const [strokes, setStrokes] = useState<SignatureStroke[]>([]);
  const [penColor, setPenColor] = useState<string>(SIGNATURE_INK_COLORS[0].value);
  const [penWidth, setPenWidth] = useState<number>(SIGNATURE_STROKE_WIDTHS[1].value);

  // Upload state
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string>("");
  const [uploadFileSize, setUploadFileSize] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load signature on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storageKey = `healthko_doctor_signature_${doctor.id}`;
      const metaKey = `healthko_doctor_signature_meta_${doctor.id}`;
      const existing = localStorage.getItem(storageKey) || localStorage.getItem("healthko_doctor_signature_active");
      if (existing) {
        setSavedSignature(existing);
        setIsEditing(false);
        const metaStr = localStorage.getItem(metaKey);
        if (metaStr) {
          try {
            setSavedMeta(JSON.parse(metaStr));
          } catch {
            setSavedMeta(null);
          }
        }
      } else {
        setIsEditing(true);
      }
    } catch (err) {
      console.error("Error accessing localStorage for signature:", err);
    }
  }, [doctor.id]);

  // Render canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear and fill simulated crisp white paper background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw baseline guideline
    const lineY = canvas.height - 38;
    ctx.save();
    ctx.strokeStyle = "#cbd5e1"; // slate-300
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(28, lineY);
    ctx.lineTo(canvas.width - 28, lineY);
    ctx.stroke();

    // Draw signature marker '✕'
    ctx.setLineDash([]);
    ctx.strokeStyle = "#94a3b8"; // slate-400
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(30, lineY - 10);
    ctx.lineTo(40, lineY + 2);
    ctx.moveTo(40, lineY - 10);
    ctx.lineTo(30, lineY + 2);
    ctx.stroke();

    // Guide text
    ctx.font = "600 11px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Sign your clinical signature above the line", 50, lineY - 2);
    ctx.restore();

    // Render completed strokes
    for (const stroke of strokes) {
      if (!stroke || !Array.isArray(stroke.points) || stroke.points.length < 1) continue;
      ctx.save();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Render active in-progress stroke
    const current = currentStrokeRef.current;
    if (current && Array.isArray(current.points) && current.points.length > 0) {
      ctx.save();
      ctx.strokeStyle = current.color;
      ctx.lineWidth = current.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(current.points[0].x, current.points[0].y);
      for (let i = 1; i < current.points.length; i++) {
        ctx.lineTo(current.points[i].x, current.points[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }, [strokes]);

  // Redraw canvas whenever pad tab is shown or strokes change
  useEffect(() => {
    if (activeTab === "draw" && isEditing) {
      renderCanvas();
    }
  }, [activeTab, isEditing, renderCanvas]);

  const getCanvasCoords = (clientX: number, clientY: number): SignaturePoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const pt = getCanvasCoords(e.clientX, e.clientY);
    if (!pt) return;
    isDrawingRef.current = true;
    currentStrokeRef.current = {
      points: [pt],
      color: penColor,
      width: penWidth,
    };
    renderCanvas();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    const pt = getCanvasCoords(e.clientX, e.clientY);
    if (!pt) return;
    if (!Array.isArray(currentStrokeRef.current.points)) {
      currentStrokeRef.current.points = [];
    }
    currentStrokeRef.current.points.push(pt);
    renderCanvas();
  };

  const handleMouseUpOrLeave = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const current = currentStrokeRef.current;
    if (current && Array.isArray(current.points) && current.points.length > 1) {
      const completedStroke: SignatureStroke = {
        color: current.color,
        width: current.width,
        points: [...current.points],
      };
      setStrokes((prev) => [...(prev || []).filter((s) => s && Array.isArray(s.points) && s.points.length > 0), completedStroke]);
    }
    currentStrokeRef.current = null;
    renderCanvas();
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    const touch = e.touches[0];
    const pt = getCanvasCoords(touch.clientX, touch.clientY);
    if (!pt) return;
    isDrawingRef.current = true;
    currentStrokeRef.current = {
      points: [pt],
      color: penColor,
      width: penWidth,
    };
    renderCanvas();
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !currentStrokeRef.current || e.touches.length !== 1) return;
    e.preventDefault();
    const touch = e.touches[0];
    const pt = getCanvasCoords(touch.clientX, touch.clientY);
    if (!pt) return;
    if (!Array.isArray(currentStrokeRef.current.points)) {
      currentStrokeRef.current.points = [];
    }
    currentStrokeRef.current.points.push(pt);
    renderCanvas();
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    handleMouseUpOrLeave();
  };

  const handleClearPad = () => {
    currentStrokeRef.current = null;
    isDrawingRef.current = false;
    setStrokes([]);
  };

  const handleUndoStroke = () => {
    currentStrokeRef.current = null;
    isDrawingRef.current = false;
    setStrokes((prev) => (prev || []).filter(Boolean).slice(0, -1));
  };

  const saveSignatureToStorage = (dataUrl: string, mode: "draw" | "upload") => {
    try {
      const storageKey = `healthko_doctor_signature_${doctor.id}`;
      const metaKey = `healthko_doctor_signature_meta_${doctor.id}`;
      const meta = {
        mode,
        savedAt: new Date().toISOString(),
        doctorName: doctor.name,
        licenseNumber: doctor.licenseNumber || "",
      };

      localStorage.setItem(storageKey, dataUrl);
      localStorage.setItem("healthko_doctor_signature_active", dataUrl);
      localStorage.setItem(metaKey, JSON.stringify(meta));

      setSavedSignature(dataUrl);
      setSavedMeta(meta);
      setIsEditing(false);
      setUploadedImage(null);
      setUploadFileName("");
      setUploadFileSize("");
      setStrokes([]);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("healthko_signature_updated"));
      }
      onToast("success", "Clinical digital signature saved successfully.");
    } catch (err) {
      console.error("Failed to save signature:", err);
      onToast("error", "Unable to save signature. Storage quota may be exceeded.");
    }
  };

  const handleSaveDrawn = () => {
    if (strokes.length === 0) {
      onToast("error", "Please write or draw your signature before saving.");
      return;
    }

    // Export cleanly to offscreen canvas
    const offscreen = document.createElement("canvas");
    offscreen.width = 560;
    offscreen.height = 180;
    const oCtx = offscreen.getContext("2d");
    if (!oCtx) return;

    // Render crisp transparent background with only the signature ink
    oCtx.clearRect(0, 0, offscreen.width, offscreen.height);

    for (const stroke of strokes) {
      if (!stroke || !Array.isArray(stroke.points) || stroke.points.length < 1) continue;
      oCtx.save();
      oCtx.strokeStyle = stroke.color;
      oCtx.lineWidth = stroke.width;
      oCtx.lineCap = "round";
      oCtx.lineJoin = "round";
      oCtx.beginPath();
      oCtx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        oCtx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      oCtx.stroke();
      oCtx.restore();
    }

    const dataUrl = offscreen.toDataURL("image/png");
    saveSignatureToStorage(dataUrl, "draw");
  };

  const handleFileProcess = (file: File) => {
    if (!file.type.startsWith("image/")) {
      onToast("error", "Please upload a valid image file (PNG, JPEG, SVG, WebP).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      onToast("error", "Signature file must be 2 MB or smaller.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setUploadedImage(reader.result);
        setUploadFileName(file.name);
        const kb = (file.size / 1024).toFixed(1);
        setUploadFileSize(`${kb} KB`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileProcess(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileProcess(file);
  };

  const handleSaveUploaded = () => {
    if (!uploadedImage) {
      onToast("error", "Please choose an image file first.");
      return;
    }
    saveSignatureToStorage(uploadedImage, "upload");
  };

  const handleRemove = () => {
    try {
      const storageKey = `healthko_doctor_signature_${doctor.id}`;
      const metaKey = `healthko_doctor_signature_meta_${doctor.id}`;
      localStorage.removeItem(storageKey);
      localStorage.removeItem("healthko_doctor_signature_active");
      localStorage.removeItem(metaKey);

      setSavedSignature(null);
      setSavedMeta(null);
      setIsEditing(true);
      setStrokes([]);
      setUploadedImage(null);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("healthko_signature_updated"));
      }
      onToast("success", "Digital signature removed from your clinical profile.");
    } catch (err) {
      console.error("Error removing signature:", err);
    }
  };

  const handleDownload = () => {
    if (!savedSignature) return;
    const link = document.createElement("a");
    link.href = savedSignature;
    link.download = `healthko-signature-${doctor.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <SettingsCard
      title="Doctor Digital Signature & Clinical E-Sign"
      body="Upload or handwrite your clinical signature to digitally authenticate prescriptions, medical certificates, and official health records."
    >
      {/* Saved Active Signature View */}
      {savedSignature && !isEditing ? (
        <div className={`rounded-2xl border p-5 transition-colors ${
          isDark ? "border-slate-800 bg-slate-950/70" : "border-slate-200 bg-slate-50/70"
        }`}>
          {/* Header Status Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4" style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
              </span>
              <div>
                <p className={`text-xs font-black uppercase tracking-wider ${isDark ? "text-emerald-400" : "text-emerald-700"}`}>
                  Active Clinical E-Signature On File
                </p>
                <p className={`text-[11px] font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {savedMeta?.savedAt ? `Saved via ${savedMeta.mode === "draw" ? "Write Pad" : "Image Upload"} on ${formatDate(savedMeta.savedAt)}` : "Verified and applied to electronic prescriptions"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownload}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black transition ${
                  isDark
                    ? "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600 hover:text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900"
                }`}
                title="Download signature file"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                  <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                </svg>
                Download PNG
              </button>

              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-teal px-3.5 py-2 text-xs font-black text-white shadow-xs transition hover:bg-teal-600"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                  <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
                </svg>
                Replace Signature
              </button>

              <button
                type="button"
                onClick={handleRemove}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black transition ${
                  isDark
                    ? "border-rose-900/60 bg-rose-950/30 text-rose-300 hover:bg-rose-950/60"
                    : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                }`}
                title="Remove signature"
              >
                Remove
              </button>
            </div>
          </div>

          {/* Signature Preview Frame */}
          <div className="mt-5 flex flex-col items-center justify-center">
            <div className="relative w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
              <div className="flex h-28 w-full items-center justify-center overflow-hidden">
                <img
                  src={savedSignature}
                  alt={`Dr. ${doctor.name} Digital Signature`}
                  className="max-h-24 max-w-full object-contain filter"
                />
              </div>
              <div className="mt-2 border-t border-slate-300 pt-2 text-center">
                <p className="text-xs font-black tracking-wider text-slate-800">
                  DR. {doctor.name.toUpperCase().replace(/^DR\.?\s+/i, "")}, MD
                </p>
                <p className="text-[10px] font-semibold text-slate-500">
                  PRC License: {doctor.licenseNumber || "PRC-VERIFIED"} · NPI/PTR: {doctor.npi || "NPI-ACTIVE"}
                </p>
              </div>
              <span className="absolute right-3 top-3 rounded-md bg-teal-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-brand-teal border border-teal-200">
                Official Seal
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Signature Creator / Editor */
        <div className={`rounded-2xl border p-5 transition-colors ${
          isDark ? "border-slate-800 bg-slate-950/70" : "border-slate-200 bg-slate-50/70"
        }`}>
          {/* Mode Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4" style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("draw")}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
                  activeTab === "draw"
                    ? "bg-brand-teal text-white shadow-xs"
                    : isDark
                      ? "bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
                      : "bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                  <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
                </svg>
                Write / Draw Pad
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("upload")}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
                  activeTab === "upload"
                    ? "bg-brand-teal text-white shadow-xs"
                    : isDark
                      ? "bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
                      : "bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 013.25 3h13.5A2.25 2.25 0 0119 5.25v9.5A2.25 2.25 0 0116.75 17H3.25A2.25 2.25 0 011 14.75v-9.5zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 00.75-.75v-2.69l-2.22-2.219a.75.75 0 00-1.06 0l-1.91 1.909-4.72-4.719a.75.75 0 00-1.06 0L2.5 11.06zm10.25-4.81a1.25 1.25 0 11-2.5 0 1.25 1.25 0 012.5 0z" clipRule="evenodd" />
                </svg>
                Upload Signature Image
              </button>
            </div>

            {savedSignature && (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-black transition ${
                  isDark
                    ? "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                Cancel
              </button>
            )}
          </div>

          {/* TAB 1: DRAW PAD */}
          {activeTab === "draw" ? (
            <div className="mt-4 space-y-4">
              {/* Draw Pad Controls Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Ink Color Selector */}
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Ink Color:
                  </span>
                  <div className="flex items-center gap-1.5">
                    {SIGNATURE_INK_COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setPenColor(c.value)}
                        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-black transition border ${
                          penColor === c.value
                            ? "border-brand-teal bg-brand-teal/10 text-brand-teal ring-1 ring-brand-teal"
                            : isDark
                              ? "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
                              : "border-slate-200 bg-white text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <span className={`h-2.5 w-2.5 rounded-full ${c.dotClass}`} />
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stroke Width Selector */}
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Pen:
                  </span>
                  <div className="flex items-center gap-1">
                    {SIGNATURE_STROKE_WIDTHS.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => setPenWidth(w.value)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-black transition border ${
                          penWidth === w.value
                            ? "border-brand-teal bg-brand-teal text-white shadow-2xs"
                            : isDark
                              ? "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
                              : "border-slate-200 bg-white text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Action Buttons: Undo & Clear */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleUndoStroke}
                    disabled={strokes.length === 0}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-black transition disabled:opacity-40 ${
                      isDark
                        ? "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                    title="Undo last stroke"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                      <path fillRule="evenodd" d="M7.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L5.414 9H14a3 3 0 013 3v2a1 1 0 11-2 0v-2a1 1 0 00-1-1H5.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                    Undo
                  </button>

                  <button
                    type="button"
                    onClick={handleClearPad}
                    disabled={strokes.length === 0}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-black transition disabled:opacity-40 ${
                      isDark
                        ? "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    Clear Pad
                  </button>
                </div>
              </div>

              {/* Canvas Write Pad Area */}
              <div className="relative overflow-hidden rounded-xl border border-slate-300 bg-white shadow-xs">
                <canvas
                  ref={canvasRef}
                  width={560}
                  height={180}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUpOrLeave}
                  onMouseLeave={handleMouseUpOrLeave}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  style={{ touchAction: "none" }}
                  className="h-44 w-full cursor-crosshair select-none"
                  aria-label="Doctor signature write pad"
                />
              </div>

              {/* Bottom Instructions and Save Button */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <p className={`text-[11px] font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  ✍️ Use mouse, stylus, or fingertip to sign your name. Strokes are rendered in high fidelity.
                </p>

                <button
                  type="button"
                  onClick={handleSaveDrawn}
                  disabled={strokes.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-teal px-5 py-2.5 text-xs font-black text-white shadow-xs transition hover:bg-teal-600 disabled:opacity-40"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                  </svg>
                  Save Drawn Signature
                </button>
              </div>
            </div>
          ) : (
            /* TAB 2: UPLOAD IMAGE */
            <div className="mt-4 space-y-4">
              {!uploadedImage ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition ${
                    isDragging
                      ? "border-brand-teal bg-brand-teal/10"
                      : isDark
                        ? "border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900"
                        : "border-slate-300 bg-slate-50/70 hover:border-slate-400 hover:bg-white"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                    onChange={handleFileInputChange}
                    className="sr-only"
                  />
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-teal/10 text-brand-teal">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <p className={`mt-3 text-sm font-black ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                    Click to browse or drag and drop signature image
                  </p>
                  <p className={`mt-1 text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    PNG with transparent background recommended (also supports JPG, SVG, WebP up to 2 MB)
                  </p>
                </div>
              ) : (
                /* Uploaded Preview */
                <div className="space-y-4">
                  <div className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                    <div className="flex h-28 w-full items-center justify-center overflow-hidden">
                      <img
                        src={uploadedImage}
                        alt="Uploaded Signature Preview"
                        className="max-h-24 max-w-full object-contain"
                      />
                    </div>
                    <div className="mt-2 border-t border-slate-300 pt-2 text-center">
                      <p className="text-xs font-black tracking-wider text-slate-800">
                        DR. {doctor.name.toUpperCase().replace(/^DR\.?\s+/i, "")}, MD
                      </p>
                      <p className="text-[10px] font-semibold text-slate-500">
                        {uploadFileName} {uploadFileSize ? `(${uploadFileSize})` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setUploadedImage(null);
                        setUploadFileName("");
                        setUploadFileSize("");
                      }}
                      className={`rounded-xl border px-4 py-2 text-xs font-black transition ${
                        isDark
                          ? "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      Choose Different File
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveUploaded}
                      className="inline-flex items-center gap-2 rounded-xl bg-brand-teal px-5 py-2.5 text-xs font-black text-white shadow-xs transition hover:bg-teal-600"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                      </svg>
                      Save Uploaded Signature
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </SettingsCard>
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

          </form>
        </SettingsCard>
      );
    }

    if (activeSection === "practice") {
      return (
        <div className="space-y-6">
          {/* ── Schedule & Availability ── */}
          <SettingsCard title="Schedule & Availability" body="Manage your practice hours, appointment duration, and live consultation availability status.">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                saveDoctorProfile("Schedule and availability updated.");
              }}
              className="grid gap-4 md:grid-cols-2"
            >
              <WorkingHoursTimeSelector
                value={form.availability}
                onChange={(value) => setField("availability", value)}
              />
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
              <div className="flex justify-end pt-1 md:col-span-2">
                <button type="submit" disabled={isPending} className="rounded-xl bg-brand-teal px-5 py-3 text-sm font-black text-white transition hover:bg-teal-600 disabled:opacity-50">
                  {isPending ? "Saving..." : "Save Schedule"}
                </button>
              </div>
            </form>
          </SettingsCard>

          {/* ── Consultation Settings ── */}
          <SettingsCard title="Consultation Settings" body="Configure live consultation room behaviour and patient admission policies.">
            <div className="grid gap-3 md:grid-cols-2">
              <PlaceholderTile title="Camera Selection" body="Managed inside the active live consultation room device selector." />
              <PlaceholderTile title="Microphone Selection" body="Managed inside the active live consultation room device selector." />
              <ToggleRow label="Manual Admit Patients" description="Current WebRTC flow lets the doctor start the room before patients join." checked={form.admitMode === "manual"} />
              <ToggleRow label="Auto Admit Patients" description="Future workflow option once waiting-room admission policies are modeled." checked={false} />
            </div>
          </SettingsCard>

          {/* ── Prescription Settings ── */}
          <DoctorDigitalSignatureSection doctor={doctor} onToast={showToast} />

          <SettingsCard
            title="Prescription Settings & Standards"
            body="Configure default clinical prescription policies and requirements."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <ToggleRow
                label="Enforce Verified Electronic Signature"
                description="Require official digital signature on all outbound prescription PDFs."
                checked={true}
              />
              <ToggleRow
                label="Telemedicine Letterhead & PRC Stamp"
                description="Automatically render doctor credentials and clinic accreditation headers."
                checked={true}
              />
              <PlaceholderTile
                title="Prescription Order Sets & Templates"
                body="Save frequent medication combos and dosage instructions to speed up consultation checkouts."
              />
              <PlaceholderTile
                title="Direct Pharmacy E-Dispense Routing"
                body="Automatic transmission of authenticated prescriptions to partner pharmacies."
              />
            </div>
          </SettingsCard>
        </div>
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

    if (activeSection === "earnings") {
      return (
        <DoctorEarningsHistory
          doctor={doctor}
          consultFee={Number(form.consultFee) > 0 ? Number(form.consultFee) : (doctor.consultFee ?? 75)}
        />
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
