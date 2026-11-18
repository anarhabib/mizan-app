export function BrandMark({
  variant = "dark",
  className = "",
}: {
  variant?: "dark" | "light";
  className?: string;
}) {
  return (
    <span
      className={`inline-grid size-7.75 shrink-0 place-items-center rounded-[10px] min-[761px]:size-9.75 ${variant === "dark" ? "bg-mizan-deep text-mizan-pale [--mizan-mark-pivot:var(--color-mizan-edge)]" : "bg-mizan-pale text-mizan-deep [--mizan-mark-pivot:var(--color-mizan-accent)]"} ${className}`}
    >
      <svg
        viewBox="0 0 256 256"
        aria-hidden="true"
        className="size-6 min-[761px]:size-7.5"
      >
        <g transform="translate(0 24)">
          <path
            fill="currentColor"
            d="M62 50h56a21 21 0 0 1 21 21v0a21 21 0 0 1-21 21H62a21 21 0 0 1-21-21v0a21 21 0 0 1 21-21zM138 50h56a21 21 0 0 1 21 21v0a21 21 0 0 1-21 21h-56a21 21 0 0 1-21-21v0a21 21 0 0 1 21-21zM20 120h216v16H20z"
          />
          <path
            fill="var(--mizan-mark-pivot)"
            d="M128 97 159 128 128 159 97 128z"
          />
        </g>
      </svg>
    </span>
  );
}
