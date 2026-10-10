import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-navy text-white border-navy hover:bg-strong-muted",
  secondary: "bg-transparent text-navy border-navy hover:bg-blue-tint",
  ghost: "bg-transparent text-navy border-line hover:bg-blue-tint",
};

// No horizontal padding here: text buttons add px-4, icon buttons add none.
// cn() does not merge conflicting utilities, so a px-4 in the base would win
// over an icon button's px-0 and squeeze the icon.
const buttonBaseClasses =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border-2 text-sm font-semibold whitespace-nowrap transition-colors duration-150 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-light disabled:cursor-not-allowed disabled:opacity-50";

export function buttonClasses(
  variant: ButtonVariant = "secondary",
  className?: string,
): string {
  return cn(buttonBaseClasses, "px-4", VARIANT_CLASSES[variant], className);
}

export function Button({
  variant = "secondary",
  className,
  type = "button",
  ...rest
}: {
  variant?: ButtonVariant;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, className)}
      {...rest}
    />
  );
}

export function IconButton({
  className,
  variant = "ghost",
  "aria-label": ariaLabel,
  ...rest
}: {
  variant?: ButtonVariant;
  "aria-label": string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={cn(
        buttonBaseClasses,
        VARIANT_CLASSES[variant],
        "h-11 w-11 shrink-0",
        className,
      )}
      {...rest}
    />
  );
}
