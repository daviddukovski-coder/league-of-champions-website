/**
 * League of Champions Tour – Backend
 *
 * Deploy this as a Google Apps Script Web App bound to a Google Sheet.
 * See the setup guide for step-by-step deployment instructions.
 *
 * Required Script Properties (Project Settings → Script Properties):
 *   STRIPE_SECRET_KEY       – Stripe secret key (test or live)
 *   SITE_BASE_URL           – e.g. https://<user>.github.io/league-of-champions-tour/
 *   FCM_PROJECT_ID          – Firebase project ID (e.g. league-of-champions-website)
 *   FCM_SERVICE_ACCOUNT_JSON – full contents of a Firebase service account JSON key
 *                              (Firebase Console → Project settings → Service accounts
 *                              → Generate new private key), pasted as one value
 *   FIREBASE_API_KEY        – the site's public Firebase web API key (used to verify
 *                              the login token every signed-in request carries)
 *   ADMIN_UIDS              – comma-separated Firebase user ids with admin rights
 *                              (Firebase Console → Authentication → Users → User UID)
 *
 * Security: every write that needs a person comes with a Firebase ID token
 * (body.idToken). It is verified with Google (verifyUser_); admin actions
 * additionally require the user id to be in ADMIN_UIDS. Never trust a user id
 * sent in the body.
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
    // confirmPayment needs no login: it only ever trusts Stripe's own answer
    if (body.action === 'confirmPayment') return jsonOut_(confirmPayment_(body));
    var user = verifyUser_(body.idToken);
    if (body.action === 'register') return jsonOut_(user ? registerTeam_(body, user) : { error: 'login required' });
    if (body.action === 'createCheckout') return jsonOut_(user ? createCheckout_(body) : { error: 'login required' });
    if (body.action === 'sendPush') return jsonOut_(user ? sendPush_(body, user) : { error: 'login required' });
    if (body.action === 'markPaid') return jsonOut_(isAdmin_(user) ? markPaid_(body) : { error: 'not authorized' });
    if (body.action === 'deleteRegistration') return jsonOut_(isAdmin_(user) ? deleteRegistration_(body) : { error: 'not authorized' });
    return jsonOut_({ error: 'unknown action' });
  } catch (err) {
    return jsonOut_({ error: String(err) });
  }
}

/* -------------------- Who is calling? -------------------- */

// Verifies a Firebase ID token with Google and returns { uid, email } or null.
// accounts:lookup only answers for a valid, unexpired token of this project.
// Results are cached for 5 minutes per token to keep requests fast.
function verifyUser_(idToken) {
  if (!idToken || typeof idToken !== 'string' || idToken.length > 4000) return null;
  var cache = CacheService.getScriptCache();
  var key = 'tok_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken));
  var hit = cache.get(key);
  if (hit) return hit === '-' ? null : JSON.parse(hit);
  var apiKey = PropertiesService.getScriptProperties().getProperty('FIREBASE_API_KEY');
  if (!apiKey) throw new Error('FIREBASE_API_KEY not configured (Script Properties).');
  var res = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(apiKey), {
    method: 'post', contentType: 'application/json', payload: JSON.stringify({ idToken: idToken }), muteHttpExceptions: true
  });
  var data = {};
  try { data = JSON.parse(res.getContentText()); } catch (e) {}
  var u = data.users && data.users[0];
  var user = u && u.localId ? { uid: u.localId, email: u.email || '' } : null;
  cache.put(key, user ? JSON.stringify(user) : '-', 300);
  return user;
}

function isAdmin_(user) {
  if (!user) return false;
  var ids = (PropertiesService.getScriptProperties().getProperty('ADMIN_UIDS') || '').split(',').map(function(s) { return s.trim(); });
  return ids.indexOf(user.uid) !== -1;
}

// Text from the form goes into the sheet as plain text: a value starting
// with = + - @ would otherwise run as a spreadsheet formula.
function cell_(v, max) {
  var s = v == null ? '' : String(v).slice(0, max || 200);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
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
      partnerUid: r[idx.PartnerId],
      jerseyFit: r[idx.JerseyFit],
      jerseySize: r[idx.JerseySize],
      jerseyName: r[idx.JerseyName],
      partnerJerseyFit: r[idx.PartnerJerseyFit],
      partnerJerseySize: r[idx.PartnerJerseySize],
      partnerJerseyName: r[idx.PartnerJerseyName]
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

function registerTeam_(body, user) {
  if (!TOURNAMENTS[body.tournamentId]) return { error: 'unknown tournament' };
  var sh = getSheet_(REG_SHEET);
  var id = Utilities.getUuid();
  sh.appendRow([
    id, new Date(), body.tournamentId, cell_(body.competition, 40),
    cell_(body.firstName, 80), cell_(body.lastName, 80), cell_(body.email, 120), cell_(body.phone, 40),
    cell_(body.partner, 120), cell_(body.club, 120), 'pending', '',
    user.uid, cell_(body.partnerUid, 128),
    cell_(body.companyName, 120), cell_(body.vatNumber, 40),
    cell_(body.jerseyFit, 20), cell_(body.jerseySize, 10), cell_(body.jerseyName, 30),
    cell_(body.partnerJerseyFit, 20), cell_(body.partnerJerseySize, 10), cell_(body.partnerJerseyName, 30)
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
// registration). doPost only lets them through for a verified admin login
// (isAdmin_ → Script Property ADMIN_UIDS).
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

/* -------------------- Push Notifications (FCM) -------------------- */

// Sends a web push to one or more device tokens via the FCM HTTP v1 API.
// body: { tokens: [string,...], title, body, url } — url is a bare hash-path
// (e.g. "inbox/xyz"), carried in the message's data.url and read by both the
// service worker's notificationclick handler and the page's foreground
// onMessage handler. A client can never call FCM directly (needs server
// credentials), so this is the relay every push goes through.
function sendPush_(body, user) {
  var projectId = PropertiesService.getScriptProperties().getProperty('FCM_PROJECT_ID');
  if (!projectId) return { error: 'FCM_PROJECT_ID not configured (Script Properties).' };
  if (!body.toUid || typeof body.toUid !== 'string' || body.toUid === user.uid) return { error: 'bad recipient' };
  // at most 30 pushes per sender per 10 minutes
  var cache = CacheService.getScriptCache(), rk = 'push_' + user.uid, n = Number(cache.get(rk) || 0);
  if (n >= 30) return { error: 'too many messages' };
  cache.put(rk, String(n + 1), 600);

  var accessToken;
  try {
    accessToken = getFcmAccessToken_();
  } catch (err) {
    return { error: String(err) };
  }
  var tokens = recipientTokens_(projectId, body.toUid);
  if (!tokens.length) return { ok: true, sent: 0 };

  var sent = 0;
  var errors = [];
  tokens.forEach(function(token) {
    var message = {
      message: {
        token: token,
        notification: { title: String(body.title || '').slice(0, 120), body: String(body.body || '').slice(0, 240) },
        data: { url: String(body.url || '').replace(/[^\w\/-]/g, '').slice(0, 200) }
      }
    };
    var res = UrlFetchApp.fetch('https://fcm.googleapis.com/v1/projects/' + projectId + '/messages:send', {
      method: 'post',
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      payload: JSON.stringify(message),
      muteHttpExceptions: true
    });
    var data = JSON.parse(res.getContentText());
    if (data.error) errors.push(data.error.message); else sent++;
  });
  return { ok: true, sent: sent, errors: errors };
}

// A player's push tokens: private doc players/{uid}/private/push, plus old
// tokens still sitting in the public profile from before they moved.
function recipientTokens_(projectId, uid) {
  var base = 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents/players/' + encodeURIComponent(uid);
  var headers = { Authorization: 'Bearer ' + getFcmAccessToken_() };
  var read = function(url) {
    var res = UrlFetchApp.fetch(url, { headers: headers, muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return [];
    var f = (JSON.parse(res.getContentText()).fields || {}).fcmTokens;
    return f && f.arrayValue && f.arrayValue.values ? f.arrayValue.values.map(function(v) { return v.stringValue; }).filter(Boolean) : [];
  };
  var all = read(base + '/private/push').concat(read(base));
  return all.filter(function(t, i) { return all.indexOf(t) === i; }).slice(0, 10);
}

// Mints a short-lived OAuth2 access token for the Firebase service account,
// for Cloud Messaging and for reading recipients' push tokens in Firestore. Apps Script has no built-in service-account
// support, but Utilities.computeRsaSha256Signature can sign the JWT by hand —
// avoids needing a third-party OAuth2 library for just this one call.
function getFcmAccessToken_() {
  var props = PropertiesService.getScriptProperties();
  var saJson = props.getProperty('FCM_SERVICE_ACCOUNT_JSON');
  if (!saJson) throw new Error('FCM_SERVICE_ACCOUNT_JSON not configured (Script Properties).');
  var sa = JSON.parse(saJson);

  var now = Math.floor(Date.now() / 1000);
  var header = { alg: 'RS256', typ: 'JWT' };
  var claimSet = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };
  var toSign = base64UrlEncode_(JSON.stringify(header)) + '.' + base64UrlEncode_(JSON.stringify(claimSet));
  var signatureBytes = Utilities.computeRsaSha256Signature(toSign, sa.private_key);
  var jwt = toSign + '.' + Utilities.base64EncodeWebSafe(signatureBytes).replace(/=+$/, '');

  var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt },
    muteHttpExceptions: true
  });
  var data = JSON.parse(res.getContentText());
  if (data.error) throw new Error('FCM auth failed: ' + (data.error_description || data.error));
  return data.access_token;
}

function base64UrlEncode_(str) {
  return Utilities.base64EncodeWebSafe(str).replace(/=+$/, '');
}
