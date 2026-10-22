// A thread's checklist, from the status markdown its agent keeps (✱ in progress, ○ to do,
// ✓ done; storm's `status_md`). Pure.

const MARKS = { "✱": "doing", "○": "todo", "◯": "todo", "✓": "done", "✔": "done" };

/**
 * Parse a thread's status markdown into items.
 * Lines starting with ✱ (in progress), ○ (to do) or ✓ (done), optionally
 * after a "- " bullet, are checklist items; other non-empty lines are notes.
 */
export function parseChecklist(status) {
  const items = [];
  for (const raw of String(status ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim().replace(/^[-+]\s+/, "");
    if (!line) continue;
    const mark = line[0];
    const state = MARKS[mark];
    if (state) items.push({ state, text: line.slice(1).trim() });
    else items.push({ state: "note", text: line.replace(/^#+\s*/, "") });
  }
  const tasks = items.filter((i) => i.state !== "note");
  return {
    items,
    total: tasks.length,
    done: tasks.filter((i) => i.state === "done").length,
    doing: tasks.filter((i) => i.state === "doing").length,
  };
}

/** Only the checklist's tasks (the segment bar and "x of y" never count a note line). */
export function tasksOf(status) {
  const c = parseChecklist(status);
  return { ...c, items: c.items.filter((i) => i.state !== "note") };
}
