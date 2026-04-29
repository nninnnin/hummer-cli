import chokidar from "chokidar";

console.log("Hummer cli: Hi");

const projectPath =
  "/Users/donggyulee/.claude/projects/-Users-donggyulee-Projects-hummer-cli";

const watcher = chokidar.watch(projectPath, {
  persistent: true,
});

watcher.on("add", (path) => {
  console.log(`File ${path} has been added`);
});

watcher.on("change", (path) => {
  console.log(`File ${path} has been changed`);
});
