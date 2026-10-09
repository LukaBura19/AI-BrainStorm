import { Fragment, forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, MessagesSquare, RotateCcw, Square } from "lucide-react";
import { streamLectureChat } from "../services/chatStream";
import "./LectureChat.css";

const MAX_INPUT = 2000;
const MAX_ASSISTANT_CHARS = 12000;
const MAX_HISTORY_MESSAGES = 39;
const MAX_HISTORY_CHARS = 50000;
// Answers the server may see again as context; a refused answer is left out together with its question.
const USABLE_REPLY = new Set(["done", "truncated", "stopped", "error"]);

const SUGGESTIONS = [
  { label: "Objasni mi prvi zadatak", text: "Objasni mi prvi zadatak korak po korak.", send: true },
  { label: "Daj mi sličan zadatak", text: "Daj mi sličan zadatak za vežbu.", send: true },
  { label: "Proveri moj postupak", text: "Proveri moj postupak: ", send: false },
];

let lastId = 0;
const newId = () => `${Date.now().toString(36)}-${(lastId += 1)}`;

/** Earlier questions that got a usable answer (newest last, within the server's limits), then the new question. */
function buildHistory(messages, question) {
  const turns = [];
  messages.forEach((message, index) => {
    const reply = messages[index + 1];
    if (message.role !== "user" || reply?.role !== "assistant") return;
    if (!USABLE_REPLY.has(reply.status) || !reply.content.trim()) return;
    turns.push([
      { role: "user", content: message.content },
      { role: "assistant", content: reply.content.slice(0, MAX_ASSISTANT_CHARS) },
    ]);
  });

  const kept = [];
  let total = question.length;
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const size = turns[index][0].content.length + turns[index][1].content.length;
    if ((kept.length + 1) * 2 + 1 > MAX_HISTORY_MESSAGES || total + size > MAX_HISTORY_CHARS) break;
    kept.unshift(turns[index]);
    total += size;
  }
  return [...kept.flat(), { role: "user", content: question }];
}

function loadConversation(key) {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(key) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((message) => message && typeof message.content === "string" && (message.role === "user" || message.role === "assistant"));
  } catch {
    return [];
  }
}

function saveConversation(key, messages) {
  try {
    if (messages.length) window.sessionStorage.setItem(key, JSON.stringify(messages.slice(-60)));
    else window.sessionStorage.removeItem(key);
  } catch {
    // Private mode or full storage: the conversation simply lasts while the page is open.
  }
}

// ---- Answers arrive as light markdown: paragraphs, lists, **bold** and `code`. Rendered as React nodes, never as HTML. ----

const LIST_ITEM = /^\s*(?:[-*•]|(\d+)[.)])\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;

function renderInline(text, keyPrefix) {
  const nodes = [];
  const pattern = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  let match = pattern.exec(text);
  while (match) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    nodes.push(match[1] !== undefined ? <strong key={`${keyPrefix}-${match.index}`}>{match[1]}</strong> : <code key={`${keyPrefix}-${match.index}`}>{match[2]}</code>);
    last = match.index + match[0].length;
    match = pattern.exec(text);
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function RichText({ text }) {
  const blocks = [];
  let paragraph = [];
  let list = null;
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "p", lines: paragraph });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (const rawLine of text.split("\n")) {
    if (!rawLine.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = HEADING.exec(rawLine);
    const item = !heading && LIST_ITEM.exec(rawLine);
    if (item) {
      flushParagraph();
      const ordered = item[1] !== undefined;
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { type: "list", ordered, start: ordered ? Number(item[1]) : undefined, items: [] };
      }
      list.items.push(item[2]);
    } else if (list && /^\s{2,}\S/.test(rawLine)) {
      list.items[list.items.length - 1] += ` ${rawLine.trim()}`;
    } else {
      flushList();
      paragraph.push(heading ? `**${heading[1].replace(/\*\*/g, "")}**` : rawLine);
    }
  }
  flushParagraph();
  flushList();

  return blocks.map((block, blockIndex) => {
    if (block.type === "p") {
      return <p key={blockIndex}>{block.lines.map((line, lineIndex) => <Fragment key={lineIndex}>{lineIndex > 0 && <br />}{renderInline(line, `${blockIndex}-${lineIndex}`)}</Fragment>)}</p>;
    }
    const items = block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item, `${blockIndex}-${itemIndex}`)}</li>);
    return block.ordered ? <ol key={blockIndex} start={block.start}>{items}</ol> : <ul key={blockIndex}>{items}</ul>;
  });
}

function Message({ message, onRetry }) {
  if (message.role === "user") {
    return (
      <div className={`chat-msg chat-msg--user ${message.status === "failed" ? "is-failed" : ""}`}>
        <div className="chat-bubble">{message.content}</div>
        {message.status === "failed" && (
          <p className="chat-msg-note chat-msg-note--error">
            {message.note} <button type="button" onClick={() => onRetry(message)}>Pošalji ponovo</button>
          </p>
        )}
      </div>
    );
  }

  const waiting = message.status === "streaming" && !message.content;
  return (
    <div className="chat-msg chat-msg--assistant">
      {message.status === "refused" ? (
        <div className="chat-bubble is-muted">{message.note}</div>
      ) : (
        <div className="chat-bubble">
          {waiting ? <span className="chat-typing" role="img" aria-label="Asistent piše"><i /><i /><i /></span> : <RichText text={message.content} />}
        </div>
      )}
      {message.status === "truncated" && <p className="chat-msg-note">Odgovor je bio predugačak pa je prekinut. Napiši „nastavi” ako želiš ostatak.</p>}
      {message.status === "stopped" && <p className="chat-msg-note">Zaustavljeno.</p>}
      {message.status === "error" && <p className="chat-msg-note chat-msg-note--error">{message.note}</p>}
    </div>
  );
}

/**
 * Razgovor sa asistentom uz snimak. Odgovor se ispisuje dok stiže; razgovor ostaje sačuvan
 * dok je kartica pregledača otvorena (sessionStorage), posebno za svaki snimak.
 */
const LectureChat = forwardRef(function LectureChat({ exam, subject, lecture, available: availableAtLoad, locked = false }, ref) {
  const storageKey = `brainstorm-chat:${exam}/${subject}/${lecture}`;
  const [messages, setMessages] = useState(() => loadConversation(storageKey));
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [available, setAvailable] = useState(availableAtLoad);
  const messagesRef = useRef(messages);
  const controllerRef = useRef(null);
  const inputRef = useRef(null);
  const logRef = useRef(null);
  const followRef = useRef(true);

  useEffect(() => {
    messagesRef.current = messages;
    if (!streaming) saveConversation(storageKey, messages);
  }, [messages, streaming, storageKey]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  // Keep the newest text in view unless the student scrolled up to reread something.
  useLayoutEffect(() => {
    const log = logRef.current;
    if (log && followRef.current) log.scrollTop = log.scrollHeight;
  }, [messages]);

  useLayoutEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, 168)}px`;
  }, [input]);

  const focusInput = useCallback((text) => {
    window.requestAnimationFrame(() => {
      const field = inputRef.current;
      if (!field) return;
      field.focus({ preventScroll: true });
      if (text !== undefined) field.setSelectionRange(text.length, text.length);
    });
  }, []);

  const prefill = useCallback((text) => {
    setInput(text);
    focusInput(text);
  }, [focusInput]);

  useImperativeHandle(ref, () => ({ prefill }), [prefill]);

  const patch = (id, changes) => setMessages((current) => current.map((message) => (message.id === id ? { ...message, ...changes } : message)));

  const send = async (raw) => {
    const question = raw.trim().slice(0, MAX_INPUT);
    if (!question || streaming || !available) return;

    const history = buildHistory(messagesRef.current, question);
    const questionId = newId();
    const replyId = newId();
    setMessages((current) => [...current, { id: questionId, role: "user", content: question, status: "done" }, { id: replyId, role: "assistant", content: "", status: "streaming" }]);
    setInput("");
    setStreaming(true);
    followRef.current = true;

    const controller = new AbortController();
    controllerRef.current = controller;
    let received = "";
    let settled = false;

    const fail = (note) => {
      settled = true;
      if (received) patch(replyId, { status: "error", note });
      else setMessages((current) => current.filter((message) => message.id !== replyId).map((message) => (message.id === questionId ? { ...message, status: "failed", note } : message)));
    };

    try {
      await streamLectureChat({
        exam,
        subject,
        lecture,
        messages: history,
        signal: controller.signal,
        onEvent: (event) => {
          if (event.type === "delta") {
            received += event.text;
            patch(replyId, { content: received });
          } else if (event.type === "done") {
            settled = true;
            patch(replyId, { status: event.stop_reason === "max_tokens" ? "truncated" : "done" });
          } else if (event.type === "refusal") {
            settled = true;
            patch(replyId, { content: "", status: "refused", note: event.message });
          } else if (event.type === "error") {
            fail(event.message);
          }
        },
      });
      if (!settled) fail("Odgovor je prekinut. Pokušaj ponovo.");
    } catch (error) {
      if (controller.signal.aborted) {
        if (received) patch(replyId, { status: "stopped" });
        else {
          setMessages((current) => current.filter((message) => message.id !== replyId && message.id !== questionId));
          setInput(question);
        }
      } else if (error.status === 503) {
        setMessages((current) => current.filter((message) => message.id !== replyId && message.id !== questionId));
        setAvailable(false);
      } else {
        fail(error.message || "Poruka nije poslata. Pokušaj ponovo.");
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      setStreaming(false);
    }
  };

  const retry = (failed) => {
    setMessages((current) => current.filter((message) => message.id !== failed.id));
    send(failed.content);
  };

  const startOver = () => {
    controllerRef.current?.abort();
    setMessages([]);
    focusInput();
  };

  const onKeyDown = (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    // On phones Enter adds a new line; the send button sends.
    if (window.matchMedia?.("(pointer: coarse)").matches) return;
    event.preventDefault();
    send(input);
  };

  const onScroll = () => {
    const log = logRef.current;
    followRef.current = log.scrollHeight - log.scrollTop - log.clientHeight < 48;
  };

  const status = !available ? (locked ? "Uz plaćen pristup" : "Uskoro dostupan") : streaming ? "Piše odgovor…" : "Pomaže oko zadataka sa ovog snimka";

  return (
    <section className="lecture-chat" aria-labelledby="lecture-chat-title">
      <header className="lecture-chat-head">
        <span className="lecture-chat-avatar" aria-hidden="true"><MessagesSquare size={20} strokeWidth={1.8} /></span>
        <div className="lecture-chat-heading">
          <h2 id="lecture-chat-title">Pitaj asistenta</h2>
          <p><i className={available ? "is-on" : ""} aria-hidden="true" />{status}</p>
        </div>
        {messages.length > 0 && (
          <button type="button" className="lecture-chat-reset" onClick={startOver}>
            <RotateCcw size={15} strokeWidth={2} aria-hidden="true" /> <span>Novi razgovor</span>
          </button>
        )}
      </header>

      <div className="lecture-chat-log" ref={logRef} onScroll={onScroll} role="log" aria-live="polite" aria-busy={streaming} aria-label="Razgovor sa asistentom" tabIndex={0}>
        {messages.length === 0 ? (
          <div className={`lecture-chat-welcome ${available ? "" : "is-off"}`}>
            {available ? (
              <>
                <p>Zdravo! Pitaj me o zadacima sa ovog snimka: kako se rešava neki korak, zašto se radi baš tako ili gde si pogrešio. Mogu da ti dam i sličan zadatak za vežbu.</p>
                <div className="lecture-chat-suggestions">
                  {SUGGESTIONS.map((suggestion) => (
                    <button key={suggestion.label} type="button" onClick={() => (suggestion.send ? send(suggestion.text) : prefill(suggestion.text))}>{suggestion.label}</button>
                  ))}
                </div>
              </>
            ) : (
              <p className="lecture-chat-off">{locked ? "Asistent je deo plaćenog pristupa. Kad otključaš snimke, pitaj ga o svakom zadatku." : "Asistent još nije uključen. Do tada zadatke možeš da prođeš sa profesorom na času."}</p>
            )}
          </div>
        ) : (
          messages.map((message) => <Message key={message.id} message={message} onRetry={retry} />)
        )}
      </div>

      <form className="lecture-chat-form" onSubmit={(event) => { event.preventDefault(); send(input); }}>
        <label htmlFor="lecture-chat-input" className="lecture-chat-sr">Tvoje pitanje</label>
        <textarea
          id="lecture-chat-input"
          ref={inputRef}
          rows={1}
          value={input}
          maxLength={MAX_INPUT}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={available ? "Napiši pitanje o zadatku…" : locked ? "Otključava se uz plaćen pristup" : "Asistent još nije uključen"}
          disabled={!available}
        />
        {streaming ? (
          <button type="button" className="lecture-chat-send is-stop" onClick={() => controllerRef.current?.abort()} aria-label="Zaustavi odgovor">
            <Square size={13} fill="currentColor" aria-hidden="true" />
          </button>
        ) : (
          <button type="submit" className="lecture-chat-send" disabled={!available || !input.trim()} aria-label="Pošalji pitanje">
            <ArrowUp size={19} strokeWidth={2.2} aria-hidden="true" />
          </button>
        )}
      </form>
      <p className="lecture-chat-foot">
        {input.length > MAX_INPUT - 200 ? `${input.length} / ${MAX_INPUT} znakova` : "Asistent može da pogreši. Ako ti nešto nije jasno, pitaj profesora na času."}
      </p>
    </section>
  );
});

export default LectureChat;
