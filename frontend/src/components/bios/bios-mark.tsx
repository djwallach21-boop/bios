// The BiOS mark: a custom geometric double-helix. Two strands that cross at
// center with base-pair rungs, drawn on a single stroke so it stays crisp from
// 16px (favicon) to hero size. Uses currentColor so it inherits text color.
export function BiosMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 2.5 C 18 6, 18 9.5, 12 12 C 6 14.5, 6 18, 12 21.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M12 2.5 C 6 6, 6 9.5, 12 12 C 18 14.5, 18 18, 12 21.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <line
        x1="9"
        y1="6.6"
        x2="15"
        y2="6.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />
      <line
        x1="9"
        y1="17.4"
        x2="15"
        y2="17.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}
