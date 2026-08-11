import Image from "next/image";

export type LogoVariant = "mark" | "horizontal";
export type LogoTheme = "light" | "dark";

interface WarehouseLensLogoProps {
  /** "mark" = icon only, "horizontal" = icon + wordmark */
  variant?: LogoVariant;
  /** "light" = for light backgrounds, "dark" = for dark backgrounds */
  theme?: LogoTheme;
  /** Size in pixels. For "mark" this is both width and height. For "horizontal" this is height (width scales proportionally). */
  size?: number;
  className?: string;
}

/**
 * WarehouseLens brand logo component.
 *
 * @example
 * // Sidebar icon (32px square)
 * <WarehouseLensLogo variant="mark" size={32} />
 *
 * // Header logo (40px tall, proportional width)
 * <WarehouseLensLogo variant="horizontal" size={40} />
 *
 * // Dark background version
 * <WarehouseLensLogo variant="horizontal" theme="dark" size={40} />
 */
export function WarehouseLensLogo({
  variant = "mark",
  theme = "light",
  size = 32,
  className,
}: WarehouseLensLogoProps) {
  const src =
    variant === "mark"
      ? theme === "dark"
        ? "/brand/warehouse-lens/logo-mark-dark.svg"
        : "/brand/warehouse-lens/logo-mark.svg"
      : theme === "dark"
        ? "/brand/warehouse-lens/logo-dark.svg"
        : "/brand/warehouse-lens/logo.svg";

  // Horizontal logo has 5:1 aspect ratio (200x40)
  const width = variant === "horizontal" ? size * 5 : size;
  const height = size;

  return (
    <Image
      src={src}
      alt="WarehouseLens"
      width={width}
      height={height}
      className={className}
      priority
    />
  );
}
