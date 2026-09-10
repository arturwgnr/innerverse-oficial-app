// Client-side retry queue for POST /api/entries (UPDATES.md round 4 #3): if
// the save itself fails outright (not just the analysis afterward), the
// draft used to just vanish behind an error toast. Now it's kept in
// localStorage and retried on the next app load or the next "online" event,
// analysis then runs normally off the eventual successful POST, no separate
// analysis-retry plumbing needed here.
const KEY = "innerverse.pendingEntries";

function readQueue() {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function writeQueue(queue) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(queue));
  } catch {
    // Best effort, if storage is unavailable the draft is lost either way,
    // no worse off than before this queue existed.
  }
}

export function enqueueEntry(payload) {
  const queue = readQueue();
  queue.push(payload);
  writeQueue(queue);
}

export function hasQueuedEntries() {
  return readQueue().length > 0;
}

// postFn is (body) => Promise, callers pass api.post bound to /api/entries so
// this module doesn't need to import the api client directly.
export async function flushEntryQueue(postFn) {
  const queue = readQueue();
  if (queue.length === 0) return 0;

  const remaining = [];
  let flushed = 0;
  for (const payload of queue) {
    try {
      await postFn(payload);
      flushed++;
    } catch {
      remaining.push(payload);
    }
  }
  writeQueue(remaining);
  return flushed;
}
