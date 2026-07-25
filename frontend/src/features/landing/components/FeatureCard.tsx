import { cn } from "@/lib/utils";

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
  return (
    <div className={cn("feature-card", variant === "dark" ? "feature-card--dark" : "feature-card--light")}>
      <div className="feature-card__body">
        <div className={cn("feature-card__eyebrow", variant === "light" && "feature-card__eyebrow--light")}>
          {eyebrow}
        </div>
        {children}
      </div>
      <div>
        <div className={cn("feature-card__title", variant === "light" && "feature-card__title--light")}>
          {title}
        </div>
        <div className={cn("feature-card__sub", variant === "light" && "feature-card__sub--light")}>
          {subtitle}
        </div>
      </div>
    </div>
  );
}
