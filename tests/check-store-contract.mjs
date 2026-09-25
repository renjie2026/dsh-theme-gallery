/**
 * Exercise the store contract the page depends on.
 *
 * The panel registered and rendered, yet it shows the empty state with no
 * status line — which means the `inject` factory bound `bound`, but no
 * `publish()`/`note()` call after that ever reached it. The store seat is the
 * one piece of that chain this repository can test outside a browser:
 *
 *   - `handle.create()` must hand back the SAME instance the render machinery
 *     will use, because the code calls `handle.create().actions` to publish;
 *   - that instance must expose `actions.sync` and `actions.note`;
 *   - `actions` must actually mutate the snapshot.
 *
 * If `create()` returned a fresh instance per call, publishing into a
 * throwaway instance would look exactly like never publishing at all.
 *
 * Run with: node tests/check-store-contract.mjs
 */
import { defineStore } from '@deepseek-ai/dsh-client-store'

let failed = 0

/**
 * Assert one condition.
 * @param label - what is being checked.
 * @param condition - the result.
 */
function check(label, condition) {
  if (!condition) failed += 1
  console.log(`${condition ? 'ok  ' : 'FAIL'} ${label}`)
}

const handle = defineStore({
  init: () => ({ ids: [], status: '', revision: -1 }),
  actions: {
    setIds: (draft, ids) => { draft.ids = ids },
    note: (draft, status) => { draft.status = status },
  },
})

check('handle.create is a function', typeof handle.create === 'function')

const a = handle.create()
const b = handle.create()
check('create() returns an object', a !== null && typeof a === 'object')
check('create() exposes actions', a !== undefined && a.actions !== null && typeof a.actions === 'object')
check('actions has the declared writes', typeof a.actions?.setIds === 'function' && typeof a.actions?.note === 'function')
check('instance exposes getSnapshot', typeof a.getSnapshot === 'function')

// The load-bearing question: same instance, or a new one each call? It is a NEW
// one — so a caller that publishes through the framework instance and reads
// through the store seat's own would write into a throwaway and the component
// would never see the data. This is why the shipped panel plugins pin theirs:
// `{ ...handle, create: () => instance }`.
check('create() returns a NEW instance per call (unpinned)', a !== b)
check('unpinned instances do NOT share a snapshot', a.getSnapshot() !== b.getSnapshot())

a.actions.setIds(['x'])
check('actions mutate their own instance', a.getSnapshot().ids.length === 1)
check('the unpinned mutation is NOT visible through the other instance', b.getSnapshot().ids.length === 0)

a.actions.note('hello')
check('note() writes its field', a.getSnapshot().status === 'hello')

// The pinned shape the plugin uses, and the thing the page depends on: create
// ONE instance, then hand that same one back forever.
const pinnedInstance = handle.create()
const pinned = { ...handle, create: () => pinnedInstance }
const first = pinned.create()
const second = pinned.create()
check('a pinned create() returns one shared instance', first === second)
first.actions.setIds(['y'])
check('a write through the pinned instance is visible through itself', second.getSnapshot().ids[0] === 'y')

if (failed > 0) {
  console.error(`\n${failed} store contract check(s) failed`)
  process.exit(1)
}
console.log('\nstore contract checks passed')
