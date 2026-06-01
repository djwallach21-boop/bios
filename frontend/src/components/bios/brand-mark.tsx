import { BiosMark } from "./bios-mark";

// The centered hero lockup: custom glyph + wordmark + one-line tagline.
export function BrandMark() {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex items-center gap-2.5">
        <BiosMark className="size-8 text-foreground" />
        <span className="text-[34px] font-semibold tracking-[-0.03em] text-foreground">
          BiOS
        </span>
      </div>
      <p className="mt-3 text-body-lg text-muted-foreground">
        Design biology in plain language.
      </p>
    </div>
  );
}
