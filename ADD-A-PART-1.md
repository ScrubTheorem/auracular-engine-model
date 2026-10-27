# Add a part and a flow

This example adds a "Slack audit channel" part fed by the Alerts node, then a flow that follows an alert to it.

## 1. Add the part to `N` in `app.js`

Add a comma after the last item in the array, then add this object before the closing `];`:

    {id:'x_slack_audit',name:'Audit channel',g:'people',p:[16,-7,7],s:'small',major:0,st:'planned',
     what:'A private channel that receives every alert, for the on-call team.',
     io:'',under:'POST /v1/alert-channels  { "kind": "slack" }'},

Notes:
- `g` must be one of: sys, listen, core, seal, work, deliver, people, dest.
- `s` must be one of: sys, gate, core, node, small, person, tiny, chain.
- `st` must be one of: built, setup, planned.
- `p` is the [x, y, z] position. Pick a spot that doesn't overlap an existing part.

## 2. Connect it in `E`

Add a comma after the last entry in `E`, then add this entry before the closing `];`:

    ['h_alerts','x_slack_audit','plan'],

## 3. Add a flow to `FLOWS`

Add this object to the `FLOWS` array:

    {id:'audit_demo',name:'Alert to audit channel',sub:'Where a held event gets seen',steps:[
     ['g_decide','A decision is held.','held'],
     ['h_alerts','One alert is generated, with a count and a link.','held'],
     ['x_slack_audit','The on-call audit channel receives it.','ok']]},

The steps must refer to ids that exist in `N`. The third value in a step sets the colour of the trail: `ok`, `held`, `blocked`, `rule` or `relay`.

## 4. Check it

Reload the page. The new part should appear, and "Alert to audit channel" should appear in the left panel. If a part is missing, the browser console will say which id it could not find.
