// PostToolUse hook: after Claude runs `git commit`, remind it to bring
// SPECIFICATIONS.md in line with what was committed.
let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  let command = "";
  try {
    command = JSON.parse(input).tool_input?.command ?? "";
  } catch {
    return;
  }
  if (!/\bgit\b[^\n;&|]*\bcommit\b/.test(command)) return;

  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: [
          "A git commit was just made in this repo.",
          "Run `git show --stat HEAD` and update SPECIFICATIONS.md so it matches the committed changes",
          "(forecast, AI pipeline, purchase orders, accuracy, API reference, known gaps).",
          "Skip this if the commit only touched SPECIFICATIONS.md or changed nothing the spec describes.",
          "Leave the spec edit uncommitted unless the user asked for it to be committed.",
        ].join(" "),
      },
    }),
  );
});
