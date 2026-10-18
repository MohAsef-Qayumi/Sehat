# How sync works

Sehat is local-first: every screen reads from and writes to IndexedDB on the device. The network is only used to exchange changes, so the app behaves the same with or without a connection.

## Data model

Each record stores its field values and, per field, the [hybrid logical clock](../src/lib/sync/hlc.ts) timestamp of the last write:

```json
{
  "id": "7c9e…",
  "data":   { "fullName": "Ahmad", "phone": "0799 123 456" },
  "clocks": { "fullName": "001750000000000-00000-a1b2", "phone": "001750000004200-00000-c3d4" }
}
```

## Merging

Two versions of a record merge field by field: the value with the newer timestamp wins ([`merge.ts`](../src/lib/sync/merge.ts)). This is a last-writer-wins register per field, which is:

- **commutative and associative** — devices converge regardless of the order changes arrive in;
- **idempotent** — receiving the same change twice is harmless, so retries are safe;
- **fine-grained** — a receptionist updating a phone number and a doctor adding an allergy to the same patient while both offline keeps both edits.

A randomised test checks convergence across delivery orders.

### Why hybrid logical clocks

Wall-clock time alone breaks when devices disagree about the time. Pure logical clocks lose the intuitive "latest edit wins" behaviour. HLCs track wall time when clocks are sane and fall back to a logical counter when they are not, and embed the device id to break ties deterministically.

A device whose clock runs more than five minutes ahead of the server is refused (`409`) instead of being allowed to "win" every future conflict.

## Protocol

`POST /api/sync` does push and pull in one round trip:

```
→ { since: <cursor>, changes: [ …outbox records… ] }
← { changes: [ …records with seq > since… ], cursor, hasMore }
```

1. The client sends its outbox (records edited locally since the last successful sync).
2. The server merges each change into Postgres. If the stored version already contains the change, nothing is written.
3. Every write takes a value from a global sequence (`seq`). The client pulls everything with `seq > cursor` and stores the new cursor.
4. The client merges pulled records locally and clears outbox entries whose revision did not change during the request, so an edit made mid-sync is never lost.

### Ordering guarantee

Sequence values are assigned when a transaction runs, not when it commits, so two concurrent transactions could commit out of order and a client could skip a change. Writes for a clinic are therefore serialised with `pg_advisory_xact_lock`, which keeps commit order equal to sequence order per clinic.

## Trade-offs

- **Deletes are soft** (`deleted: true`) so they sync like any other field change.
- **Field-level LWW is not a text CRDT.** Two people editing the same notes field at the same time will see one version win. For clinic records this is acceptable; collaborative text editing would need a sequence CRDT.
- **Queue numbers** are derived from check-in timestamps, so a device that was offline for a long time can insert an earlier check-in on sync.
