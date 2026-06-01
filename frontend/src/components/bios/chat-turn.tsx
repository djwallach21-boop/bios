import { BiosMark } from "./bios-mark";
import { ResultView } from "./result-view";
import { ShareRow } from "./share-row";
import { StageList } from "./stage-list";
import type { ChatMessage } from "@/lib/types";

// Bubble-free transcript turns. User prompts get a left rule; assistant turns
// lead with a Dna glyph, stream prose with a caret, and show real stage
// progress until the result card mounts.
export function ChatTurn({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="border-l-2 border-foreground/20 pl-4">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          You
        </span>
        <p className="mt-1 whitespace-pre-wrap text-[15px] text-foreground">
          {message.content}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <BiosMark className="size-3.5 text-muted-foreground" />
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          BiOS
        </span>
      </div>

      <div className="mt-2" aria-live="polite" aria-atomic="false">
        {message.status === "streaming" && (
          <div>
            <span className="sr-only">
              {message.stream.stages.find((s) => s.status === "active")?.label ??
                "Designing"}
            </span>
            {message.stream.text && (
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
                {message.stream.text}
                <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] bg-confidence-high align-middle motion-safe:animate-pulse" />
              </p>
            )}
            <div className={message.stream.text ? "mt-5" : ""}>
              <StageList stages={message.stream.stages} />
            </div>
          </div>
        )}

        {message.status === "error" && (
          <p
            role="alert"
            aria-live="assertive"
            className="text-[14px] leading-relaxed text-destructive"
          >
            {message.message}
          </p>
        )}

        {message.status === "done" && (
          <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
            <span className="sr-only">Design complete.</span>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
              {message.result.explanation}
            </p>
            <div className="mt-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
              <ResultView result={message.result} />
            </div>
            {message.designId && <ShareRow designId={message.designId} />}
          </div>
        )}
      </div>
    </div>
  );
}
