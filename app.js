// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 ScrubTheorem
(function(){
"use strict";
if(!window.THREE){document.getElementById('nText').textContent='The 3D engine could not load. Reload the page to try again.';return;}
const T = THREE;
const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- model data: grounded in the Auracular source code ---------------- */
const G = {
  sys:{name:'Your systems',color:'#5BA3F0'},
  listen:{name:'Listening',color:'#3B7BFF'},
  core:{name:'In the path of data',color:'#3B7BFF'},
  seal:{name:'Sealed record',color:'#E0A526'},
  work:{name:'Rule workshop',color:'#8B7CFF'},
  deliver:{name:'Delivery',color:'#14C8B8'},
  people:{name:'People and alerts',color:'#EDEBE4'},
  dest:{name:'Destinations',color:'#5BA3F0'}
};
const STATUS = {
  built:{t:'Built',c:'#3FBF7F'},
  setup:{t:'Built · needs setup',c:'#F0B429'},
  planned:{t:'Planned',c:'#F0B429'}
};
// shape: sys | gate | core | node | small | person | chain
const N = [
 // sources
 {id:'src_onspring',name:'Onspring',g:'sys',p:[-22,5,0],s:'sys',major:1,st:'built',
  what:'A customer\'s Onspring app: vendors, risks, controls. When a record changes, an Onspring REST API outcome posts it to Auracular\'s Onspring endpoint, which turns its fields into a clean event.',
  io:'Out: the changed record. "Vendor Name" arrives as vendor_name, text numbers become numbers, event type onspring.vendor.updated.',
  under:'Onspring REST API outcome → POST /v1/connectors/{id}/onspring\nonspring.py → normalize'},
 {id:'src_salesforce',name:'Salesforce',g:'sys',p:[-22,2.5,0],s:'sys',major:1,st:'built',
  what:'A CRM pushing contact changes. The example system in your brand reference.',io:'Out: contact.created, contact.updated',under:'POST /v1/connectors  { "system": "salesforce" }'},
 {id:'src_workday',name:'Workday',g:'sys',p:[-22,0,0],s:'sys',major:1,st:'built',
  what:'An HR system pushing employee changes.',io:'Out: employee.updated',under:'POST /v1/events'},
 {id:'src_db',name:'Your databases',g:'sys',p:[-22,-2.5,0],s:'sys',major:1,st:'built',
  what:'Postgres, MySQL, SQL Server or Snowflake. Auracular reads new rows with read-only credentials. Nothing in the database changes.',io:'Out: new rows, read as events',under:'connectors_sql.py\nCredentials encrypted, never returned by the API.'},
 {id:'src_partner',name:'Partner\'s Auracular',g:'sys',p:[-22,-5,0],s:'sys',major:1,st:'built',
  what:'Another company running its own Auracular. It sends events with a signed receipt of its own decision.',io:'Out: event + signed receipt',under:'federation.py → receipt'},
 // listening
 {id:'ing_api',name:'Events API',g:'listen',p:[-15,2.5,0],s:'node',major:1,st:'built',
  what:'The front door for systems that push. Each connector authenticates with its own key. A repeated external ID is caught as a duplicate, so retries never double-count.',
  io:'In: events from push systems. Out: one event into the pipeline.',under:'POST /v1/events\nPOST /v1/connectors\nGET /v1/connectors/{id}/heartbeat'},
 {id:'ing_sql',name:'SQL poller',g:'listen',p:[-15,-2.5,0],s:'node',major:1,st:'built',
  what:'Reads only new rows using an always-increasing column such as id or updated_at, and feeds each row in as an event.',io:'In: new rows. Out: events.',under:'python manage.py poll\nPOST /v1/connectors/{id}/poll'},
 {id:'ing_fed',name:'Federation inbox',g:'listen',p:[-15,-5,0],s:'node',major:0,st:'built',
  what:'Where a partner\'s Auracular delivers, with no API key. The signed receipt is checked against what actually arrived. If they don\'t match, the event is held.',
  io:'In: partner event + receipt. Out: event marked with verified provenance.',under:'POST /federation/inbox/{connector}'},
 // the rings, outermost to innermost
 {id:'g_route',name:'Route match',g:'core',p:[-9,0,0],s:'gate',r:4.8,major:1,st:'built',
  what:'Finds every governed route listening for this event type from this source. One event can travel several routes, and each gets its own decision. With no route it is recorded as unrouted.',
  io:'In: event. Out: one copy per matching route.',under:'POST /v1/routes  (Idempotency-Key)\npipeline.py → ingest_event'},
 {id:'g_adapt',name:'Schema adapters',g:'core',p:[-6,0,0],s:'gate',r:3.9,major:1,st:'built',
  what:'Approved fixes for renamed fields, units and text numbers run first. Before an adapter applies it must pass two checks: forward (the result has the learned shape) and backward (undoing it gives back the original). A second person approves it, then the review queue is balanced.',
  io:'In: raw payload. Out: adapted payload.',under:'POST /v1/routes/{id}/adapters/propose\nPOST /v1/routes/{id}/adapters'},
 {id:'g_drift',name:'Drift check',g:'core',p:[-3,0,0],s:'gate',r:3.0,major:1,st:'built',
  what:'Compares the event\'s fields with the shape the route learned. If the shape changed, the route\'s setting decides: hold it for a person, block it, or relay it and learn the new shape.',
  io:'In: payload. Out: drift report.',under:'on_drift: "hold" | "block" | "relay"'},
 {id:'g_policy',name:'Policy engine',g:'core',p:[0,0,0],s:'gate',r:2.1,major:1,st:'built',
  what:'Runs every policy on the route. Policies are data, not code, so nothing executable can be injected. Every condition must pass. A missing field or a wrong type fails closed.',
  io:'In: payload. Out: pass or fail per policy, with the failing conditions.',under:'PUT /v1/policies/{id}\nPOST /v1/policies/{id}/evaluate  (dry run)'},
 {id:'n_screen',name:'Screening lists',g:'core',p:[0,3.6,-2.4],s:'small',major:0,st:'built',
  what:'Checks a value against a list such as a sanctions list, and produces a small proof that it is or isn\'t on it. The proof reveals two neighbouring fingerprints, never the list.',
  io:'In: a name or ID. Out: listed or not, with a proof.',under:'PUT /v1/lists/{id}\nPOST /v1/lists/{id}/check\npolicy op: "not_listed"'},
 {id:'n_zk',name:'Private commitment',g:'core',p:[1.6,-3.2,-2.4],s:'small',major:0,st:'built',
  what:'While deciding, Auracular seals a Poseidon commitment to the fields the policy read. Later it can prove the event passed without showing the event.',
  io:'Out: a commitment sealed with the decision.',under:'POST /v1/events/{id}/private-proof\nzkp.py'},
 {id:'g_decide',name:'Decision',g:'core',p:[3,0,0],s:'gate',r:1.2,major:1,st:'built',
  what:'Four answers: Permit, Prohibit, Unknown (the rule didn\'t reach) or Both (the rule contradicts itself). Only Permit moves data. Prohibit is blocked; Unknown and Both go to a person instead of a guess. A shape change outranks a policy block.',
  io:'Out: relayed, held or blocked, with the verdict sealed.',under:'policy_engine.py → verdict_of\nGET /v1/referrals  (measured referral rate)'},
 {id:'seal',name:'Seal',g:'seal',p:[5.6,0,0],s:'core',major:1,st:'built',
  what:'Every decision becomes an audit entry. Each field gets its own salted commitment, the commitments form a Merkle root, and the entry\'s hash covers the hash before it. Nothing can be quietly edited.',
  io:'Out: an entry hash, returned as x-auracular-audit: sealed.',under:'audit_chain.py → seal'},
 // ledger & proof below
 {id:'ledger',name:'Private ledger',g:'seal',p:[5.6,-3.6,0],s:'small',major:1,st:'built',
  what:'The full hash-chained record, kept in your own database. It only grows. Time runs downward here: the deeper the block, the older the entry. A field can be redacted without breaking the chain because its commitment stays.',
  io:'Every sealed decision, in full detail.',under:'GET /v1/audit\nGET /v1/audit/{id}/verify?full=true\nPOST /v1/audit/{id}/redact'},
 {id:'n_transitions',name:'Transition verifier',g:'seal',p:[1,-11,2],s:'small',major:0,st:'built',
  what:'Replays the whole ledger, proves every change followed the allowed order, and checks the database still matches the sealed history.',io:'In: the ledger. Out: valid or the first broken step.',under:'GET /v1/ledger/transitions'},
 {id:'n_anchor',name:'Merkle anchor',g:'seal',p:[11,-9,0],s:'small',major:1,st:'built',
  what:'Batches ledger entries and keeps only their Merkle root. That root is the only thing that leaves your systems.',io:'In: a batch of entries. Out: one root.',under:'POST /v1/ledger/anchors'},
 {id:'n_public',name:'Public ledger',g:'seal',p:[15,-9,0],s:'small',major:1,st:'built',
  what:'A list of roots anyone can see. No trades, parties or payloads, so nothing here ever needs editing.',io:'Roots only.',under:'GET /v1/ledger/public'},
 {id:'n_polygon',name:'Polygon',g:'seal',p:[19.5,-9,0],s:'chain',major:1,st:'setup',
  what:'Each root can be written to a small contract on Polygon so its date can\'t be backdated. Built, but it needs a funded anchoring wallet and the contract deployed before it runs for real.',
  io:'In: a root and a label.',under:'contracts/AuracularAnchor.sol\npython manage.py deploy-anchor-contract\nGET /v1/ledger/anchors/{id}/onchain'},
 {id:'n_auditor',name:'Auditor\'s laptop',g:'people',p:[19.5,-13.5,1.5],s:'person',major:1,st:'built',
  what:'An auditor checks a proof offline, with no access to your systems. A disclosure proof shows only the fields you chose. A private proof shows only pass or fail.',
  io:'In: a proof file and the public roots.',under:'python verify_proof.py proof.json\nnode zk/verify.mjs proof.json'},
 {id:'n_backup',name:'Encrypted backups',g:'seal',p:[9.5,-14,-1.5],s:'small',major:0,st:'built',
  what:'Daily encrypted backups that record the ledger head. Any backup can be restored into a scratch database and re-verified.',io:'',under:'python manage.py backup\npython manage.py verify-backup FILE'},
 {id:'n_witness',name:'Partner witness',g:'seal',p:[-8,-9,3],s:'small',major:0,st:'built',
  what:'Every 15 minutes Auracular fetches each partner\'s signed ledger head and seals it in your own ledger. If a partner signs two different histories or goes backwards, it is caught and alerted.',
  io:'In: partner checkpoints.',under:'GET /federation/checkpoint\nfederation.py → witness'},
 // rule workshop above
 {id:'w_proposal',name:'Rule change',g:'work',p:[-10,8,0],s:'node',major:1,st:'built',
  what:'Someone proposes a new version of a policy. It gets a fingerprint, and nothing takes effect yet.',io:'Out: a proposal with a fingerprint.',under:'POST /v1/policies/{id}/proposals'},
 {id:'w_z3',name:'Z3 proofs',g:'work',p:[-5.5,10.5,-1],s:'node',major:1,st:'built',
  what:'Proves things about the rule over every possible event, not a sample: can anything pass, which conditions are redundant, and exactly which events the new version newly blocks or allows. Rules nothing can pass are refused.',
  io:'Out: proven facts, each re-checked by the real engine.',under:'POST /v1/policies/{id}/analyze'},
 {id:'w_repair',name:'Policy repair',g:'work',p:[-5.5,5.5,1.5],s:'node',major:0,st:'built',
  what:'Give it events that should pass and events that should fail. The solver finds the smallest edit that gets them right: move a limit, add or drop a list value, drop a condition. Nothing is applied automatically.',
  io:'Out: a suggested new version.',under:'POST /v1/policies/{id}/repair'},
 {id:'w_fidelity',name:'Intentional-fail probes',g:'work',p:[0,9,0],s:'node',major:1,st:'built',
  what:'Builds events designed to fail each condition on purpose, runs them through four separate engines, and requires all four to agree. Then it mutates the rule to prove the probes would notice any change. Every policy save is probed.',
  io:'Out: agreement report, sealed.',under:'POST /v1/policies/{id}/fidelity'},
 {id:'e_engine',name:'Runtime engine',g:'work',p:[0,10.7,0],s:'tiny',major:0,st:'built',what:'Engine 1 of 4: the code that decides real events.',io:'',under:'policy_engine.py'},
 {id:'e_z3',name:'Z3 model',g:'work',p:[0,9,1.7],s:'tiny',major:0,st:'built',what:'Engine 2 of 4: the solver\'s model of the rule.',io:'',under:'policy_proofs.py'},
 {id:'e_r1cs',name:'R1CS circuit',g:'work',p:[0,7.3,0],s:'tiny',major:0,st:'built',what:'Engine 3 of 4: the rule as algebraic constraints.',io:'',under:'circuits.py'},
 {id:'e_wasm',name:'WASM module',g:'work',p:[0,9,-1.7],s:'tiny',major:0,st:'built',what:'Engine 4 of 4: the rule compiled to WebAssembly.',io:'',under:'wasm_compiler.py'},
 {id:'w_r1cs',name:'ZK circuit setup',g:'work',p:[4.5,11.5,-1.5],s:'node',major:0,st:'built',
  what:'Compiles the rule into constraints for zero-knowledge proofs, then runs a one-time Groth16 setup per version. A public multi-party setup means nobody has to trust whoever ran it.',
  io:'Out: proving key and public verification key.',under:'GET /v1/policies/{id}/circuit\nPOST /v1/policies/{id}/zk/setup\npython manage.py zk-contribute / zk-beacon'},
 {id:'w_signoff',name:'3-of-5 sign-off',g:'work',p:[6.5,7.5,0],s:'node',major:1,st:'built',
  what:'Five people hold their own signing keys. Three subjectors check what the rule should do; two translators check the machine version says that. A change goes live only with 2 of 3 subjectors and 1 of 2 translators.',
  io:'In: signatures on the proposal\'s fingerprint. Out: the new version, live and sealed.',under:'POST /v1/policy-proposals/{id}/attest\npython attest.py <proposal> --key <your key>'},
 {id:'w_wasm',name:'Enforce anywhere',g:'work',p:[11.5,10,-1],s:'node',major:0,st:'built',
  what:'Compiles a rule into a tiny WebAssembly program that enforces it inside another system, with no call back to Auracular and no data leaving that system.',
  io:'Out: a portable enforcement module.',under:'GET /v1/policies/{id}/wasm'},
 // people & alerts, in front
 {id:'h_review',name:'Review queue',g:'people',p:[3,-6.5,6],s:'person',major:1,st:'built',
  what:'Held events wait here in the console. A person approves an adapter or releases the event, and the release is sealed. Redactions can require two people.',
  io:'Out: released events go to delivery.',under:'GET /v1/events/held\nPOST /v1/events/{id}/release'},
 {id:'h_sso',name:'Company sign-in',g:'people',p:[-1,-8,8],s:'small',major:0,st:'built',
  what:'People sign in to the console with Okta, Entra ID, Google Workspace or Auth0. Their groups decide what they may do.',io:'',under:'oidc.py'},
 {id:'h_alerts',name:'Alerts',g:'people',p:[8.5,-4,7.5],s:'small',major:1,st:'built',
  what:'Held, blocked, drift, failed delivery, approvals waiting and ledger failures. Fifty held events become one message. Alerts carry counts and links, never data.',io:'',under:'POST /v1/alert-channels'},
 {id:'h_chat',name:'Slack · Teams · email',g:'people',p:[13,-4,8.5],s:'small',major:0,st:'built',what:'Alerts land where people already work.',io:'',under:'alerts.py'},
 // delivery, right
 {id:'d_outbox',name:'Delivery outbox',g:'deliver',p:[10.5,0,0],s:'node',major:1,st:'built',
  what:'A relayed or released event is queued in the same database transaction as its decision, so a restart never loses one.',io:'',under:'delivery.py → queue'},
 {id:'d_worker',name:'Background worker',g:'deliver',p:[13.5,0,0],s:'node',major:0,st:'built',
  what:'Sends due deliveries every few seconds. Failed sends retry after 30s, 2m, 10m, 1h, 6h and 24h, then alert. It also re-verifies the ledger every 15 minutes.',io:'',under:'worker.py\nGET /v1/deliveries'},
 {id:'d_proofs',name:'Proofs in flight',g:'deliver',p:[14.5,4,-1],s:'small',major:0,st:'built',
  what:'A route can withhold sensitive fields from the destination and attach a private proof instead, so the receiver learns the data passed your rules without seeing it.',io:'',under:'delivery_options:\n  withhold_fields: ["bank_account"]\n  attach_proofs: true'},
 {id:'d_webhook',name:'Signed webhook',g:'deliver',p:[17,2,0],s:'node',major:0,st:'built',
  what:'Posts to an HTTPS address. Every request carries a signature header so the receiver can prove it came from you.',io:'',under:'X-Auracular-Signature: t=…,v1=…\nverify_webhook.py'},
 {id:'d_sqlsink',name:'SQL sink',g:'deliver',p:[17,-2,0],s:'node',major:0,st:'built',
  what:'Inserts the event into a table in the destination\'s database.',io:'',under:'"kind": "sql_sink"'},
 // destinations
 {id:'dst_onspring',name:'Onspring',g:'dest',p:[23,5.5,0],s:'sys',major:1,st:'built',
  what:'An Onspring destination connector writes each decision back onto the record through Onspring\'s API v2: status, verdict and sealed hash, into the field IDs you map.',
  io:'In: decision, verdict and sealed hash on the record.',under:'connector kind "onspring"\nPUT https://api.onspring.com/Records (X-ApiKey, X-Api-Version: 2)'},
 {id:'dst_erp',name:'NetSuite / ERP',g:'dest',p:[23,2,0],s:'sys',major:1,st:'built',what:'An ERP receiving relayed events through a signed webhook.',io:'',under:'"kind": "webhook"'},
 {id:'dst_wh',name:'Data warehouse',g:'dest',p:[23,-1.5,0],s:'sys',major:1,st:'built',what:'A warehouse such as Snowflake EU, filled through the SQL sink.',io:'',under:'"kind": "sql_sink"'},
 {id:'dst_partner',name:'Partner\'s Auracular',g:'dest',p:[23,-5,0],s:'sys',major:1,st:'built',what:'Receives the event plus a signed receipt of your decision: which policies, which versions, the sealed entry and a fingerprint of exactly what was delivered.',io:'',under:'federation.py → receipt'}
];
N.push(
 {id:'n_cross',name:'WASM cross-check',g:'core',p:[3,-3.2,2.4],s:'small',major:0,st:'built',
  what:'Every enforced decision is made twice: by the runtime engine and by the same rule compiled to WebAssembly. If they ever disagree, the verdict is Both and the event is held. Two independent paths, one decision.',
  io:'Out: agreed, or held as Both.',under:'crosscheck.py  (AURACULAR_DUAL_PATH, on by default)'},
 {id:'w_dual',name:'Dual independent derivation',g:'work',p:[-10,11.5,-1.5],s:'node',major:1,st:'built',
  what:'One statute, one signed reading, two translators deriving the rule blind. The solver and both rules\' probes compare the two endpoints. Agreement goes to sign-off; disagreement is caught with example events and counted in a published disagreement rate.',
  io:'Out: an agreed rule (proposal) or a sealed disagreement.',under:'POST /v1/policies/{id}/derivations\npython attest.py --derive dv_… --rule rule.json --key …'},
 {id:'w_prov',name:'Provenance chain',g:'work',p:[-14.5,9.5,0],s:'small',major:0,st:'built',
  what:'Statute → signed reading → translator A and B (two lines) → where they meet → solver encoding → circuit → policy version. Each link commits to the one before and names its signer.',
  io:'',under:'GET /v1/policies/{id}/provenance'},
 {id:'n_balance',name:'Trial balance',g:'people',p:[6.5,-8.5,6],s:'small',major:0,st:'built',
  what:'Every event that enters the review queue must leave it through a sealed record. The ledger\'s history and the events table must agree on exactly what is still held; any difference is sealed and alerted.',
  io:'',under:'GET /v1/routes/{id}/balance'}
);
// attestor pentagon around w_signoff
['Subjector 1','Subjector 2','Subjector 3','Translator 1','Translator 2'].forEach((nm,i)=>{
  const a = -Math.PI/2 + i*2*Math.PI/5, c=N.find(n=>n.id==='w_signoff').p;
  N.push({id:'att'+i,name:nm,g:'work',p:[c[0], c[1]+Math.cos(a)*1.9, c[2]+Math.sin(a)*1.9],s:'tiny',major:0,st:'built',
    what:(i<3?'Checks what the rule should do. ':'Checks the machine-readable rule says what the subjectors approved. ')+'Signs with an Ed25519 key that never leaves their own computer.',io:'',under:'python manage.py create-attestor --role '+(i<3?'subjector':'translator'),tint:i<3?'#B9AFFF':'#14C8B8'});
});
const byId = {}; N.forEach(n=>byId[n.id]=n);

// edges [from, to, kind] kind: '' solid | 'plan' dashed planned | 'ctl' dashed control
const E = [
 ['src_onspring','ing_api'],['src_salesforce','ing_api'],['src_workday','ing_api'],['src_db','ing_sql'],['src_partner','ing_fed'],
 ['ing_api','g_route'],['ing_sql','g_route'],['ing_fed','g_route'],
 ['g_route','g_adapt'],['g_adapt','g_drift'],['g_drift','g_policy'],['g_policy','g_decide'],['g_decide','seal'],
 ['g_policy','n_screen'],['g_policy','n_zk'],
 ['seal','ledger'],['ledger','n_anchor'],['n_anchor','n_public'],['n_public','n_polygon'],['n_public','n_auditor'],['ledger','n_transitions'],['ledger','n_backup'],
 ['n_witness','src_partner','ctl'],['n_witness','ledger','ctl'],
 ['seal','d_outbox'],['d_outbox','d_worker'],['d_worker','d_webhook'],['d_worker','d_sqlsink'],['d_worker','d_proofs','ctl'],
 ['d_webhook','dst_erp'],['d_webhook','dst_onspring','plan'],['d_webhook','dst_partner'],['d_sqlsink','dst_wh'],
 ['g_decide','h_review'],['h_review','h_sso','ctl'],['h_review','d_outbox'],['g_decide','h_alerts','ctl'],['h_alerts','h_chat'],
 ['w_proposal','w_z3'],['w_proposal','w_repair'],['w_repair','w_z3','ctl'],['w_z3','w_fidelity'],['w_fidelity','w_r1cs','ctl'],['w_fidelity','w_signoff'],
 ['w_signoff','g_policy'],['w_signoff','w_wasm'],['w_dual','w_proposal'],['w_prov','w_dual','ctl'],['g_decide','n_cross','ctl'],['h_review','n_balance','ctl'],['n_balance','ledger','ctl'],['w_wasm','dst_wh','ctl'],['w_wasm','dst_erp','ctl']
];

/* ---------------- flows (each step moves the tracer to a node) ---------------- */
const FLOWS = [
 {id:'normal',name:'A normal event',sub:'Salesforce to an ERP, start to finish',steps:[
  ['src_salesforce','A contact changes in Salesforce. Salesforce pushes contact.updated.','relay'],
  ['ing_api','It reaches the Events API, signed with the Salesforce connector\'s key. Auracular is listening.'],
  ['g_route','The outer ring finds the governed route Salesforce → ERP, which listens for contact.updated.'],
  ['g_adapt','No adapter is set for this route, so the payload passes through unchanged.'],
  ['g_drift','The fields match the shape the route learned. No drift.'],
  ['g_policy','Policy AUR-POL-014 runs in the path of data: personal data must stay in the EU. Every condition passes.'],
  ['n_zk','A private commitment to the fields the policy read is set aside, so this decision can be proven later without the data.'],
  ['g_decide','Outcome: relayed.'],
  ['seal','The decision is sealed. Its hash covers the previous entry\'s hash.','ok'],
  ['ledger','A new gold block joins the top of the private ledger.','ok'],
  ['d_outbox','The delivery is queued in the same transaction as the decision.','relay'],
  ['d_worker','The worker picks it up within seconds.'],
  ['d_webhook','It is posted with an X-Auracular-Signature header.'],
  ['dst_erp','The ERP receives it and can verify it came from you.','ok']]},
 {id:'block',name:'A policy blocks it',sub:'An overweight shipment from a database',steps:[
  ['src_db','A new row appears in the shipments table: weight 5,200 lb.','relay'],
  ['ing_sql','The SQL poller reads only rows newer than its last cursor and turns this one into shipment.created.'],
  ['g_route','The route Shipments → Warehouse is listening for shipment.created.'],
  ['g_drift','Shape matches. No drift.'],
  ['g_policy','The policy says weight must be at most 4,500. This condition fails.','blocked'],
  ['g_decide','The policy is in enforce mode with on_fail: block. Outcome: <em>blocked</em>. Nothing moves past this ring.','blocked'],
  ['seal','The block is still sealed, with the failing condition recorded. A refusal is evidence too.','blocked'],
  ['h_alerts','An alert fires: one message with a count and a link, never the shipment data.','blocked'],
  ['h_chat','The team sees it in Slack, Teams or email. The warehouse never received bad data.','blocked']]},
 {id:'drift',name:'Data shape changes',sub:'Held, fixed with an adapter, released',steps:[
  ['src_workday','Workday renames a field: salary_band becomes pay_grade.','relay'],
  ['ing_api','The event arrives as employee.updated.'],
  ['g_route','Route Workday → Payroll matches.'],
  ['g_adapt','No adapter exists yet for this new shape.'],
  ['g_drift','The fields differ from the learned shape: one removed, one added. The route says on_drift: hold.','held'],
  ['g_decide','Outcome: <em>held</em>. A shape change outranks a policy result, because a renamed field looks missing and would wrongly fail.','held'],
  ['seal','The hold is sealed.','held'],
  ['h_alerts','An alert goes out: drift detected on Workday → Payroll.','held'],
  ['h_review','In the console, Auracular proposes an adapter: rename pay_grade back to salary_band. It previews what each held event would become and what the policies would decide.','held'],
  ['g_adapt','A person approves. The adapter is sealed and now runs first on every new event. The original payload is kept.','relay'],
  ['g_policy','The held events are reprocessed. Policies pass.'],
  ['seal','The release is sealed.','ok'],
  ['d_outbox','Delivery is queued.','relay'],
  ['d_worker','Sent.'],
  ['d_sqlsink','Written through the SQL sink.'],
  ['dst_wh','Payroll data arrives in the right shape. Nothing broke downstream.','ok']]},
 {id:'onspring',name:'Onspring round trip',sub:'How a platform partner plugs in',steps:[
  ['src_onspring','A vendor record changes in Onspring. A REST API outcome you configure in Onspring fires and posts the record out.','relay'],
  ['ing_api','It lands on Auracular\'s Onspring endpoint. "Vendor Name" becomes vendor_name, "120,000" becomes the number 120000, and the event type is onspring.vendor.updated.'],
  ['g_route','The route Onspring → ERP is listening for vendor.updated.'],
  ['g_drift','The shape matches what the route learned.'],
  ['n_screen','The policy checks the vendor\'s name against the sanctions list and gets a proof that it isn\'t on it.'],
  ['g_policy','All conditions pass.'],
  ['g_decide','Outcome: relayed.'],
  ['seal','Sealed, with the screening proof attached to the decision.','ok'],
  ['d_outbox','Queued for delivery.','relay'],
  ['d_proofs','The route withholds the vendor\'s bank account and attaches a private proof instead. The ERP learns the vendor passed, without seeing the account.'],
  ['d_webhook','Signed and sent.'],
  ['dst_erp','The ERP gets the cleared vendor.','ok'],
  ['dst_onspring','The Onspring destination writes the status, verdict and sealed hash back onto the same vendor record through Onspring\'s API v2, so Onspring users can see it was checked.','ok']]},
 {id:'rule',name:'Changing a rule',sub:'Proofs and sign-off before it goes live',steps:[
  ['w_proposal','A compliance lead proposes raising the weight limit from 4,500 to 5,000 lb. Nothing changes yet.','rule'],
  ['w_z3','Z3 compares old and new over every possible event: exactly the shipments between 4,500 and 5,000 lb are newly allowed. Nothing else changes.'],
  ['w_fidelity','Intentional-fail probes: events built to sit just over each limit, missing fields, wrong types. All four engines must give the same answer on every probe.'],
  ['e_engine','The runtime engine…'],['e_z3','…the Z3 model…'],['e_r1cs','…the R1CS circuit…'],['e_wasm','…and the WASM module agree. The rule is then mutated to show the probes would catch any change.'],
  ['w_signoff','Sign-off: the proposal\'s fingerprint needs 2 of 3 subjectors and 1 of 2 translators, each signing with their own key.'],
  ['att0','Subjector 1 signs.'],['att2','Subjector 3 signs.'],['att3','Translator 1 signs. Threshold met.'],
  ['g_policy','The new version goes live in the policy engine, and every signature is sealed.','ok'],
  ['w_wasm','The rule is also compiled to a WASM module that can enforce it inside other systems.','rule']]},
 {id:'dd',name:'Dual independent derivation',sub:'Two translators, one rule, derived blind',steps:[
  ['w_prov','A statute is registered with its citation, and a structured reading of it. A subjector signs the reading with their own key.','rule'],
  ['w_dual','Two translators each derive the machine rule from that reading. Neither can see the other\'s rule until both are in, so neither can copy the other.'],
  ['w_z3','Once both are in, the solver compares both rules over every possible event, and both rules\' intentional-fail probes run through both.'],
  ['w_dual','If they disagree, the events they treat differently are sealed and alerted, and the published disagreement rate goes up. Nothing is applied.','held'],
  ['w_signoff','If they agree, the rule goes to 3-of-5 sign-off with its provenance chain: statute, reading, both lines, the meeting point, the encoding and the circuit.','rule'],
  ['g_policy','Signed off, it goes live. Every enforced decision is then made twice at runtime, by the engine and the WASM module.','ok'],
  ['n_cross','If those two ever disagree, the verdict is Both and the event is held. The instrument is broken, not the data.','held']]},
 {id:'audit',name:'Proving it to an auditor',sub:'From your ledger to an offline check',steps:[
  ['ledger','The private ledger holds every decision in full, in your own database.','ok'],
  ['n_transitions','The transition verifier replays it: every change followed the allowed order and the database matches the sealed history.'],
  ['n_anchor','A batch of entries is reduced to one Merkle root.'],
  ['n_public','Only the root goes to the public ledger. No payloads, no parties.'],
  ['n_polygon','<em>Once the anchoring wallet is funded</em>, the root is also written to Polygon so its date can\'t be backdated.','held'],
  ['n_auditor','The auditor gets a proof for one entry, revealing only the fields you chose, or a private proof showing only pass or fail. They check it offline with verify_proof.py, with no access to your systems.','ok']]},
 {id:'fed',name:'Partner handoff',sub:'Two companies, two Auracular installs',steps:[
  ['seal','Your decision on a shipment is sealed.','ok'],
  ['d_outbox','Queued for delivery to your partner.','relay'],
  ['d_webhook','Sent with a signed receipt: which policies ran, which versions, the sealed entry, and a fingerprint of exactly what was delivered.'],
  ['dst_partner','The partner\'s Auracular checks the receipt on arrival. If it doesn\'t match the payload, the event is held on their side.','ok'],
  ['n_witness','Every 15 minutes each side fetches the other\'s signed ledger head and seals it. If either ever signs two histories or rolls back, it is caught.','rule'],
  ['ledger','Your ledger becomes evidence of their history, and theirs of yours.','ok']]}
];

/* ---------------- three.js scene ---------------- */
const stage = document.getElementById('stage');
const renderer = new T.WebGLRenderer({antialias:true,alpha:false});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.setClearColor(0x070A1F,1);
stage.appendChild(renderer.domElement);
const scene = new T.Scene();
scene.fog = new T.FogExp2(0x070A1F,0.011);
const camera = new T.PerspectiveCamera(45,1,0.1,400);
scene.add(new T.AmbientLight(0x8090ff,0.55));
const key = new T.DirectionalLight(0xffffff,0.9); key.position.set(10,20,15); scene.add(key);
const rim = new T.PointLight(0x5BA3F0,1.2,60); rim.position.set(-12,6,-14); scene.add(rim);
const goldLight = new T.PointLight(0xE0A526,1.4,14); goldLight.position.set(5.6,0,0); scene.add(goldLight);

// starfield
(function(){
  const g=new T.BufferGeometry(),n=1400,a=new Float32Array(n*3);
  for(let i=0;i<n;i++){const r=110+Math.random()*90,t=Math.random()*Math.PI*2,p=Math.acos(2*Math.random()-1);
    a[i*3]=r*Math.sin(p)*Math.cos(t);a[i*3+1]=r*Math.cos(p);a[i*3+2]=r*Math.sin(p)*Math.sin(t);}
  g.setAttribute('position',new T.BufferAttribute(a,3));
  scene.add(new T.Points(g,new T.PointsMaterial({color:0xaab4ff,size:0.5,sizeAttenuation:true,transparent:true,opacity:.7,fog:false})));
})();

// faint floor grid under the core (the "time floor")
(function(){
  const grid=new T.GridHelper(60,30,0x2a3470,0x161c48); grid.position.y=-15.5; grid.material.transparent=true; grid.material.opacity=.35; scene.add(grid);
})();

// glow sprite texture
function glowTex(){
  const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');
  const gr=x.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.25,'rgba(255,255,255,.55)');gr.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=gr;x.fillRect(0,0,64,64);return new T.CanvasTexture(c);
}
const GLOW = glowTex();
function glow(color,scale){const s=new T.Sprite(new T.SpriteMaterial({map:GLOW,color:new T.Color(color),transparent:true,blending:T.AdditiveBlending,depthWrite:false}));s.scale.set(scale,scale,1);return s;}

// group zones (soft translucent shells to show the four regions)
function zone(label,pos,size,color){
  const geo=new T.BoxGeometry(size[0],size[1],size[2]);
  const m=new T.Mesh(geo,new T.MeshBasicMaterial({color,transparent:true,opacity:.025,depthWrite:false}));
  m.position.set(...pos);scene.add(m);
  const e=new T.LineSegments(new T.EdgesGeometry(geo),new T.LineBasicMaterial({color,transparent:true,opacity:.12}));e.position.copy(m.position);scene.add(e);
}
zone('workshop',[0.5,9,0],[25,8,7],0x8B7CFF);

const pickables=[]; const meshes={};
function v3(p){return new T.Vector3(p[0],p[1],p[2]);}
N.forEach(n=>{
  const col=new T.Color(n.tint||G[n.g].color);
  const grp=new T.Group(); grp.position.copy(v3(n.p)); scene.add(grp);
  let body, hit;
  const std=(o)=>new T.MeshStandardMaterial(Object.assign({color:col,emissive:col,emissiveIntensity:.35,metalness:.3,roughness:.45,transparent:true,opacity:1},o||{}));
  if(n.s==='gate'){
    body=new T.Mesh(new T.TorusGeometry(n.r,0.12+n.r*0.03,16,96),std({emissiveIntensity:.6}));
    body.rotation.y=Math.PI/2;
    // inner disc so the ring reads as a membrane the event passes through
    const disc=new T.Mesh(new T.CircleGeometry(n.r,64),new T.MeshBasicMaterial({color:col,transparent:true,opacity:.05,side:T.DoubleSide,depthWrite:false}));
    disc.rotation.y=Math.PI/2; grp.add(disc);
    hit=new T.Mesh(new T.SphereGeometry(Math.min(1.3,n.r*.6),12,12),new T.MeshBasicMaterial({visible:false}));
  } else if(n.s==='core'){
    body=new T.Mesh(new T.SphereGeometry(.75,40,40),std({color:new T.Color('#E0A526'),emissive:new T.Color('#E0A526'),emissiveIntensity:.9,metalness:.6,roughness:.25}));
    grp.add(glow('#E0A526',4.5));
  } else if(n.s==='sys'){
    body=new T.Mesh(new T.BoxGeometry(1.6,1.6,1.6),std({emissiveIntensity:.25,opacity:n.st==='planned'?.55:1}));
    const ed=new T.LineSegments(new T.EdgesGeometry(body.geometry),new T.LineBasicMaterial({color:col,transparent:true,opacity:.9}));grp.add(ed);
  } else if(n.s==='node'){
    body=new T.Mesh(new T.IcosahedronGeometry(.62,1),std({flatShading:true}));
  } else if(n.s==='small'){
    body=new T.Mesh(new T.OctahedronGeometry(.48,0),std({flatShading:true}));
  } else if(n.s==='tiny'){
    body=new T.Mesh(new T.SphereGeometry(.3,16,16),std({emissiveIntensity:.6}));
  } else if(n.s==='person'){
    body=new T.Group();
    const head=new T.Mesh(new T.SphereGeometry(.32,20,20),std()); head.position.y=.55;
    const tor=new T.Mesh(new T.CylinderGeometry(.18,.5,.8,20),std()); tor.position.y=-.1;
    body.add(head,tor);
  } else if(n.s==='chain'){
    body=new T.Group();
    for(let i=0;i<4;i++){const b=new T.Mesh(new T.BoxGeometry(.6,.6,.6),std({flatShading:true}));b.position.set(i*.75-1.1,0,0);b.rotation.set(.3,.5,0);body.add(b);}
  }
  grp.add(body);
  if(!hit) hit=new T.Mesh(new T.SphereGeometry(n.s==='sys'?1.2:n.s==='tiny'?.45:.85,10,10),new T.MeshBasicMaterial({visible:false}));
  hit.userData.id=n.id; grp.add(hit); pickables.push(hit);
  const halo=glow(G[n.g].color,n.s==='gate'?0:n.s==='sys'?3.2:2.2); halo.material.opacity=n.s==='gate'?0:.35; grp.add(halo);
  meshes[n.id]={grp,body,halo,col,base:halo.material.opacity};
});

// curved edge helper: gentle arc between two nodes
function curve(a,b){
  const A=v3(byId[a].p),B=v3(byId[b].p);
  const mid=A.clone().add(B).multiplyScalar(.5);
  const d=A.distanceTo(B);
  const straight=(byId[a].g==='core'&&byId[b].g==='core'&&A.y===B.y&&A.z===B.z);
  if(!straight){ mid.y+= (A.y===B.y? d*.12 : 0); }
  return new T.QuadraticBezierCurve3(A,mid,B);
}
const edgeObjs=[];
E.forEach(([a,b,k])=>{
  const c=curve(a,b), pts=c.getPoints(40), g=new T.BufferGeometry().setFromPoints(pts);
  const color=new T.Color(G[byId[a].g].color).lerp(new T.Color(G[byId[b].g].color),.5);
  let mat = k ? new T.LineDashedMaterial({color,dashSize:.35,gapSize:.3,transparent:true,opacity:k==='plan'?.75:.4})
              : new T.LineBasicMaterial({color,transparent:true,opacity:.42});
  const line=new T.Line(g,mat); if(k) line.computeLineDistances(); scene.add(line);
  edgeObjs.push({a,b,line,base:mat.opacity});
});

// the spine: a soft beam through the rings (the path of data)
(function(){
  const g=new T.CylinderGeometry(.05,.05,14.6,8); const m=new T.Mesh(g,new T.MeshBasicMaterial({color:0x5BA3F0,transparent:true,opacity:.35}));
  m.rotation.z=Math.PI/2; m.position.set(-1.7,0,0); scene.add(m);
})();

/* ---------------- ledger helix: the time axis ---------------- */
const MAXB=420; const LEDG=byId.ledger.p;
const blockGeo=new T.BoxGeometry(.34,.2,.34);
const blockMat=new T.MeshStandardMaterial({color:0xE0A526,emissive:0xE0A526,emissiveIntensity:.35,metalness:.6,roughness:.35});
const blocks=new T.InstancedMesh(blockGeo,blockMat,MAXB); blocks.count=0; scene.add(blocks);
const blockState=[]; // {kind}
const kindColor={ok:new T.Color('#E0A526'),held:new T.Color('#F0B429'),blocked:new T.Color('#E5484D'),rule:new T.Color('#8B7CFF')};
const tmpM=new T.Matrix4(), tmpQ=new T.Quaternion(), tmpS=new T.Vector3(1,1,1), tmpP=new T.Vector3();
function layoutBlocks(){
  const n=blockState.length;
  for(let i=0;i<n;i++){ // i=0 newest, at top
    const age=i, ang=age*0.42, y=LEDG[1]-1.0-age*0.026, r=1.25+Math.min(age,120)*0.004;
    tmpP.set(LEDG[0]+Math.cos(ang)*r, y, LEDG[2]+Math.sin(ang)*r);
    tmpQ.setFromAxisAngle(new T.Vector3(0,1,0),-ang);
    tmpM.compose(tmpP,tmpQ,tmpS); blocks.setMatrixAt(i,tmpM);
    const c=kindColor[blockState[i]]||kindColor.ok; blocks.setColorAt(i, c.clone().multiplyScalar(i<40?1:Math.max(.35,1-(i-40)/380)));
  }
  blocks.count=n; blocks.instanceMatrix.needsUpdate=true; if(blocks.instanceColor) blocks.instanceColor.needsUpdate=true;
}
// faint helix guide + time ticks
(function(){
  const pts=[];for(let i=0;i<MAXB;i+=2){const a=i*.42;pts.push(new T.Vector3(LEDG[0]+Math.cos(a)*1.25,LEDG[1]-1-i*.026,LEDG[2]+Math.sin(a)*1.25));}
  scene.add(new T.Line(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:0xE0A526,transparent:true,opacity:.12})));
  const axis=new T.Mesh(new T.CylinderGeometry(.03,.03,11.5,6),new T.MeshBasicMaterial({color:0xE0A526,transparent:true,opacity:.3}));
  axis.position.set(LEDG[0],LEDG[1]-6.6,LEDG[2]); scene.add(axis);
})();
let sealedCount=0, anchored=0;
function addBlock(kind){
  blockState.unshift(kind||'ok'); if(blockState.length>MAXB) blockState.pop();
  layoutBlocks(); sealedCount++; flashSeal();
  if(sealedCount%16===0) anchorPulse();
}
for(let i=0;i<60;i++) blockState.push(Math.random()<.85?'ok':Math.random()<.6?'held':'blocked');
layoutBlocks();

/* ---------------- tracers (particles that follow edges) ---------------- */
const STC={relay:'#5BA3F0',ok:'#3FBF7F',held:'#F0B429',blocked:'#E5484D',rule:'#8B7CFF',gold:'#E0A526'};
const tracers=[];
function makeTracer(color,big){
  const g=new T.Group();
  const core=new T.Mesh(new T.SphereGeometry(big?.2:.13,12,12),new T.MeshBasicMaterial({color:new T.Color(color)}));
  const gl=glow(color,big?1.8:1.1); g.add(core,gl); scene.add(g);
  const trail=[];for(let i=0;i<(big?10:5);i++){const t=glow(color,(big?1.1:.7)*(1-i/12));t.material.opacity=.5*(1-i/(big?10:5));scene.add(t);trail.push(t);}
  return {g,core,gl,trail,hist:[]};
}
function setTracerColor(tr,color){const c=new T.Color(color);tr.core.material.color=c;tr.gl.material.color=c;tr.trail.forEach(t=>t.material.color=c);}
function disposeTracer(tr){scene.remove(tr.g);tr.trail.forEach(t=>scene.remove(t));}
function pathCurve(a,b){
  // use an edge curve if one exists, else a lifted arc
  const ed=E.find(e=>(e[0]===a&&e[1]===b)); if(ed) return curve(a,b);
  const rev=E.find(e=>(e[0]===b&&e[1]===a)); if(rev){const c=curve(b,a);return {getPoint:t=>c.getPoint(1-t)};}
  const A=v3(byId[a].p),B=v3(byId[b].p),mid=A.clone().add(B).multiplyScalar(.5); mid.y+=A.distanceTo(B)*.25;
  return new T.QuadraticBezierCurve3(A,mid,B);
}
function moveTracer(tr,pos){tr.g.position.copy(pos);tr.hist.unshift(pos.clone());if(tr.hist.length>40)tr.hist.pop();
  tr.trail.forEach((t,i)=>{const h=tr.hist[Math.min(tr.hist.length-1,(i+1)*2)];if(h)t.position.copy(h);});}

/* ---------------- live traffic (the 4th dimension: time) ---------------- */
let live=true, simSec=9*3600, stats={relayed:0,held:0,blocked:0};
const liveEvents=[];
const ROUTES=[
 {src:'src_salesforce',ing:'ing_api',dst:['d_webhook','dst_erp']},
 {src:'src_workday',ing:'ing_api',dst:['d_sqlsink','dst_wh']},
 {src:'src_db',ing:'ing_sql',dst:['d_sqlsink','dst_wh']},
 {src:'src_onspring',ing:'ing_api',dst:['d_webhook','dst_erp']},
 {src:'src_partner',ing:'ing_fed',dst:['d_webhook','dst_partner']}
];
function spawnLive(){
  const r=ROUTES[Math.floor(Math.random()*ROUTES.length)];
  const roll=Math.random(), outcome=roll<.8?'relay':roll<.91?'held':'blocked';
  let path=[r.src,r.ing,'g_route','g_adapt','g_drift','g_policy','g_decide','seal'];
  if(outcome==='relay') path=path.concat(['d_outbox','d_worker'],r.dst);
  else if(outcome==='held') path=path.concat(['h_review']);
  const tr=makeTracer(STC.relay,false);
  liveEvents.push({tr,path,i:0,t:0,outcome,speed:1.2+Math.random()*.5,sealed:false});
}
function stepLive(dt){
  for(let k=liveEvents.length-1;k>=0;k--){
    const ev=liveEvents[k]; const a=ev.path[ev.i], b=ev.path[ev.i+1];
    if(!b){ disposeTracer(ev.tr); liveEvents.splice(k,1); continue; }
    const c=pathCurve(a,b); const len=v3(byId[a].p).distanceTo(v3(byId[b].p));
    ev.t+=dt*ev.speed*6/Math.max(len,1.5);
    if(ev.t>=1){
      ev.t=0; ev.i++;
      const at=ev.path[ev.i];
      if(at==='g_decide'){ setTracerColor(ev.tr,STC[ev.outcome==='relay'?'relay':ev.outcome]); pulse(at,STC[ev.outcome==='relay'?'relay':ev.outcome]); }
      if(at==='seal'&&!ev.sealed){ ev.sealed=true; addBlock(ev.outcome==='relay'?'ok':ev.outcome); stats[ev.outcome==='relay'?'relayed':ev.outcome]++;
        if(ev.outcome==='blocked'){ ev.path=ev.path.slice(0,ev.i+1); } }
      continue;
    }
    moveTracer(ev.tr,c.getPoint(ev.t));
  }
}
// pulses that run along the anchor / witness paths
const pulses=[];
function pulseRun(path,color){const tr=makeTracer(color,false);pulses.push({tr,path,i:0,t:0});}
function anchorPulse(){anchored++; pulseRun(['ledger','n_anchor','n_public','n_polygon'],STC.gold);}
function stepPulses(dt){
  for(let k=pulses.length-1;k>=0;k--){const p=pulses[k];const a=p.path[p.i],b=p.path[p.i+1];
    if(!b){disposeTracer(p.tr);pulses.splice(k,1);continue;}
    p.t+=dt*1.6; if(p.t>=1){p.t=0;p.i++;pulse(p.path[p.i],'#E0A526');continue;}
    moveTracer(p.tr,pathCurve(a,b).getPoint(p.t));}
}
let flashT=0; function flashSeal(){flashT=1;}
const pulsing={}; function pulse(id,color){pulsing[id]={t:1,color:new T.Color(color)};}

/* ---------------- labels ---------------- */
const labelsEl=document.getElementById('labels');
const labelEls={};
N.forEach(n=>{
  const d=document.createElement('div'); d.className='lbl'+(n.major?'':' minor')+(n.st==='planned'?' planned':''); d.tabIndex=0; d.setAttribute('role','button');
  d.innerHTML='<span class="dot" style="background:'+(n.tint||G[n.g].color)+'"></span>'+n.name+(n.st==='planned'?' <span class="tag">planned</span>':n.st==='setup'?' <span class="tag">setup</span>':'');
  d.addEventListener('click',e=>{e.stopPropagation();select(n.id,true);});
  d.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(n.id,true);}});
  d.addEventListener('mouseenter',()=>{hover=n.id;}); d.addEventListener('mouseleave',()=>{if(hover===n.id)hover=null;});
  labelsEl.appendChild(d); labelEls[n.id]=d;
});
let allLabels=false, hover=null, selected=null, focusSet=null;
const pv=new T.Vector3();
function updateLabels(){
  const w=renderer.domElement.clientWidth,h=renderer.domElement.clientHeight;
  N.forEach(n=>{
    const el=labelEls[n.id]; const m=meshes[n.id];
    const show = n.major || allLabels || hover===n.id || selected===n.id || (focusSet&&focusSet.has(n.id));
    pv.copy(m.grp.position); const off=n.s==='gate'?n.r+.5:n.s==='sys'?1.3:n.s==='tiny'?.45:.85; pv.y+=off;
    pv.project(camera);
    if(!show||pv.z>1){el.style.opacity=0;el.style.visibility='hidden';return;}
    const x=(pv.x*.5+.5)*w,y=(-pv.y*.5+.5)*h;
    const dist=camera.position.distanceTo(m.grp.position);
    let op=Math.max(.25,Math.min(1,1.6-dist/70));
    if(focusSet&&!focusSet.has(n.id)&&selected!==n.id) op*=.3;
    if(selected===n.id||hover===n.id) op=1;
    el.style.visibility='visible'; el.style.opacity=op.toFixed(2);
    el.style.transform='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px) translate(-50%,-100%)';
    el.style.zIndex=String(1000-Math.round(dist));
    el.classList.toggle('on',selected===n.id);
    el.style.color=selected===n.id?(n.tint||G[n.g].color):'';
  });
}

/* ---------------- camera orbit (drag, wheel, pinch) ---------------- */
const target=new T.Vector3(0,0,0), goalTarget=new T.Vector3(0,-1,0);
let rad=62, phi=1.22, theta=1.0; // spherical
let gRad=rad,gPhi=phi,gTheta=theta;
function resetView(){gRad=window.innerWidth<860?165:62;gPhi=1.22;gTheta=1.22;goalTarget.set(1,-1,0);}
resetView(); rad=gRad+30;
let drag=null, pinch=null, moved=0;
const cv=renderer.domElement;
cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,id:e.pointerId,btn:e.button};moved=0;cv.classList.add('dragging');});
cv.addEventListener('pointermove',e=>{
  if(drag&&e.pointerId===drag.id&&!pinch){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;moved+=Math.abs(dx)+Math.abs(dy);
    if(drag.btn===2||e.shiftKey){ // pan
      const s=gRad*.0016; const right=new T.Vector3().subVectors(camera.position,target).cross(camera.up).normalize();
      goalTarget.addScaledVector(right,dx*s); goalTarget.y+=dy*s;
    } else { gTheta-=dx*.005; gPhi=Math.max(.15,Math.min(Math.PI-.15,gPhi-dy*.005)); }
  } else { pointerHover(e); }
});
cv.addEventListener('pointerup',e=>{cv.classList.remove('dragging');if(drag&&moved<6)pick(e);drag=null;});
cv.addEventListener('pointercancel',()=>{drag=null;cv.classList.remove('dragging');});
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('wheel',e=>{e.preventDefault();gRad=Math.max(12,Math.min(180,gRad*(1+Math.sign(e.deltaY)*.08)));},{passive:false});
cv.addEventListener('touchstart',e=>{if(e.touches.length===2){pinch=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);}},{passive:true});
cv.addEventListener('touchmove',e=>{if(pinch&&e.touches.length===2){const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);gRad=Math.max(12,Math.min(180,gRad*pinch/d));pinch=d;}},{passive:true});
cv.addEventListener('touchend',e=>{if(e.touches.length<2)pinch=null;},{passive:true});
const ray=new T.Raycaster(), mouse=new T.Vector2();
function hitAt(e){const r=cv.getBoundingClientRect();mouse.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);ray.setFromCamera(mouse,camera);const h=ray.intersectObjects(pickables,false);return h.length?h[0].object.userData.id:null;}
function pointerHover(e){const id=hitAt(e);hover=id;cv.style.cursor=id?'pointer':'grab';}
function pick(e){const id=hitAt(e); if(id) select(id,false); else if(!flow) closeDrawer();}

/* ---------------- detail drawer ---------------- */
const drawer=document.getElementById('drawer');
const neighbors=id=>{const s=new Set();E.forEach(([a,b])=>{if(a===id)s.add(b);if(b===id)s.add(a);});return [...s];};
function esc(s){return String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
function select(id,fly){
  selected=id; const n=byId[id], st=STATUS[n.st], gc=n.tint||G[n.g].color;
  drawer.innerHTML='<div class="head"><h3>'+esc(n.name)+'</h3><button class="x" id="dx" aria-label="Close">×</button></div>'+
   '<div class="chips"><span class="chip" style="color:'+gc+'">'+G[n.g].name+'</span><span class="chip" style="color:'+st.c+'">'+st.t+'</span></div>'+
   '<p>'+esc(n.what)+'</p>'+(n.io?'<p style="color:var(--muted)">'+esc(n.io)+'</p>':'')+
   (n.under?'<div class="sec">Under the hood</div><code>'+esc(n.under)+'</code>':'')+
   '<div class="sec">Connected to</div><div class="links">'+neighbors(id).map(x=>'<button data-id="'+x+'">'+esc(byId[x].name)+'</button>').join('')+'</div>';
  drawer.hidden=false;
  drawer.querySelector('#dx').onclick=closeDrawer;
  drawer.querySelectorAll('.links button').forEach(b=>b.onclick=()=>select(b.dataset.id,true));
  if(fly) flyTo(id);
}
function closeDrawer(){drawer.hidden=true;selected=null;}
function flyTo(id){const p=byId[id].p;goalTarget.set(p[0]*.6,p[1]*.6,p[2]*.6);}

/* ---------------- guided flows ---------------- */
const flowsEl=document.getElementById('flows');
FLOWS.forEach(f=>{const b=document.createElement('button');b.className='flow';b.dataset.id=f.id;b.innerHTML=f.name+'<small>'+f.sub+'</small>';b.onclick=()=>startFlow(f.id);flowsEl.appendChild(b);});
let flow=null, fStep=0, fT=0, fPlaying=true, fTracer=null, fHold=0, fFrom=null;
const nTitle=document.getElementById('nTitle'),nText=document.getElementById('nText'),nStep=document.getElementById('nStep'),nCtl=document.getElementById('nCtl'),nBar=document.getElementById('nBar'),bPlay=document.getElementById('bPlay');
const LIVE_TEXT=nText.innerHTML;
function startFlow(id){
  flow=FLOWS.find(f=>f.id===id); fStep=0; fT=1; fHold=0; fFrom=null;
  focusSet=new Set(flow.steps.map(s=>s[0]));
  document.querySelectorAll('.flow').forEach(b=>b.classList.toggle('active',b.dataset.id===id));
  if(fTracer) disposeTracer(fTracer); fTracer=makeTracer(STC[flow.steps[0][2]||'relay'],true);
  moveTracer(fTracer,v3(byId[flow.steps[0][0]].p)); fTracer.hist=[];
  nTitle.textContent=flow.name; nCtl.hidden=false; fPlaying=true; bPlay.textContent='Pause'; bPlay.setAttribute('aria-pressed','true');
  showStep(); selectQuiet(flow.steps[0][0]);
}
function selectQuiet(id){ select(id,false); const p=byId[id].p; goalTarget.set(p[0]*.55,p[1]*.55,p[2]*.55); }
function showStep(){
  const s=flow.steps[fStep]; nText.innerHTML=s[1]; nStep.textContent=(fStep+1)+' / '+flow.steps.length;
  nBar.style.width=((fStep+1)/flow.steps.length*100)+'%';
  if(s[2]) setTracerColor(fTracer,STC[s[2]]);
}
function goStep(i){
  if(!flow) return; i=Math.max(0,Math.min(flow.steps.length-1,i)); if(i===fStep) return;
  fFrom=flow.steps[fStep][0]; fStep=i; fT=0; fHold=0; showStep(); selectQuiet(flow.steps[i][0]);
  // replay the step color history up to i
  let c='relay'; for(let k=0;k<=i;k++){ if(flow.steps[k][2]) c=flow.steps[k][2]; } setTracerColor(fTracer,STC[c]);
}
function exitFlow(){ if(fTracer){disposeTracer(fTracer);fTracer=null;} flow=null; focusSet=null; nCtl.hidden=true; nTitle.textContent='Live traffic'; nText.innerHTML=LIVE_TEXT; nStep.textContent='';
  document.querySelectorAll('.flow').forEach(b=>b.classList.remove('active')); closeDrawer(); resetView(); }
function stepFlow(dt){
  if(!flow||!fTracer) return;
  const to=flow.steps[fStep][0];
  if(fFrom && fT<1){ const a=fFrom; const c=pathCurve(a,to); const len=v3(byId[a].p).distanceTo(v3(byId[to].p));
    fT=Math.min(1,fT+dt*7/Math.max(len,2)); moveTracer(fTracer,c.getPoint(fT));
    if(fT>=1){ pulse(to,'#FFFFFF'); if(['seal'].includes(to)) addBlock(flow.steps[fStep][2]==='blocked'?'blocked':flow.steps[fStep][2]==='held'?'held':'ok'); }
  } else { moveTracer(fTracer,v3(byId[to].p)); if(fPlaying){ fHold+=dt; if(fHold>(reduce?6:3.6)){ if(fStep<flow.steps.length-1) goStep(fStep+1); else { fPlaying=false; bPlay.textContent='Replay'; bPlay.setAttribute('aria-pressed','false'); } } } }
}
document.getElementById('bNext').onclick=()=>goStep(fStep+1);
document.getElementById('bPrev').onclick=()=>{ if(!flow) return; const i=Math.max(0,fStep-1); fFrom=null; fStep=i; fT=1; showStep(); selectQuiet(flow.steps[i][0]); let c='relay'; for(let k=0;k<=i;k++){ if(flow.steps[k][2]) c=flow.steps[k][2]; } setTracerColor(fTracer,STC[c]); fTracer.hist=[]; };
bPlay.onclick=()=>{ if(!flow) return; if(!fPlaying && fStep===flow.steps.length-1){ startFlow(flow.id); return; } fPlaying=!fPlaying; bPlay.textContent=fPlaying?'Pause':'Play'; bPlay.setAttribute('aria-pressed',String(fPlaying)); };
document.getElementById('bExit').onclick=exitFlow;
document.addEventListener('keydown',e=>{ if(!flow) return; if(e.key==='ArrowRight') goStep(fStep+1); if(e.key==='ArrowLeft') document.getElementById('bPrev').click(); if(e.key==='Escape') exitFlow(); });

/* ---------------- HUD toggles + legend ---------------- */
const bLive=document.getElementById('bLive'), bLabels=document.getElementById('bLabels');
bLive.onclick=()=>{live=!live;bLive.setAttribute('aria-pressed',String(live));};
bLabels.onclick=()=>{allLabels=!allLabels;bLabels.setAttribute('aria-pressed',String(allLabels));};
document.getElementById('bView').onclick=()=>{ if(flow) exitFlow(); else { closeDrawer(); resetView(); } };
const li=document.getElementById('legendItems');
Object.keys(G).filter(k=>k!=='dest'&&k!=='listen').forEach(k=>{const s=document.createElement('span');s.innerHTML='<i style="background:'+G[k].color+'"></i>'+(k==='sys'?'Systems in and out':G[k].name);li.appendChild(s);});
[['#5BA3F0','Relayed'],['#F0B429','Held / planned'],['#E5484D','Blocked'],['#3FBF7F','Sealed, delivered']].forEach(([c,t])=>{const s=document.createElement('span');s.innerHTML='<i style="background:'+c+';border-radius:50%"></i>'+t;li.appendChild(s);});

/* ---------------- loop ---------------- */
function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
window.addEventListener('resize',resize); resize();
const sClock=document.getElementById('sClock'),sSealed=document.getElementById('sSealed'),sRel=document.getElementById('sRelayed'),sHeld=document.getElementById('sHeld'),sBlk=document.getElementById('sBlocked'),sAnch=document.getElementById('sAnch');
let last=performance.now(), spawnAcc=0, witnessAcc=0, hudAcc=0, tAll=0;
function pad(n){return String(n).padStart(2,'0');}
function frame(now){
  const dt=Math.min(.05,(now-last)/1000); last=now; tAll+=dt;
  // camera easing
  const k=1-Math.pow(.001,dt);
  rad+=(gRad-rad)*k; phi+=(gPhi-phi)*k; theta+=(gTheta-theta)*k; target.lerp(goalTarget,k);
  if(!drag&&!flow&&!selected&&!reduce) gTheta+=dt*.018;
  camera.position.set(target.x+rad*Math.sin(phi)*Math.cos(theta),target.y+rad*Math.cos(phi),target.z+rad*Math.sin(phi)*Math.sin(theta));
  camera.lookAt(target);
  // time: 1 real second = 1 simulated minute
  if(live){ simSec+=dt*60; spawnAcc+=dt; witnessAcc+=dt;
    const rate=flow?1.6:.55; if(spawnAcc>rate){spawnAcc=0; if(liveEvents.length<28) spawnLive();}
    if(witnessAcc>15){witnessAcc=0; pulseRun(['src_partner','n_witness','ledger'],STC.rule); addBlock('rule');}
  }
  stepLive(live?dt:0); stepPulses(dt); stepFlow(dt);
  // live tracers dim while a flow is focused
  liveEvents.forEach(ev=>{const o=flow?.25:1; ev.tr.core.material.opacity=o; ev.tr.core.material.transparent=true; ev.tr.gl.material.opacity=o*.9; ev.tr.trail.forEach(t=>t.material.opacity=Math.min(t.material.opacity,o*.5));});
  // ring spin + node pulses
  N.forEach(n=>{const m=meshes[n.id];
    if(n.s==='gate'){ m.body.rotation.x+=dt*(.25+(5-n.r)*.12)*(n.id.length%2?1:-1); }
    if(n.s==='node'||n.s==='small'){ m.body.rotation.y+=dt*.4; }
    let emis=n.s==='gate'?.6:.35;
    const pu=pulsing[n.id]; if(pu){ pu.t-=dt*1.4; if(pu.t<=0) delete pulsing[n.id]; }
    const dim=focusSet&&!focusSet.has(n.id)&&selected!==n.id;
    const tgt=(dim?.18:1);
    m.body.traverse(o=>{ if(o.material&&o.material.emissive){ o.material.opacity+= (tgt-o.material.opacity)*k*2; o.material.emissiveIntensity=emis+(pu?pu.t*1.4:0)+(selected===n.id?.5:0)+(hover===n.id?.3:0); } });
    m.halo.material.opacity=(m.base*(dim?.3:1))+(pu?pu.t*.8:0)+(selected===n.id?.35:0);
  });
  edgeObjs.forEach(o=>{const on=!focusSet||(focusSet.has(o.a)&&focusSet.has(o.b)); o.line.material.opacity+=((on?o.base:o.base*.25)-o.line.material.opacity)*k*2;});
  // seal flash
  if(flashT>0){flashT=Math.max(0,flashT-dt*3);} goldLight.intensity=1.2+flashT*3; meshes.seal.body.scale.setScalar(1+flashT*.25+Math.sin(tAll*2)*.03);
  renderer.render(scene,camera); updateLabels();
  hudAcc+=dt; if(hudAcc>.2){hudAcc=0; const s=Math.floor(simSec)%86400; sClock.textContent=pad(Math.floor(s/3600))+':'+pad(Math.floor(s/60)%60)+':'+pad(s%60);
    sSealed.textContent=(60+sealedCount).toLocaleString('en-US'); sRel.textContent=stats.relayed; sHeld.textContent=stats.held; sBlk.textContent=stats.blocked; sAnch.textContent=anchored; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// deep link: #flow-onspring etc.
const h=(location.hash||'').replace('#','');
if(h.indexOf('flow-')===0 && FLOWS.find(f=>f.id===h.slice(5))) setTimeout(()=>startFlow(h.slice(5)),600);
})();
