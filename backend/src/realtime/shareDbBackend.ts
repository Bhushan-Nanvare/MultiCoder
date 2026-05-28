import ShareDB from 'sharedb';

/**
 * Creates a ShareDB backend backed by the in-memory MemoryDB adapter. Suitable
 * for Phase 1 single-server development; Phase 2 swaps this for sharedb-postgres
 * or sharedb-mongo without changing call sites.
 */
export function createShareDbBackend(): ShareDB {
  return new ShareDB({
    presence: true,
    doNotForwardSendPresenceErrorsToClient: true,
  });
}
