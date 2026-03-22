import { Hono } from "hono";
import type { Env } from "../types.ts";

const privacy = new Hono<{ Bindings: Env }>();

const UPDATED      = "2026-03-22";
const BOT_NAME     = "@lifegrambot";
const BOT_LINK     = "https://t.me/lifegrambot";
const CONTACT_EMAIL = "support@areszyn.com";
function getHtml(env: Env) {
const POLICY_URL = `https://${env.APP_DOMAIN}/api/privacy`;
const MINIAPP_URL = env.MINIAPP_URL;
return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0a0a0a">
<title>Privacy Policy &amp; Terms — ${BOT_NAME}</title>
<meta property="og:type"        content="article">
<meta property="og:title"       content="Privacy Policy, Terms of Service &amp; Terms and Conditions — ${BOT_NAME}">
<meta property="og:description" content="Complete privacy policy, terms of service, cookie policy, data rights, and terms and conditions for ${BOT_NAME}.">
<meta property="og:url"         content="${POLICY_URL}">
<meta property="article:published_time" content="${UPDATED}T00:00:00Z">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{
  background:#0d0d0d;color:#d0d0d0;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;
  font-size:15px;line-height:1.78;
}
article{max-width:740px;margin:0 auto;padding:44px 22px 90px}
header{margin-bottom:36px;padding-bottom:24px;border-bottom:1px solid #1e1e1e}
header h1{font-size:1.65rem;font-weight:700;color:#f0f0f0;line-height:1.3;margin-bottom:12px}
.meta{font-size:12px;color:#444;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.badge{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:6px;padding:3px 9px;font-size:11px;color:#555}
.badge.blue{border-color:#1d4ed8;color:#3b82f6}
h2{font-size:1.08rem;font-weight:600;color:#e8e8e8;margin:40px 0 12px;
   padding-left:13px;border-left:3px solid #3b82f6}
h3{font-size:.93rem;font-weight:600;color:#c8c8c8;margin:22px 0 8px}
h4{font-size:.88rem;font-weight:600;color:#aaa;margin:16px 0 6px}
p{margin-bottom:12px;color:#999}
p strong{color:#bbb}
ul,ol{padding-left:22px;margin-bottom:14px}
li{margin-bottom:7px;color:#999}
li strong{color:#bbb}
a{color:#3b82f6;text-decoration:none}
a:hover{text-decoration:underline}
code{background:#161616;border:1px solid #222;border-radius:4px;
     padding:1px 5px;font-size:.82em;font-family:'SF Mono','Fira Code',monospace;color:#7dd3fc}
.highlight{
  background:#0f172a;border:1px solid #1e3a5f;border-left:3px solid #3b82f6;
  border-radius:0 10px 10px 0;padding:14px 18px;margin:16px 0;
}
.highlight p{margin:0;font-size:.9rem;color:#6b8db5}
.highlight.warn{background:#1c0f00;border-color:#7c3a00;border-left-color:#f59e0b}
.highlight.warn p{color:#92611a}
.highlight.green{background:#051a0f;border-color:#064e2a;border-left-color:#10b981}
.highlight.green p{color:#1a6644}
.card{
  background:#111;border:1px solid #1e1e1e;border-radius:12px;
  padding:18px 20px;margin:14px 0;
}
.card h3{margin-top:0;color:#ccc}
.card-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:14px 0}
@media(max-width:560px){.card-grid{grid-template-columns:1fr}}
table{width:100%;border-collapse:collapse;margin:16px 0;font-size:.86rem}
th{background:#141414;color:#777;font-weight:500;text-align:left;
   padding:10px 13px;border-bottom:1px solid #1e1e1e}
td{padding:10px 13px;border-bottom:1px solid #181818;color:#888;vertical-align:top}
tr:last-child td{border-bottom:none}
td:first-child{color:#aaa;white-space:nowrap}
.toc{background:#111;border:1px solid #1e1e1e;border-radius:14px;padding:20px 22px;margin-bottom:36px}
.toc-title{font-size:11px;font-weight:600;color:#444;letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px}
.toc-cols{display:grid;grid-template-columns:1fr 1fr;gap:2px 24px}
@media(max-width:520px){.toc-cols{grid-template-columns:1fr}}
.toc li{margin-bottom:5px;font-size:12.5px;list-style:none;padding:0}
.toc a{color:#555;transition:color .15s}
.toc a:hover{color:#3b82f6;text-decoration:none}
.toc-num{color:#2a2a2a;margin-right:5px;font-variant-numeric:tabular-nums}
.section-label{display:inline-block;font-size:10px;font-weight:600;
  letter-spacing:.07em;text-transform:uppercase;border-radius:5px;
  padding:2px 7px;margin-bottom:6px;
  background:#1d4ed810;border:1px solid #1d4ed830;color:#3b82f6}
dl{margin:12px 0}
dt{font-weight:600;color:#bbb;margin-top:14px;font-size:.9rem}
dd{margin-left:20px;color:#888;margin-bottom:4px;font-size:.9rem}
.divider{border:none;border-top:1px solid #1a1a1a;margin:40px 0}
footer{margin-top:56px;padding-top:24px;border-top:1px solid #1a1a1a;
       font-size:12px;color:#3a3a3a;text-align:center;line-height:2}
@media(max-width:520px){
  article{padding:28px 16px 64px}
  header h1{font-size:1.3rem}
  h2{font-size:1rem}
  table{display:block;overflow-x:auto;-webkit-overflow-scrolling:touch}
  .toc-cols{grid-template-columns:1fr}
}
</style>
</head>
<body>
<article>

<header>
  <h1>Privacy Policy, Terms of Service &amp; Terms and Conditions</h1>
  <div class="meta">
    <span>${BOT_NAME}</span>
    <span class="badge blue">Last updated: <time datetime="${UPDATED}">${UPDATED}</time></span>
    <span class="badge">English</span>
    <span class="badge">v2.0</span>
  </div>
</header>

<!-- ═══════════════════════════ TABLE OF CONTENTS ═══════════════════════════ -->
<div class="toc">
  <p class="toc-title">Contents</p>
  <ul class="toc-cols">
    <li><span class="toc-num">1.</span><a href="#definitions">Definitions</a></li>
    <li><span class="toc-num">2.</span><a href="#operator">Operator Information</a></li>
    <li><span class="toc-num">3.</span><a href="#overview">Service Overview</a></li>
    <li><span class="toc-num">4.</span><a href="#data-collected">Data We Collect</a></li>
    <li><span class="toc-num">5.</span><a href="#legal-basis">Legal Basis for Processing</a></li>
    <li><span class="toc-num">6.</span><a href="#how-we-use">How We Use Your Data</a></li>
    <li><span class="toc-num">7.</span><a href="#retention">Data Retention</a></li>
    <li><span class="toc-num">8.</span><a href="#security">Security Measures</a></li>
    <li><span class="toc-num">9.</span><a href="#breach">Data Breach Policy</a></li>
    <li><span class="toc-num">10.</span><a href="#third-party">Third-Party Services</a></li>
    <li><span class="toc-num">11.</span><a href="#international">International Transfers</a></li>
    <li><span class="toc-num">12.</span><a href="#automated">Automated Processing</a></li>
    <li><span class="toc-num">13.</span><a href="#children">Children's Privacy</a></li>
    <li><span class="toc-num">14.</span><a href="#cookies">Cookies &amp; Local Storage</a></li>
    <li><span class="toc-num">15.</span><a href="#ip-collection">IP &amp; Device Data</a></li>
    <li><span class="toc-num">16.</span><a href="#sessions">MTProto Sessions</a></li>
    <li><span class="toc-num">17.</span><a href="#video">Video Streaming</a></li>
    <li><span class="toc-num">18.</span><a href="#groups">Group Management</a></li>
    <li><span class="toc-num">19.</span><a href="#broadcast">Broadcast Messages</a></li>
    <li><span class="toc-num">20.</span><a href="#payments">Payments &amp; Donations</a></li>
    <li><span class="toc-num">21.</span><a href="#rights">Your Rights</a></li>
    <li><span class="toc-num">22.</span><a href="#in-app-rights">In-App Data Controls</a></li>
    <li><span class="toc-num">23.</span><a href="#complaints">Complaints Procedure</a></li>
    <li><span class="toc-num">24.</span><a href="#terms">Terms of Service</a></li>
    <li><span class="toc-num">25.</span><a href="#conditions">Terms &amp; Conditions</a></li>
    <li><span class="toc-num">26.</span><a href="#acceptable-use">Acceptable Use Policy</a></li>
    <li><span class="toc-num">27.</span><a href="#premium">Premium Subscriptions</a></li>
    <li><span class="toc-num">28.</span><a href="#refunds">Refund Policy</a></li>
    <li><span class="toc-num">29.</span><a href="#changes">Policy Changes</a></li>
    <li><span class="toc-num">30.</span><a href="#contact">Contact</a></li>
  </ul>
</div>

<!-- ═══════════════════════════ 1. DEFINITIONS ═══════════════════════════════ -->
<h2 id="definitions">1. Definitions</h2>
<p>The following terms are used throughout this document:</p>
<dl>
  <dt>Bot / Service</dt>
  <dd>The Telegram bot <a href="${BOT_LINK}">${BOT_NAME}</a> and its associated Mini App at <a href="${MINIAPP_URL}">${MINIAPP_URL}</a>, API server, database, and storage systems.</dd>

  <dt>Operator / We / Us</dt>
  <dd>The individual or entity operating ${BOT_NAME}. Contact details are in Section 2.</dd>

  <dt>User / You</dt>
  <dd>Any individual who sends a message to the bot, opens the Mini App, or accesses a video streaming link.</dd>

  <dt>Admin</dt>
  <dd>The designated administrator (Telegram user ID 2114237158) who manages the service and can read all user messages.</dd>

  <dt>Personal Data</dt>
  <dd>Any information that can directly or indirectly identify a natural person, as defined by GDPR and applicable privacy law.</dd>

  <dt>Processing</dt>
  <dd>Any operation performed on personal data including collection, storage, retrieval, transmission, deletion, or modification.</dd>

  <dt>D1</dt>
  <dd>Cloudflare D1 — the SQL database in which user data and service records are stored.</dd>

  <dt>R2</dt>
  <dd>Cloudflare R2 — the object storage service used to store media files and uploaded content.</dd>

  <dt>MTProto / GramJS</dt>
  <dd>Telegram's native protocol and its JavaScript library, used to stream large video files without Telegram Bot API file-size restrictions.</dd>

  <dt>Mini App</dt>
  <dd>A web application embedded inside Telegram at <a href="${MINIAPP_URL}">${MINIAPP_URL}</a>, accessible via the bot's menu button.</dd>

  <dt>Consent</dt>
  <dd>A freely given, specific, informed, and unambiguous indication of your agreement to the processing of your personal data.</dd>

  <dt>GDPR</dt>
  <dd>General Data Protection Regulation (EU) 2016/679, and any equivalent national legislation implementing it.</dd>
</dl>

<!-- ═══════════════════════════ 2. OPERATOR INFORMATION ══════════════════════ -->
<h2 id="operator">2. Operator Information</h2>
<div class="card">
  <h3>Data Controller</h3>
  <ul>
    <li><strong>Service name:</strong> ${BOT_NAME}</li>
    <li><strong>Telegram bot:</strong> <a href="${BOT_LINK}">${BOT_LINK}</a></li>
    <li><strong>Mini App:</strong> <a href="${MINIAPP_URL}">${MINIAPP_URL}</a></li>
    <li><strong>Contact email:</strong> <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></li>
    <li><strong>Privacy policy URL:</strong> <a href="${POLICY_URL}">${POLICY_URL}</a></li>
  </ul>
</div>
<p>The operator is the data controller for all personal data processed through this service.
If you are located in the European Economic Area (EEA), the UK, or any jurisdiction with
comprehensive data protection law, the operator is responsible for ensuring compliance with
the applicable legal framework.</p>

<!-- ═══════════════════════════ 3. SERVICE OVERVIEW ══════════════════════════ -->
<h2 id="overview">3. Service Overview</h2>
<p>${BOT_NAME} is a multi-feature Telegram bot and Mini App providing:</p>
<div class="card-grid">
  <div class="card">
    <h3>📨 Messaging</h3>
    <p>Bi-directional private messaging between users and the administrator. All messages, media, and files are stored.</p>
  </div>
  <div class="card">
    <h3>📹 Video Streaming</h3>
    <p>MTProto-based video delivery with no file-size limit. Time-limited JWT tokens protect each stream link (24-hour expiry).</p>
  </div>
  <div class="card">
    <h3>💳 Donations</h3>
    <p>Voluntary crypto donations via OxaPay and in-app Telegram Stars payments. All transactions are recorded.</p>
  </div>
  <div class="card">
    <h3>⭐ Premium</h3>
    <p>Paid subscriptions unlock advanced features. Subscription status, expiry, and payment amount are stored.</p>
  </div>
  <div class="card">
    <h3>👥 Groups</h3>
    <p>Group management tools including tag-all, ban-all, and anti-spam enforcement in managed Telegram groups.</p>
  </div>
  <div class="card">
    <h3>🛡️ Moderation</h3>
    <p>Automated anti-spam and manual moderation (ban, warn, restrict) with logged action history.</p>
  </div>
</div>
<div class="highlight">
  <p>By sending any message to ${BOT_NAME}, opening the Mini App, or accessing a video
  streaming link, you acknowledge that you have read and agree to this Privacy Policy,
  Terms of Service, and Terms and Conditions in their entirety.</p>
</div>

<!-- ═══════════════════════════ 4. DATA WE COLLECT ═══════════════════════════ -->
<h2 id="data-collected">4. Data We Collect</h2>
<p>We collect only what is necessary to operate the service. The table below lists every
category of personal data stored, the source, and whether collection is mandatory or
dependent on your use of specific features.</p>

<table>
  <thead>
    <tr><th>Category</th><th>Data Points</th><th>Source</th><th>Mandatory?</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Identity</strong></td>
      <td>Telegram user ID (numeric), first name, username (if set by you in Telegram)</td>
      <td>Telegram Bot API — sent automatically with every update</td>
      <td>Yes — core to service operation</td>
    </tr>
    <tr>
      <td><strong>Messages</strong></td>
      <td>Full text content, timestamps, sender type (user/admin), read status, Telegram message IDs, reply threading</td>
      <td>Messages you send to the bot</td>
      <td>Yes — you choose to send messages</td>
    </tr>
    <tr>
      <td><strong>Media files</strong></td>
      <td>Telegram file IDs, R2 storage URLs, MIME types, file sizes, original file names</td>
      <td>Files, photos, videos, and documents you send</td>
      <td>Only if you send media</td>
    </tr>
    <tr>
      <td><strong>Donations</strong></td>
      <td>Payment amount, currency, transaction ID, OxaPay tracking ID, payment status, crypto address used, Telegram Stars invoice data</td>
      <td>OxaPay gateway callback or Telegram Payments API</td>
      <td>Only if you donate</td>
    </tr>
    <tr>
      <td><strong>Subscriptions</strong></td>
      <td>Plan name, subscription start and end dates, status (active/expired), amount paid in Stars or USD equivalent</td>
      <td>Created at time of purchase</td>
      <td>Only if you subscribe</td>
    </tr>
    <tr>
      <td><strong>MTProto sessions</strong></td>
      <td>GramJS string session token (a long base64 string encoding your Telegram account's MTProto keys), creation timestamp</td>
      <td>Generated if you link an account for advanced features</td>
      <td>Optional — advanced feature only</td>
    </tr>
    <tr>
      <td><strong>Moderation records</strong></td>
      <td>Action type (ban/warn/restrict/mute), reason, duration, scope (bot/app/global), applied-by (admin/auto), timestamps</td>
      <td>Admin manual action or automatic anti-spam system</td>
      <td>Only if an action is applied to you</td>
    </tr>
    <tr>
      <td><strong>Anti-spam counters</strong></td>
      <td>Message count within rolling time windows, last violation timestamp</td>
      <td>Calculated automatically from message activity</td>
      <td>Yes — for all active users</td>
    </tr>
    <tr>
      <td><strong>Group membership</strong></td>
      <td>Telegram group/channel IDs the bot manages, member lists, join dates, role flags</td>
      <td>Telegram chat_member events in groups where bot is admin</td>
      <td>Only for managed groups</td>
    </tr>
    <tr>
      <td><strong>Device &amp; network</strong></td>
      <td>IP address, country code, city/region, browser user-agent string, OS/platform, screen resolution, browser language, timezone</td>
      <td>HTTP request headers and Mini App JavaScript APIs</td>
      <td>When you use the Mini App or open a video link</td>
    </tr>
    <tr>
      <td><strong>Consent preferences</strong></td>
      <td>Cookie/data consent status (accepted/declined/pending), timestamp of last update</td>
      <td>Your response to the consent banner</td>
      <td>Yes — recorded for compliance</td>
    </tr>
    <tr>
      <td><strong>Activity timestamps</strong></td>
      <td>First-seen timestamp, last-seen timestamp in the Mini App</td>
      <td>Mini App load events</td>
      <td>When you use the Mini App</td>
    </tr>
    <tr>
      <td><strong>Deletion requests</strong></td>
      <td>Request ID, Telegram ID, first name, username, reason text, status, admin note, timestamps</td>
      <td>Submitted by you via the in-app form or /deleteme command</td>
      <td>Only if you submit a request</td>
    </tr>
  </tbody>
</table>

<div class="highlight green">
  <p>We do <strong>not</strong> collect: passwords, payment card numbers, government-issued IDs,
  biometric data, precise GPS location, contacts or phone numbers, browsing history outside this
  service, or any data from Telegram chats other than messages sent directly to this bot.</p>
</div>

<!-- ═══════════════════════════ 5. LEGAL BASIS ═══════════════════════════════ -->
<h2 id="legal-basis">5. Legal Basis for Processing (GDPR Article 6)</h2>
<p>For users in the EEA, UK, or other GDPR-aligned jurisdictions, the following legal bases
apply to each category of processing:</p>

<table>
  <thead>
    <tr><th>Processing Activity</th><th>Legal Basis</th><th>Details</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>Storing and routing messages between user and admin</td>
      <td><strong>Contract performance</strong> (Art. 6(1)(b))</td>
      <td>Necessary to deliver the core messaging service you opted into</td>
    </tr>
    <tr>
      <td>Recording donations and subscriptions</td>
      <td><strong>Contract performance</strong> (Art. 6(1)(b)) + <strong>Legal obligation</strong> (Art. 6(1)(c))</td>
      <td>Required to fulfil the transaction and maintain financial records</td>
    </tr>
    <tr>
      <td>Anti-spam message counters</td>
      <td><strong>Legitimate interests</strong> (Art. 6(1)(f))</td>
      <td>Protecting the service and other users from abuse; counters are transient and not profiling</td>
    </tr>
    <tr>
      <td>Storing moderation actions</td>
      <td><strong>Legitimate interests</strong> (Art. 6(1)(f))</td>
      <td>Preventing repeat abuse; proportionate to the safety benefit</td>
    </tr>
    <tr>
      <td>Collecting IP, device, and geo data via Mini App</td>
      <td><strong>Consent</strong> (Art. 6(1)(a)) + <strong>Legitimate interests</strong> (Art. 6(1)(f))</td>
      <td>Consent is obtained via the banner; legitimate interest for fraud prevention</td>
    </tr>
    <tr>
      <td>MTProto session storage</td>
      <td><strong>Explicit consent</strong> (Art. 6(1)(a))</td>
      <td>You explicitly provide the session string to enable advanced features</td>
    </tr>
    <tr>
      <td>Video streaming token generation</td>
      <td><strong>Contract performance</strong> (Art. 6(1)(b))</td>
      <td>Necessary to deliver video content you or the admin shared</td>
    </tr>
    <tr>
      <td>Broadcast messages</td>
      <td><strong>Legitimate interests</strong> (Art. 6(1)(f))</td>
      <td>Service announcements; you can opt out — see Section 19</td>
    </tr>
    <tr>
      <td>Deletion request records</td>
      <td><strong>Legal obligation</strong> (Art. 6(1)(c))</td>
      <td>Required to demonstrate compliance with erasure requests under GDPR Art. 17</td>
    </tr>
  </tbody>
</table>

<!-- ═══════════════════════════ 6. HOW WE USE YOUR DATA ══════════════════════ -->
<h2 id="how-we-use">6. How We Use Your Data</h2>
<div class="card">
  <h3>Core service operations</h3>
  <ul>
    <li>Routing messages and media between you and the administrator</li>
    <li>Displaying message history in the Mini App inbox</li>
    <li>Delivering video streams to authorised link holders</li>
    <li>Processing and confirming crypto and Stars donations</li>
    <li>Managing and verifying premium subscription access</li>
    <li>Enforcing anti-spam rate limits and moderation rules</li>
    <li>Sending broadcast announcements (see Section 19 for opt-out)</li>
  </ul>
</div>
<div class="card">
  <h3>Security and fraud prevention</h3>
  <ul>
    <li>IP analysis to detect unusual access patterns or credential stuffing</li>
    <li>Device fingerprinting to identify automation or bot traffic</li>
    <li>Geo-based anomaly detection (e.g. simultaneous access from multiple continents)</li>
    <li>Rate-limiting to prevent denial-of-service abuse</li>
  </ul>
</div>
<div class="card">
  <h3>Service improvement</h3>
  <ul>
    <li>Aggregate, anonymised analytics (total messages, donation volumes, active users) — no individual profiling</li>
    <li>Debugging errors and improving system reliability</li>
    <li>Understanding which features are most used to prioritise development</li>
  </ul>
</div>
<div class="card">
  <h3>Compliance</h3>
  <ul>
    <li>Maintaining donation records for financial compliance purposes</li>
    <li>Recording consent and deletion request outcomes for GDPR audit trails</li>
    <li>Responding to lawful requests from law enforcement or courts</li>
  </ul>
</div>
<div class="highlight warn">
  <p>We <strong>never</strong> sell, rent, trade, or monetise your personal data. We do not
  use your data for advertising, behavioural profiling, or any purpose other than those
  listed above.</p>
</div>

<!-- ═══════════════════════════ 7. DATA RETENTION ═══════════════════════════ -->
<h2 id="retention">7. Data Retention</h2>
<p>We retain personal data only as long as necessary for the purpose for which it was
collected, or as required by law. The schedule below applies unless you submit a deletion
request (Section 21) and it is approved.</p>

<table>
  <thead>
    <tr><th>Data Type</th><th>Retention Period</th><th>Notes</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>Messages (text &amp; media metadata)</td>
      <td>Until admin manually deletes or you request erasure</td>
      <td>No automatic expiry — the admin may archive conversations</td>
    </tr>
    <tr>
      <td>Media files (stored in R2)</td>
      <td>Until admin deletes or you request erasure</td>
      <td>R2 objects are referenced by URL in the D1 messages table</td>
    </tr>
    <tr>
      <td>User profile (ID, name, username)</td>
      <td>Indefinite while account is active; deleted on approved erasure request</td>
      <td>Required to maintain message history and service state</td>
    </tr>
    <tr>
      <td>Donation records</td>
      <td>Minimum 12 months for financial compliance; may be retained longer as required by law</td>
      <td>Even after erasure, anonymised transaction totals may be retained</td>
    </tr>
    <tr>
      <td>Subscription records</td>
      <td>Duration of subscription + 6 months after expiry</td>
      <td>Needed to resolve billing disputes</td>
    </tr>
    <tr>
      <td>Moderation actions</td>
      <td>Active bans: indefinite. Warn/restrict logs: 90 days then auto-purged</td>
      <td>Active restrictions must persist to be enforced</td>
    </tr>
    <tr>
      <td>Anti-spam counters</td>
      <td>Rolling 60-second windows; not persisted to the database</td>
      <td>Held in memory only; cleared on server restart</td>
    </tr>
    <tr>
      <td>Video stream tokens</td>
      <td>24 hours from generation (auto-expire via JWT expiry claim)</td>
      <td>Expired tokens are rejected; token metadata is not persisted</td>
    </tr>
    <tr>
      <td>MTProto sessions</td>
      <td>Until you revoke them via the Sessions page or submit a deletion request</td>
      <td>Sessions remain valid until revoked; see Section 16</td>
    </tr>
    <tr>
      <td>Device &amp; IP metadata</td>
      <td>Indefinite while account is active; deleted on approved erasure request</td>
      <td>Updated on each Mini App visit</td>
    </tr>
    <tr>
      <td>Deletion request records</td>
      <td>3 years after resolution</td>
      <td>Retained for GDPR compliance audit evidence</td>
    </tr>
    <tr>
      <td>Server access logs</td>
      <td>Up to 7 days in Cloudflare infrastructure</td>
      <td>Controlled by Cloudflare's own policies</td>
    </tr>
  </tbody>
</table>

<!-- ═══════════════════════════ 8. SECURITY MEASURES ═════════════════════════ -->
<h2 id="security">8. Security Measures</h2>
<p>We apply the following technical and organisational measures to protect your personal data:</p>

<h3>8.1 Encryption in transit</h3>
<p>All communication between your device and our server is encrypted using TLS 1.2 or 1.3,
enforced via Cloudflare's edge. HSTS is enabled. The Mini App is served exclusively over HTTPS.
Telegram's own MTProto encryption applies to all bot messages before they reach our server.</p>

<h3>8.2 Encryption at rest</h3>
<p>Cloudflare D1 (database) and Cloudflare R2 (file storage) encrypt all data at rest using
AES-256 by default. No unencrypted copies of data are made outside these systems.</p>

<h3>8.3 Access control</h3>
<p>The admin panel (Mini App) uses Telegram's <code>initData</code> cryptographic validation:
a HMAC-SHA256 hash derived from your bot token is verified server-side on every API request.
Admin-only endpoints require a matching Telegram user ID header and a valid initData signature.
No username/password system is used; authentication is tied to Telegram account control.</p>

<h3>8.4 Secrets management</h3>
<p>API keys, database credentials, and bot tokens are stored as environment secrets in the
hosting platform and are never committed to version control or logged.</p>

<h3>8.5 Rate limiting</h3>
<p>API endpoints are rate-limited at both the bot and Mini App level to prevent enumeration,
brute-force, and denial-of-service attacks.</p>

<h3>8.6 Video token security</h3>
<p>Video stream links use signed JWT tokens (HS256) with a 24-hour expiry. Each token contains
the file reference and cannot be forged without the server's signing secret.</p>

<h3>8.7 MTProto session security</h3>
<p>MTProto string sessions are stored in the database without additional server-side encryption
beyond Cloudflare's at-rest encryption. <strong>You should treat your session string like a
password.</strong> Anyone with your session string can act on your behalf on Telegram.
See Section 16 for full details and risks.</p>

<div class="highlight warn">
  <p>No system is perfectly secure. Despite our measures, we cannot guarantee that data
  will never be accessed, disclosed, altered, or destroyed by a breach of physical, technical,
  or managerial safeguards. You use this service at your own risk.</p>
</div>

<!-- ═══════════════════════════ 9. DATA BREACH POLICY ════════════════════════ -->
<h2 id="breach">9. Data Breach Policy</h2>

<h3>9.1 Detection and assessment</h3>
<p>In the event of a suspected security incident, the operator will assess the scope, nature,
and impact of the breach within 24 hours of becoming aware of it.</p>

<h3>9.2 Notification</h3>
<p>If the breach is likely to result in a risk to your rights and freedoms:</p>
<ul>
  <li>Affected users will be notified via the bot within 72 hours where feasible.</li>
  <li>Where required by applicable law (e.g. GDPR Article 33), the relevant supervisory authority
  will also be notified within 72 hours.</li>
  <li>Notification will describe the nature of the breach, the data categories affected, the
  approximate number of individuals concerned, likely consequences, and the measures taken or
  proposed.</li>
</ul>

<h3>9.3 Containment</h3>
<p>Immediate steps upon confirmed breach include: rotating all secrets and tokens, revoking
active MTProto sessions, invalidating active JWT video tokens, and assessing whether D1 or R2
data was exfiltrated. If sessions are compromised, all users will be advised to revoke their
sessions immediately and change their Telegram Two-Step Verification password.</p>

<!-- ═══════════════════════════ 10. THIRD-PARTY SERVICES ══════════════════════ -->
<h2 id="third-party">10. Third-Party Services</h2>
<p>The service relies on the following external providers. Each processes personal data under
its own privacy policy and security practices.</p>

<table>
  <thead>
    <tr><th>Service</th><th>Purpose</th><th>Data shared</th><th>Privacy policy</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Telegram</strong></td>
      <td>Message delivery, file sharing, Payments, Stars</td>
      <td>All bot traffic passes through Telegram's infrastructure</td>
      <td><a href="https://telegram.org/privacy" target="_blank">telegram.org/privacy</a></td>
    </tr>
    <tr>
      <td><strong>Cloudflare D1</strong></td>
      <td>SQL database — all structured data storage</td>
      <td>All personal data in database tables</td>
      <td><a href="https://www.cloudflare.com/privacypolicy/" target="_blank">cloudflare.com/privacypolicy</a></td>
    </tr>
    <tr>
      <td><strong>Cloudflare R2</strong></td>
      <td>Object storage — media files and attachments</td>
      <td>Files you or the admin upload via the bot</td>
      <td><a href="https://www.cloudflare.com/privacypolicy/" target="_blank">cloudflare.com/privacypolicy</a></td>
    </tr>
    <tr>
      <td><strong>Cloudflare CDN / Workers</strong></td>
      <td>Edge proxy, DDoS protection, TLS termination</td>
      <td>IP address, request headers (standard CDN proxy)</td>
      <td><a href="https://www.cloudflare.com/privacypolicy/" target="_blank">cloudflare.com/privacypolicy</a></td>
    </tr>
    <tr>
      <td><strong>OxaPay</strong></td>
      <td>Cryptocurrency payment gateway</td>
      <td>Donation amount, currency, transaction ID; your crypto wallet address is not collected by us</td>
      <td><a href="https://oxapay.com/privacy-policy" target="_blank">oxapay.com/privacy-policy</a></td>
    </tr>
    <tr>
      <td><strong>Telegram Payments (Stars)</strong></td>
      <td>In-app Telegram Stars payment processing</td>
      <td>Stars invoice data processed entirely by Telegram; we receive only confirmation and amount</td>
      <td><a href="https://telegram.org/privacy" target="_blank">telegram.org/privacy</a></td>
    </tr>
    <tr>
      <td><strong>ip-api.com</strong></td>
      <td>IP geolocation (city &amp; region lookup)</td>
      <td>IP address sent for geolocation; no account is created; free tier with rate limits</td>
      <td><a href="https://ip-api.com/docs/legal" target="_blank">ip-api.com/docs/legal</a></td>
    </tr>
  </tbody>
</table>

<p>We do not use Google Analytics, Meta Pixel, or any advertising network. No third-party
scripts are loaded on the Mini App or policy page beyond what is listed above.</p>

<!-- ═══════════════════════════ 11. INTERNATIONAL TRANSFERS ══════════════════ -->
<h2 id="international">11. International Data Transfers</h2>
<p>Your data may be processed in data centres outside your country of residence. Specifically:</p>
<ul>
  <li><strong>Cloudflare D1 and R2</strong> use data centres in the United States and the European
  Union. Cloudflare is a participant in the EU-U.S. Data Privacy Framework and provides Standard
  Contractual Clauses (SCCs) for EU personal data transfers.</li>
  <li><strong>Telegram</strong> operates servers globally under its own data localisation practices.</li>
  <li><strong>OxaPay</strong> processes payments internationally as part of the cryptocurrency
  ecosystem.</li>
  <li><strong>ip-api.com</strong> is queried in real time from our server with only the IP address;
  no other personal data is sent.</li>
</ul>
<p>We rely on Cloudflare's SCCs and adequacy decisions where available as the lawful mechanism
for international transfers of EEA personal data.</p>

<!-- ═══════════════════════════ 12. AUTOMATED PROCESSING ══════════════════════ -->
<h2 id="automated">12. Automated Processing &amp; Anti-Spam</h2>

<h3>12.1 Anti-spam system</h3>
<p>An automated system monitors message frequency across rolling time windows. When a user
sends messages faster than the configured threshold, the following automated actions may occur
without human intervention:</p>
<ul>
  <li>Warning message sent to the user</li>
  <li>Temporary restriction of messaging rights</li>
  <li>Temporary or permanent ban from the bot</li>
</ul>

<h3>12.2 Your rights regarding automated decisions</h3>
<p>Under GDPR Article 22, you have the right not to be subject to decisions based solely on
automated processing that produce significant effects on you. If you believe an automated
moderation action has been applied incorrectly, you may:</p>
<ul>
  <li>Contact the admin at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> to request a human review</li>
  <li>Send a message to ${BOT_NAME} explaining the situation (once the restriction is lifted)</li>
</ul>
<p>The anti-spam system does <strong>not</strong> analyse message content — it counts only
message frequency. It does not build behavioural profiles or infer personal characteristics.</p>

<h3>12.3 No other automated profiling</h3>
<p>We do not use automated decision-making for any other purpose, including credit assessment,
content recommendation, or personalisation.</p>

<!-- ═══════════════════════════ 13. CHILDREN'S PRIVACY ═══════════════════════ -->
<h2 id="children">13. Children's Privacy</h2>
<p>This service is not directed at children under the age of 13 (or the minimum age set by
Telegram in your country, whichever is higher). We do not knowingly collect personal data
from children.</p>
<p>Telegram itself requires users to be at least 13 years old. By using this bot you represent
that you are at or above the minimum age. If we become aware that a child below the minimum
age has provided personal data, we will delete that data promptly upon notification.</p>
<p>If you are a parent or guardian and believe your child has used this service, please contact
us at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>

<!-- ═══════════════════════════ 14. COOKIES & LOCAL STORAGE ═══════════════════ -->
<h2 id="cookies">14. Cookies &amp; Local Storage</h2>

<h3>14.1 What we set</h3>
<p>We use browser <strong>localStorage</strong> (not traditional HTTP cookies) to store
consent preferences and session state. No cross-site tracking cookies are set. The Mini App
and video player each set a single key:</p>
<table>
  <thead>
    <tr><th>Key</th><th>Values</th><th>Purpose</th><th>Scope</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><code>cookie_consent_v1</code></td>
      <td><code>accepted</code> | <code>declined</code></td>
      <td>Records your consent preference shown by the Mini App banner</td>
      <td>Mini App origin only</td>
    </tr>
    <tr>
      <td><code>ck_player_v1</code></td>
      <td><code>accepted</code> | <code>declined</code></td>
      <td>Records your consent preference shown by the video player banner</td>
      <td>Player page origin only</td>
    </tr>
  </tbody>
</table>
<p>These keys do not expire automatically. They can be cleared at any time by clearing your
browser's site data, or by changing your preference in the Mini App's Account tab.</p>
<p>No advertising, analytics (e.g. Google Analytics), social media tracking, or third-party
cookies are placed on your device.</p>

<h3>14.2 Essential vs enhanced data</h3>
<ul>
  <li><strong>Essential</strong> (always collected regardless of consent): Telegram user ID and
  first name — the minimum required to operate the messaging service.</li>
  <li><strong>Enhanced</strong> (collected when you use the Mini App or open a video link):
  IP address, country, city, device type, browser, screen resolution, language, and timezone.
  You can manage this via your consent preference, but note it is technically collected from
  the HTTP request regardless — your consent preference determines how it is stored and used.</li>
</ul>

<h3>14.3 Managing your consent</h3>
<p>Open the Mini App and go to <strong>Account → Cookie &amp; Data Consent</strong> to change
your preference at any time. Withdrawing consent does not automatically delete data already
collected; submit a deletion request (Section 21) to request erasure.</p>

<!-- ═══════════════════════════ 15. IP & DEVICE DATA ══════════════════════════ -->
<h2 id="ip-collection">15. IP Address &amp; Device Data</h2>
<p>When you use the Mini App or open a video streaming link, the following technical data
is automatically captured and stored in Cloudflare D1, associated with your Telegram user ID:</p>

<table>
  <thead>
    <tr><th>Data point</th><th>How collected</th><th>Why</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>IP address</td>
      <td>From the <code>cf-connecting-ip</code> Cloudflare header on every HTTP request to our API</td>
      <td>Security, fraud detection, geolocation</td>
    </tr>
    <tr>
      <td>Country code</td>
      <td>From the <code>cf-ipcountry</code> Cloudflare header (two-letter ISO 3166-1 code)</td>
      <td>Regional service delivery and anomaly detection</td>
    </tr>
    <tr>
      <td>City &amp; region</td>
      <td>Derived from your IP via the ip-api.com geolocation API (free tier, no persistent account)</td>
      <td>Approximate location context for the administrator</td>
    </tr>
    <tr>
      <td>User-agent string</td>
      <td>Standard <code>User-Agent</code> HTTP header sent by your browser or Telegram client</td>
      <td>Device and OS identification</td>
    </tr>
    <tr>
      <td>Screen resolution</td>
      <td><code>window.screen.width × window.screen.height</code> read by Mini App JavaScript</td>
      <td>Display optimisation</td>
    </tr>
    <tr>
      <td>Browser language</td>
      <td><code>navigator.language</code> read by Mini App JavaScript</td>
      <td>Future localisation support</td>
    </tr>
    <tr>
      <td>Timezone</td>
      <td><code>Intl.DateTimeFormat().resolvedOptions().timeZone</code> read by Mini App JavaScript</td>
      <td>Timestamp display and scheduling</td>
    </tr>
    <tr>
      <td>Platform</td>
      <td><code>navigator.platform</code> read by Mini App JavaScript</td>
      <td>Device classification</td>
    </tr>
  </tbody>
</table>

<p>This data is visible only to the administrator via the admin chat panel. It is not shared
with any third party other than the infrastructure services listed in Section 10.</p>
<p>IP addresses are stored in their full form and are not anonymised or hashed. To request
removal of your IP and device data, use the in-app deletion request feature or contact
<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>

<!-- ═══════════════════════════ 16. MTPROTO SESSIONS ══════════════════════════ -->
<h2 id="sessions">16. MTProto Sessions</h2>

<h3>16.1 What is an MTProto session?</h3>
<p>An MTProto string session is a base64-encoded token that contains the encryption keys
for an active Telegram account session. When you provide this session string to the bot,
it allows the service to act on your Telegram account via the MTProto protocol — similar
to being logged in as you on Telegram Web.</p>

<h3>16.2 How we use sessions</h3>
<p>Sessions stored in this service are used exclusively to:</p>
<ul>
  <li>Stream large video files (above Telegram Bot API's 20 MB limit) without re-uploading</li>
  <li>Perform advanced group management operations that require a user account rather than a bot</li>
</ul>
<p>Sessions are <strong>never</strong> used to read your private conversations, access your
contacts, post on your behalf, or perform any action not directly related to the above.</p>

<h3>16.3 Risks — please read carefully</h3>
<div class="highlight warn">
  <p>Providing your MTProto session string to any service carries significant risk. The session
  grants full access to your Telegram account until it is revoked. If this service were breached,
  an attacker with your session string could read your messages, impersonate you, and access
  all your Telegram data. <strong>Only provide a session string if you fully understand and
  accept this risk.</strong></p>
</div>

<h3>16.4 How to revoke your session</h3>
<p>At any time you can:</p>
<ul>
  <li>Open the Mini App → <strong>Sessions</strong> tab → delete your session</li>
  <li>Open Telegram → Settings → Privacy and Security → Active Sessions → terminate the relevant session</li>
  <li>Change your Telegram Two-Step Verification password, which invalidates all sessions</li>
</ul>
<p>Revoking the session in Telegram's official settings immediately invalidates it even if
it is still stored in our database. We recommend revoking on both sides.</p>

<!-- ═══════════════════════════ 17. VIDEO STREAMING ══════════════════════════ -->
<h2 id="video">17. Video Streaming</h2>

<h3>17.1 How it works</h3>
<p>Video files are streamed directly from Telegram's servers via the Bot API. When a Premium
subscriber or the admin sends a video, a signed HMAC token is generated and embedded in a
unique watch URL. The video player page fetches the file from Telegram on demand and streams
it to your browser. <strong>Video streaming is a Premium-only feature.</strong> Non-premium
users who send videos will have their videos forwarded to the admin as normal messages without
generating stream links.</p>

<h3>17.2 Data collected during streaming</h3>
<p>When you open a video streaming link, the following data is collected:</p>
<ul>
  <li>IP address and user-agent string (from the HTTP request)</li>
  <li>A cookie/localStorage preference (<code>ck_player_v1</code>) recording your consent choice</li>
  <li>The token itself is validated but not stored in the database; it lives only in memory</li>
</ul>
<p>We do not track which portions of a video you watched, how long you watched for, or whether
you completed it.</p>

<h3>17.3 Link expiry</h3>
<p>Watch links expire after 24 hours. Expired links display a notice and cannot be extended
automatically. Request a new link from the sender.</p>

<h3>17.4 Link sharing</h3>
<p>Video watch links are not protected by authentication — anyone with the URL can watch the
video during its 24-hour validity window. Do not share watch links publicly if the content
is private.</p>

<!-- ═══════════════════════════ 18. GROUP MANAGEMENT ══════════════════════════ -->
<h2 id="groups">18. Group Management</h2>

<h3>18.1 Groups the bot manages</h3>
<p>When the bot is added as an administrator to a Telegram group or channel, it may collect and
process the following group-level data:</p>
<ul>
  <li><strong>Group ID and title</strong> — for identifying which group actions are applied in</li>
  <li><strong>Member list</strong> — Telegram user IDs of members in managed groups (used for /tagall and /banall)</li>
  <li><strong>Join/leave events</strong> — timestamps of when members join or leave</li>
  <li><strong>Message events</strong> — message counts for anti-spam purposes (content is not read or stored)</li>
</ul>

<h3>18.2 Group member rights</h3>
<p>If you are a member of a group managed by this bot, your Telegram user ID and membership
timestamps are processed as described above. If you want your data removed from group records,
contact the group administrator who controls this bot, or submit a deletion request to
<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>

<h3>18.3 /tagall and /banall commands</h3>
<p>These premium commands iterate over the stored member list. <code>/tagall</code> mentions
all tracked members in a single message. <code>/banall</code> bans all tracked members. These
are powerful tools that can only be invoked by group administrators with premium access.
The operator is not responsible for misuse of these commands by group admins.</p>

<!-- ═══════════════════════════ 19. BROADCAST MESSAGES ═══════════════════════ -->
<h2 id="broadcast">19. Broadcast Messages</h2>

<h3>19.1 What broadcasts are</h3>
<p>The admin can send a single message to all users who have ever messaged the bot. Broadcasts
are non-interactive announcements (e.g. service updates, new features, policy changes).</p>

<h3>19.2 Opting out of broadcasts</h3>
<p>Telegram bots cannot send messages to users who have blocked the bot. To stop receiving
broadcasts, simply <strong>block ${BOT_NAME}</strong> in Telegram (long-press the bot → Block).
You can unblock it at any time to resume receiving messages.</p>
<p>Blocking the bot does not delete your data. If you also want your data deleted, submit a
deletion request as described in Section 21.</p>

<h3>19.3 Broadcast content policy</h3>
<p>Broadcasts will only be used for service-related announcements. They will not be used for
commercial advertising, third-party promotions, or spam of any kind.</p>

<!-- ═══════════════════════════ 20. PAYMENTS & DONATIONS ══════════════════════ -->
<h2 id="payments">20. Payments &amp; Donations</h2>

<h3>20.1 Cryptocurrency donations (OxaPay)</h3>
<p>Donations via OxaPay support multiple cryptocurrencies including USDT, BTC, ETH, TRX, and
others available on the OxaPay platform. The payment flow:</p>
<ol>
  <li>You initiate a donation in the Mini App and specify an amount</li>
  <li>We call the OxaPay API to create an invoice; OxaPay returns a payment address and amount</li>
  <li>You send cryptocurrency to the displayed address from your own wallet</li>
  <li>OxaPay sends a webhook callback to our server confirming the transaction</li>
  <li>We record the donation amount, currency, and OxaPay tracking ID in D1</li>
</ol>
<p>We never see or store your private wallet keys or seed phrases. Your sending address
is visible on the public blockchain but we do not actively record it.</p>

<h3>20.2 Telegram Stars</h3>
<p>Telegram Stars are Telegram's in-app virtual currency. Stars payments are processed entirely
within Telegram's infrastructure via the Payments API. We receive only a confirmation event
containing the Stars amount and the Telegram invoice ID. No external payment credentials are
involved.</p>

<h3>20.3 Donation records</h3>
<p>All completed donations are stored in D1 indefinitely by default (minimum 12 months for
compliance). They appear in your donation history in the Mini App. Donation records may be
retained even after an account deletion request to satisfy legal financial record-keeping
obligations, though they will be anonymised (Telegram ID removed, replaced with a placeholder).</p>

<h3>20.4 Refunds</h3>
<p>See Section 28 (Refund Policy) for the full refunds policy.</p>

<!-- ═══════════════════════════ 21. YOUR RIGHTS ═══════════════════════════════ -->
<h2 id="rights">21. Your Rights</h2>
<p>Depending on your jurisdiction and applicable law, you may have the following rights regarding
your personal data. These apply in full to users in the EEA (GDPR), UK (UK GDPR), California
(CCPA/CPRA), and equivalent regimes.</p>

<table>
  <thead>
    <tr><th>Right</th><th>What it means</th><th>How to exercise it</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Access (Art. 15)</strong></td>
      <td>Obtain a copy of all personal data held about you</td>
      <td>Email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> with subject "Data Access Request"</td>
    </tr>
    <tr>
      <td><strong>Rectification (Art. 16)</strong></td>
      <td>Correct inaccurate personal data</td>
      <td>Contact us — most identity data comes from Telegram and must be corrected there first</td>
    </tr>
    <tr>
      <td><strong>Erasure (Art. 17)</strong></td>
      <td>Request deletion of all data ("right to be forgotten")</td>
      <td>Use in-app deletion request form or send <code>/deleteme</code> to the bot</td>
    </tr>
    <tr>
      <td><strong>Restriction (Art. 18)</strong></td>
      <td>Ask us to pause processing while a dispute is pending</td>
      <td>Email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></td>
    </tr>
    <tr>
      <td><strong>Portability (Art. 20)</strong></td>
      <td>Receive your data in a structured, machine-readable format (JSON/CSV)</td>
      <td>Email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> with subject "Data Portability Request"</td>
    </tr>
    <tr>
      <td><strong>Objection (Art. 21)</strong></td>
      <td>Object to processing based on legitimate interests</td>
      <td>Email us explaining the specific processing you object to</td>
    </tr>
    <tr>
      <td><strong>Automated decisions (Art. 22)</strong></td>
      <td>Request human review of automated anti-spam decisions</td>
      <td>Email us or message the bot after your restriction expires</td>
    </tr>
    <tr>
      <td><strong>Withdraw consent</strong></td>
      <td>Withdraw any consent-based processing at any time</td>
      <td>Update your consent in Mini App → Account, or block the bot</td>
    </tr>
  </tbody>
</table>

<p>We will respond to all rights requests within <strong>30 days</strong>. In complex cases
we may extend this by a further 60 days, in which case you will be notified within the initial
30-day window.</p>
<div class="highlight">
  <p>Exercising your rights is free. We will never charge a fee for rights requests made in
  good faith. Manifestly unfounded or excessive requests may be refused or charged a reasonable
  fee in accordance with GDPR Article 12(5).</p>
</div>

<!-- ═══════════════════════════ 22. IN-APP DATA CONTROLS ══════════════════════ -->
<h2 id="in-app-rights">22. In-App Data Rights Controls</h2>
<p>The Mini App provides built-in self-service tools so you can exercise key rights without
emailing us:</p>

<div class="card-grid">
  <div class="card">
    <h3>Account → Data Deletion</h3>
    <p>Submit a formal deletion request with a written reason. The admin reviews and approves or
    declines within 30 days. On approval, all records in all D1 tables linked to your Telegram ID
    are permanently deleted and you are notified via the bot.</p>
  </div>
  <div class="card">
    <h3>Account → Cookie Consent</h3>
    <p>Change your consent preference (Accept / Decline) at any time. The update is immediately
    synced to your <code>user_metadata</code> record in D1 and sent to the server within seconds.</p>
  </div>
  <div class="card">
    <h3>Sessions → Revoke</h3>
    <p>Delete any stored MTProto session string from our database. The session should also be
    revoked from Telegram's Active Sessions page for full security.</p>
  </div>
  <div class="card">
    <h3>Bot command: /deleteme</h3>
    <p>Send <code>/deleteme</code> directly to ${BOT_NAME} to trigger an automatic deletion
    request in our system. An admin will review and respond within 30 days.</p>
  </div>
</div>

<!-- ═══════════════════════════ 23. COMPLAINTS ════════════════════════════════ -->
<h2 id="complaints">23. Complaints Procedure</h2>

<h3>23.1 Internal complaints</h3>
<p>If you have a complaint about how we handle your personal data, please contact us first
at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> with the subject "Privacy Complaint".
We will acknowledge your complaint within 5 business days and provide a substantive response
within 30 days.</p>

<h3>23.2 Supervisory authority</h3>
<p>If you are based in the EEA and you are not satisfied with our response, you have the right
to lodge a complaint with your local data protection supervisory authority. Examples include:</p>
<ul>
  <li><strong>EU (any member state):</strong> Your national DPA (e.g. CNIL in France, BfDI in Germany, DPC in Ireland)</li>
  <li><strong>UK:</strong> Information Commissioner's Office (ICO) — <a href="https://ico.org.uk" target="_blank">ico.org.uk</a></li>
  <li><strong>US (California):</strong> California Privacy Protection Agency (CPPA)</li>
</ul>
<p>We encourage you to contact us before escalating to a supervisory authority so we have the
opportunity to resolve your concern directly.</p>

<hr class="divider">

<!-- ═══════════════════════════ 24. TERMS OF SERVICE ═════════════════════════ -->
<h2 id="terms">24. Terms of Service</h2>
<span class="section-label">Binding Agreement</span>

<h3>24.1 Acceptance</h3>
<p>By sending any message to ${BOT_NAME} or opening the Mini App, you agree to be bound by
these Terms of Service. If you do not agree, you must stop using the service immediately.</p>

<h3>24.2 Eligibility</h3>
<p>You must be at least 13 years of age (or the minimum age required by Telegram in your
country, whichever is higher). By using the service you represent and warrant that you meet
this requirement and have the legal capacity to enter into a binding agreement.</p>

<h3>24.3 Permitted use</h3>
<ul>
  <li>Contacting the administrator with genuine enquiries, questions, or feedback</li>
  <li>Sending files and media for review or delivery by the administrator</li>
  <li>Making voluntary donations via the supported payment methods</li>
  <li>Accessing premium features you have lawfully paid for</li>
  <li>Using group management tools in groups where you are a legitimate administrator</li>
  <li>Streaming video content shared with you by the administrator</li>
</ul>

<h3>24.4 Service availability</h3>
<p>The service is provided on an "as is" and "as available" basis. We make no guarantee of
uninterrupted or error-free operation. Scheduled maintenance, Telegram API outages, Cloudflare
incidents, or other infrastructure issues may cause temporary unavailability. We will not be
liable for any losses arising from unavailability.</p>

<h3>24.5 Service modifications</h3>
<p>We reserve the right to modify, suspend, or discontinue any part of the service at any time,
with or without notice. We will make reasonable efforts to notify active users of significant
changes via broadcast or bot message.</p>

<h3>24.6 Termination</h3>
<p>We may restrict or terminate your access to the bot without notice if we determine that
you have violated these terms, applicable law, or Telegram's own Terms of Service. You may
stop using the service at any time by blocking the bot. Termination does not affect our
rights to retain data as described in Section 7.</p>

<!-- ═══════════════════════════ 25. TERMS AND CONDITIONS ═════════════════════ -->
<h2 id="conditions">25. Terms and Conditions</h2>
<span class="section-label">Legal Framework</span>

<h3>25.1 Intellectual property</h3>
<p>All code, design, branding, and content associated with this service is owned by or
licensed to the operator. You may not copy, modify, distribute, reverse-engineer, or create
derivative works without prior written permission, except as permitted by applicable law.</p>

<h3>25.2 User content licence</h3>
<p>By sending content (text, images, videos, files, voice messages) through the bot, you grant
the operator a limited, non-exclusive, royalty-free licence to store, process, and transmit
that content solely for the purpose of delivering the service. This licence terminates when
your content is deleted from our systems. You retain full ownership of your content.</p>

<h3>25.3 Limitation of liability</h3>
<p>To the maximum extent permitted by applicable law, the operator shall not be liable for any
indirect, incidental, special, consequential, exemplary, or punitive damages, including loss of
data, loss of revenue, loss of profits, or loss of goodwill, arising from:</p>
<ul>
  <li>Your use of or inability to use the service</li>
  <li>Unauthorised access to or alteration of your data</li>
  <li>Deletion, corruption, or failure to store any content or data</li>
  <li>Actions taken by Telegram, Cloudflare, OxaPay, or any third-party service</li>
  <li>Cryptocurrency market fluctuations or transaction failures</li>
</ul>
<p>In no event shall the operator's total liability to you exceed the total amount you have
paid through the service in the 12 months preceding the claim, or USD 10, whichever is greater.</p>

<h3>25.4 Indemnification</h3>
<p>You agree to indemnify, defend, and hold harmless the operator from and against any claims,
liabilities, damages, losses, costs, and expenses (including reasonable legal fees) arising from
your use of the service, your violation of these terms, your violation of any applicable law,
or your infringement of any third-party rights.</p>

<h3>25.5 Disclaimer of warranties</h3>
<p>The service is provided without warranty of any kind, express or implied, including but not
limited to warranties of merchantability, fitness for a particular purpose, non-infringement,
accuracy, reliability, or security. Use of the service is at your sole risk.</p>

<h3>25.6 Governing law &amp; jurisdiction</h3>
<p>These terms are governed by applicable international law. Any dispute arising from or relating
to these terms that cannot be resolved informally shall be subject to the exclusive jurisdiction
of the courts of the operator's place of residence or operation. You waive any objection to
venue and jurisdiction.</p>

<h3>25.7 Severability</h3>
<p>If any provision of these terms is held to be invalid, illegal, or unenforceable, the
remaining provisions shall continue in full force and effect.</p>

<h3>25.8 Entire agreement</h3>
<p>This document constitutes the entire agreement between you and the operator regarding the
service, and supersedes all prior agreements, understandings, negotiations, and discussions,
whether oral or written.</p>

<h3>25.9 Waiver</h3>
<p>Failure to enforce any provision of these terms shall not constitute a waiver of the
operator's right to enforce that provision at a later time.</p>

<!-- ═══════════════════════════ 26. ACCEPTABLE USE POLICY ════════════════════ -->
<h2 id="acceptable-use">26. Acceptable Use Policy</h2>
<span class="section-label">Prohibited Conduct</span>

<h3>26.1 Prohibited content</h3>
<p>You must not send or share content that:</p>
<ul>
  <li>Is illegal under any applicable jurisdiction</li>
  <li>Contains child sexual abuse material (CSAM) — zero tolerance; immediately reported</li>
  <li>Infringes copyright, trademark, or other intellectual property rights</li>
  <li>Is defamatory, threatening, harassing, or incites hatred against any group</li>
  <li>Is deceptive, fraudulent, or designed to mislead</li>
  <li>Contains malware, viruses, trojans, ransomware, or other harmful code</li>
  <li>Violates Telegram's Terms of Service or community guidelines</li>
</ul>

<h3>26.2 Prohibited behaviour</h3>
<p>You must not:</p>
<ul>
  <li>Spam the bot with repeated or automated messages</li>
  <li>Attempt to circumvent rate limits or anti-spam measures</li>
  <li>Attempt to access data belonging to other users</li>
  <li>Probe, scan, or penetration-test the service without written authorisation</li>
  <li>Impersonate any person, entity, or bot</li>
  <li>Use the service to collect or harvest data about other users</li>
  <li>Interfere with the proper functioning of the bot, Mini App, or API server</li>
  <li>Use automated scripts, bots, or crawlers to interact with the service</li>
  <li>Attempt to obtain another user's MTProto session string</li>
  <li>Use premium features you have not lawfully paid for</li>
</ul>

<h3>26.3 Enforcement</h3>
<p>Violations of this policy may result in immediate termination of access without notice,
preservation of evidence for law enforcement, and reporting to relevant authorities. For serious
violations (e.g. CSAM, fraud), we will cooperate fully with law enforcement.</p>

<!-- ═══════════════════════════ 27. PREMIUM SUBSCRIPTIONS ════════════════════ -->
<h2 id="premium">27. Premium Subscriptions</h2>

<h3>27.1 What premium unlocks</h3>
<p>Premium subscribers gain access to features not available in the free tier:</p>
<ul>
  <li><strong>Video Streaming:</strong> 24-hour video stream and download links with a web player when sending videos to the bot</li>
  <li><strong>Tag All:</strong> Mention every tracked member in a managed Telegram group with a single command</li>
  <li><strong>Ban All:</strong> Ban all tracked members in a managed Telegram group with a single action</li>
</ul>
<p>Non-premium users who send videos will have them forwarded to the admin as normal messages. The admin always has full access to all features regardless of premium status.</p>

<h3>27.2 Subscription terms</h3>
<ul>
  <li>Subscriptions cost <strong>250 Telegram Stars (~$5 USD)</strong> for a 30-day period</li>
  <li>Subscriptions do <strong>not</strong> auto-renew; you must purchase again when they expire</li>
  <li>Access to premium features ceases immediately upon subscription expiry</li>
  <li>Premium features may change over time; we will provide reasonable notice of significant changes</li>
</ul>

<h3>27.3 Pricing</h3>
<p>The current price is 250 Telegram Stars (~$5 USD) for 30 days. Prices may change; existing
subscriptions are not affected by price changes until their expiry.</p>

<h3>27.4 Suspension for abuse</h3>
<p>Premium access may be suspended without refund if you violate the Acceptable Use Policy
or these Terms while using premium features.</p>

<!-- ═══════════════════════════ 28. REFUND POLICY ════════════════════════════ -->
<h2 id="refunds">28. Refund Policy</h2>

<h3>28.1 Cryptocurrency donations</h3>
<p>Cryptocurrency transactions are irreversible by the nature of blockchain technology once
confirmed. We are technically unable to reverse on-chain transactions. <strong>All crypto
donations are final and non-refundable.</strong></p>

<h3>28.2 Telegram Stars donations</h3>
<p>Telegram Stars are governed by Telegram's own refund policy. We cannot process Stars refunds
ourselves; if you believe you were charged incorrectly, contact Telegram support directly.</p>

<h3>28.3 Premium subscriptions</h3>
<p>Premium subscription fees are <strong>non-refundable</strong> once the subscription period
has commenced and you have received access to premium features. Exceptions may apply where
required by mandatory consumer protection law in your jurisdiction.</p>

<h3>28.4 Failed payments</h3>
<p>If you sent cryptocurrency and the bot did not credit your donation (e.g. due to network
issues or an incorrect amount), contact us at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>
with your transaction hash and OxaPay tracking ID. We will investigate within 5 business days.</p>

<h3>28.5 Consumer rights</h3>
<p>Nothing in this refund policy affects any statutory rights you may have under applicable
consumer protection law, which cannot be excluded or limited by contract.</p>

<!-- ═══════════════════════════ 29. POLICY CHANGES ═══════════════════════════ -->
<h2 id="changes">29. Policy Changes</h2>
<p>We may update this policy periodically to reflect changes in our practices, legal requirements,
or service features. When we make material changes, we will:</p>
<ul>
  <li>Update the "Last updated" date at the top of this document</li>
  <li>Send a broadcast notification to all bot users</li>
  <li>Post an announcement via the bot</li>
</ul>
<p>Minor changes (e.g. fixing typos, clarifying existing practices without substantive change)
may be made without formal notification. We encourage you to review this policy periodically.</p>
<p>Continued use of the service after changes constitutes acceptance of the revised policy.
If you do not agree with changes, you must stop using the service and may submit a deletion
request to have your data removed.</p>

<!-- ═══════════════════════════ 30. CONTACT ══════════════════════════════════ -->
<h2 id="contact">30. Contact</h2>
<p>For privacy requests, data deletion, rights exercises, complaints, or any questions about
this policy:</p>
<div class="card">
  <ul>
    <li><strong>Email:</strong> <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></li>
    <li><strong>Telegram bot:</strong> <a href="${BOT_LINK}">${BOT_NAME}</a></li>
    <li><strong>Mini App:</strong> <a href="${MINIAPP_URL}">${MINIAPP_URL}</a></li>
    <li><strong>Policy URL:</strong> <a href="${POLICY_URL}">${POLICY_URL}</a></li>
  </ul>
</div>
<p>When contacting us about a privacy matter, please include your Telegram user ID (if known)
and a clear description of your request. We will acknowledge your message within 5 business days.</p>

<footer>
  <p>${BOT_NAME} &nbsp;·&nbsp; Privacy Policy, Terms of Service &amp; Terms and Conditions</p>
  <p>Last updated <time datetime="${UPDATED}">${UPDATED}</time> &nbsp;·&nbsp; v2.0 &nbsp;·&nbsp; <a href="${POLICY_URL}">Permalink</a></p>
  <p style="margin-top:6px;font-size:11px">This document is written in plain English and is intended to be clear and transparent.
  If any provision is unclear, contact us and we will explain it.</p>
</footer>

</article>
</body>
</html>`;
}

privacy.get("/privacy", (c) => {
  c.header("Cache-Control", "public, max-age=3600");
  return c.html(getHtml(c.env));
});

export default privacy;
