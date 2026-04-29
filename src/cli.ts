import chokidar from "chokidar";
import path from "path";
import fs from "fs/promises";

import { Differ } from "./diff";
import { EntryParser } from "./parser";

console.log("Hummer cli: Hi");

const projectPath =
  "/Users/donggyulee/.claude/projects/-Users-donggyulee-Projects-hummer-cli";

// Initialize
const differ = new Differ();
const parser = new EntryParser();

const watcher = chokidar.watch(projectPath, {
  persistent: true,
});

watcher.on("add", (path) => {
  console.log(`File ${path} has been added`);
});

watcher.on("change", async (filepath) => {
  console.log(`File ${filepath} has been changed`);

  const filename = path.basename(filepath);
  console.log("basename: ", filename);

  const contents = await fs.readFile(filepath, "utf-8");

  const newLines = differ.checkDiff(filename, contents);

  if (newLines) {
    console.log(newLines.length);

    for (const line of newLines) {
      parser.parse(line);
    }
  }
});
