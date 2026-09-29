type TabButtonTone = "light" | "dark";

type TabButtonClassNameOptions = {
  active: boolean;
  tone?: TabButtonTone;
};

const TAB_BUTTON_BASE =
  "inline-flex h-9 min-w-[5.5rem] flex-none shrink-0 items-center justify-center rounded-full border px-3.5 text-[10px] sm:text-[11px] font-extrabold uppercase tracking-[0.12em] leading-none whitespace-nowrap transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30 sm:min-w-[7.5rem]";

export function getTabButtonClassName({ active, tone = "light" }: TabButtonClassNameOptions) {
  const variant =
    tone === "dark"
      ? active
        ? "border-brand-teal bg-brand-teal text-white shadow-sm shadow-brand-teal/20"
        : "border-slate-800 bg-slate-900/90 text-slate-400 hover:border-slate-700 hover:text-slate-200"
      : active
        ? "border-brand-teal bg-brand-teal text-white shadow-sm shadow-brand-teal/20"
        : "border-slate-200 bg-slate-100/90 text-slate-600 hover:border-brand-teal/40 hover:text-slate-900";

  return `${TAB_BUTTON_BASE} ${variant}`;
}

export const TAB_CONTAINER_CLASS =
  "flex w-full items-center gap-1.5 overflow-x-auto no-scrollbar pb-1.5 pt-0.5 sm:gap-2";

