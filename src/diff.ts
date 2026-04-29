import { diffLines } from "diff";

type Filename = string;

export class Differ {
  private cache: Map<Filename, string> = new Map();

  constructor() {}

  checkDiff(filename: string, content: string) {
    const cache = this.cache.get(filename);

    if (!cache) {
      this.cache.set(filename, content);
      return "No Diff";
    }

    this.cache.set(filename, content);
    return diffLines(cache, content);
  }
}
