import { BiosMark } from "./bios-mark";

// The centered hero lockup: custom glyph + wordmark + one-line tagline.
export function BrandMark() {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex items-center gap-3 [perspective:500px]">
        <BiosMark className="helix-live size-11 text-foreground" />
        <span className="text-[40px] font-semibold leading-none tracking-[-0.04em] text-foreground">
          BiOS
        </span>
      </div>
      <p className="mt-4 text-body-lg text-muted-foreground">
        Design biology in plain English.
      </p>
    </div>
  );
}
