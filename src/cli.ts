import chokidar from "chokidar";
import path from "path";
import fs from "fs/promises";

import { Differ } from "./diff";
import { EntryParser } from "./parser";
import { runSetup } from "./config/setup";

const differ = new Differ();
const parser = new EntryParser();

async function main() {
  const { projectsPath, projectDir, sessionFile } = await runSetup();

  const watchTarget = sessionFile
    ? path.join(projectsPath, projectDir, sessionFile)
    : path.join(projectsPath, projectDir);

  console.log(`\nWatching: ${watchTarget}\n`);

  const watcher = chokidar.watch(watchTarget, {
    persistent: true,
  });

  watcher.on("add", (filePath) => {
    if (filePath.endsWith(".jsonl")) {
      console.log(`New session: ${path.basename(filePath)}`);
    }
  });

  watcher.on("change", async (filepath) => {
    if (!filepath.endsWith(".jsonl")) return;

    const filename = path.basename(filepath);
    const contents = await fs.readFile(filepath, "utf-8");
    const newLines = differ.checkDiff(filename, contents);

    if (newLines) {
      for (const line of newLines) {
        parser.parse(line);
      }
    }
  });
}

main().catch((err) => {
  // AbortPromptError = user hit Ctrl+C during prompt
  if (err?.name === "AbortPromptError") {
    process.exit(0);
  }
  console.error(err);
  process.exit(1);
});
