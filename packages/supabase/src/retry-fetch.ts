/**
 * A `fetch` for the database clients that tries again when the database's API hands the request a pooled connection stuck in an aborted
 * transaction. The API then answers HTTP 500 with Postgres error 25P02 ("current transaction is aborted, commands ignored until end of
 * transaction block"): the request's own transaction never began, so nothing ran and asking again is safe, for a write as much as a read. The
 * next try usually lands on a healthy connection. Any other answer, including any other error, is returned untouched.
 */

const STUCK_CONNECTION = '"25P02"';
/** The waits before the second and third try. */
export const STUCK_CONNECTION_DELAYS_MS = [150, 400];

type FetchLike = typeof fetch;

async function isStuckConnection(response: Response): Promise<boolean> {
  if (response.status !== 500) return false;
  try {
    return (await response.clone().text()).includes(STUCK_CONNECTION);
  } catch {
    return false;
  }
}

export function createRetryingFetch(base: FetchLike = (input, init) => fetch(input, init), delaysMs: readonly number[] = STUCK_CONNECTION_DELAYS_MS): FetchLike {
  return async (input, init) => {
    let response = await base(input, init);
    for (const wait of delaysMs) {
      if (init?.signal?.aborted || !(await isStuckConnection(response))) return response;
      await new Promise((resolve) => setTimeout(resolve, wait));
      response = await base(input, init);
    }
    return response;
  };
}

/** The shared instance the app's clients use. */
export const retryingFetch: FetchLike = createRetryingFetch();
