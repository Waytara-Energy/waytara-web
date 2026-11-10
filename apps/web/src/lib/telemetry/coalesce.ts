/**
 * Turns many separate asks for one thing each, made within a moment of each other, into ONE call for all of them, and hands each asker its own answer.
 * A screen with four devices used to send four requests for their connection state at the same instant (each with its own browser pre-check); this lets
 * the four ask as they like and sends one.
 *
 * `load` receives every distinct key asked for during the window and returns an answer per key; a key it has no answer for gets `missing`. If `load`
 * fails, every asker of that round fails with the same error.
 */
export function coalesce<K, V>(load: (keys: K[]) => Promise<Map<K, V>>, missing: V, windowMs = 25): (key: K) => Promise<V> {
  let waiting = new Map<K, { resolve: (v: V) => void; reject: (e: unknown) => void }[]>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  function flush(): void {
    timer = null;
    const round = waiting;
    waiting = new Map();
    load([...round.keys()]).then(
      (answers) => {
        for (const [key, askers] of round) for (const a of askers) a.resolve(answers.has(key) ? (answers.get(key) as V) : missing);
      },
      (error) => {
        for (const askers of round.values()) for (const a of askers) a.reject(error);
      }
    );
  }

  return (key) =>
    new Promise<V>((resolve, reject) => {
      const askers = waiting.get(key);
      if (askers) askers.push({ resolve, reject });
      else waiting.set(key, [{ resolve, reject }]);
      if (!timer) timer = setTimeout(flush, windowMs);
    });
}
