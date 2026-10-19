import Image from "next/image";

export type LogoVariant = "mark" | "horizontal";
export type LogoTheme = "light" | "dark";

interface WarehouseLensLogoProps {
  /** Mark = compact navigation icon; horizontal = default wordmark. */
  variant?: LogoVariant;
  /** Light is for ivory or white surfaces; dark is for forest surfaces. */
  theme?: LogoTheme;
  /** Mark height in pixels. Horizontal assets are kept at the kit minimum width. */
  size?: number;
  className?: string;
}

export function WarehouseLensLogo({
  variant = "mark",
  theme = "light",
  size = 32,
  className,
}: WarehouseLensLogoProps) {
  const colorVariant = theme === "dark" ? "reverse" : "primary";
  const microSize = size <= 16 ? 16 : size <= 32 ? 32 : 48;
  const src =
    variant === "mark"
      ? `/brand/icons/icon-${theme === "dark" ? "dark" : "light"}-${microSize}.png`
      : `/brand/logos/svg/warehouselens-horizontal-${colorVariant}.svg`;
  const width = variant === "horizontal" ? Math.max(180, Math.round(size * 5.6)) : size;

  return (
    <Image
      src={src}
      alt="WarehouseLens"
      width={width}
      height={size}
      className={className}
      priority
    />
  );
}
