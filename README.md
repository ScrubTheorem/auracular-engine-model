# Auracular Engine Model

An interactive 3D map of how the **Auracular** engine works: an event comes in from a system, goes through five rings that decide what happens to it, and every decision is sealed in a ledger nobody can quietly edit. Above the rings, in purple, is the **rule workshop**, where rules are proven and approved before they go live.

**Open `index.html` in any browser.** No install, no build, works offline. Drag to orbit, scroll or pinch to zoom, click any part to read what it does, and press a flow to follow one event step by step.

![The engine model](screenshot.png)

- **Copyright (c) 2026 ScrubTheorem. Apache License 2.0.** Anyone can use it, study it, reverse engineer it, change it, and build on it, including commercially. No permission needed. Keep the `LICENSE` and `NOTICE` files with what you share.
- **Built using AI.** The code was written with AI assistance (Claude). The architecture, design and decisions are ScrubTheorem's.
- **It's a map, not the engine.** It doesn't run any rules. It exists so people can understand the design, and fork it to draw their own.
- **Contact:** ScrubTheorem@gmail.com

## How to read it

The bottom half is the **live data path**: it runs for every event, all the time, in milliseconds. The purple top half is the **rule workshop**: it runs only when someone changes a rule. It never touches live data. It decides what the rings are allowed to do. The purple line from **3-of-5 sign-off** down to the **Policy engine** ring is the moment an approved rule goes live.

## Every part, labelled

The status column is what the model claims about each part (Built, Built · needs setup, Planned). The claims come from the author's description of the system; check them against the code before relying on them. Company and product names (Onspring, Salesforce, Workday, NetSuite, Snowflake, Polygon, Slack, Teams) are example systems only and imply no affiliation.

### The five rings (every event, in this order)

| # | Ring | What it does |
|---|---|---|
| 1 | **Route match** | Finds every governed route listening for this event type from this source. |
| 2 | **Schema adapters** | Approved fixes for renamed fields, units and text numbers run first. |
| 3 | **Drift check** | Compares the event's fields with the shape the route learned. |
| 4 | **Policy engine** | Runs every policy on the route. |
| 5 | **Decision** | Four answers: Permit, Prohibit, Unknown (the rule didn't reach) or Both (the rule contradicts itself). |

### Your systems

| Part | Status | What it does |
|---|---|---|
| **Onspring** | Built | A customer's Onspring app: vendors, risks, controls. |
| **Salesforce** | Built | A CRM pushing contact changes. |
| **Workday** | Built | An HR system pushing employee changes. |
| **Your databases** | Built | Postgres, MySQL, SQL Server or Snowflake. |
| **Partner's Auracular** | Built | Another company running its own Auracular. |

### Listening

| Part | Status | What it does |
|---|---|---|
| **Events API** | Built | The front door for systems that push. |
| **SQL poller** | Built | Reads only new rows using an always-increasing column such as id or updated_at, and feeds each row in as an event. |
| **Federation inbox** | Built | Where a partner's Auracular delivers, with no API key. |

### In the path of data

| Part | Status | What it does |
|---|---|---|
| **Screening lists** | Built | Checks a value against a list such as a sanctions list, and produces a small proof that it is or isn't on it. |
| **Private commitment** | Built | While deciding, Auracular seals a Poseidon commitment to the fields the policy read. |
| **WASM cross-check** | Built | Every enforced decision is made twice: by the runtime engine and by the same rule compiled to WebAssembly. |

### Sealed record

| Part | Status | What it does |
|---|---|---|
| **Seal** | Built | Every decision becomes an audit entry. |
| **Private ledger** | Built | The full hash-chained record, kept in your own database. |
| **Transition verifier** | Built | Replays the whole ledger, proves every change followed the allowed order, and checks the database still matches the sealed history. |
| **Merkle anchor** | Built | Batches ledger entries and keeps only their Merkle root. |
| **Public ledger** | Built | A list of roots anyone can see. |
| **Polygon** | Built · needs setup | Each root can be written to a small contract on Polygon so its date can't be backdated. |
| **Encrypted backups** | Built | Daily encrypted backups that record the ledger head. |
| **Partner witness** | Built | Every 15 minutes Auracular fetches each partner's signed ledger head and seals it in your own ledger. |

### Rule workshop (the purple area above the rings)

| Part | Status | What it does |
|---|---|---|
| **Rule change** | Built | Someone proposes a new version of a policy. |
| **Z3 proofs** | Built | Proves things about the rule over every possible event, not a sample: can anything pass, which conditions are redundant, and exactly which events the new version newly blocks or allows. |
| **Policy repair** | Built | Give it events that should pass and events that should fail. |
| **Intentional-fail probes** | Built | Builds events designed to fail each condition on purpose, runs them through four separate engines, and requires all four to agree. |
| **Runtime engine** | Built | Engine 1 of 4: the code that decides real events. |
| **Z3 model** | Built | Engine 2 of 4: the solver's model of the rule. |
| **R1CS circuit** | Built | Engine 3 of 4: the rule as algebraic constraints. |
| **WASM module** | Built | Engine 4 of 4: the rule compiled to WebAssembly. |
| **ZK circuit setup** | Built | Compiles the rule into constraints for zero-knowledge proofs, then runs a one-time Groth16 setup per version. |
| **3-of-5 sign-off** | Built | Five people hold their own signing keys. |
| **Enforce anywhere** | Built | Compiles a rule into a tiny WebAssembly program that enforces it inside another system, with no call back to Auracular and no data leaving that system. |
| **Dual independent derivation** | Built | One statute, one signed reading, two translators deriving the rule blind. |
| **Provenance chain** | Built | Statute → signed reading → translator A and B (two lines) → where they meet → solver encoding → circuit → policy version. |
| **Subjector 1** | Built | Checks what the rule should do. |
| **Subjector 2** | Built | Checks what the rule should do. |
| **Subjector 3** | Built | Checks what the rule should do. |
| **Translator 1** | Built | Checks the machine-readable rule says what the subjectors approved. |
| **Translator 2** | Built | Checks the machine-readable rule says what the subjectors approved. |

### People and alerts

| Part | Status | What it does |
|---|---|---|
| **Auditor's laptop** | Built | An auditor checks a proof offline, with no access to your systems. |
| **Review queue** | Built | Held events wait here in the console. |
| **Company sign-in** | Built | People sign in to the console with Okta, Entra ID, Google Workspace or Auth0. |
| **Alerts** | Built | Held, blocked, drift, failed delivery, approvals waiting and ledger failures. |
| **Slack · Teams · email** | Built | Alerts land where people already work. |
| **Trial balance** | Built | Every event that enters the review queue must leave it through a sealed record. |

### Delivery

| Part | Status | What it does |
|---|---|---|
| **Delivery outbox** | Built | A relayed or released event is queued in the same database transaction as its decision, so a restart never loses one. |
| **Background worker** | Built | Sends due deliveries every few seconds. |
| **Proofs in flight** | Built | A route can withhold sensitive fields from the destination and attach a private proof instead, so the receiver learns the data passed your rules without seeing it. |
| **Signed webhook** | Built | Posts to an HTTPS address. |
| **SQL sink** | Built | Inserts the event into a table in the destination's database. |

### Destinations

| Part | Status | What it does |
|---|---|---|
| **Onspring** | Built | An Onspring destination connector writes each decision back onto the record through Onspring's API v2: status, verdict and sealed hash, into the field IDs you map. |
| **NetSuite / ERP** | Built | An ERP receiving relayed events through a signed webhook. |
| **Data warehouse** | Built | A warehouse such as Snowflake EU, filled through the SQL sink. |
| **Partner's Auracular** | Built | Receives the event plus a signed receipt of your decision: which policies, which versions, the sealed entry and a fingerprint of exactly what was delivered. |

**About "Dual independent derivation":** two translators turn the same written rule into a machine rule separately, without seeing each other's work, and the solver checks the two results match. The general name for the idea is *double data entry* (two people enter the same thing independently, and the entries are compared); in software it's called *N-version design*.

## The eight guided flows

| Flow | What it shows | Link |
|---|---|---|
| A normal event | Salesforce to an ERP, start to finish | `index.html#flow-normal` |
| A policy blocks it | An overweight shipment from a database | `index.html#flow-block` |
| Data shape changes | Held, fixed with an adapter, released | `index.html#flow-drift` |
| Onspring round trip | How a platform partner plugs in | `index.html#flow-onspring` |
| Changing a rule | Proofs and sign-off before it goes live | `index.html#flow-rule` |
| Dual independent derivation | Two translators, one rule, derived blind | `index.html#flow-dd` |
| Proving it to an auditor | From your ledger to an offline check | `index.html#flow-audit` |
| Partner handoff | Two companies, two Auracular installs | `index.html#flow-fed` |

## Controls

- Drag to orbit. Scroll or pinch to zoom.
- Click any part to see what it does, what goes in and out, and the code or API behind it.
- **Follow the data** walks through a flow one step at a time.
- **Reset view** returns the camera to the start.
- Open a flow directly with a link such as `index.html#flow-rule`.

## Put it on GitHub from a phone

Every file sits at the top level, so you can upload them all at once from a phone browser: on github.com, open the repository, tap **Add file → Upload files**, select all the files, and **Commit changes**. Then **Settings → Pages → Deploy from a branch → main / (root)** gives you a live link like `https://YOUR-NAME.github.io/auracular-engine-model/`.

## How it's built

Everything the model shows comes from three arrays in `app.js`:

- `N`: the parts. Each has an `id`, a `name`, a group (`g`), a position (`p`), a shape (`s`), a status (`st`), a description (`what`) and optional `under` text for the "Under the hood" panel.
- `E`: the connections, as `[from, to, kind]`. Kind is empty for solid, `plan` for planned (dashed) or `ctl` for control (dashed).
- `FLOWS`: the guided flows. Each step is `[partId, narration, outcome]`.

The scene is drawn with Three.js r128 (`three.r128.min.js`, included so it works offline); the rest is plain JavaScript. To add your own part and flow, see [`ADD-A-PART.md`](ADD-A-PART.md).

## Test

    npm i playwright && npx playwright install chromium
    node smoke-test.mjs

It checks that the page draws the scene, lists the eight flows, runs a flow, and throws no page errors.

## Security

The page loads only its own files, plus Google Fonts for typography. A Content-Security-Policy blocks other scripts and network connections. It makes no network requests for data and stores nothing in the browser.

## License

Copyright (c) 2026 ScrubTheorem. Licensed under the Apache License 2.0; see [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE). Three.js is MIT-licensed by its authors; see [`THREE-LICENSE.md`](THREE-LICENSE.md). The name Auracular is not licensed as a trademark: if you ship a fork as your own product, give it your own name.
