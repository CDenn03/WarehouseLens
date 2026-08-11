interface FeatureCardProps {
  variant?: "dark" | "light";
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export default function FeatureCard({
  variant = "dark",
  eyebrow,
  title,
  subtitle,
  children,
}: FeatureCardProps) {
  const isDark = variant === "dark";

  return (
    <div
      className={`flex flex-col justify-between rounded-2xl border p-5 ${
        isDark
          ? "border-white/10 bg-[var(--forest)]"
          : "border-[var(--line)] bg-[var(--bg-alt)]"
      }`}
    >
      <div className="mb-4">
        <p
          className={`mb-3 text-[10px] font-medium uppercase tracking-wider ${
            isDark ? "text-white/40" : "text-[var(--ink-mute)]"
          }`}
        >
          {eyebrow}
        </p>
        {children}
      </div>
      <div>
        <p className={`font-medium ${isDark ? "text-white" : "text-[var(--ink)]"}`}>
          {title}
        </p>
        <p className={`text-sm ${isDark ? "text-white/50" : "text-[var(--ink-mute)]"}`}>
          {subtitle}
        </p>
      </div>
    </div>
  );
}
