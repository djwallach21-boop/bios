"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PanelLeft, Plus } from "lucide-react";
import { BrandMark } from "@/components/bios/brand-mark";
import { ChatComposer, type ComposerHandle } from "@/components/bios/chat-composer";
import { ChatTurn } from "@/components/bios/chat-turn";
import { Sidebar } from "@/components/bios/sidebar";
import { SuggestionChips } from "@/components/bios/suggestion-chips";
import { StructureViewer } from "@/components/bios/structure-viewer";
import { HERO_PDB } from "@/lib/hero-pdb";
import { streamDesign } from "@/lib/api";
import type { ChatMessage } from "@/lib/types";
import {
  loadThreads,
  saveThreads,
  titleFrom,
  type Thread,
} from "@/lib/threads";

let counter = 0;
const nextId = () => `m${++counter}`;

function shortTitle(targetFunction: string): string {
  const clause = targetFunction.split(/[,;.]/)[0] ?? targetFunction;
  const t = titleFrom(clause);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export default function Home() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  const mainRef = useRef<HTMLElement>(null);
  const composerRef = useRef<ComposerHandle>(null);
  const nearBottomRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const bufRef = useRef("");
  const parentRef = useRef<string | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const openBtnRef = useRef<HTMLButtonElement>(null);

  // Load persisted threads on mount; start with the drawer closed on phones.
  useEffect(() => {
    setThreads(loadThreads());
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, []);

  // Fork: /?intent=...&parent=<id> prefills the composer and records lineage.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const forkIntent = p.get("intent");
    const parent = p.get("parent");
    if (forkIntent) setInput(forkIntent);
    if (parent) parentRef.current = parent;
    if (forkIntent || parent) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  // Auto-scroll only when already near the bottom (no hijack mid-stream).
  useEffect(() => {
    const el = mainRef.current;
    if (el && nearBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Persist the active thread once the transcript has settled.
  useEffect(() => {
    if (!activeId || messages.length === 0) return;
    const streaming = messages.some(
      (m) => m.role === "assistant" && m.status === "streaming"
    );
    if (streaming) return;
    setThreads((prev) => {
      const next = prev.map((t) =>
        t.id === activeId ? { ...t, messages, updatedAt: Date.now() } : t
      );
      saveThreads(next);
      return next;
    });
  }, [messages, activeId]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  // Track the mobile breakpoint so the drawer is a focus-trapping modal on
  // phones but a static, non-modal rail on desktop.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Move focus into the drawer when it opens on mobile; restore it to the
  // trigger when it closes.
  useEffect(() => {
    if (!isMobile) return;
    if (sidebarOpen) {
      const first = drawerRef.current?.querySelector<HTMLElement>(
        'button, [href], input, [tabindex]:not([tabindex="-1"])'
      );
      first?.focus();
    } else {
      openBtnRef.current?.focus();
    }
  }, [sidebarOpen, isMobile]);

  // Keyboard: Cmd/Ctrl+K focuses the composer; Esc closes the mobile drawer if
  // open, else stops a running design.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        composerRef.current?.focus();
      } else if (e.key === "Escape" && sidebarOpen && isMobile) {
        setSidebarOpen(false);
      } else if (e.key === "Escape" && busy) {
        stop();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, stop, sidebarOpen, isMobile]);

  // Trap Tab within the drawer while it is a modal (mobile only).
  function trapTab(e: React.KeyboardEvent) {
    if (e.key !== "Tab" || !isMobile) return;
    const focusables = drawerRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function onScroll() {
    const el = mainRef.current;
    if (!el) return;
    nearBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 140;
  }

  async function send() {
    const intent = input.trim();
    if (!intent || busy) return;

    const userMsg: ChatMessage = { id: nextId(), role: "user", content: intent };
    const botId = nextId();
    const botMsg: ChatMessage = {
      id: botId,
      role: "assistant",
      status: "streaming",
      stream: { stages: [], text: "", modality: null },
    };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInput("");
    setBusy(true);
    nearBottomRef.current = true;

    // Ensure a thread exists (create on first message of a fresh design).
    let threadId = activeId;
    if (!threadId) {
      threadId = `t${Date.now()}-${counter}`;
      setActiveId(threadId);
      setThreads((prev) => [
        {
          id: threadId as string,
          title: titleFrom(intent),
          messages: [userMsg],
          updatedAt: Date.now(),
        },
        ...prev,
      ]);
    }

    const controller = new AbortController();
    abortRef.current = controller;
    bufRef.current = "";
    let savedId: string | undefined;

    const flush = () => {
      if (!bufRef.current) return;
      const chunk = bufRef.current;
      bufRef.current = "";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botId && m.role === "assistant" && m.status === "streaming"
            ? { ...m, stream: { ...m.stream, text: m.stream.text + chunk } }
            : m
        )
      );
    };
    const timer = window.setInterval(flush, 50);

    const patchStream = (
      fn: (s: import("@/lib/types").StreamState) => import("@/lib/types").StreamState
    ) =>
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botId && m.role === "assistant" && m.status === "streaming"
            ? { ...m, stream: fn(m.stream) }
            : m
        )
      );

    try {
      await streamDesign(
      intent,
      {
        onRoute: (modality) => patchStream((s) => ({ ...s, modality })),
        onStages: (stages) =>
          patchStream((s) => ({
            ...s,
            stages: stages.map((st) => ({ ...st, status: "pending" as const })),
          })),
        onStage: (id, status) =>
          patchStream((s) => ({
            ...s,
            stages: s.stages.map((st) =>
              st.id === id ? { ...st, status } : st
            ),
          })),
        onToken: (text) => {
          bufRef.current += text;
        },
        onSaved: (id) => {
          savedId = id;
        },
        onResult: (result) => {
          flush();
          setMessages((prev) =>
            prev.map((m) =>
              m.id === botId
                ? {
                    id: botId,
                    role: "assistant",
                    status: "done",
                    result,
                    designId: savedId,
                  }
                : m
            )
          );
          const fn = result.parsed?.targetFunction;
          if (fn) {
            setThreads((prev) =>
              prev.map((t) =>
                t.id === threadId ? { ...t, title: shortTitle(fn) } : t
              )
            );
          }
        },
        onError: (message) => {
          flush();
          setMessages((prev) =>
            prev.map((m) =>
              m.id === botId
                ? { id: botId, role: "assistant", status: "error", message }
                : m
            )
          );
        },
      },
      controller.signal,
      parentRef.current
      );
    } finally {
      // The lineage edge is recorded once; subsequent designs are not forks.
      parentRef.current = null;
      window.clearInterval(timer);
      flush();
      if (controller.signal.aborted) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botId && m.role === "assistant" && m.status === "streaming"
              ? { id: botId, role: "assistant", status: "error", message: "Generation stopped." }
              : m
          )
        );
      }
      abortRef.current = null;
      setBusy(false);
    }
  }

  function newDesign() {
    if (busy) return;
    setActiveId(null);
    setMessages([]);
    setInput("");
    composerRef.current?.focus();
  }

  function selectThread(id: string) {
    if (busy) return;
    const t = threads.find((x) => x.id === id);
    if (!t) return;
    setActiveId(id);
    setMessages(t.messages);
    setInput("");
  }

  function deleteThread(id: string) {
    setThreads((prev) => {
      const next = prev.filter((t) => t.id !== id);
      saveThreads(next);
      return next;
    });
    if (id === activeId) {
      setActiveId(null);
      setMessages([]);
    }
  }

  const empty = messages.length === 0;
  const ordered = [...threads].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="flex h-[100dvh]">
      {sidebarOpen && (
        <>
          {/* Mobile: dim backdrop that closes the drawer on tap. */}
          <div
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Off-canvas drawer on mobile, static rail on desktop. */}
          <div
            ref={drawerRef}
            onKeyDown={trapTab}
            role={isMobile ? "dialog" : undefined}
            aria-modal={isMobile ? true : undefined}
            aria-label={isMobile ? "Design history" : undefined}
            className="fixed inset-y-0 left-0 z-40 md:static md:z-auto"
          >
            <Sidebar
              threads={ordered}
              activeId={activeId}
              onSelect={(id) => {
                selectThread(id);
                if (window.innerWidth < 768) setSidebarOpen(false);
              }}
              onNew={() => {
                newDesign();
                if (window.innerWidth < 768) setSidebarOpen(false);
              }}
              onDelete={deleteThread}
              onCollapse={() => setSidebarOpen(false)}
            />
          </div>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between px-4">
          <div className="flex items-center gap-1">
            {!sidebarOpen && (
              <>
                <button
                  ref={openBtnRef}
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Open sidebar"
                  className="press flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                >
                  <PanelLeft className="size-4" />
                </button>
                <button
                  onClick={newDesign}
                  aria-label="New design"
                  className="press flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                >
                  <Plus className="size-4" />
                </button>
              </>
            )}
          </div>
          <a
            href="https://github.com/djwallach21-boop/bios"
            target="_blank"
            rel="noopener noreferrer"
            className="press rounded-full bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            GitHub
          </a>
        </header>

        {empty ? (
          <>
            <main className="relative flex flex-1 flex-col items-center justify-center px-6">
              {/* Signature hero: a live, pLDDT-colored protein structure drifting
                  on a transparent canvas behind the composer. Strongest at the
                  periphery, dissolves behind the wordmark via a radial mask, and
                  unmounts the instant a design starts. */}
              <div className="pointer-events-none absolute inset-0 scale-125 opacity-[0.3] motion-reduce:opacity-[0.16] [mask-image:radial-gradient(70%_60%_at_50%_45%,black,transparent)] [-webkit-mask-image:radial-gradient(70%_60%_at_50%_45%,black,transparent)]">
                <StructureViewer ambient pdb={HERO_PDB} />
              </div>
              <div className="hero-vignette pointer-events-none absolute inset-0" />
              <div className="relative w-full max-w-[680px]">
                <div className="hero-enter">
                  <BrandMark />
                </div>
                <div className="hero-enter mt-9" style={{ animationDelay: "140ms" }}>
                  <ChatComposer
                    ref={composerRef}
                    value={input}
                    onChange={setInput}
                    onSubmit={send}
                    onStop={stop}
                    running={busy}
                    autoFocus
                  />
                </div>
                <div className="hero-enter" style={{ animationDelay: "240ms" }}>
                  <SuggestionChips onSelect={setInput} />
                </div>
              </div>
            </main>
            <footer className="shrink-0 pb-5 text-center">
              <p className="font-mono text-[11px] text-muted-foreground/50">
                Powered by Claude · ProteinMPNN · ESMFold · GenBank, open
                source. Validate all designs experimentally.
              </p>
            </footer>
          </>
        ) : (
          <>
            <main
              ref={mainRef}
              onScroll={onScroll}
              className="flex-1 overflow-y-auto"
            >
              <div className="mx-auto w-full max-w-[46rem] px-6 py-6">
                <div className="flex flex-col gap-8">
                  {messages.map((m, i) => (
                    <div key={m.id}>
                      {i > 0 && <div className="mb-8 border-t border-border" />}
                      <ChatTurn message={m} />
                    </div>
                  ))}
                </div>
                <div className="h-4" />
              </div>
            </main>

            <div className="shrink-0">
              <div className="pointer-events-none mx-auto h-8 w-full max-w-[46rem] bg-gradient-to-t from-background to-transparent" />
              <div className="mx-auto w-full max-w-[46rem] px-6 pb-4">
                <ChatComposer
                  ref={composerRef}
                  value={input}
                  onChange={setInput}
                  onSubmit={send}
                  onStop={stop}
                  running={busy}
                />
                <p className="mt-2 text-center font-mono text-[11px] text-muted-foreground/50">
                  BiOS can make mistakes. Validate all designs experimentally.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
