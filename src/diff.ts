import { diffLines } from "diff";

type Filename = string;

export class Differ {
  private cache: Map<Filename, string> = new Map();

  constructor() {}

  checkDiff(filename: string, content: string) {
    const cache = this.cache.get(filename);

    this.cache.set(filename, content);

    if (!cache) {
      return false;
    }

    return diffLines(cache, content)
      .filter((part) => part.added)
      .flatMap((part) => part.value.split("\n"))
      .filter((line) => line.trim().length > 0);
  }
}
