type TabButtonTone = "light" | "dark";

type TabButtonClassNameOptions = {
  active: boolean;
  tone?: TabButtonTone;
};

const TAB_BUTTON_BASE =
  "inline-flex h-10 min-w-[6.75rem] flex-none items-center justify-center rounded-full border px-4 text-[10px] font-black uppercase tracking-[0.16em] leading-none whitespace-nowrap transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30 sm:min-w-[7.5rem]";

export function getTabButtonClassName({ active, tone = "light" }: TabButtonClassNameOptions) {
  const variant =
    tone === "dark"
      ? active
        ? "border-brand-teal bg-brand-teal text-white"
        : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200"
      : active
        ? "border-brand-teal bg-brand-teal text-white"
        : "border-slate-200 bg-slate-100 text-slate-500 hover:border-brand-teal/40 hover:text-slate-700";

  return `${TAB_BUTTON_BASE} ${variant}`;
}
