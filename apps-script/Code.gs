/**
 * League of Champions Tour – Backend
 *
 * Deploy this as a Google Apps Script Web App bound to a Google Sheet.
 * See the setup guide for step-by-step deployment instructions.
 *
 * Required Script Properties (Project Settings → Script Properties):
 *   STRIPE_SECRET_KEY  – Stripe secret key (test or live)
 *   SITE_BASE_URL      – e.g. https://<user>.github.io/league-of-champions-tour/
 *
 * Required sheet tabs (exact header row spelling matters):
 *   "Registrations": ID | Timestamp | TournamentId | Competition | FirstName | LastName | Email | Phone | Partner | Club | Status | StripeSessionId | UserId | PartnerId
 */

var REG_SHEET = 'Registrations';

// Keep in sync with the TOURNAMENTS fee values in index.html.
// The fee charged is always looked up here server-side — never trust
// an amount sent from the browser.
var TOURNAMENTS = {
  'matosinhos-1000': { name: 'Matosinhos 1000', feeCents: 6000 },
  'valencia-500':    { name: 'Valencia 500 / Cullera 100', feeCents: 6000 },
  'faro-finals':     { name: 'Faro Finals', feeCents: 8000 }
};

function doGet(e) {
  try {
    var action = e.parameter.action;
    if (action === 'list') return jsonOut_(listRegistrations_(e.parameter.tournamentId));
    if (action === 'status') return jsonOut_(getStatus_(e.parameter.id));
    return jsonOut_({ error: 'unknown action' });
  } catch (err) {
    return jsonOut_({ error: String(err) });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.action === 'register') return jsonOut_(registerTeam_(body));
    if (body.action === 'createCheckout') return jsonOut_(createCheckout_(body));
    if (body.action === 'confirmPayment') return jsonOut_(confirmPayment_(body));
    if (body.action === 'markPaid') return jsonOut_(markPaid_(body));
    if (body.action === 'deleteRegistration') return jsonOut_(deleteRegistration_(body));
    return jsonOut_({ error: 'unknown action' });
  } catch (err) {
    return jsonOut_({ error: String(err) });
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getSheet_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Sheet "' + name + '" was not found.');
  return sh;
}

function indexMap_(header) {
  var m = {};
  header.forEach(function(h, i) { m[h] = i; });
  return m;
}

/* -------------------- Registrations -------------------- */

function listRegistrations_(tournamentId) {
  var sh = getSheet_(REG_SHEET);
  var rows = sh.getDataRange().getValues();
  var header = rows.shift();
  var idx = indexMap_(header);
  var out = [];
  rows.forEach(function(r) {
    if (r[idx.TournamentId] !== tournamentId) return;
    out.push({
      id: r[idx.ID],
      firstName: r[idx.FirstName],
      lastName: r[idx.LastName],
      partner: r[idx.Partner],
      club: r[idx.Club],
      competition: r[idx.Competition],
      status: r[idx.Status],
      uid: r[idx.UserId],
      partnerUid: r[idx.PartnerId]
    });
  });
  return out;
}

function getStatus_(id) {
  var sh = getSheet_(REG_SHEET);
  var rows = sh.getDataRange().getValues();
  var header = rows.shift();
  var idx = indexMap_(header);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][idx.ID] === id) return { status: rows[i][idx.Status] };
  }
  return { error: 'not found' };
}

function registerTeam_(body) {
  if (!TOURNAMENTS[body.tournamentId]) return { error: 'unknown tournament' };
  var sh = getSheet_(REG_SHEET);
  var id = Utilities.getUuid();
  sh.appendRow([
    id, new Date(), body.tournamentId, body.competition,
    body.firstName, body.lastName, body.email, body.phone,
    body.partner, body.club, 'pending', '',
    body.uid || '', body.partnerUid || '',
    body.companyName || '', body.vatNumber || ''
  ]);
  return { ok: true, id: id };
}

function updateRegistration_(id, fields) {
  var sh = getSheet_(REG_SHEET);
  var rows = sh.getDataRange().getValues();
  var header = rows[0];
  var idx = indexMap_(header);
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][idx.ID] === id) {
      Object.keys(fields).forEach(function(k) {
        sh.getRange(i + 1, idx[k] + 1).setValue(fields[k]);
      });
      return true;
    }
  }
  return false;
}

// Admin-only actions (manually confirm a cash payment, remove a duplicate/cancelled
// registration). Gated client-side by CONFIG.ADMIN_EMAILS, same trust model as the
// rest of this endpoint — there's no server-side identity check here, so anyone who
// finds this Web App URL could in principle call these directly. Fine for a small,
// single-operator tournament; add a shared-secret or token check here first if that's
// not an acceptable risk once real payments are flowing.
function markPaid_(body) {
  var ok = updateRegistration_(body.id, { Status: 'paid', PaymentMethod: body.paymentMethod || '' });
  if (ok) sendInvoiceIfNeeded_(body.id);
  return ok ? { ok: true } : { error: 'not found' };
}

// Invoicing rule (per team owner, 2026-08-27): a "Rechnung" only ever goes out
// once a registration actually becomes paid/confirmed — never at "pay later"
// time, since nothing has been charged yet. That happens at exactly two
// call sites, both already funneling through updateRegistration_(id, {Status:'paid'}):
// this function (admin manually confirms, e.g. cash/bank transfer) and
// confirmPayment_ below (Stripe checkout verified paid — covers both "pay now"
// immediately and "pay later" finished off afterward, since both end up here).
//
// Not implemented yet — intentionally a placeholder until the site is off
// demo mode: there's no invoice-number ledger (the agreed series starts at
// "2026/01"), no PDF template wired into Apps Script (the Musterrechnung was
// built with docx-js outside this project), and no verified sender address
// for MailApp/GmailApp. Wire this up before relying on it; for now it only
// logs so the two trigger points stay visible in the execution log.
//
// Email spec (per team owner, 2026-08-27) for once this is wired up —
// MailApp/GmailApp always sends as the Google account that owns this Apps
// Script deployment (or a verified Gmail send-as alias on it), so the
// "sending address" the owner provides needs to be that account, not an
// arbitrary From: header:
//   To: the registrant's email (registration row)
//   Subject: "Your League of Champions Invoice – " + tournament name
//   Body (English):
//     "Dear " + club name + " team,
//
//      Please find your invoice for " + tournament name + " attached.
//
//      Thank you for registering with League of Champions!
//
//      If you have any questions, feel free to reach out at this email
//      address or on Instagram @footvolleyleagueofchampions."
//   Attachment: the generated invoice (PDF).
function sendInvoiceIfNeeded_(registrationId) {
  Logger.log('TODO: generate & email invoice for registration ' + registrationId);
}

function deleteRegistration_(body) {
  var sh = getSheet_(REG_SHEET);
  var rows = sh.getDataRange().getValues();
  var header = rows[0];
  var idx = indexMap_(header);
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][idx.ID] === body.id) {
      sh.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { error: 'not found' };
}

/* -------------------- Stripe -------------------- */

function createCheckout_(body) {
  var cfg = TOURNAMENTS[body.tournamentId];
  if (!cfg) return { error: 'unknown tournament' };

  var props = PropertiesService.getScriptProperties();
  var base = props.getProperty('SITE_BASE_URL');
  var key = props.getProperty('STRIPE_SECRET_KEY');
  if (!base || !key) return { error: 'SITE_BASE_URL or STRIPE_SECRET_KEY not configured (Script Properties).' };

  // successPath/cancelPath are relative hash-paths from the front-end
  // (e.g. "event/faro-finals/register/Men?paid=<id>"); we only ever
  // append them onto our own configured base URL, never a client-supplied host.
  var successUrl = base + '#/' + (body.successPath || '') + (String(body.successPath || '').indexOf('?') > -1 ? '&' : '?') + 'session_id={CHECKOUT_SESSION_ID}';
  var cancelUrl = base + '#/' + (body.cancelPath || '');

  var payload = {
    'mode': 'payment',
    'success_url': successUrl,
    'cancel_url': cancelUrl,
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][product_data][name]': 'Entry fee – ' + cfg.name,
    'line_items[0][price_data][unit_amount]': cfg.feeCents,
    'line_items[0][quantity]': 1,
    'metadata[registrationId]': body.id,
    // Lets a business customer enter their VAT/tax number right in Stripe's
    // hosted checkout — confirmPayment_ reads it back from customer_details.
    // Note: this only collects the number for the invoice. It does NOT by
    // itself remove the 20% VAT or apply reverse charge — that requires
    // separately setting up Stripe Tax (registrations + product tax codes).
    // Confirm the correct reverse-charge handling with your Steuerberater
    // before treating a supplied VAT number as "no VAT due".
    'tax_id_collection[enabled]': 'true'
  };

  var res = UrlFetchApp.fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'post',
    headers: { Authorization: 'Bearer ' + key },
    payload: payload,
    muteHttpExceptions: true
  });
  var data = JSON.parse(res.getContentText());
  if (data.error) return { error: data.error.message };

  updateRegistration_(body.id, { StripeSessionId: data.id });
  return { ok: true, url: data.url };
}

function confirmPayment_(body) {
  var key = PropertiesService.getScriptProperties().getProperty('STRIPE_SECRET_KEY');
  if (!key) return { error: 'STRIPE_SECRET_KEY not configured.' };

  var res = UrlFetchApp.fetch('https://api.stripe.com/v1/checkout/sessions/' + encodeURIComponent(body.sessionId), {
    headers: { Authorization: 'Bearer ' + key },
    muteHttpExceptions: true
  });
  var data = JSON.parse(res.getContentText());
  if (data.error) return { error: data.error.message };

  // Verify server-side against Stripe directly (payment_status + metadata match)
  // rather than trusting the browser — this is what makes the flow safe without
  // needing a signed webhook.
  var matches = data.metadata && data.metadata.registrationId === body.id;
  if (matches && data.payment_status === 'paid') {
    // Stripe Checkout's own tax_id_collection (enabled in createCheckout_)
    // lets a business customer enter their VAT number right there in the
    // hosted checkout page — if they did, it shows up here so we don't need
    // a separate manual-entry step for the Stripe path.
    var taxIds = data.customer_details && data.customer_details.tax_ids;
    var vatFromStripe = (taxIds && taxIds.length) ? taxIds[0].value : '';
    var fields = { Status: 'paid', PaymentMethod: 'stripe' };
    if (vatFromStripe) fields.VatNumber = vatFromStripe;
    updateRegistration_(body.id, fields);
    sendInvoiceIfNeeded_(body.id);
    return { ok: true, status: 'paid' };
  }
  return { ok: true, status: 'pending' };
}
