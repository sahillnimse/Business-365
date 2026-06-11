export function MicrosoftLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

export function MicrosoftSignInButton({
  onClick,
  disabled,
  label = "Sign in with Microsoft",
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-md border border-[#8c8c8c]/40 bg-white px-4 text-sm font-semibold text-[#5e5e5e] shadow-sm transition-all hover:bg-[#f8f8f8] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-accent"
    >
      <MicrosoftLogo />
      <span>{label}</span>
    </button>
  );
}
