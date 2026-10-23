import { BrandAvatar } from "@/components/ig/Avatar";

/** Script wordmark, the IG Wrapped answer to Instagram's logotype. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`select-none whitespace-nowrap font-logo font-normal leading-none tracking-normal ${className}`}
    >
      IG Wrapped
    </span>
  );
}

/** Compact mark for the icon-only sidebar. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return <BrandAvatar size={size} className="rounded-[9px]" />;
}

export const NOT_AFFILIATED =
  "IG Wrapped is an independent project — not affiliated with Instagram or Meta.";
