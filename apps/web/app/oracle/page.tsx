"use client";

// Oracle — ring-scoped Q&A over the synthetic demo cosmos
// (createDemoCosmos(11, 600)) via @omega/ai-core's answerOracleQuery.
// Answers cite in-ring nodes only; the Guardian refuses out-of-ring
// retrieval, and every answer is labeled with the backend that produced
// it (live Meta Model API, offline fallback, or guardian).
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
import "@/app/creative/suites.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  answerOracleQuery,
  createChatProvider,
  getChatProviderStatus,
} from "@omega/ai-core";
import type { OracleNodeRef } from "@omega/ai-core";
import { createDemoCosmos } from "@omega/cosmos-engine/data";
import { RING_TYPES } from "@omega/consent-core";
import type { RingType } from "@omega/consent-core";

type OracleBackend = "meta-model-api" | "offline-stub" | "guardian";

interface OracleCitation {
  id: string;
  label: string;
  ring: RingType;
}

interface OracleMessage {
  id: number;
  role: "user" | "oracle";
  text: string;
  backend?: OracleBackend;
  model?: string;
  refused?: boolean;
  citations?: OracleCitation[];
  boundaryRing?: RingType;
}

function capitalize(text: string): string {
  return text.length === 0
    ? text
    : `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function BackendBadge({
  backend,
  model,
}: {
  backend: OracleBackend;
  model?: string;
}) {
  if (backend === "meta-model-api") {
    return (
      <span className="badge badge-live">
        Live — Meta Model API{model !== undefined ? ` · ${model}` : ""}
      </span>
    );
  }
  if (backend === "guardian") {
    return <span className="badge badge-guardian">Guardian refusal</span>;
  }
  return (
    <span className="badge badge-offline">
      Offline fallback — no API key connected; composed locally from demo
      data
    </span>
  );
}

function ProviderStatusBadge({
  mode,
  model,
}: {
  mode: "live" | "offline";
  model: string;
}) {
  if (mode === "live") {
    return (
      <span className="badge badge-live">Live — Meta Model API · {model}</span>
    );
  }
  return (
    <span className="badge badge-offline">
      Offline fallback — no API key connected
    </span>
  );
}

export default function OraclePage() {
  const [activeRing, setActiveRing] = useState<RingType>("public");
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<OracleMessage[]>([
    {
      id: 0,
      role: "oracle",
      text:
        "Ask me about the demo cosmos. I answer only from nodes inside " +
        "your active consent ring and cite them. Try a suggestion below — " +
        "including the one that deliberately reaches across a ring.",
    },
  ]);
  const nextIdRef = useRef(1);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  const provider = useMemo(() => createChatProvider(), []);
  const providerStatus = useMemo(
    () => getChatProviderStatus(provider),
    [provider],
  );

  const nodes: OracleNodeRef[] = useMemo(
    () =>
      createDemoCosmos(11, 600).nodes.map((node) => ({
        id: node.id,
        label: node.label,
        ring: node.ring,
        kind: node.kind,
      })),
    [],
  );

  const inScopeCount = useMemo(
    () => nodes.filter((n) => n.ring === activeRing).length,
    [nodes, activeRing],
  );

  const inRingNode = useMemo(
    () => nodes.find((n) => n.ring === activeRing),
    [nodes, activeRing],
  );

  // Deliberately out-of-ring target for the Guardian demo: a family-ring
  // node whenever family is not the active ring.
  const crossRingNode = useMemo(() => {
    if (activeRing !== "family") {
      return nodes.find((n) => n.ring === "family");
    }
    return nodes.find((n) => n.ring !== activeRing);
  }, [nodes, activeRing]);

  useEffect(() => {
    const el = messagesRef.current;
    if (el !== null) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  async function ask(raw: string) {
    const query = raw.trim();
    if (query === "" || pending) return;
    const userId = nextIdRef.current++;
    setMessages((prev) => [...prev, { id: userId, role: "user", text: query }]);
    setInput("");
    setPending(true);
    try {
      const result = await answerOracleQuery(query, {
        activeRing,
        nodes,
        provider,
      });
      const answerId = nextIdRef.current++;
      setMessages((prev) => [
        ...prev,
        {
          id: answerId,
          role: "oracle",
          text: result.text,
          backend: result.backend,
          ...(result.model !== undefined ? { model: result.model } : {}),
          refused: result.refused,
          citations: result.citations.map((c) => ({
            id: c.id,
            label: c.label,
            ring: c.ring,
          })),
          ...(result.boundaryRing !== undefined
            ? { boundaryRing: result.boundaryRing }
            : {}),
        },
      ]);
    } catch {
      const errorId = nextIdRef.current++;
      setMessages((prev) => [
        ...prev,
        {
          id: errorId,
          role: "oracle",
          text:
            "The Oracle could not answer just now — the provider call " +
            "failed. Your ring scope is unchanged; try again.",
          backend: "offline-stub",
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(input);
  }

  return (
    <div>
      <h1 className="page-title">Oracle</h1>
      <p className="muted">
        Oracle — answers only from your own ring-scoped demo data, with
        citations. Offline fallback is labeled; the Guardian refuses
        out-of-ring retrieval.
      </p>
      <p style={{ marginTop: "0.5rem" }}>
        <ProviderStatusBadge
          mode={providerStatus.mode}
          model={providerStatus.model}
        />
      </p>

      <div
        className="picker-row"
        role="radiogroup"
        aria-label="Active consent ring"
        style={{ marginTop: "1rem" }}
      >
        {RING_TYPES.map((ring) => (
          <button
            key={ring}
            type="button"
            role="radio"
            aria-checked={activeRing === ring}
            className={
              activeRing === ring
                ? "chip picker-chip is-active"
                : "chip picker-chip"
            }
            onClick={() => setActiveRing(ring)}
          >
            {capitalize(ring)}
          </button>
        ))}
      </div>
      <p className="oracle-scope-note">
        Active ring: <strong>{activeRing}</strong> · {inScopeCount} of{" "}
        {nodes.length} demo nodes in scope. Changing the ring re-scopes
        every answer that follows.
      </p>

      <div
        className="oracle-messages"
        ref={messagesRef}
        aria-live="polite"
        aria-label="Oracle conversation"
      >
        {messages.map((message) => {
          const isGuardian =
            message.refused === true || message.backend === "guardian";
          const bubbleClass =
            message.role === "user"
              ? "oracle-bubble oracle-bubble-user"
              : isGuardian
                ? "oracle-bubble oracle-bubble-guardian"
                : "oracle-bubble oracle-bubble-oracle";
          return (
            <div key={message.id} className={bubbleClass}>
              <div className="oracle-bubble-head">
                <span>
                  {message.role === "user"
                    ? "You"
                    : isGuardian
                      ? "Guardian"
                      : "Oracle"}
                </span>
                {message.backend !== undefined && (
                  <BackendBadge
                    backend={message.backend}
                    {...(message.model !== undefined
                      ? { model: message.model }
                      : {})}
                  />
                )}
              </div>
              <p>{message.text}</p>
              {message.refused === true &&
                message.boundaryRing !== undefined && (
                  <p className="boundary-note">
                    Boundary: this question reaches for the{" "}
                    <strong>{message.boundaryRing}</strong> ring, which is
                    outside your active <strong>{activeRing}</strong> ring.
                    Switch the active ring above to ask about it there.
                  </p>
                )}
              {message.citations !== undefined &&
                message.citations.length > 0 && (
                  <ul className="citation-list" aria-label="Citations">
                    <li>Cited:</li>
                    {message.citations.map((citation) => (
                      <li key={citation.id}>
                        <span className="chip">
                          {citation.label} · {citation.ring}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
            </div>
          );
        })}
        {pending && (
          <div className="oracle-bubble oracle-bubble-oracle">
            <p className="muted">Oracle is thinking…</p>
          </div>
        )}
      </div>

      <div className="suggestion-row" aria-label="Suggested questions">
        <span className="suggestion-label">Try:</span>
        {inRingNode !== undefined && (
          <button
            type="button"
            className="chip"
            disabled={pending}
            onClick={() => void ask(`Tell me about ${inRingNode.label}`)}
          >
            Tell me about {inRingNode.label}
          </button>
        )}
        {crossRingNode !== undefined && (
          <button
            type="button"
            className="chip"
            disabled={pending}
            onClick={() => void ask(`Tell me about ${crossRingNode.label}`)}
          >
            Try crossing a ring → Tell me about {crossRingNode.label}
          </button>
        )}
      </div>

      <form className="oracle-input-row" onSubmit={handleSubmit}>
        <input
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask about the ${activeRing} ring…`}
          aria-label="Ask the Oracle"
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={pending || input.trim() === ""}
        >
          {pending ? "Asking…" : "Send"}
        </button>
      </form>
    </div>
  );
}
