import os from "os";
import path from "path";
import fs from "fs/promises";
import { input, select, confirm } from "@inquirer/prompts";

const DEFAULT_CLAUDE_PROJECTS_PATH = path.join(
  os.homedir(),
  ".claude",
  "projects",
);

function decodeProjectDirName(dirName: string): string {
  // "-Users-donggyulee-Projects-hummer-cli" → "hummer-cli"
  const segments = dirName.split("-").filter(Boolean);
  return segments[segments.length - 1] ?? dirName;
}

async function listProjects(projectsPath: string): Promise<string[]> {
  const entries = await fs.readdir(projectsPath, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

interface SessionInfo {
  filename: string;
  mtime: Date;
  aiTitle: string | null;
}

async function readSessionInfo(filePath: string): Promise<SessionInfo> {
  const filename = path.basename(filePath);
  const stat = await fs.stat(filePath);
  let aiTitle: string | null = null;

  // Scan file lines in reverse to get the latest ai-title efficiently
  const content = await fs.readFile(filePath, "utf-8");
  const lines = content.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.type === "ai-title" && obj.aiTitle) {
        aiTitle = obj.aiTitle;
        break;
      }
    } catch {
      // skip malformed lines
    }
  }

  return { filename, mtime: stat.mtime, aiTitle };
}

async function listJsonlFiles(projectDirPath: string): Promise<SessionInfo[]> {
  const entries = await fs.readdir(projectDirPath, { withFileTypes: true });
  const jsonlNames = entries
    .filter((e) => e.isFile() && e.name.endsWith(".jsonl"))
    .map((e) => e.name);

  const infos = await Promise.all(
    jsonlNames.map((name) => readSessionInfo(path.join(projectDirPath, name))),
  );

  return infos.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
}

export interface SetupResult {
  projectsPath: string;
  projectDir: string;
  sessionFile: string | null; // null = watch all files in project
}

export async function runSetup(): Promise<SetupResult> {
  console.log("\n🐦 hummer — initial setup\n");

  // Step 1: Confirm or enter the base ~/.claude/projects path
  let projectsPath: string;

  const hasDefault = await fs
    .access(DEFAULT_CLAUDE_PROJECTS_PATH)
    .then(() => true)
    .catch(() => false);

  if (hasDefault) {
    const useDefault = await confirm({
      message: `Use default Claude projects path? (${DEFAULT_CLAUDE_PROJECTS_PATH})`,
      default: true,
    });

    if (useDefault) {
      projectsPath = DEFAULT_CLAUDE_PROJECTS_PATH;
    } else {
      projectsPath = await input({
        message: "Enter the path to your Claude projects directory:",
        default: DEFAULT_CLAUDE_PROJECTS_PATH,
        validate: async (value) => {
          const exists = await fs
            .access(value)
            .then(() => true)
            .catch(() => false);
          return exists ? true : `Path not found: ${value}`;
        },
      });
    }
  } else {
    console.log(`Default path not found: ${DEFAULT_CLAUDE_PROJECTS_PATH}`);
    projectsPath = await input({
      message: "Enter the path to your Claude projects directory:",
      validate: async (value) => {
        const exists = await fs
          .access(value)
          .then(() => true)
          .catch(() => false);
        return exists ? true : `Path not found: ${value}`;
      },
    });
  }

  // Step 2: Select a project
  const projectDirs = await listProjects(projectsPath);

  if (projectDirs.length === 0) {
    throw new Error(`No project directories found in: ${projectsPath}`);
  }

  const projectDir = await select({
    message: "Select a project to watch:",
    choices: projectDirs.map((dir) => ({
      name: `${decodeProjectDirName(dir)}  (${dir})`,
      value: dir,
    })),
  });

  // Step 3: Select a session file or watch all
  const projectDirPath = path.join(projectsPath, projectDir);
  const jsonlFiles = await listJsonlFiles(projectDirPath);

  let sessionFile: string | null = null;

  if (jsonlFiles.length === 0) {
    console.log(
      "\nNo JSONL session files found yet. Watching for new sessions...\n",
    );
  } else {
    const fileChoice = await select({
      message: "Select a session file (or watch all):",
      choices: [
        { name: "Watch all sessions in this project", value: "__all__" },
        ...jsonlFiles.map((s) => {
          const date = s.mtime.toLocaleString("ko-KR", {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          });
          const label = s.aiTitle ?? s.filename.slice(0, 8) + "...";
          return { name: `[${date}]  ${label}`, value: s.filename };
        }),
      ],
    });

    sessionFile = fileChoice === "__all__" ? null : fileChoice;
  }

  return { projectsPath, projectDir, sessionFile };
}
