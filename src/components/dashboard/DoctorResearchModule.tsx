"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import type { DashboardDoctor, DoctorArticle, DoctorArticleCategory } from "@/lib/dashboard/types";

type ViewTab = "my_publications" | "peer_network";

const CATEGORY_META: Record<
  DoctorArticleCategory,
  { label: string; icon: string; lightBadge: string; darkBadge: string }
> = {
  guide: {
    label: "Clinical Guide",
    icon: "🩺",
    lightBadge: "bg-teal-50 text-brand-teal border-teal-200",
    darkBadge: "bg-brand-teal/15 text-brand-teal border-brand-teal/30",
  },
  tip: {
    label: "Health Tip",
    icon: "💡",
    lightBadge: "bg-amber-50 text-amber-800 border-amber-200",
    darkBadge: "bg-amber-400/15 text-amber-300 border-amber-400/30",
  },
  research: {
    label: "Medical Research",
    icon: "🔬",
    lightBadge: "bg-purple-50 text-purple-800 border-purple-200",
    darkBadge: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  },
  update: {
    label: "Practice Insight",
    icon: "📝",
    lightBadge: "bg-sky-50 text-sky-800 border-sky-200",
    darkBadge: "bg-sky-400/15 text-sky-300 border-sky-400/30",
  },
};

const AUDIENCE_META = {
  patients: { label: "Patients & Public", badge: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  physicians: { label: "Physicians & Peers", badge: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20" },
  general: { label: "General Healthcare", badge: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
};

const PRESET_THUMBNAILS = [
  {
    name: "Consultation & Vitals",
    url: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Cardiology & ECG",
    url: "https://images.unsplash.com/photo-1628348068343-c6a848d2b6dd?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Nutrition & Lifestyle",
    url: "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Telemedicine & Digital",
    url: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Laboratory & Biotech",
    url: "https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?auto=format&fit=crop&w=900&q=80",
  },
];

function getInitialCuratedArticles(doctor: DashboardDoctor): DoctorArticle[] {
  const doctorName = doctor.name || "Dr. Medical Doctor";
  const doctorSpecialty = doctor.specialty || "Internal Medicine";

  return [
    // 1. Current Doctor - Clinical Guide
    {
      id: "art-my-1",
      title: "Essential Hypertension: Step-by-Step Home Monitoring & Lifestyle Protocol",
      slug: "hypertension-home-monitoring-lifestyle-protocol",
      category: "guide",
      targetAudience: "patients",
      summary: "A practical, evidence-based guide for patients managing stage 1 and stage 2 hypertension outside clinical consultations.",
      content: `### Objective & Patient Guidelines
Hypertension is often called the silent condition because it rarely causes noticeable symptoms until complications develop. Effective long-term control relies heavily on structured home blood pressure monitoring (HBPM) combined with steady lifestyle modifications.

### Proper Technique for Blood Pressure Measurement
1. **Rest**: Sit quietly for at least 5 minutes in a comfortable chair with back support before taking a measurement.
2. **Arm Position**: Rest your bare arm on a flat surface (such as a table) at heart level.
3. **Cuff Placement**: Ensure the lower edge of the cuff sits 2–3 cm above the bend of the elbow.
4. **Timing**: Measure twice daily—once in the morning before breakfast and medication, and once in the evening before dinner.

### Sodium Restriction and The DASH Framework
Aim for less than 2,000 mg of sodium per day (roughly one level teaspoon of salt). Prioritize potassium-rich foods (bananas, spinach, sweet potatoes) unless contraindicated by chronic renal disease. Regular aerobic exercise (30 minutes brisk walking daily) has been shown to reduce systolic pressure by 5–8 mmHg.`,
      keyTakeaways: [
        "Take morning and evening readings at least 5 minutes after resting.",
        "Keep daily sodium intake below 2,000 mg using herbs and spices instead of table salt.",
        "Log measurements in the HealthKo patient tracker before every follow-up consultation.",
      ],
      readTimeMinutes: 4,
      publishedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      authorId: doctor.id,
      authorName: doctorName,
      authorSpecialty: doctorSpecialty,
      authorNpi: doctor.npi,
      thumbnailUrl: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=900&q=80",
      tags: ["Hypertension", "Cardiovascular", "HomeMonitoring", "PreventiveHealth"],
      viewsCount: 342,
      likesCount: 28,
      isPeerArticle: false,
    },
    // 2. Current Doctor - Health Tip
    {
      id: "art-my-2",
      title: "Five Overlooked Daily Habits That Significantly Lower Chronic Inflammation",
      slug: "habits-lowering-chronic-inflammation",
      category: "tip",
      targetAudience: "patients",
      summary: "Actionable dietary and sleep tips to modulate inflammatory markers and reduce cardiovascular fatigue.",
      content: `### Understanding Low-Grade Chronic Inflammation
While acute inflammation is the body's natural response to tissue injury or infection, chronic low-grade systemic inflammation contributes to insulin resistance, endothelial dysfunction, and accelerated vascular aging.

### High-Impact Daily Adjustments
- **Consistent Circadian Sleep**: Maintaining a 7-8 hour sleep window synchronized with natural daylight cycles directly down-regulates interleukin-6 (IL-6) and C-reactive protein (CRP).
- **Polyphenol-Dense Nutrition**: Green tea, extra virgin olive oil, and dark berries deliver potent bioflavonoids.
- **Post-Meal Ambulation**: A light 10-minute walk after lunch and dinner blunts glucose spikes, mitigating postprandial inflammatory cascades.
- **Stress De-escalation**: 5 minutes of box breathing (4s inhale, 4s hold, 4s exhale, 4s hold) reduces sympathetic tone.`,
      keyTakeaways: [
        "Target consistent sleep hours to maintain baseline immune stability.",
        "Incorporate a 10-minute walk immediately following your heaviest daily meal.",
        "Replace processed seed oils with extra-virgin olive oil for cooking and salads.",
      ],
      readTimeMinutes: 3,
      publishedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      authorId: doctor.id,
      authorName: doctorName,
      authorSpecialty: doctorSpecialty,
      authorNpi: doctor.npi,
      thumbnailUrl: "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=900&q=80",
      tags: ["Wellness", "Nutrition", "Inflammation", "HealthyAging"],
      viewsCount: 520,
      likesCount: 46,
      isPeerArticle: false,
    },
    // 3. Current Doctor - Research Paper
    {
      id: "art-my-3",
      title: "Synchronous Telehealth Encounters in Ambulatory Care: Patient Adherence & Outcome Analysis",
      slug: "telehealth-ambulatory-adherence-analysis",
      category: "research",
      targetAudience: "physicians",
      summary: "Observational clinical study examining 180-day prescription refill compliance and follow-up attendance across 1,200 remote consultations.",
      content: `### Abstract & Clinical Context
With the rapid institutionalization of synchronous audiovisual telehealth, assessing treatment persistence and follow-up reliability is vital for clinical governance. We conducted an observational cohort assessment evaluating prescription adherence and scheduled review completions.

### Methodology & Observed Cohort
A retrospective chart review of 1,200 adult patients attending scheduled teleconsultations revealed a 34% reduction in appointment no-show rates compared to traditional brick-and-mortar visits (p < 0.001).

### Primary Clinical Findings
- Prescription fulfillment rates increased from 71.4% to 88.2% when electronic prescriptions were generated instantly during the video session.
- Patients reported higher satisfaction with digital treatment plan documentation and direct downloadable prescription summaries.
- Blood pressure normalization targets were reached an average of 18 days faster due to expedited titration check-ins.`,
      keyTakeaways: [
        "Digital follow-ups decrease patient drop-off and improve chronic disease titration speed.",
        "Real-time electronic prescription delivery improves pharmacy fulfillment by over 16%.",
        "Short 10-minute check-ins sustain clinical engagement between major quarterly evaluations.",
      ],
      readTimeMinutes: 6,
      publishedAt: new Date(Date.now() - 14 * 86400000).toISOString(),
      authorId: doctor.id,
      authorName: doctorName,
      authorSpecialty: doctorSpecialty,
      authorNpi: doctor.npi,
      thumbnailUrl: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=900&q=80",
      tags: ["Telemedicine", "ClinicalOutcomes", "Adherence", "DigitalHealth"],
      viewsCount: 890,
      likesCount: 63,
      isPeerArticle: false,
    },
    // 4. Peer Doctor 1 - Cardiology Guide
    {
      id: "art-peer-1",
      title: "Atrial Fibrillation Screening: Pulse Palpation and Smart Wearable ECG Guidance",
      slug: "afib-screening-wearables-ecg-guidance",
      category: "guide",
      targetAudience: "patients",
      summary: "Cardiologist guide on distinguishing benign palpitations from sustained arrhythmias using home wearables.",
      content: `### Introduction from Cardiology
Consumer smartwatches and wearable pulse monitors have revolutionized the detection of intermittent cardiac rhythm irregularities. However, interpreting notifications requires clinical discernment.

### When to Seek Evaluation
Occasional extra beats (premature ventricular or atrial contractions) are very common. In contrast, an irregularly irregular pulse with no discernible pattern, coupled with fatigue or mild dyspnea, warrants an immediate 12-lead ECG.

### Wearable Recording Tips
- Avoid moving or speaking while recording single-lead smartwatch ECG strips.
- Export recordings as PDF and bring them to your telehealth session for board-certified cardiology review.`,
      keyTakeaways: [
        "Export single-lead wearable ECG traces as PDF for your physician to inspect rhythm strips.",
        "Benign ectopic beats are transient; sustained irregular tachycardia requires urgent formal ECG.",
      ],
      readTimeMinutes: 5,
      publishedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      authorId: "doc-peer-1",
      authorName: "Dr. Alejandro Gomez, MD",
      authorSpecialty: "Cardiology",
      thumbnailUrl: "https://images.unsplash.com/photo-1628348068343-c6a848d2b6dd?auto=format&fit=crop&w=900&q=80",
      tags: ["Cardiology", "Arrhythmia", "Wearables", "ECG"],
      viewsCount: 640,
      likesCount: 52,
      isPeerArticle: true,
    },
    // 5. Peer Doctor 2 - Pediatrics Tip
    {
      id: "art-peer-2",
      title: "Managing Pediatric Fevers: Safe Antipyretic Dosing and Red Flag Symptoms",
      slug: "pediatric-fever-dosing-red-flags",
      category: "tip",
      targetAudience: "patients",
      summary: "Pediatrician's protocol on paracetamol and ibuprofen weight-based dosing and when urgent hospital referral is needed.",
      content: `### Pediatric Fever Demystified
Fever is a normal, protective physiologic response to infection. Treating fever in children is aimed at improving the child's comfort, hydration, and alertness, rather than achieving a completely normal thermometer reading.

### Weight-Based Dosing Over Age-Based Dosing
Always calculate medication dosage according to the child's weight in kilograms rather than their age on the bottle label. Paracetamol is 10–15 mg/kg every 4–6 hours (max 4 doses in 24 hours). Ibuprofen is 5–10 mg/kg every 6–8 hours.

### Red Flag Symptoms Requiring Immediate Emergency Care
- Infant younger than 3 months with temperature ≥ 38.0°C (100.4°F).
- Difficulty breathing, grunting, or severe chest retractions.
- Inability to hold down oral fluids or signs of severe dehydration (no tears, dry diapers > 8 hours).
- Lethargy, extreme floppiness, or non-blanching petechial rash.`,
      keyTakeaways: [
        "Always dose fever reducers by weight in kilograms, never age alone.",
        "Infants under 3 months with a fever need urgent clinical evaluation.",
        "Focus on the child's alertness and hydration rather than just the number on the thermometer.",
      ],
      readTimeMinutes: 4,
      publishedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      authorId: "doc-peer-2",
      authorName: "Dr. Patricia Reyes, MD, FPPS",
      authorSpecialty: "Pediatrics",
      thumbnailUrl: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=900&q=80",
      tags: ["Pediatrics", "ChildHealth", "FeverManagement", "Parenting"],
      viewsCount: 1120,
      likesCount: 94,
      isPeerArticle: true,
    },
    // 6. Peer Doctor 3 - Neurology Research
    {
      id: "art-peer-3",
      title: "Migraine Prophylaxis with CGRP Antagonists: Clinical Real-World Effectiveness",
      slug: "migraine-prophylaxis-cgrp-effectiveness",
      category: "research",
      targetAudience: "physicians",
      summary: "Comprehensive multi-center review of calcitonin gene-related peptide receptor antagonists in refractory chronic migraine.",
      content: `### Background
Chronic migraine represents a disabling neurovascular disorder. The advent of monoclonal antibodies and small-molecule CGRP antagonists has provided targeted prophylactic interventions with improved tolerability profiles over traditional beta-blockers or antiepileptics.

### Clinical Observations
In a real-world multi-center registry of 320 refractory migraineurs, patients demonstrated an average reduction of 6.2 monthly migraine days (MMDs) within 12 weeks of initiation. Adverse effect withdrawal rates remained below 4%, with constipation and mild injection-site erythema being the most frequent observations.`,
      keyTakeaways: [
        "CGRP inhibitors demonstrate high tolerability and rapid onset in treatment-resistant migraine.",
        "Regular monitoring of blood pressure is prudent during the initial titration phase.",
      ],
      readTimeMinutes: 6,
      publishedAt: new Date(Date.now() - 9 * 86400000).toISOString(),
      authorId: "doc-peer-3",
      authorName: "Dr. Roberto Tan, MD, FPNA",
      authorSpecialty: "Neurology",
      thumbnailUrl: "https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?auto=format&fit=crop&w=900&q=80",
      tags: ["Neurology", "Migraine", "Pharmacotherapy", "ClinicalTrial"],
      viewsCount: 480,
      likesCount: 39,
      isPeerArticle: true,
    },
    // 7. Peer Doctor 4 - Dermatology Guide
    {
      id: "art-peer-4",
      title: "Atopic Dermatitis in Adults: Barrier Repair and Topical Anti-Inflammatory Regimens",
      slug: "atopic-dermatitis-barrier-repair-regimens",
      category: "guide",
      targetAudience: "patients",
      summary: "Dermatologist guidelines for restoring the stratum corneum and safely applying topical corticosteroids and calcineurin inhibitors.",
      content: `### The Skin Barrier Defect
Atopic eczema is fundamentally characterized by epidermal barrier dysfunction, often tied to filaggrin mutations and ceramides deficiency, leading to transepidermal water loss and allergen penetration.

### The 'Soak and Seal' Method
1. Bathe or shower in lukewarm water for no more than 5–10 minutes.
2. Gently pat skin with a soft towel, leaving it slightly damp.
3. Apply prescribed topical anti-inflammatory ointments only to active lesions.
4. Within 3 minutes of bathing, generously apply a thick ceramide-containing emollient across the entire body.`,
      keyTakeaways: [
        "Apply emollient within 3 minutes of bathing to lock in stratum corneum hydration.",
        "Avoid scented washes, harsh detergents, and wool fabrics directly against the skin.",
      ],
      readTimeMinutes: 4,
      publishedAt: new Date(Date.now() - 11 * 86400000).toISOString(),
      authorId: "doc-peer-4",
      authorName: "Dr. Camille Santos, MD, FPDS",
      authorSpecialty: "Dermatology",
      thumbnailUrl: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=900&q=80",
      tags: ["Dermatology", "Eczema", "Skincare", "Allergy"],
      viewsCount: 790,
      likesCount: 68,
      isPeerArticle: true,
    },
  ];
}

export function DoctorResearchModule({
  doctor,
  tone = "light",
}: {
  doctor: DashboardDoctor;
  tone?: "light" | "dark";
}) {
  const isDark = tone === "dark";

  // Persistent storage key
  const storageKey = `healthko:doctor:articles:${doctor.id || "default"}`;

  const [articles, setArticles] = useState<DoctorArticle[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) return JSON.parse(saved);
      } catch {
        // Fallback
      }
    }
    return getInitialCuratedArticles(doctor);
  });

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(articles));
    } catch {
      // Ignore storage errors
    }
  }, [articles, storageKey]);

  const [activeTab, setActiveTab] = useState<ViewTab>("my_publications");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("all");

  // Interaction State
  const [likedArticles, setLikedArticles] = useState<Record<string, boolean>>({});
  const [bookmarkedArticles, setBookmarkedArticles] = useState<Record<string, boolean>>({});
  const [activeReaderArticle, setActiveReaderArticle] = useState<DoctorArticle | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  // New Article Composer Form State
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState<DoctorArticleCategory>("guide");
  const [formAudience, setFormAudience] = useState<"patients" | "physicians" | "general">("patients");
  const [formSummary, setFormSummary] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formReadTime, setFormReadTime] = useState("4");
  const [formTags, setFormTags] = useState("");
  const [takeawayInputs, setTakeawayInputs] = useState<string[]>([""]);

  // Media & Thumbnail State
  const [formThumbnail, setFormThumbnail] = useState<string>("");
  const [formImages, setFormImages] = useState<{ id: string; url: string; caption?: string }[]>([]);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const articleImagesInputRef = useRef<HTMLInputElement>(null);

  // Available Peer Specialties for Filtering
  const peerSpecialties = useMemo(() => {
    const list = articles.filter((a) => a.isPeerArticle).map((a) => a.authorSpecialty);
    return Array.from(new Set(list));
  }, [articles]);

  // Filtered Articles based on Active Tab, Search, Category, and Specialty
  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      // Tab filter
      if (activeTab === "my_publications" && article.isPeerArticle) return false;
      if (activeTab === "peer_network" && !article.isPeerArticle) return false;

      // Category filter
      if (selectedCategory !== "all" && article.category !== selectedCategory) return false;

      // Specialty filter (in peer tab)
      if (activeTab === "peer_network" && selectedSpecialty !== "all" && article.authorSpecialty !== selectedSpecialty) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = article.title.toLowerCase().includes(q);
        const matchesSummary = article.summary.toLowerCase().includes(q);
        const matchesAuthor = article.authorName.toLowerCase().includes(q);
        const matchesTags = article.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchesTitle && !matchesSummary && !matchesAuthor && !matchesTags) return false;
      }

      return true;
    });
  }, [articles, activeTab, selectedCategory, selectedSpecialty, searchQuery]);

  // Metrics
  const myArticlesCount = articles.filter((a) => !a.isPeerArticle).length;
  const peerArticlesCount = articles.filter((a) => a.isPeerArticle).length;
  const totalLikes = articles.filter((a) => !a.isPeerArticle).reduce((acc, a) => acc + a.likesCount, 0);
  const totalViews = articles.filter((a) => !a.isPeerArticle).reduce((acc, a) => acc + a.viewsCount, 0);

  // Toggle Like
  const handleToggleLike = (articleId: string) => {
    const isLiked = Boolean(likedArticles[articleId]);
    setLikedArticles((prev) => ({ ...prev, [articleId]: !isLiked }));
    setArticles((prev) =>
      prev.map((a) => {
        if (a.id === articleId) {
          return {
            ...a,
            likesCount: isLiked ? Math.max(0, a.likesCount - 1) : a.likesCount + 1,
          };
        }
        return a;
      })
    );
  };

  // Toggle Bookmark
  const handleToggleBookmark = (articleId: string) => {
    setBookmarkedArticles((prev) => ({ ...prev, [articleId]: !prev[articleId] }));
  };

  // Handle Thumbnail File Upload
  const handleThumbnailFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (max 6MB)
    if (file.size > 6 * 1024 * 1024) {
      alert("Image file size is too large. Please select an image under 6MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const dataUrl = loadEvent.target?.result as string;
      if (dataUrl) {
        setFormThumbnail(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Multiple Article Images / Figures Upload
  const handleArticleImagesFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach((file) => {
      if (file.size > 6 * 1024 * 1024) return;
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const dataUrl = loadEvent.target?.result as string;
        if (dataUrl) {
          const defaultCaption = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
          setFormImages((prev) => [
            ...prev,
            {
              id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              url: dataUrl,
              caption: defaultCaption,
            },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Insert image markdown tag into article content
  const handleInsertImageIntoContent = (imgUrl: string, caption?: string) => {
    const label = caption || "Figure";
    const markdown = `\n\n![${label}](${imgUrl})\n*${label}*\n\n`;
    setFormContent((prev) => prev + markdown);
  };

  // Handle Publish New Article
  const handlePublishArticle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) return;

    const newArticle: DoctorArticle = {
      id: `art-my-${Date.now()}`,
      title: formTitle.trim(),
      slug: formTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      category: formCategory,
      targetAudience: formAudience,
      summary: formSummary.trim() || formContent.slice(0, 160) + "…",
      content: formContent.trim(),
      keyTakeaways: takeawayInputs.map((t) => t.trim()).filter(Boolean),
      readTimeMinutes: Math.max(1, parseInt(formReadTime, 10) || 3),
      publishedAt: new Date().toISOString(),
      authorId: doctor.id || "doc-current",
      authorName: doctor.name || "Dr. Medical Doctor",
      authorSpecialty: doctor.specialty || "General Practice",
      authorNpi: doctor.npi,
      authorLicense: doctor.licenseNumber,
      thumbnailUrl: formThumbnail || undefined,
      coverImageUrl: formThumbnail || undefined,
      images: formImages.length > 0 ? formImages : undefined,
      tags: formTags
        .split(",")
        .map((t) => t.trim().replace(/^#/, ""))
        .filter(Boolean),
      viewsCount: 1,
      likesCount: 0,
      isPeerArticle: false,
    };

    setArticles((prev) => [newArticle, ...prev]);
    setIsComposerOpen(false);

    // Reset Form
    setFormTitle("");
    setFormCategory("guide");
    setFormAudience("patients");
    setFormSummary("");
    setFormContent("");
    setFormReadTime("4");
    setFormTags("");
    setTakeawayInputs([""]);
    setFormThumbnail("");
    setFormImages([]);
  };

  // Handle Delete Article
  const handleDeleteArticle = (articleId: string) => {
    if (confirm("Are you sure you want to remove this publication?")) {
      setArticles((prev) => prev.filter((a) => a.id !== articleId));
      if (activeReaderArticle?.id === articleId) {
        setActiveReaderArticle(null);
      }
    }
  };

  return (
    <section className="space-y-6">
      {/* ── TOP HERO & KNOWLEDGE HUB BANNER ────────────────────────────── */}
      <div
        className={`rounded-2xl border p-6 transition-colors ${
          isDark ? "border-slate-800 bg-slate-900 text-white shadow-xs" : "border-slate-200 bg-white text-slate-900 shadow-xs"
        }`}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b pb-5" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 rounded-full bg-brand-teal animate-pulse" />
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-teal">Clinical Knowledge & Research</p>
            </div>
            <h2 className={`mt-1 text-2xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>Blogs, Guides & Research Hub</h2>
            <p className={`mt-1 text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Publish patient health tips, clinical protocols with rich imagery, and explore evidence-based research shared across the HealthKo medical community.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsComposerOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-brand-teal px-5 py-2.5 text-xs font-black text-white shadow-md hover:bg-teal-600 transition"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Publish New Guide / Article
            </button>
          </div>
        </div>

        {/* ── STATS BAR ────────────────────────────────────────── */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className={`rounded-xl border p-3.5 transition-colors ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-100 bg-slate-50/70"}`}>
            <p className={`text-[10px] font-black uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>Your Publications</p>
            <p className="mt-1 text-2xl font-black text-brand-teal">{myArticlesCount}</p>
          </div>
          <div className={`rounded-xl border p-3.5 transition-colors ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-100 bg-slate-50/70"}`}>
            <p className={`text-[10px] font-black uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>Peer Network Articles</p>
            <p className="mt-1 text-2xl font-black text-sky-500">{peerArticlesCount}</p>
          </div>
          <div className={`rounded-xl border p-3.5 transition-colors ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-100 bg-slate-50/70"}`}>
            <p className={`text-[10px] font-black uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>Reader Views</p>
            <p className="mt-1 text-2xl font-black text-emerald-500">{totalViews}</p>
          </div>
          <div className={`rounded-xl border p-3.5 transition-colors ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-100 bg-slate-50/70"}`}>
            <p className={`text-[10px] font-black uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>Physician Applauds</p>
            <p className="mt-1 text-2xl font-black text-amber-500">{totalLikes}</p>
          </div>
        </div>

        {/* ── PRIMARY VIEW TAB SWITCHER ──────────────────────────── */}
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t pt-5" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab("my_publications");
                setSelectedSpecialty("all");
              }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
                activeTab === "my_publications"
                  ? "bg-brand-teal text-white shadow-xs"
                  : isDark
                    ? "bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900"
              }`}
            >
              <span>👤</span>
              <span>My Publications</span>
              <span
                className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  activeTab === "my_publications"
                    ? "bg-white/20 text-white"
                    : isDark
                      ? "bg-slate-700 text-slate-300"
                      : "bg-slate-200 text-slate-700"
                }`}
              >
                {myArticlesCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("peer_network");
              }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
                activeTab === "peer_network"
                  ? "bg-brand-teal text-white shadow-xs"
                  : isDark
                    ? "bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900"
              }`}
            >
              <span>🌐</span>
              <span>Physician Network</span>
              <span
                className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  activeTab === "peer_network"
                    ? "bg-white/20 text-white"
                    : isDark
                      ? "bg-slate-700 text-slate-300"
                      : "bg-slate-200 text-slate-700"
                }`}
              >
                {peerArticlesCount}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors sm:w-72 ${
              isDark ? "border-slate-700 bg-slate-950" : "border-slate-200 bg-slate-50/80"
            }`}
          >
            <svg className="h-4 w-4 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search topic, title, doctor…"
              className={`w-full bg-transparent text-xs font-semibold outline-none ${
                isDark ? "text-white placeholder:text-slate-500" : "text-slate-900 placeholder:text-slate-400"
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-xs font-black text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* ── FILTER CHIPS ─────────────────────────────────────── */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className={`text-[10px] font-black uppercase tracking-wider mr-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>Category:</span>
          {[
            { id: "all", label: "All Formats" },
            { id: "guide", label: "Clinical Guides" },
            { id: "tip", label: "Health Tips" },
            { id: "research", label: "Medical Research" },
            { id: "update", label: "Practice Updates" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-black transition-all ${
                selectedCategory === cat.id
                  ? isDark ? "bg-brand-teal/20 text-brand-teal ring-1 ring-brand-teal/40" : "bg-teal-50 text-teal-700 ring-1 ring-teal-300"
                  : isDark ? "bg-slate-950 text-slate-400 hover:text-white" : "bg-slate-100 text-slate-600 hover:text-slate-900"
              }`}
            >
              {cat.label}
            </button>
          ))}

          {/* Specialty Filter for Peer Tab */}
          {activeTab === "peer_network" && peerSpecialties.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <span className={`text-[10px] font-black uppercase tracking-wider mr-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>Specialty:</span>
              <button
                type="button"
                onClick={() => setSelectedSpecialty("all")}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-black transition-all ${
                  selectedSpecialty === "all"
                    ? isDark ? "bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/40" : "bg-sky-50 text-sky-700 ring-1 ring-sky-300"
                    : isDark ? "bg-slate-950 text-slate-400 hover:text-white" : "bg-slate-100 text-slate-600 hover:text-slate-900"
                }`}
              >
                All Specialties
              </button>
              {peerSpecialties.map((spec) => (
                <button
                  key={spec}
                  type="button"
                  onClick={() => setSelectedSpecialty(spec)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-black transition-all ${
                    selectedSpecialty === spec
                      ? isDark ? "bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/40" : "bg-sky-50 text-sky-700 ring-1 ring-sky-300"
                      : isDark ? "bg-slate-950 text-slate-400 hover:text-white" : "bg-slate-100 text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {spec}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── ARTICLES GRID ────────────────────────────────────────── */}
      {filteredArticles.length === 0 ? (
        <div
          className={`rounded-2xl border p-12 text-center ${
            isDark ? "border-slate-800 bg-slate-900 text-slate-400" : "border-slate-200 bg-white text-slate-500 shadow-xs"
          }`}
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-teal/15 text-brand-teal text-2xl">
            📚
          </div>
          <h3 className={`mt-3 text-base font-black ${isDark ? "text-white" : "text-slate-900"}`}>
            {searchQuery ? "No matching publications found" : activeTab === "my_publications" ? "You have not published any articles yet" : "No peer articles in this category"}
          </h3>
          <p className="mt-1 text-xs max-w-md mx-auto">
            {searchQuery
              ? "Try adjusting your search terms or clearing the active category filters."
              : activeTab === "my_publications"
                ? "Share your medical knowledge, patient guides, and health tips with photos and infographics today."
                : "Explore other specialties or categories to find articles published by peer physicians."}
          </p>
          {activeTab === "my_publications" && (
            <button
              type="button"
              onClick={() => setIsComposerOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-teal px-4 py-2 text-xs font-black text-white hover:bg-teal-600 transition"
            >
              + Create First Guide or Tip
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredArticles.map((article) => {
            const catInfo = CATEGORY_META[article.category] || CATEGORY_META.guide;
            const audInfo = AUDIENCE_META[article.targetAudience] || AUDIENCE_META.patients;
            const isLiked = Boolean(likedArticles[article.id]);
            const isBookmarked = Boolean(bookmarkedArticles[article.id]);

            return (
              <article
                key={article.id}
                className={`group rounded-2xl border flex flex-col justify-between overflow-hidden transition-all duration-200 hover:shadow-lg ${
                  isDark ? "border-slate-800 bg-slate-900/95 hover:border-slate-700" : "border-slate-200 bg-white hover:border-slate-300 shadow-2xs"
                }`}
              >
                <div>
                  {/* Article Thumbnail Header */}
                  {article.thumbnailUrl ? (
                    <div
                      onClick={() => setActiveReaderArticle(article)}
                      className="relative h-44 w-full overflow-hidden bg-slate-100 dark:bg-slate-950 cursor-pointer"
                    >
                      <img
                        src={article.thumbnailUrl}
                        alt={article.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

                      {/* Overlaid Badges */}
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                        <span
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-xs ${catInfo.lightBadge}`}
                        >
                          <span>{catInfo.icon}</span>
                          {catInfo.label}
                        </span>

                        <span className={`rounded-lg border px-2 py-0.5 text-[9px] font-black backdrop-blur-md ${audInfo.badge} bg-white/90 dark:bg-slate-900/90`}>
                          {audInfo.label}
                        </span>
                      </div>

                      {/* Thumbnail Image indicator if there are more figures */}
                      {article.images && article.images.length > 0 && (
                        <div className="absolute bottom-2.5 right-3 flex items-center gap-1 rounded-md bg-black/60 backdrop-blur-xs px-2 py-0.5 text-[10px] font-bold text-white">
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                            <circle cx="9" cy="9" r="2" />
                            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                          </svg>
                          <span>+{article.images.length}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Stylized Header if no image uploaded */
                    <div className="p-5 pb-0">
                      <div className="flex items-center justify-between gap-2 pb-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                            isDark ? catInfo.darkBadge : catInfo.lightBadge
                          }`}
                        >
                          <span>{catInfo.icon}</span>
                          {catInfo.label}
                        </span>

                        <span className={`rounded-md border px-2 py-0.5 text-[9px] font-bold ${audInfo.badge}`}>
                          {audInfo.label}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Content Container */}
                  <div className="p-5">
                    {/* Title */}
                    <h3
                      onClick={() => setActiveReaderArticle(article)}
                      className={`text-base font-black leading-snug cursor-pointer transition-colors line-clamp-2 ${
                        isDark ? "text-white group-hover:text-brand-teal" : "text-slate-900 group-hover:text-brand-teal"
                      }`}
                    >
                      {article.title}
                    </h3>

                    {/* Author Meta */}
                    <div className="mt-2.5 flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-teal/15 text-brand-teal text-xs font-black">
                        {article.authorName.replace(/^Dr\.\s*/i, "").charAt(0) || "D"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-black truncate ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                          {article.authorName}
                        </p>
                        <p className={`text-[10px] truncate ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          {article.authorSpecialty}
                        </p>
                      </div>
                    </div>

                    {/* Summary */}
                    <p className={`mt-3 text-xs leading-relaxed line-clamp-3 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                      {article.summary}
                    </p>

                    {/* Key Takeaways Preview */}
                    {article.keyTakeaways && article.keyTakeaways.length > 0 && (
                      <div
                        className={`mt-3.5 rounded-xl border p-2.5 text-[11px] space-y-1.5 ${
                          isDark ? "border-slate-800 bg-slate-950/70 text-slate-300" : "border-slate-100 bg-slate-50 text-slate-700"
                        }`}
                      >
                        <p className="text-[9px] font-black uppercase tracking-wider text-brand-teal">Key Takeaways:</p>
                        {article.keyTakeaways.slice(0, 2).map((takeaway, idx) => (
                          <div key={idx} className="flex items-start gap-1.5 line-clamp-1">
                            <span className="text-emerald-500 font-bold shrink-0">✓</span>
                            <span className="truncate">{takeaway}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Tags */}
                    {article.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {article.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className={`rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${
                              isDark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div
                  className="px-5 pb-4 pt-3 flex items-center justify-between border-t"
                  style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}
                >
                  <span className={`text-[10px] font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    {article.readTimeMinutes} min read • {new Date(article.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>

                  <div className="flex items-center gap-2">
                    {/* Like Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleLike(article.id)}
                      className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold transition ${
                        isLiked
                          ? "bg-rose-500/15 text-rose-500"
                          : isDark
                            ? "text-slate-400 hover:text-white"
                            : "text-slate-500 hover:text-slate-900"
                      }`}
                      title="Applaud / Recommend"
                    >
                      <svg className="h-3.5 w-3.5" fill={isLiked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                      <span className="text-[11px]">{article.likesCount}</span>
                    </button>

                    {/* Bookmark Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleBookmark(article.id)}
                      className={`rounded-lg p-1.5 text-xs transition ${
                        isBookmarked
                          ? "bg-amber-500/15 text-amber-500"
                          : isDark
                            ? "text-slate-400 hover:text-white"
                            : "text-slate-500 hover:text-slate-900"
                      }`}
                      title={isBookmarked ? "Bookmarked" : "Save for reference"}
                    >
                      <svg className="h-3.5 w-3.5" fill={isBookmarked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                      </svg>
                    </button>

                    {/* Read Full Article Button */}
                    <button
                      type="button"
                      onClick={() => setActiveReaderArticle(article)}
                      className="rounded-lg bg-brand-teal/10 px-2.5 py-1 text-xs font-black text-brand-teal hover:bg-brand-teal/20 transition"
                    >
                      Read
                    </button>

                    {/* Delete for own articles */}
                    {!article.isPeerArticle && (
                      <button
                        type="button"
                        onClick={() => handleDeleteArticle(article.id)}
                        className="rounded-lg p-1.5 text-xs text-slate-400 hover:text-rose-500 transition"
                        title="Delete publication"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ── ARTICLE COMPOSER MODAL ─────────────────────────────── */}
      {isComposerOpen && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-fadeIn">
          <div
            className={`relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl transition-all ${
              isDark ? "border-slate-800 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`flex items-center justify-between border-b p-6 ${isDark ? "border-slate-800" : "border-slate-100"}`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-brand-teal animate-pulse" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Knowledge Publication</p>
                </div>
                <h3 className="text-xl font-black mt-0.5">Publish New Article, Tip or Clinical Guide</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsComposerOpen(false)}
                className={`grid h-8 w-8 place-items-center rounded-full transition ${
                  isDark ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                ✕
              </button>
            </div>

            {/* Modal Scrollable Form */}
            <form onSubmit={handlePublishArticle} className="overflow-y-auto p-6 space-y-5 max-h-[calc(92vh-10rem)]">
              {/* Title */}
              <div>
                <label className={`block text-xs font-black uppercase tracking-wider mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Publication Title *
                </label>
                <input
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Managing Pediatric Fevers: Weight-Based Dosing and Red Flags"
                  className={`w-full rounded-xl border p-3 text-xs font-semibold outline-none transition ${
                    isDark ? "border-slate-700 bg-slate-950 text-white focus:border-brand-teal" : "border-slate-200 bg-slate-50 text-slate-900 focus:border-brand-teal"
                  }`}
                />
              </div>

              {/* ── THUMBNAIL UPLOAD SECTION ──────────────────────── */}
              <div className={`rounded-2xl border p-4.5 space-y-3 ${isDark ? "border-slate-800 bg-slate-950/70" : "border-slate-200 bg-slate-50/60"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <label className={`text-xs font-black uppercase tracking-wider ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                      Article Thumbnail / Cover Image
                    </label>
                    <p className={`text-[11px] font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      Upload a header image from your device or select a clinical preset.
                    </p>
                  </div>
                  {formThumbnail && (
                    <button
                      type="button"
                      onClick={() => setFormThumbnail("")}
                      className="text-[11px] font-black text-rose-500 hover:underline"
                    >
                      Remove Thumbnail
                    </button>
                  )}
                </div>

                {/* Hidden File Input for Thumbnail */}
                <input
                  type="file"
                  ref={thumbnailInputRef}
                  accept="image/*"
                  onChange={handleThumbnailFileChange}
                  className="hidden"
                />

                {formThumbnail ? (
                  <div className="relative h-44 w-full rounded-xl overflow-hidden border border-brand-teal/40 group">
                    <img src={formThumbnail} alt="Thumbnail Preview" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => thumbnailInputRef.current?.click()}
                        className="rounded-xl bg-white/90 px-4 py-2 text-xs font-black text-slate-900 shadow-lg hover:bg-white transition"
                      >
                        Change Image
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => thumbnailInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all hover:border-brand-teal ${
                      isDark ? "border-slate-700 bg-slate-900/50 hover:bg-slate-900" : "border-slate-300 bg-white hover:bg-teal-50/30"
                    }`}
                  >
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-brand-teal/15 text-brand-teal mb-2">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                        <circle cx="9" cy="9" r="2" />
                        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                      </svg>
                    </div>
                    <p className={`text-xs font-bold ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                      Click to upload cover thumbnail
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      PNG, JPG, WebP or GIF up to 6MB
                    </p>
                  </div>
                )}

                {/* Preset Themes Selector */}
                <div>
                  <p className={`text-[10px] font-black uppercase tracking-wider mb-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Or choose a medical theme preset:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {PRESET_THUMBNAILS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => setFormThumbnail(preset.url)}
                        className={`relative rounded-lg overflow-hidden border text-left p-1 transition-all ${
                          formThumbnail === preset.url
                            ? "border-brand-teal ring-2 ring-brand-teal"
                            : isDark
                              ? "border-slate-800 hover:border-slate-600"
                              : "border-slate-200 hover:border-slate-400"
                        }`}
                      >
                        <img src={preset.url} alt={preset.name} className="h-12 w-full object-cover rounded-md" />
                        <p className={`mt-1 text-[9px] font-bold truncate px-0.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                          {preset.name}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Category & Audience Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={`block text-xs font-black uppercase tracking-wider mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    Category Format
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as DoctorArticleCategory)}
                    className={`w-full rounded-xl border p-3 text-xs font-semibold outline-none transition ${
                      isDark ? "border-slate-700 bg-slate-950 text-white" : "border-slate-200 bg-slate-50 text-slate-900"
                    }`}
                  >
                    <option value="guide">🩺 Clinical Guide</option>
                    <option value="tip">💡 Health Tip</option>
                    <option value="research">🔬 Medical Research</option>
                    <option value="update">📝 Practice Update</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-black uppercase tracking-wider mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    Target Audience
                  </label>
                  <select
                    value={formAudience}
                    onChange={(e) => setFormAudience(e.target.value as any)}
                    className={`w-full rounded-xl border p-3 text-xs font-semibold outline-none transition ${
                      isDark ? "border-slate-700 bg-slate-950 text-white" : "border-slate-200 bg-slate-50 text-slate-900"
                    }`}
                  >
                    <option value="patients">Patients & Families</option>
                    <option value="physicians">Physicians & Peers</option>
                    <option value="general">General Healthcare</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-black uppercase tracking-wider mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    Read Time (Mins)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={formReadTime}
                    onChange={(e) => setFormReadTime(e.target.value)}
                    className={`w-full rounded-xl border p-3 text-xs font-semibold outline-none transition ${
                      isDark ? "border-slate-700 bg-slate-950 text-white" : "border-slate-200 bg-slate-50 text-slate-900"
                    }`}
                  />
                </div>
              </div>

              {/* Brief Excerpt / Summary */}
              <div>
                <label className={`block text-xs font-black uppercase tracking-wider mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Short Summary / Abstract
                </label>
                <input
                  value={formSummary}
                  onChange={(e) => setFormSummary(e.target.value)}
                  placeholder="A one-sentence overview displayed on article cards in the feed..."
                  className={`w-full rounded-xl border p-3 text-xs font-semibold outline-none transition ${
                    isDark ? "border-slate-700 bg-slate-950 text-white focus:border-brand-teal" : "border-slate-200 bg-slate-50 text-slate-900 focus:border-brand-teal"
                  }`}
                />
              </div>

              {/* Key Takeaways Builder */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={`text-xs font-black uppercase tracking-wider ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    Key Clinical Takeaways (Bulleted Highlights)
                  </label>
                  <button
                    type="button"
                    onClick={() => setTakeawayInputs((prev) => [...prev, ""])}
                    className="text-[11px] font-black text-brand-teal hover:underline"
                  >
                    + Add Takeaway
                  </button>
                </div>
                <div className="space-y-2">
                  {takeawayInputs.map((inputVal, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="text-emerald-500 font-bold text-xs">✓</span>
                      <input
                        value={inputVal}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTakeawayInputs((prev) => prev.map((item, i) => (i === index ? val : item)));
                        }}
                        placeholder={`Takeaway #${index + 1}...`}
                        className={`flex-1 rounded-xl border p-2.5 text-xs font-semibold outline-none transition ${
                          isDark ? "border-slate-700 bg-slate-950 text-white" : "border-slate-200 bg-slate-50 text-slate-900"
                        }`}
                      />
                      {takeawayInputs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setTakeawayInputs((prev) => prev.filter((_, i) => i !== index))}
                          className="text-xs text-slate-400 hover:text-rose-500"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── ADDITIONAL FIGURES / DIAGRAMS SECTION ───────────── */}
              <div className={`rounded-2xl border p-4.5 space-y-3 ${isDark ? "border-slate-800 bg-slate-950/70" : "border-slate-200 bg-slate-50/60"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <label className={`text-xs font-black uppercase tracking-wider ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                      Article Figures, Charts & Infographics
                    </label>
                    <p className={`text-[11px] font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      Upload clinical diagrams, lab charts, or patient education illustrations.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => articleImagesInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg bg-brand-teal/15 px-3 py-1.5 text-xs font-black text-brand-teal hover:bg-brand-teal/25 transition"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Upload Figure
                  </button>
                </div>

                {/* Hidden File Input for Multiple Article Images */}
                <input
                  type="file"
                  ref={articleImagesInputRef}
                  accept="image/*"
                  multiple
                  onChange={handleArticleImagesFileChange}
                  className="hidden"
                />

                {formImages.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {formImages.map((img, idx) => (
                      <div
                        key={img.id}
                        className={`rounded-xl border p-2.5 flex items-start gap-3 ${
                          isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
                        }`}
                      >
                        <img src={img.url} alt="Figure" className="h-16 w-16 shrink-0 object-cover rounded-lg border border-slate-700/30" />
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <input
                            type="text"
                            value={img.caption || ""}
                            onChange={(e) => {
                              const newCaption = e.target.value;
                              setFormImages((prev) =>
                                prev.map((item) => (item.id === img.id ? { ...item, caption: newCaption } : item))
                              );
                            }}
                            placeholder="Figure caption..."
                            className={`w-full rounded-md border px-2 py-1 text-[11px] font-semibold outline-none ${
                              isDark ? "border-slate-700 bg-slate-950 text-white" : "border-slate-200 bg-slate-50 text-slate-900"
                            }`}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleInsertImageIntoContent(img.url, img.caption)}
                              className="text-[10px] font-black text-brand-teal hover:underline"
                            >
                              + Insert in Content
                            </button>
                            <span className="text-slate-400 text-[10px]">•</span>
                            <button
                              type="button"
                              onClick={() => setFormImages((prev) => prev.filter((item) => item.id !== img.id))}
                              className="text-[10px] font-bold text-rose-500 hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">
                    No figures attached yet. Click &quot;Upload Figure&quot; to add charts or medical illustrations.
                  </p>
                )}
              </div>

              {/* Main Content */}
              <div>
                <label className={`block text-xs font-black uppercase tracking-wider mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Full Guide / Article Content *
                </label>
                <textarea
                  required
                  rows={8}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Provide clinical steps, detailed dietary advice, or study methodology. You can use markdown headings (###) and bullet points (-)..."
                  className={`w-full rounded-xl border p-3 text-xs font-semibold outline-none leading-relaxed transition ${
                    isDark ? "border-slate-700 bg-slate-950 text-white focus:border-brand-teal" : "border-slate-200 bg-slate-50 text-slate-900 focus:border-brand-teal"
                  }`}
                />
              </div>

              {/* Tags */}
              <div>
                <label className={`block text-xs font-black uppercase tracking-wider mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Medical Tags / Topics (comma-separated)
                </label>
                <input
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="Cardiology, Hypertension, Diet, Wellness"
                  className={`w-full rounded-xl border p-3 text-xs font-semibold outline-none transition ${
                    isDark ? "border-slate-700 bg-slate-950 text-white focus:border-brand-teal" : "border-slate-200 bg-slate-50 text-slate-900 focus:border-brand-teal"
                  }`}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
                <button
                  type="button"
                  onClick={() => setIsComposerOpen(false)}
                  className={`rounded-xl px-4 py-2.5 text-xs font-black transition ${
                    isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-brand-teal px-6 py-2.5 text-xs font-black text-white shadow-md hover:bg-teal-600 transition"
                >
                  Publish to Knowledge Hub
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── FULL ARTICLE READER MODAL ──────────────────────────── */}
      {activeReaderArticle && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-fadeIn">
          <div
            className={`relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl transition-all ${
              isDark ? "border-slate-800 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Reader Header */}
            <div className={`flex items-start justify-between border-b p-6 ${isDark ? "border-slate-800" : "border-slate-100"}`}>
              <div className="space-y-1.5 max-w-[85%]">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                      isDark ? CATEGORY_META[activeReaderArticle.category].darkBadge : CATEGORY_META[activeReaderArticle.category].lightBadge
                    }`}
                  >
                    <span>{CATEGORY_META[activeReaderArticle.category].icon}</span>
                    {CATEGORY_META[activeReaderArticle.category].label}
                  </span>
                  <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${AUDIENCE_META[activeReaderArticle.targetAudience].badge}`}>
                    {AUDIENCE_META[activeReaderArticle.targetAudience].label}
                  </span>
                </div>

                <h2 className="text-xl font-black leading-snug">{activeReaderArticle.title}</h2>
              </div>

              <button
                type="button"
                onClick={() => setActiveReaderArticle(null)}
                className={`grid h-8 w-8 place-items-center rounded-full transition ${
                  isDark ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                ✕
              </button>
            </div>

            {/* Reader Body */}
            <div className="overflow-y-auto p-6 space-y-5 max-h-[calc(92vh-12rem)]">
              {/* Cover Banner if present */}
              {activeReaderArticle.thumbnailUrl && (
                <div className="relative h-56 sm:h-72 w-full rounded-2xl overflow-hidden border border-slate-700/20 shadow-xs">
                  <img
                    src={activeReaderArticle.thumbnailUrl}
                    alt={activeReaderArticle.title}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}

              {/* Author Strip */}
              <div
                className={`rounded-2xl border p-4 flex items-center justify-between ${
                  isDark ? "border-slate-800 bg-slate-950/80" : "border-slate-100 bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-teal/20 text-brand-teal text-sm font-black">
                    {activeReaderArticle.authorName.replace(/^Dr\.\s*/i, "").charAt(0) || "D"}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className={`text-sm font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                        {activeReaderArticle.authorName}
                      </p>
                      <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand-teal text-white text-[8px] font-black">
                        ✓
                      </span>
                    </div>
                    <p className={`text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      {activeReaderArticle.authorSpecialty}
                      {activeReaderArticle.authorNpi && ` • NPI: ${activeReaderArticle.authorNpi}`}
                    </p>
                  </div>
                </div>

                <div className="text-right text-[11px] font-semibold text-slate-400">
                  <p>{activeReaderArticle.readTimeMinutes} min read</p>
                  <p>{new Date(activeReaderArticle.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                </div>
              </div>

              {/* Key Takeaways Callout Box */}
              {activeReaderArticle.keyTakeaways && activeReaderArticle.keyTakeaways.length > 0 && (
                <div
                  className={`rounded-2xl border p-4.5 space-y-2.5 ${
                    isDark ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200" : "border-emerald-200 bg-emerald-50/80 text-emerald-950"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Key Clinical Recommendations & Takeaways
                    </p>
                  </div>
                  <ul className="space-y-1.5 text-xs font-semibold">
                    {activeReaderArticle.keyTakeaways.map((takeaway, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-500 font-bold shrink-0 mt-0.5">✓</span>
                        <span>{takeaway}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Formatted Content with Markdown & Inline Images */}
              <div
                className={`text-sm leading-relaxed space-y-4 whitespace-pre-line ${
                  isDark ? "text-slate-200" : "text-slate-800"
                }`}
              >
                {activeReaderArticle.content}
              </div>

              {/* Attached Clinical Figures / Diagram Gallery in Reader */}
              {activeReaderArticle.images && activeReaderArticle.images.length > 0 && (
                <div className={`rounded-2xl border p-4.5 space-y-3 ${isDark ? "border-slate-800 bg-slate-950/70" : "border-slate-200 bg-slate-50/80"}`}>
                  <p className="text-xs font-black uppercase tracking-wider text-brand-teal">
                    Attached Clinical Figures & Charts ({activeReaderArticle.images.length})
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {activeReaderArticle.images.map((fig, i) => (
                      <div key={fig.id || i} className="space-y-1.5">
                        <div className="h-44 w-full rounded-xl overflow-hidden border border-slate-700/20 bg-black/10">
                          <img src={fig.url} alt={fig.caption || `Figure ${i + 1}`} className="h-full w-full object-cover hover:scale-105 transition-transform duration-200" />
                        </div>
                        {fig.caption && (
                          <p className={`text-[11px] font-semibold italic ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                            {fig.caption}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags Strip */}
              {activeReaderArticle.tags.length > 0 && (
                <div className="pt-4 border-t flex flex-wrap items-center gap-2" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
                  <span className="text-xs font-black uppercase text-slate-400">Tags:</span>
                  {activeReaderArticle.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`rounded-lg px-2 py-1 text-xs font-bold ${
                        isDark ? "bg-slate-800 text-brand-teal" : "bg-teal-50 text-teal-700"
                      }`}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Reader Footer Actions */}
            <div
              className={`flex items-center justify-between border-t p-4 ${isDark ? "border-slate-800 bg-slate-950/60" : "border-slate-100 bg-slate-50/80"}`}
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleToggleLike(activeReaderArticle.id)}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    likedArticles[activeReaderArticle.id]
                      ? "bg-rose-500/20 text-rose-500"
                      : isDark
                        ? "bg-slate-800 text-slate-300 hover:text-white"
                        : "bg-white text-slate-700 hover:text-slate-900 border"
                  }`}
                >
                  <svg className="h-4 w-4" fill={likedArticles[activeReaderArticle.id] ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                  Applaud ({activeReaderArticle.likesCount})
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleBookmark(activeReaderArticle.id)}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    bookmarkedArticles[activeReaderArticle.id]
                      ? "bg-amber-500/20 text-amber-500"
                      : isDark
                        ? "bg-slate-800 text-slate-300 hover:text-white"
                        : "bg-white text-slate-700 hover:text-slate-900 border"
                  }`}
                >
                  <svg className="h-4 w-4" fill={bookmarkedArticles[activeReaderArticle.id] ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  </svg>
                  {bookmarkedArticles[activeReaderArticle.id] ? "Saved" : "Save for Reference"}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setActiveReaderArticle(null)}
                className="rounded-xl bg-brand-teal px-5 py-2 text-xs font-black text-white hover:bg-teal-600 transition"
              >
                Close Reader
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
