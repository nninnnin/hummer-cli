export class EntryParser {
  constructor() {}

  parse(entryStr: string) {
    const parsed = JSON.parse(entryStr);

    console.log(parsed.type);
  }
}
