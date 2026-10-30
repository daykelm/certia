import type { AiExtractor, Mailer } from "./interfaces.js";

/** No-op extractor: fields are filled in by hand until AI is connected (F-05). */
export class ManualExtractor implements AiExtractor {
  async extract() {
    return { values: {}, confidence: {} };
  }
}

/** Development mailer: prints the message to the console. */
export class ConsoleMailer implements Mailer {
  constructor(private readonly from = "no-reply@certia-es.com") {}

  async send(m: { to: string; subject: string; text: string }) {
    console.log(`[mail] From: ${this.from} · To: ${m.to} · ${m.subject}\n${m.text}`);
  }
}
