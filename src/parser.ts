export class EntryParser {
  constructor() {}

  parse(entryStr: string) {
    const entry = JSON.parse(entryStr);

    console.log(entry.type);

    if (entry.type === "assistant") {
      const msg = entry.message;
      if (!msg || msg.stop_reason === null) return;

      const usage = msg.usage;
      if (!usage) return;

      const totalInput =
        (usage.input_tokens ?? 0) +
        (usage.cache_creation_input_tokens ?? 0) +
        (usage.cache_read_input_tokens ?? 0);

      console.log({
        type: "token_usage",
        model: msg.model,
        inputTokens: totalInput,
        outputTokens: usage.output_tokens ?? 0,
        cacheCreated: usage.cache_creation_input_tokens ?? 0,
        cacheRead: usage.cache_read_input_tokens ?? 0,
      });
    }
  }
}
