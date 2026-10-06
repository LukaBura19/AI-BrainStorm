import { API_URL } from "./api";

export class ChatError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "ChatError";
    this.status = status;
  }
}

/**
 * Šalje razgovor asistentu i čita odgovor dok stiže (text/event-stream).
 * `onEvent` dobija događaje sa servera: delta, done, refusal ili error.
 */
export async function streamLectureChat({ exam, subject, lecture, messages, signal, onEvent }) {
  let response;
  try {
    response = await fetch(`${API_URL}/public/prep/${exam}/${subject}/${lecture}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ChatError("Ne možemo da se povežemo sa serverom. Proveri internet vezu i pokušaj ponovo.");
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const detail = typeof payload.detail === "string" ? payload.detail : "Poruka nije poslata. Pokušaj ponovo.";
    throw new ChatError(detail, response.status);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const flush = (chunk) => {
    for (const line of chunk.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      try {
        onEvent(JSON.parse(line.slice(6)));
      } catch {
        // Oštećen događaj preskačemo; ostatak odgovora i dalje stiže.
      }
    }
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      flush(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");
    }
  }
  if (buffer.trim()) flush(buffer);
}
