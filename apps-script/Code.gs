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
 *   "Registrations": ID | Timestamp | TournamentId | Competition | FirstName | LastName | Email | Phone | Partner | Club | Status | StripeSessionId
 *   "Ranking":       Competition | Name | Club | Points
 */

var REG_SHEET = 'Registrations';
var RANK_SHEET = 'Ranking';

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
    if (action === 'ranking') return jsonOut_(getRanking_());
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
      firstName: r[idx.FirstName],
      lastName: r[idx.LastName],
      partner: r[idx.Partner],
      club: r[idx.Club],
      competition: r[idx.Competition],
      status: r[idx.Status]
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
    body.partner, body.club, 'pending', ''
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

/* -------------------- Ranking -------------------- */

function getRanking_() {
  var sh = getSheet_(RANK_SHEET);
  var rows = sh.getDataRange().getValues();
  var header = rows.shift();
  var idx = indexMap_(header);
  return rows
    .filter(function(r) { return r[idx.Name]; })
    .map(function(r) {
      return { competition: r[idx.Competition], name: r[idx.Name], club: r[idx.Club], points: Number(r[idx.Points]) || 0 };
    });
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
    'metadata[registrationId]': body.id
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
    updateRegistration_(body.id, { Status: 'paid' });
    return { ok: true, status: 'paid' };
  }
  return { ok: true, status: 'pending' };
}
