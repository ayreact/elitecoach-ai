import logoUrl from "@/assets/logo.png";

export function Logo({
  size = 32,
  showWordmark = true,
  variant = "dark",
}: {
  size?: number;
  showWordmark?: boolean;
  variant?: "dark" | "light";
}) {
  const wordmarkColor = variant === "dark" ? "text-text-primary" : "text-white";
  return (
    <span className="inline-flex items-center gap-2.5">
      <img
        src={logoUrl}
        alt="EliteCoach logo"
        width={size}
        height={size}
        className="block object-contain"
        style={{ height: size, width: size }}
      />
      {showWordmark && (
        <span className={`text-lg font-bold tracking-tight ${wordmarkColor}`}>
          EliteCoach
        </span>
      )}
    </span>
  );
}
