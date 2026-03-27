import { Hono } from "hono";
import type { Env } from "../types.ts";

const privacy = new Hono<{ Bindings: Env }>();

privacy.get("/privacy", (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0a0a0a">
<title>Privacy Policy &amp; Terms — @lifegrambot</title>
<meta property="og:type"        content="article">
<meta property="og:title"       content="Privacy Policy, Terms of Service &amp; Terms and Conditions — @lifegrambot">
<meta property="og:description" content="Complete privacy policy, terms of service, cookie policy, data rights, and terms and conditions for @lifegrambot.">
<meta property="og:url"         content="https://mini.susagar.sbs/api/privacy">
<meta property="article:published_time" content="2026-03-27T00:00:00Z">
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
.lang-bar-wrap{margin:20px 0 0}
.lang-bar{display:flex;flex-wrap:wrap;gap:6px}
.lang-btn{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:6px;padding:4px 12px;
  font-size:11px;color:#555;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:4px}
.lang-btn:hover{border-color:#3b82f6;color:#3b82f6}
.lang-btn.active{border-color:#3b82f6;color:#3b82f6;background:rgba(29,78,216,0.06)}
#translated-overlay h2{font-size:1.08rem;font-weight:600;color:#e8e8e8;margin:32px 0 12px;
  padding-left:13px;border-left:3px solid #3b82f6}
#translated-overlay p{margin-bottom:12px;color:#999}
#translated-overlay ul{padding-left:22px;margin-bottom:14px}
#translated-overlay li{margin-bottom:7px;color:#999}
#translated-overlay a{color:#3b82f6}
[dir="rtl"] h2{padding-left:0;padding-right:13px;border-left:none;border-right:3px solid #3b82f6}
</style>
</head>
<body>
<article>

<header>
  <h1>Privacy Policy, Terms of Service &amp; Terms and Conditions</h1>
  <div class="meta">
    <span>@lifegrambot</span>
    <span class="badge blue">Last updated: <time datetime="2026-03-27">2026-03-27</time></span>
    <span class="badge" id="lang-label">English</span>
    <span class="badge">v3.2</span>
  </div>
</header>

<div id="lang-bar-wrap" class="lang-bar-wrap">
  <div class="lang-bar">
    <button class="lang-btn active" data-lang="en">English</button>
    <button class="lang-btn" data-lang="si">සිංහල</button>
    <button class="lang-btn" data-lang="hi">हिन्दी</button>
    <button class="lang-btn" data-lang="ta">தமிழ்</button>
    <button class="lang-btn" data-lang="zh">中文</button>
    <button class="lang-btn" data-lang="ar">العربية</button>
    <button class="lang-btn" data-lang="es">Español</button>
    <button class="lang-btn" data-lang="ru">Русский</button>
  </div>
</div>

<div id="translated-overlay" style="display:none"></div>

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
    <li><span class="toc-num">29.</span><a href="#ccpa">California Privacy (CCPA/CPRA)</a></li>
    <li><span class="toc-num">30.</span><a href="#dnt">Do Not Track Signals</a></li>
    <li><span class="toc-num">31.</span><a href="#dpia">Data Protection Impact Assessment</a></li>
    <li><span class="toc-num">32.</span><a href="#dpa">Data Processing Agreements</a></li>
    <li><span class="toc-num">33.</span><a href="#consent-mgmt">Consent Management</a></li>
    <li><span class="toc-num">34.</span><a href="#accessibility">Accessibility Statement</a></li>
    <li><span class="toc-num">35.</span><a href="#open-source">Open-Source Disclosures</a></li>
    <li><span class="toc-num">36.</span><a href="#ai-disclosure">AI &amp; Automated Tools Disclosure</a></li>
    <li><span class="toc-num">37.</span><a href="#changelog">Version History</a></li>
    <li><span class="toc-num">38.</span><a href="#changes">Policy Changes</a></li>
    <li><span class="toc-num">39.</span><a href="#contact">Contact</a></li>
  </ul>
</div>

<!-- ═══════════════════════════ 1. DEFINITIONS ═══════════════════════════════ -->
<h2 id="definitions">1. Definitions</h2>
<p>The following terms are used throughout this document:</p>
<dl>
  <dt>Bot / Service</dt>
  <dd>The Telegram bot <a href="https://t.me/lifegrambot">@lifegrambot</a> and its associated Mini App at <a href="https://lifegram-miniapp.pages.dev/miniapp/">https://lifegram-miniapp.pages.dev/miniapp/</a>, API server, database, and storage systems.</dd>

  <dt>Operator / We / Us</dt>
  <dd>The individual or entity operating @lifegrambot. Contact details are in Section 2.</dd>

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
  <dd>A web application embedded inside Telegram at <a href="https://lifegram-miniapp.pages.dev/miniapp/">https://lifegram-miniapp.pages.dev/miniapp/</a>, accessible via the bot's menu button.</dd>

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
    <li><strong>Service name:</strong> @lifegrambot</li>
    <li><strong>Telegram bot:</strong> <a href="https://t.me/lifegrambot">https://t.me/lifegrambot</a></li>
    <li><strong>Mini App:</strong> <a href="https://lifegram-miniapp.pages.dev/miniapp/">https://lifegram-miniapp.pages.dev/miniapp/</a></li>
    <li><strong>Contact email:</strong> <a href="mailto:support@areszyn.com">support@areszyn.com</a></li>
    <li><strong>Privacy policy URL:</strong> <a href="https://mini.susagar.sbs/api/privacy">https://mini.susagar.sbs/api/privacy</a></li>
  </ul>
</div>
<p>The operator is the data controller for all personal data processed through this service.
If you are located in the European Economic Area (EEA), the UK, or any jurisdiction with
comprehensive data protection law, the operator is responsible for ensuring compliance with
the applicable legal framework.</p>

<!-- ═══════════════════════════ 3. SERVICE OVERVIEW ══════════════════════════ -->
<h2 id="overview">3. Service Overview</h2>
<p>@lifegrambot is a multi-feature Telegram bot and Mini App providing:</p>
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
  <div class="card">
    <h3>⚡ Live Chat</h3>
    <p>Real-time text messaging between users and admin directly within the Mini App. Messages are stored and identified by your Telegram user ID.</p>
  </div>
</div>
<div class="highlight">
  <p>By sending any message to @lifegrambot, opening the Mini App, or accessing a video
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
      <td><strong>Live Chat</strong></td>
      <td>Text messages, timestamps, read status, sender and receiver Telegram IDs</td>
      <td>Messages you send in the Live Chat feature within the Mini App</td>
      <td>Only if you use Live Chat</td>
    </tr>
    <tr>
      <td><strong>Verification Links</strong></td>
      <td>IP address, user agent, GPS coordinates (if permitted), camera photos (if permitted), Telegram ID (if opened via Mini App)</td>
      <td>Collected when you open a verification link shared by the administrator</td>
      <td>Only if you open a verification link and grant permissions</td>
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
      <td>Phone number used for login, GramJS string session token (a long base64 string encoding your Telegram account's MTProto keys), creation timestamp</td>
      <td>Provided by you when linking a Telegram account for advanced features</td>
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
  biometric data, contacts, browsing history outside this
  service, or any data from Telegram chats other than messages sent directly to this bot.</p>
</div>

<div class="highlight">
  <p><strong>Location data:</strong> If you choose to share your location via the Mini App chat,
  a Google Maps link is generated and sent as a text message. The link text is stored in the
  messages table like any other message. We do <strong>not</strong> store raw GPS coordinates or
  continuously track your location. Sharing is always manual and voluntary.</p>
</div>

<div class="highlight">
  <p><strong>Media proxy:</strong> Photos, videos, voice messages, and documents you send are
  served via the Telegram Bot API file proxy (<code>/api/file/:fileId</code>). Media is streamed
  directly from Telegram servers on each request — it is <strong>not</strong> permanently stored on
  our servers. Only the Telegram <code>file_id</code> reference is stored in the database.</p>
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
  <li>Contact the admin at <a href="mailto:support@areszyn.com">support@areszyn.com</a> to request a human review</li>
  <li>Send a message to @lifegrambot explaining the situation (once the restriction is lifted)</li>
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
us at <a href="mailto:support@areszyn.com">support@areszyn.com</a>.</p>

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
<a href="mailto:support@areszyn.com">support@areszyn.com</a>.</p>

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
<a href="mailto:support@areszyn.com">support@areszyn.com</a>.</p>

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
broadcasts, simply <strong>block @lifegrambot</strong> in Telegram (long-press the bot → Block).
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

<h3>20.4 Payment history</h3>
<p>All payment transactions — Premium subscriptions, Widget plan purchases (Stars and crypto),
Boost add-on purchases, and donations — are accessible via a <strong>Payment History</strong> page in the
Mini App. This page shows transaction type, amount, payment method, status, and date for each entry.
Administrators have access to a consolidated view of all user payments with user identity information
(first name, username) for support and audit purposes.</p>

<h3>20.5 Refunds</h3>
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
      <td>Email <a href="mailto:support@areszyn.com">support@areszyn.com</a> with subject "Data Access Request"</td>
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
      <td>Email <a href="mailto:support@areszyn.com">support@areszyn.com</a></td>
    </tr>
    <tr>
      <td><strong>Portability (Art. 20)</strong></td>
      <td>Receive your data in a structured, machine-readable format (JSON/CSV)</td>
      <td>Email <a href="mailto:support@areszyn.com">support@areszyn.com</a> with subject "Data Portability Request"</td>
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
    <p>Send <code>/deleteme</code> directly to @lifegrambot to trigger an automatic deletion
    request in our system. An admin will review and respond within 30 days.</p>
  </div>
</div>

<!-- ═══════════════════════════ 23. COMPLAINTS ════════════════════════════════ -->
<h2 id="complaints">23. Complaints Procedure</h2>

<h3>23.1 Internal complaints</h3>
<p>If you have a complaint about how we handle your personal data, please contact us first
at <a href="mailto:support@areszyn.com">support@areszyn.com</a> with the subject "Privacy Complaint".
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
<p>By sending any message to @lifegrambot or opening the Mini App, you agree to be bound by
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
  <li>Premium subscriptions cost <strong>250 Telegram Stars (~$5 USD)</strong> for a 30-day period</li>
  <li>Widget plans: Standard (<strong>150 Stars / $3</strong>), Pro (<strong>400 Stars / $8</strong>) per 30 days</li>
  <li>Boost add-ons: per-unit pricing, stackable, active for 30 days</li>
  <li>Subscriptions auto-renew every 30 days via Telegram Stars; crypto payments do not auto-renew</li>
  <li>Access to premium features ceases immediately upon subscription expiry</li>
  <li>Premium features may change over time; we will provide reasonable notice of significant changes</li>
</ul>

<h3>27.3 Team Premium Sharing</h3>
<p>Premium subscribers may create a team to share their premium features with other users:</p>
<ul>
  <li><strong>Free members:</strong> The first 3 team members can join for free using an invite code</li>
  <li><strong>Paid members:</strong> Additional members beyond 3 cost <strong>$5 per user (250 Telegram Stars)</strong>, payable while the owner's premium subscription is active</li>
  <li><strong>Shared features:</strong> Team members receive access to Tag All, Ban All, Silent Ban, Group Tools, and widget watermark removal</li>
  <li><strong>Dependency on owner:</strong> Team member access is tied to the team owner's active premium subscription; if the owner's premium expires, team members lose access</li>
  <li><strong>Data stored:</strong> Team name, invite code, member Telegram IDs, join dates, and seat allocation are stored in our database (<code>premium_teams</code> and <code>premium_team_members</code> tables)</li>
  <li><strong>Removal:</strong> Team owners, individual members, or administrators can remove members at any time. Deleting a team removes all membership records</li>
</ul>

<h3>27.4 Pricing</h3>
<p>Premium: 250 Telegram Stars (~$5 USD) for 30 days. Team seats: first 3 free, then $5/user (250 Stars) per seat.
Widget Standard: 150 Stars ($3). Widget Pro: 400 Stars ($8).
Boost add-ons use per-unit pricing (e.g., 1 Star per extra message/day). Prices may change; existing
subscriptions are not affected by price changes until their expiry.</p>

<h3>27.5 Suspension for abuse</h3>
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
issues or an incorrect amount), contact us at <a href="mailto:support@areszyn.com">support@areszyn.com</a>
with your transaction hash and OxaPay tracking ID. We will investigate within 5 business days.</p>

<h3>28.5 Consumer rights</h3>
<p>Nothing in this refund policy affects any statutory rights you may have under applicable
consumer protection law, which cannot be excluded or limited by contract.</p>

<!-- ═══════════════════════════ 29. CALIFORNIA PRIVACY (CCPA/CPRA) ═════════ -->
<h2 id="ccpa">29. California Privacy Rights (CCPA/CPRA)</h2>
<span class="section-label">California Residents</span>

<h3>29.1 Categories of personal information collected</h3>
<p>Under the California Consumer Privacy Act (CCPA) and the California Privacy Rights Act (CPRA),
California residents have specific rights regarding their personal information. The following
categories of personal information may be collected:</p>
<table>
  <thead>
    <tr><th>Category</th><th>Examples</th><th>Collected</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>A. Identifiers</strong></td>
      <td>Telegram user ID, username, first/last name, IP address</td>
      <td>Yes</td>
    </tr>
    <tr>
      <td><strong>B. Personal info (Cal. Civ. Code §1798.80)</strong></td>
      <td>Name, language preference</td>
      <td>Yes</td>
    </tr>
    <tr>
      <td><strong>D. Commercial information</strong></td>
      <td>Donation history, subscription records, payment amounts</td>
      <td>Yes</td>
    </tr>
    <tr>
      <td><strong>F. Internet or network activity</strong></td>
      <td>Device info, browser type, screen resolution, timezone, interaction logs</td>
      <td>Yes</td>
    </tr>
    <tr>
      <td><strong>G. Geolocation data</strong></td>
      <td>Approximate location derived from IP address</td>
      <td>Yes</td>
    </tr>
    <tr>
      <td><strong>H. Audio, electronic, visual</strong></td>
      <td>Voice messages, photos, videos sent through the bot</td>
      <td>Yes</td>
    </tr>
    <tr>
      <td><strong>K. Inferences</strong></td>
      <td>Spam risk score, user activity level (active/inactive)</td>
      <td>Yes</td>
    </tr>
  </tbody>
</table>

<h3>29.2 Your California rights</h3>
<p>As a California resident, you have the following rights:</p>
<ul>
  <li><strong>Right to Know:</strong> Request disclosure of categories and specific pieces of personal
  information we have collected, the sources, the business purpose, and the categories of third
  parties with whom we share it.</li>
  <li><strong>Right to Delete:</strong> Request deletion of personal information we have collected
  (subject to certain exceptions).</li>
  <li><strong>Right to Correct:</strong> Request correction of inaccurate personal information.</li>
  <li><strong>Right to Opt-Out of Sale/Sharing:</strong> We do <strong>not sell</strong> personal
  information and do <strong>not share</strong> personal information for cross-context behavioural
  advertising. No opt-out is necessary.</li>
  <li><strong>Right to Limit Use of Sensitive Personal Information:</strong> We only use sensitive
  personal information for purposes permitted under CPRA.</li>
  <li><strong>Right to Non-Discrimination:</strong> We will not discriminate against you for
  exercising any of your CCPA/CPRA rights.</li>
</ul>

<h3>29.3 "Shine the Light" (Cal. Civ. Code §1798.83)</h3>
<p>We do not disclose personal information to third parties for their direct marketing purposes.
California residents are entitled to request this information once per calendar year. To make a
request, email <a href="mailto:support@areszyn.com">support@areszyn.com</a> with subject "California Shine the Light".</p>

<h3>29.4 Financial incentives</h3>
<p>We do not offer any financial incentives or price/service differences in exchange for the
retention or sale of personal information.</p>

<h3>29.5 Authorised agents</h3>
<p>You may designate an authorised agent to submit requests on your behalf. The agent must provide
written authorisation signed by you, and we may require you to verify your identity directly.</p>

<h3>29.6 Verification</h3>
<p>To protect your privacy, we will verify your identity before processing any rights request.
Verification typically requires matching your Telegram user ID against our records and may
require additional information if the request involves sensitive data.</p>

<hr class="divider">

<!-- ═══════════════════════════ 30. DO NOT TRACK ══════════════════════════════ -->
<h2 id="dnt">30. Do Not Track (DNT) Signals</h2>
<p>Some web browsers transmit "Do Not Track" (DNT) signals. As there is currently no industry
standard for recognising or honouring DNT signals, our Mini App does not currently respond to
DNT signals. However:</p>
<ul>
  <li>We do <strong>not</strong> use third-party tracking cookies or advertising pixels</li>
  <li>We do <strong>not</strong> engage in cross-site tracking</li>
  <li>We do <strong>not</strong> sell or share data with advertisers</li>
  <li>Our cookie consent mechanism provides equivalent functionality — users who decline consent
  receive the same service without enhanced data collection</li>
</ul>
<p>When the Global Privacy Control (GPC) specification reaches broader adoption, we intend to
honour GPC signals as a valid opt-out mechanism.</p>

<hr class="divider">

<!-- ═══════════════════════════ 31. DPIA ══════════════════════════════════════ -->
<h2 id="dpia">31. Data Protection Impact Assessment (DPIA)</h2>
<span class="section-label">GDPR Article 35</span>

<p>We have conducted a Data Protection Impact Assessment in accordance with GDPR Article 35
for processing activities that are likely to result in high risk to the rights and freedoms
of natural persons. Key findings:</p>

<div class="card-grid">
  <div class="card">
    <h3>Processing activity</h3>
    <p>Automated anti-spam analysis of incoming messages, including content scanning against
    keyword blocklists and behavioural pattern analysis for rate-limiting.</p>
  </div>
  <div class="card">
    <h3>Risk assessment</h3>
    <p>Medium risk — automated decisions may restrict access without prior notice. Mitigated by
    human review capability, appeal process, and time-limited restrictions.</p>
  </div>
  <div class="card">
    <h3>MTProto session storage</h3>
    <p>High sensitivity — session strings grant access to a user's Telegram account. Mitigated by
    platform-level encryption at rest (Cloudflare D1), per-user session isolation, immediate
    revocation capability, and strict access controls limiting session access to the authenticated user.</p>
  </div>
  <div class="card">
    <h3>Outcome</h3>
    <p>Processing may proceed with the documented safeguards in place. Regular reviews are
    conducted to ensure continued compliance and proportionality.</p>
  </div>
</div>

<h3>31.1 Necessity and proportionality</h3>
<p>Each category of data collected is necessary for the specific purpose stated in Section 6.
We do not collect data beyond what is required to deliver the service. Where a less intrusive
alternative exists, we adopt it.</p>

<h3>31.2 Review schedule</h3>
<p>The DPIA is reviewed and updated whenever we introduce a new processing activity, change the
nature or scope of existing processing, or when a data breach or near-miss occurs.</p>

<hr class="divider">

<!-- ═══════════════════════════ 32. DATA PROCESSING AGREEMENTS ════════════════ -->
<h2 id="dpa">32. Data Processing Agreements (DPA)</h2>
<span class="section-label">Sub-Processors</span>

<p>In accordance with GDPR Article 28, we maintain appropriate data processing arrangements
with third-party sub-processors who handle personal data on our behalf. The nature of each
arrangement depends on the sub-processor:</p>

<table>
  <thead>
    <tr><th>Sub-Processor</th><th>Purpose</th><th>Location</th><th>DPA Status</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Cloudflare, Inc.</strong></td>
      <td>CDN, Workers runtime, D1 database, R2 object storage</td>
      <td>Global (edge network)</td>
      <td>Standard DPA + SCCs</td>
    </tr>
    <tr>
      <td><strong>Telegram FZ-LLC</strong></td>
      <td>Bot API, message relay, user identity, Stars payments</td>
      <td>Dubai, UAE / Global</td>
      <td>Platform ToS applies</td>
    </tr>
    <tr>
      <td><strong>OxaPay</strong></td>
      <td>Cryptocurrency payment processing</td>
      <td>International</td>
      <td>Merchant agreement with data terms</td>
    </tr>
    <tr>
      <td><strong>Koyeb SAS</strong></td>
      <td>MTProto backend hosting</td>
      <td>EU (France)</td>
      <td>Standard DPA</td>
    </tr>
    <tr>
      <td><strong>GitHub, Inc.</strong></td>
      <td>Source code hosting, CI/CD (no user data processed)</td>
      <td>United States</td>
      <td>Standard DPA + SCCs</td>
    </tr>
  </tbody>
</table>

<h3>32.1 Sub-processor changes</h3>
<p>We will notify users via broadcast message at least 14 days before engaging a new sub-processor
that handles personal data. Users who object may submit a data deletion request.</p>

<h3>32.2 Data flow diagram</h3>
<div class="highlight">
  <p><strong>User → Telegram Bot API → Cloudflare Worker (API Server) → D1 Database / R2 Storage</strong><br>
  <strong>User → Mini App (Cloudflare Pages) → API Server → D1 / R2</strong><br>
  <strong>Admin → MTProto Backend (Koyeb) → Telegram MTProto API</strong><br>
  <strong>User → OxaPay → Webhook → API Server → D1</strong></p>
</div>

<hr class="divider">

<!-- ═══════════════════════════ 33. CONSENT MANAGEMENT ════════════════════════ -->
<h2 id="consent-mgmt">33. Consent Management</h2>
<span class="section-label">Granular Consent</span>

<p>We implement a layered consent model that distinguishes between essential processing
(which does not require consent) and optional processing (which does):</p>

<table>
  <thead>
    <tr><th>Processing purpose</th><th>Legal basis</th><th>User control</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>Storing messages sent to the bot</td>
      <td>Contractual necessity (Art. 6(1)(b))</td>
      <td>Cannot opt out (core service)</td>
    </tr>
    <tr>
      <td>Anti-spam analysis</td>
      <td>Legitimate interest (Art. 6(1)(f))</td>
      <td>Can object; human review available</td>
    </tr>
    <tr>
      <td>IP address &amp; device info collection</td>
      <td>Consent (Art. 6(1)(a))</td>
      <td>Accept / Decline via cookie banner</td>
    </tr>
    <tr>
      <td>Donation payment processing</td>
      <td>Contractual necessity (Art. 6(1)(b))</td>
      <td>Voluntary — only collected when you donate</td>
    </tr>
    <tr>
      <td>Broadcast notifications</td>
      <td>Legitimate interest (Art. 6(1)(f))</td>
      <td>Block the bot to stop all broadcasts</td>
    </tr>
    <tr>
      <td>MTProto session storage</td>
      <td>Explicit consent (Art. 6(1)(a))</td>
      <td>You must actively start a session; revocable at any time</td>
    </tr>
    <tr>
      <td>Premium subscription records</td>
      <td>Contractual necessity (Art. 6(1)(b))</td>
      <td>Retained for subscription duration + tax record period</td>
    </tr>
  </tbody>
</table>

<h3>33.1 Consent withdrawal</h3>
<p>Withdrawing consent does not affect the lawfulness of processing carried out before the
withdrawal. After withdrawal, we will cease the specific processing within 48 hours and
delete associated data within 30 days unless retention is required by law.</p>

<h3>33.2 Consent records</h3>
<p>We maintain records of all consent given or withdrawn, including timestamps, the specific
purpose, and the mechanism used (in-app toggle, bot command, or email). These records are
retained for the duration of the processing relationship plus 3 years for compliance evidence.</p>

<hr class="divider">

<!-- ═══════════════════════════ 34. ACCESSIBILITY STATEMENT ═══════════════════ -->
<h2 id="accessibility">34. Accessibility Statement</h2>

<p>We are committed to making this privacy policy and the Mini App accessible to all users,
including those with disabilities.</p>

<h3>34.1 This document</h3>
<ul>
  <li>Semantic HTML5 structure with proper heading hierarchy (h1–h4)</li>
  <li>High-contrast dark theme with WCAG AA compliant colour ratios</li>
  <li>Responsive design — readable on mobile screens down to 320px width</li>
  <li>Linked table of contents with anchor navigation</li>
  <li>Screen-reader compatible tables with header associations</li>
  <li>No JavaScript required — this page renders as static HTML</li>
</ul>

<h3>34.2 Mini App</h3>
<ul>
  <li>Touch-friendly controls with minimum 44×44px tap targets</li>
  <li>Colour is not used as the sole indicator of state — text labels accompany badges</li>
  <li>Loading states include animated indicators visible to assistive technology</li>
  <li>Form inputs have associated labels and error messages</li>
</ul>

<h3>34.3 Known limitations</h3>
<p>Some features that rely on Telegram's native UI (e.g. inline keyboards, bot commands)
inherit the accessibility characteristics of the Telegram client. We have no control over
the accessibility of Telegram's own interface.</p>

<p>If you encounter accessibility barriers, please contact us at
<a href="mailto:support@areszyn.com">support@areszyn.com</a> with subject "Accessibility Issue".
We will address reported issues within 14 business days.</p>

<hr class="divider">

<!-- ═══════════════════════════ 35. OPEN-SOURCE DISCLOSURES ══════════════════ -->
<h2 id="open-source">35. Open-Source Software Disclosures</h2>

<p>This service uses open-source software components. We acknowledge and are grateful for
the contributions of the open-source community. Key dependencies include:</p>

<table>
  <thead>
    <tr><th>Package</th><th>Licence</th><th>Purpose</th></tr>
  </thead>
  <tbody>
    <tr><td>Hono</td><td>MIT</td><td>API server web framework</td></tr>
    <tr><td>React</td><td>MIT</td><td>Mini App UI framework</td></tr>
    <tr><td>Vite</td><td>MIT</td><td>Build tooling and dev server</td></tr>
    <tr><td>Tailwind CSS</td><td>MIT</td><td>Utility-first CSS framework</td></tr>
    <tr><td>Telegram MTProto (GramJS)</td><td>MIT</td><td>MTProto protocol implementation</td></tr>
    <tr><td>Radix UI</td><td>MIT</td><td>Accessible UI primitives</td></tr>
    <tr><td>Lucide Icons</td><td>ISC</td><td>Icon set</td></tr>
  </tbody>
</table>

<p>Full dependency lists and their licences are available in the project repository. All
dependencies are used in accordance with their respective licences.</p>

<hr class="divider">

<!-- ═══════════════════════════ 36. AI & AUTOMATED TOOLS ═════════════════════ -->
<h2 id="ai-disclosure">36. AI &amp; Automated Tools Disclosure</h2>

<p>In the interest of transparency, we disclose the following use of AI and automated tools
in the development and operation of this service:</p>

<h3>36.1 Operational use</h3>
<ul>
  <li><strong>Anti-spam filtering:</strong> Rule-based keyword matching and rate-limiting algorithms
  (not machine learning models) are used to detect and filter spam. No external AI services
  receive your message content.</li>
  <li><strong>Automated moderation:</strong> Automated systems may restrict access based on
  predefined rules. All automated decisions can be reviewed by a human administrator upon request.</li>
</ul>

<h3>36.2 Development use</h3>
<p>AI coding assistants may have been used during the development of this service's source code.
All AI-generated code has been reviewed, tested, and validated by human developers before
deployment. No AI model has access to user data or production systems.</p>

<h3>36.3 Content generation</h3>
<p>Bot responses to users are <strong>not</strong> generated by AI. All automated replies are
predefined templates triggered by specific commands or events. The admin's manual replies
are written by a human.</p>

<hr class="divider">

<!-- ═══════════════════════════ 37. VERSION HISTORY ═══════════════════════════ -->
<h2 id="changelog">37. Version History</h2>

<table>
  <thead>
    <tr><th>Version</th><th>Date</th><th>Changes</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>v3.3</strong></td>
      <td>2026-03-27</td>
      <td>Added Team Premium Sharing section (27.3): team creation, free/paid member tiers (first 3
      free, then $5/user), shared features, data handling, and removal policies. Updated pricing section
      (27.4) to include team seat pricing. Renumbered subsections 27.4→27.5.</td>
    </tr>
    <tr>
      <td><strong>v3.2</strong></td>
      <td>2026-03-27</td>
      <td>Added widget boost/add-on purchase system (Stars &amp; crypto), stackable
      boost limits (30-day expiry), boost payment processing and idempotent activation, updated crypto
      payment flows for boost add-ons. Added payment history pages (user + admin).</td>
    </tr>
    <tr>
      <td><strong>v3.1</strong></td>
      <td>2026-03-26</td>
      <td>Added CCPA/CPRA section, DNT policy, DPIA summary, DPA sub-processor list,
      granular consent management table, accessibility statement, open-source disclosures,
      AI/automated tools disclosure, version history. Renumbered sections 29–39.</td>
    </tr>
    <tr>
      <td><strong>v2.0</strong></td>
      <td>2026-03-20</td>
      <td>Major expansion: added 30 comprehensive sections covering all data processing activities,
      premium subscriptions, MTProto sessions, video streaming, group management, automated
      processing, in-app data controls, complaints procedure, acceptable use policy, and refund
      policy. Full GDPR Article 13/14 compliance.</td>
    </tr>
    <tr>
      <td><strong>v1.0</strong></td>
      <td>2026-02-15</td>
      <td>Initial privacy policy covering basic data collection, cookies, and contact information.</td>
    </tr>
  </tbody>
</table>

<hr class="divider">

<!-- ═══════════════════════════ 38. POLICY CHANGES ═══════════════════════════ -->
<h2 id="changes">38. Policy Changes</h2>
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

<!-- ═══════════════════════════ 39. CONTACT ══════════════════════════════════ -->
<h2 id="contact">39. Contact</h2>
<p>For privacy requests, data deletion, rights exercises, complaints, or any questions about
this policy:</p>
<div class="card">
  <ul>
    <li><strong>Email:</strong> <a href="mailto:support@areszyn.com">support@areszyn.com</a></li>
    <li><strong>Telegram bot:</strong> <a href="https://t.me/lifegrambot">@lifegrambot</a></li>
    <li><strong>Mini App:</strong> <a href="https://lifegram-miniapp.pages.dev/miniapp/">https://lifegram-miniapp.pages.dev/miniapp/</a></li>
    <li><strong>Policy URL:</strong> <a href="https://mini.susagar.sbs/api/privacy">https://mini.susagar.sbs/api/privacy</a></li>
  </ul>
</div>
<p>When contacting us about a privacy matter, please include your Telegram user ID (if known)
and a clear description of your request. We will acknowledge your message within 5 business days.</p>

<footer>
  <p>@lifegrambot &nbsp;·&nbsp; Privacy Policy, Terms of Service &amp; Terms and Conditions</p>
  <p>Last updated <time datetime="2026-03-27">2026-03-27</time> &nbsp;·&nbsp; v3.2 &nbsp;·&nbsp; <a href="https://mini.susagar.sbs/api/privacy">Permalink</a></p>
  <p style="margin-top:6px;font-size:11px">This document is written in plain English and is intended to be clear and transparent.
  If any provision is unclear, contact us and we will explain it.</p>
</footer>

</article>
<script>
(function(){
var ov=document.getElementById("translated-overlay");
var ar=document.querySelector("article");
var orig=[];var fb=false;
for(var i=0;i<ar.children.length;i++){var el=ar.children[i];
if(el.id==="lang-bar-wrap"){fb=true;continue;}
if(fb&&el.id!=="translated-overlay"&&el.tagName!=="SCRIPT"){orig.push(el);}
}
var T={};
T.si={legal:"\\\\u2696\\\\ufe0f \\\\u0db8\\\\u0dd9\\\\u0db8 \\\\u0db4\\\\u0dbb\\\\u0dd2\\\\u0dc0\\\\u0dbb\\\\u0dca\\\\u0dad\\\\u0db1\\\\u0dba \\\\u0dad\\\\u0ddc\\\\u0dbb\\\\u0dad\\\\u0dd4\\\\u0dbb\\\\u0dd4 \\\\u0d85\\\\u0dbb\\\\u0db8\\\\u0dd4\\\\u0dab\\\\u0dd4 \\\\u0dc3\\\\u0db3\\\\u0dc4\\\\u0dcf \\\\u0db4\\\\u0db8\\\\u0dab\\\\u0dd2. \\\\u0d89\\\\u0d82\\\\u0d9c\\\\u0dca\\\\u200d\\\\u0dbb\\\\u0dd3\\\\u0dc3\\\\u0dd2 \\\\u0d85\\\\u0db1\\\\u0dd4\\\\u0dc0\\\\u0dcf\\\\u0daf\\\\u0dba \\\\u0db1\\\\u0dd3\\\\u0dad\\\\u0dd2\\\\u0db8\\\\u0dba \\\\u0dc0\\\\u0dc1\\\\u0dba\\\\u0dd9\\\\u0db1\\\\u0dca \\\\u0db6\\\\u0dd0\\\\u0db3\\\\u0dd3 \\\\u0d87\\\\u0dad.",
s:[
["\\\\u0dc3\\\\u0dda\\\\u0dc0\\\\u0dba \\\\u0db4\\\\u0dd2\\\\u0dc5\\\\u0dd2\\\\u0db6\\\\u0db3 \\\\u0daf\\\\u0dc5 \\\\u0dc0\\\\u0dd2\\\\u0dc3\\\\u0dd4\\\\u0db8","@lifegrambot \\\\u0dba\\\\u0db1\\\\u0dd4 Telegram \\\\u0db8\\\\u0dad \\\\u0d9a\\\\u0dca\\\\u200d\\\\u0dbb\\\\u0dd2\\\\u0dba\\\\u0dcf\\\\u0dad\\\\u0dca\\\\u0db8\\\\u0d9a \\\\u0dc0\\\\u0db1 \\\\u0db6\\\\u0dc4\\\\u0dd4-\\\\u0dbd\\\\u0d9a\\\\u0dca\\\\u0dc2\\\\u0dab \\\\u0db6\\\\u0ddc\\\\u0da7\\\\u0dca \\\\u0d91\\\\u0d9a\\\\u0d9a\\\\u0dd2 \\\\u0dc3\\\\u0dc4 Mini App \\\\u0d91\\\\u0d9a\\\\u0d9a\\\\u0dd2.",["\\\\u0db4\\\\u0dab\\\\u0dd2\\\\u0dc0\\\\u0dd2\\\\u0da9 \\\\u0dc4\\\\u0dd4\\\\u0dc0\\\\u0db8\\\\u0dcf\\\\u0dbb\\\\u0dd4\\\\u0dc0","\\\\u0dc0\\\\u0dd3\\\\u0da9\\\\u0dd2\\\\u0dba\\\\u0ddc \\\\u0db4\\\\u0dca\\\\u200d\\\\u0dbb\\\\u0dc0\\\\u0dcf\\\\u0dc4\\\\u0dba","\\\\u0d9c\\\\u0dd9\\\\u0dc0\\\\u0dd3\\\\u0db8\\\\u0dca \\\\u0dc3\\\\u0dc4 \\\\u0db4\\\\u0dbb\\\\u0dd2\\\\u0dad\\\\u0dca\\\\u200d\\\\u0dba\\\\u0dcf\\\\u0d9c","\\\\u0d9a\\\\u0dab\\\\u0dca\\\\u0da9\\\\u0dcf\\\\u0dba\\\\u0db8\\\\u0dca \\\\u0d9a\\\\u0dc5\\\\u0db8\\\\u0db1\\\\u0dcf\\\\u0d9a\\\\u0dbb\\\\u0dab\\\\u0dba","AI \\\\u0d9a\\\\u0dad\\\\u0dcf\\\\u0db6\\\\u0dc4\\\\u0dc3\\\\u0dca","\\\\u0dc3\\\\u0da2\\\\u0dd3\\\\u0dc0\\\\u0dd3 \\\\u0d9a\\\\u0dad\\\\u0dcf\\\\u0db6\\\\u0dc4\\\\u0dc3\\\\u0dca \\\\u0dc0\\\\u0dd2\\\\u0da2\\\\u0da7\\\\u0dca"]],
["\\\\u0d85\\\\u0db4\\\\u0dd2 \\\\u0d91\\\\u0d9a\\\\u0dad\\\\u0dd4 \\\\u0d9a\\\\u0dbb\\\\u0db1 \\\\u0daf\\\\u0dad\\\\u0dca\\\\u0dad","\\\\u0dc3\\\\u0dda\\\\u0dc0\\\\u0dcf\\\\u0dc0 \\\\u0d9a\\\\u0dca\\\\u200d\\\\u0dbb\\\\u0dd2\\\\u0dba\\\\u0dcf\\\\u0dad\\\\u0dca\\\\u0db8\\\\u0d9a \\\\u0d9a\\\\u0dd2\\\\u0dbb\\\\u0dd3\\\\u0db8\\\\u0da7 \\\\u0d85\\\\u0dc0\\\\u0dc1\\\\u0dca\\\\u200d\\\\u0dba \\\\u0daf\\\\u0dad\\\\u0dca\\\\u0dad \\\\u0db4\\\\u0db8\\\\u0dab\\\\u0d9a\\\\u0dca \\\\u0d91\\\\u0d9a\\\\u0dad\\\\u0dd4 \\\\u0d9a\\\\u0dbb\\\\u0dba\\\\u0dd2:",["Telegram ID, \\\\u0db8\\\\u0dd4\\\\u0dbd\\\\u0dca \\\\u0db1\\\\u0db8, \\\\u0db4\\\\u0dbb\\\\u0dd2\\\\u0dc1\\\\u0dd3\\\\u0dbd\\\\u0d9a \\\\u0db1\\\\u0dcf\\\\u0db8\\\\u0dba","\\\\u0d94\\\\u0db6 \\\\u0dba\\\\u0dc0\\\\u0db1 \\\\u0db4\\\\u0dab\\\\u0dd2\\\\u0dc0\\\\u0dd2\\\\u0da9 \\\\u0dc3\\\\u0dc4 \\\\u0db8\\\\u0dcf\\\\u0db0\\\\u0dca\\\\u200d\\\\u0dba","\\\\u0d9c\\\\u0dd9\\\\u0dc0\\\\u0dd3\\\\u0db8\\\\u0dca \\\\u0dc0\\\\u0dcf\\\\u0dbb\\\\u0dca\\\\u0dad\\\\u0dcf (\\\\u0db4\\\\u0dbb\\\\u0dd2\\\\u0dad\\\\u0dca\\\\u200d\\\\u0dba\\\\u0dcf\\\\u0d9c/\\\\u0daf\\\\u0dcf\\\\u0dba\\\\u0d9a\\\\u0dad\\\\u0dca\\\\u0dc0)","IP \\\\u0dbd\\\\u0dd2\\\\u0db4\\\\u0dd2\\\\u0db1\\\\u0dba, \\\\u0d89\\\\u0db4\\\\u0dcf\\\\u0d82\\\\u0d9c/\\\\u0db6\\\\u0dca\\\\u200d\\\\u0dbb\\\\u0dc0\\\\u0dca\\\\u0dc3\\\\u0dbb\\\\u0dca \\\\u0dad\\\\u0ddc\\\\u0dbb\\\\u0dad\\\\u0dd4\\\\u0dbb\\\\u0dd4","\\\\u0db8\\\\u0dd9\\\\u0dc4\\\\u0dd9\\\\u0dba\\\\u0dd4\\\\u0db8\\\\u0dca \\\\u0d9a\\\\u0dca\\\\u200d\\\\u0dbb\\\\u0dd2\\\\u0dba\\\\u0dcf (\\\\u0dad\\\\u0dc4\\\\u0db1\\\\u0db8\\\\u0dca, \\\\u0d85\\\\u0db1\\\\u0dad\\\\u0dd4\\\\u0dbb\\\\u0dd4 \\\\u0d87\\\\u0d9f\\\\u0dc0\\\\u0dd3\\\\u0db8\\\\u0dca)"]],
["\\\\u0daf\\\\u0dad\\\\u0dca\\\\u0dad \\\\u0db7\\\\u0dcf\\\\u0dc0\\\\u0dd2\\\\u0dad\\\\u0dba","\\\\u0db4\\\\u0dab\\\\u0dd2\\\\u0dc0\\\\u0dd2\\\\u0da9 \\\\u0db8\\\\u0dcf\\\\u0dbb\\\\u0dca\\\\u0d9c\\\\u0d9c\\\\u0dad \\\\u0d9a\\\\u0dd2\\\\u0dbb\\\\u0dd3\\\\u0db8, \\\\u0d9c\\\\u0dd9\\\\u0dc0\\\\u0dd3\\\\u0db8\\\\u0dca \\\\u0dc3\\\\u0dd0\\\\u0d9a\\\\u0dc3\\\\u0dd3\\\\u0db8, \\\\u0d86\\\\u0dbb\\\\u0d9a\\\\u0dca\\\\u0dc2\\\\u0dcf\\\\u0dc0, \\\\u0d85\\\\u0db1\\\\u0dc0\\\\u0dc3\\\\u0dbb \\\\u0db4\\\\u0dca\\\\u200d\\\\u0dbb\\\\u0dc0\\\\u0dda\\\\u0dc1 \\\\u0dc0\\\\u0dd0\\\\u0dc5\\\\u0dd0\\\\u0d9a\\\\u0dca\\\\u0dc0\\\\u0dd3\\\\u0db8, \\\\u0dc3\\\\u0dc4 \\\\u0dc3\\\\u0dda\\\\u0dc0\\\\u0dcf \\\\u0dc0\\\\u0dd0\\\\u0da9\\\\u0dd2\\\\u0daf\\\\u0dd2\\\\u0dba\\\\u0dd4\\\\u0dab\\\\u0dd4 \\\\u0d9a\\\\u0dd2\\\\u0dbb\\\\u0dd3\\\\u0db8 \\\\u0dc3\\\\u0db3\\\\u0dc4\\\\u0dcf \\\\u0db7\\\\u0dcf\\\\u0dc0\\\\u0dd2\\\\u0dad\\\\u0dcf \\\\u0dc0\\\\u0dda."],
["\\\\u0daf\\\\u0dad\\\\u0dca\\\\u0dad \\\\u0dbb\\\\u0daf\\\\u0dc0\\\\u0dcf \\\\u0d9c\\\\u0dd0\\\\u0db1\\\\u0dd3\\\\u0db8","\\\\u0db4\\\\u0dab\\\\u0dd2\\\\u0dc0\\\\u0dd2\\\\u0da9 \\\\u0d94\\\\u0db6 \\\\u0db8\\\\u0d9a\\\\u0dcf \\\\u0daf\\\\u0db8\\\\u0db1 \\\\u0dad\\\\u0dd9\\\\u0d9a\\\\u0dca \\\\u0d9c\\\\u0db6\\\\u0da9\\\\u0dcf \\\\u0dc0\\\\u0dda. AES-256 \\\\u0dc3\\\\u0d82\\\\u0d9a\\\\u0dda\\\\u0dad\\\\u0db1\\\\u0dba \\\\u0dc3\\\\u0dc4 Cloudflare \\\\u0d86\\\\u0dbb\\\\u0d9a\\\\u0dca\\\\u0dc2\\\\u0dcf\\\\u0dc0 \\\\u0db7\\\\u0dcf\\\\u0dc0\\\\u0dd2\\\\u0dad\\\\u0dcf \\\\u0d9a\\\\u0dbb\\\\u0dba\\\\u0dd2."],
["\\\\u0d94\\\\u0db6\\\\u0d9c\\\\u0dd9 \\\\u0d85\\\\u0dba\\\\u0dd2\\\\u0dad\\\\u0dd2\\\\u0dc0\\\\u0dcf\\\\u0dc3\\\\u0dd2\\\\u0d9a\\\\u0db8\\\\u0dca",null,["\\\\u0daf\\\\u0dad\\\\u0dca\\\\u0dad \\\\u0db4\\\\u0dca\\\\u200d\\\\u0dbb\\\\u0dc0\\\\u0dda\\\\u0dc1\\\\u0dba \\\\u0d89\\\\u0dbd\\\\u0dca\\\\u0dbd\\\\u0dcf \\\\u0dc3\\\\u0dd2\\\\u0da7\\\\u0dd2\\\\u0dba \\\\u0dc4\\\\u0dd0\\\\u0d9a","\\\\u0dc0\\\\u0dd0\\\\u0dbb\\\\u0daf\\\\u0dd2 \\\\u0dad\\\\u0ddc\\\\u0dbb\\\\u0dad\\\\u0dd4\\\\u0dbb\\\\u0dd4 \\\\u0db1\\\\u0dd2\\\\u0dc0\\\\u0dd0\\\\u0dbb\\\\u0daf\\\\u0dd2 \\\\u0d9a\\\\u0dd2\\\\u0dbb\\\\u0dd3\\\\u0db8","\\\\u0daf\\\\u0dad\\\\u0dca\\\\u0dad \\\\u0db8\\\\u0d9a\\\\u0dcf \\\\u0daf\\\\u0dd0\\\\u0db8\\\\u0dd3\\\\u0db8 (/deleteme)","\\\\u0dc3\\\\u0dd0\\\\u0d9a\\\\u0dc3\\\\u0dd3\\\\u0db8\\\\u0da7 \\\\u0dc0\\\\u0dd2\\\\u0dbb\\\\u0ddc\\\\u0db0\\\\u0dba","\\\\u0daf\\\\u0dad\\\\u0dca\\\\u0dad \\\\u0d85\\\\u0dad\\\\u0dda \\\\u0d9c\\\\u0dd9\\\\u0db1 \\\\u0dba\\\\u0dcf \\\\u0dc4\\\\u0dd0\\\\u0d9a"]],
["\\\\u0d9a\\\\u0dd4\\\\u0d9a\\\\u0dd3\\\\u0dc3\\\\u0dca","Mini App \\\\u0d9a\\\\u0dca\\\\u200d\\\\u0dbb\\\\u0dd2\\\\u0dba\\\\u0dcf\\\\u0d9a\\\\u0dcf\\\\u0dbb\\\\u0dd3\\\\u0dad\\\\u0dca\\\\u0dc0\\\\u0dba \\\\u0dc3\\\\u0db3\\\\u0dc4\\\\u0dcf localStorage \\\\u0db7\\\\u0dcf\\\\u0dc0\\\\u0dd2\\\\u0dad\\\\u0dcf \\\\u0d9a\\\\u0dbb\\\\u0dba\\\\u0dd2. \\\\u0d94\\\\u0db6\\\\u0da7 \\\\u0d95\\\\u0db1\\\\u0dd0\\\\u0db8 \\\\u0d85\\\\u0dc0\\\\u0dc3\\\\u0dca\\\\u0dae\\\\u0dcf\\\\u0dc0\\\\u0d9a \\\\u0daf\\\\u0dad\\\\u0dca\\\\u0dad \\\\u0d89\\\\u0dc0\\\\u0dad\\\\u0dca \\\\u0d9a\\\\u0dc5 \\\\u0dc4\\\\u0dd0\\\\u0d9a."],
["\\\\u0dc3\\\\u0db8\\\\u0dca\\\\u0db6\\\\u0db1\\\\u0dca\\\\u0db0 \\\\u0dc0\\\\u0db1\\\\u0dca\\\\u0db1",'<a href="mailto:support@areszyn.com">support@areszyn.com</a> &middot; <a href="https://t.me/lifegrambot">@lifegrambot</a>']
]};
T.hi={legal:"\\\\u2696\\\\ufe0f \\\\u092f\\\\u0939 \\\\u0905\\\\u0928\\\\u0941\\\\u0935\\\\u093e\\\\u0926 \\\\u0915\\\\u0947\\\\u0935\\\\u0932 \\\\u0938\\\\u0942\\\\u091a\\\\u0928\\\\u093e\\\\u0924\\\\u094d\\\\u092e\\\\u0915 \\\\u0909\\\\u0926\\\\u094d\\\\u0926\\\\u0947\\\\u0936\\\\u094d\\\\u092f\\\\u094b\\\\u0902 \\\\u0915\\\\u0947 \\\\u0932\\\\u093f\\\\u090f \\\\u0939\\\\u0948\\\\u0964 \\\\u0905\\\\u0902\\\\u0917\\\\u094d\\\\u0930\\\\u0947\\\\u091c\\\\u093c\\\\u0940 \\\\u0938\\\\u0902\\\\u0938\\\\u094d\\\\u0915\\\\u0930\\\\u0923 \\\\u0915\\\\u093e\\\\u0928\\\\u0942\\\\u0928\\\\u0940 \\\\u0930\\\\u0942\\\\u092a \\\\u0938\\\\u0947 \\\\u092c\\\\u093e\\\\u0927\\\\u094d\\\\u092f\\\\u0915\\\\u093e\\\\u0930\\\\u0940 \\\\u0939\\\\u0948\\\\u0964",
s:[
["\\\\u0938\\\\u0947\\\\u0935\\\\u093e \\\\u0905\\\\u0935\\\\u0932\\\\u094b\\\\u0915\\\\u0928","@lifegrambot Telegram \\\\u092a\\\\u0930 \\\\u090f\\\\u0915 \\\\u092c\\\\u0939\\\\u0941-\\\\u0938\\\\u0941\\\\u0935\\\\u093f\\\\u0927\\\\u093e \\\\u092c\\\\u0949\\\\u091f \\\\u0914\\\\u0930 Mini App \\\\u0939\\\\u0948\\\\u0964",["\\\\u0938\\\\u0902\\\\u0926\\\\u0947\\\\u0936 \\\\u092d\\\\u0947\\\\u091c\\\\u0928\\\\u093e \\\\u0914\\\\u0930 \\\\u092a\\\\u094d\\\\u0930\\\\u093e\\\\u092a\\\\u094d\\\\u0924 \\\\u0915\\\\u0930\\\\u0928\\\\u093e","\\\\u0935\\\\u0940\\\\u0921\\\\u093f\\\\u092f\\\\u094b \\\\u0938\\\\u094d\\\\u091f\\\\u094d\\\\u0930\\\\u0940\\\\u092e\\\\u093f\\\\u0902\\\\u0917","\\\\u092d\\\\u0941\\\\u0917\\\\u0924\\\\u093e\\\\u0928 \\\\u0914\\\\u0930 \\\\u0926\\\\u093e\\\\u0928","\\\\u0938\\\\u092e\\\\u0942\\\\u0939 \\\\u092a\\\\u094d\\\\u0930\\\\u092c\\\\u0902\\\\u0927\\\\u0928","AI \\\\u091a\\\\u0948\\\\u091f","\\\\u0932\\\\u093e\\\\u0907\\\\u0935 \\\\u091a\\\\u0948\\\\u091f \\\\u0935\\\\u093f\\\\u091c\\\\u0947\\\\u091f"]],
["\\\\u0939\\\\u092e \\\\u0915\\\\u094c\\\\u0928 \\\\u0938\\\\u093e \\\\u0921\\\\u0947\\\\u091f\\\\u093e \\\\u090f\\\\u0915\\\\u0924\\\\u094d\\\\u0930 \\\\u0915\\\\u0930\\\\u0924\\\\u0947 \\\\u0939\\\\u0948\\\\u0902","\\\\u0938\\\\u0947\\\\u0935\\\\u093e \\\\u0938\\\\u0902\\\\u091a\\\\u093e\\\\u0932\\\\u093f\\\\u0924 \\\\u0915\\\\u0930\\\\u0928\\\\u0947 \\\\u0915\\\\u0947 \\\\u0932\\\\u093f\\\\u090f \\\\u0915\\\\u0947\\\\u0935\\\\u0932 \\\\u0906\\\\u0935\\\\u0936\\\\u094d\\\\u092f\\\\u0915 \\\\u0921\\\\u0947\\\\u091f\\\\u093e:",["Telegram ID, \\\\u092a\\\\u0939\\\\u0932\\\\u093e \\\\u0928\\\\u093e\\\\u092e, \\\\u0909\\\\u092a\\\\u092f\\\\u094b\\\\u0917\\\\u0915\\\\u0930\\\\u094d\\\\u0924\\\\u093e \\\\u0928\\\\u093e\\\\u092e","\\\\u0906\\\\u092a\\\\u0915\\\\u0947 \\\\u092d\\\\u0947\\\\u091c\\\\u0947 \\\\u0917\\\\u090f \\\\u0938\\\\u0902\\\\u0926\\\\u0947\\\\u0936 \\\\u0914\\\\u0930 \\\\u092e\\\\u0940\\\\u0921\\\\u093f\\\\u092f\\\\u093e","\\\\u092d\\\\u0941\\\\u0917\\\\u0924\\\\u093e\\\\u0928 \\\\u0930\\\\u093f\\\\u0915\\\\u0949\\\\u0930\\\\u094d\\\\u0921 (\\\\u0926\\\\u093e\\\\u0928/\\\\u0938\\\\u0926\\\\u0938\\\\u094d\\\\u092f\\\\u0924\\\\u093e)","IP \\\\u092a\\\\u0924\\\\u093e, \\\\u0921\\\\u093f\\\\u0935\\\\u093e\\\\u0907\\\\u0938/\\\\u092c\\\\u094d\\\\u0930\\\\u093e\\\\u0909\\\\u091c\\\\u093c\\\\u0930 \\\\u091c\\\\u093e\\\\u0928\\\\u0915\\\\u093e\\\\u0930\\\\u0940","\\\\u092e\\\\u0949\\\\u0921\\\\u0930\\\\u0947\\\\u0936\\\\u0928 \\\\u0915\\\\u093e\\\\u0930\\\\u094d\\\\u0930\\\\u0935\\\\u093e\\\\u0907\\\\u092f\\\\u093e\\\\u0902 (\\\\u092a\\\\u094d\\\\u0930\\\\u0924\\\\u093f\\\\u092c\\\\u0902\\\\u0927, \\\\u091a\\\\u0947\\\\u0924\\\\u093e\\\\u0935\\\\u0928\\\\u0940)"]],
["\\\\u0921\\\\u0947\\\\u091f\\\\u093e \\\\u0909\\\\u092a\\\\u092f\\\\u094b\\\\u0917","\\\\u0938\\\\u0902\\\\u0926\\\\u0947\\\\u0936 \\\\u0930\\\\u0942\\\\u091f\\\\u093f\\\\u0902\\\\u0917, \\\\u092d\\\\u0941\\\\u0917\\\\u0924\\\\u093e\\\\u0928 \\\\u092a\\\\u094d\\\\u0930\\\\u0938\\\\u0902\\\\u0938\\\\u094d\\\\u0915\\\\u0930\\\\u0923, \\\\u0938\\\\u0941\\\\u0930\\\\u0915\\\\u094d\\\\u0937\\\\u093e, \\\\u0927\\\\u094b\\\\u0916\\\\u093e\\\\u0927\\\\u0921\\\\u093c\\\\u0940 \\\\u0930\\\\u094b\\\\u0915\\\\u0925\\\\u093e\\\\u092e \\\\u0914\\\\u0930 \\\\u0938\\\\u0947\\\\u0935\\\\u093e \\\\u0938\\\\u0941\\\\u0927\\\\u093e\\\\u0930 \\\\u0915\\\\u0947 \\\\u0932\\\\u093f\\\\u090f \\\\u0909\\\\u092a\\\\u092f\\\\u094b\\\\u0917 \\\\u0915\\\\u093f\\\\u092f\\\\u093e \\\\u091c\\\\u093e\\\\u0924\\\\u093e \\\\u0939\\\\u0948\\\\u0964"],
["\\\\u0921\\\\u0947\\\\u091f\\\\u093e \\\\u092a\\\\u094d\\\\u0930\\\\u0924\\\\u093f\\\\u0927\\\\u093e\\\\u0930\\\\u0923","\\\\u0938\\\\u0902\\\\u0926\\\\u0947\\\\u0936 \\\\u0924\\\\u092c \\\\u0924\\\\u0915 \\\\u0938\\\\u0902\\\\u0917\\\\u094d\\\\u0930\\\\u0939\\\\u0940\\\\u0924 \\\\u0930\\\\u0939\\\\u0924\\\\u0947 \\\\u0939\\\\u0948\\\\u0902 \\\\u091c\\\\u092c \\\\u0924\\\\u0915 \\\\u0906\\\\u092a \\\\u0939\\\\u091f\\\\u093e\\\\u0924\\\\u0947 \\\\u0928\\\\u0939\\\\u0940\\\\u0902\\\\u0964 AES-256 \\\\u090f\\\\u0928\\\\u094d\\\\u0915\\\\u094d\\\\u0930\\\\u093f\\\\u092a\\\\u094d\\\\u0936\\\\u0928 \\\\u0914\\\\u0930 Cloudflare \\\\u0938\\\\u0941\\\\u0930\\\\u0915\\\\u094d\\\\u0937\\\\u093e \\\\u0915\\\\u093e \\\\u0909\\\\u092a\\\\u092f\\\\u094b\\\\u0917\\\\u0964"],
["\\\\u0906\\\\u092a\\\\u0915\\\\u0947 \\\\u0905\\\\u0927\\\\u093f\\\\u0915\\\\u093e\\\\u0930",null,["\\\\u0921\\\\u0947\\\\u091f\\\\u093e \\\\u090f\\\\u0915\\\\u094d\\\\u0938\\\\u0947\\\\u0938 \\\\u0915\\\\u093e \\\\u0905\\\\u0928\\\\u0941\\\\u0930\\\\u094b\\\\u0927","\\\\u0917\\\\u0932\\\\u0924 \\\\u0921\\\\u0947\\\\u091f\\\\u093e \\\\u0938\\\\u0941\\\\u0927\\\\u093e\\\\u0930\\\\u0928\\\\u093e","\\\\u0921\\\\u0947\\\\u091f\\\\u093e \\\\u0939\\\\u091f\\\\u093e\\\\u0928\\\\u093e (/deleteme)","\\\\u092a\\\\u094d\\\\u0930\\\\u0938\\\\u0902\\\\u0938\\\\u094d\\\\u0915\\\\u0930\\\\u0923 \\\\u092a\\\\u0930 \\\\u0906\\\\u092a\\\\u0924\\\\u094d\\\\u0924\\\\u093f","\\\\u0921\\\\u0947\\\\u091f\\\\u093e \\\\u092a\\\\u094b\\\\u0930\\\\u094d\\\\u091f\\\\u0947\\\\u092c\\\\u093f\\\\u0932\\\\u093f\\\\u091f\\\\u0940"]],
["\\\\u0915\\\\u0941\\\\u0915\\\\u0940\\\\u091c\\\\u093c","Mini App \\\\u0915\\\\u093e\\\\u0930\\\\u094d\\\\u092f\\\\u0915\\\\u094d\\\\u0937\\\\u092e\\\\u0924\\\\u093e \\\\u0915\\\\u0947 \\\\u0932\\\\u093f\\\\u090f localStorage \\\\u0915\\\\u093e \\\\u0909\\\\u092a\\\\u092f\\\\u094b\\\\u0917 \\\\u0915\\\\u0930\\\\u0924\\\\u093e \\\\u0939\\\\u0948\\\\u0964 \\\\u0906\\\\u092a \\\\u0915\\\\u092d\\\\u0940 \\\\u092d\\\\u0940 \\\\u0921\\\\u0947\\\\u091f\\\\u093e \\\\u0938\\\\u093e\\\\u092b\\\\u093c \\\\u0915\\\\u0930 \\\\u0938\\\\u0915\\\\u0924\\\\u0947 \\\\u0939\\\\u0948\\\\u0902\\\\u0964"],
["\\\\u0938\\\\u0902\\\\u092a\\\\u0930\\\\u094d\\\\u0915",'<a href="mailto:support@areszyn.com">support@areszyn.com</a> &middot; <a href="https://t.me/lifegrambot">@lifegrambot</a>']
]};
T.ta={legal:"\\\\u2696\\\\ufe0f \\\\u0b87\\\\u0ba8\\\\u0bcd\\\\u0ba4 \\\\u0bae\\\\u0bca\\\\u0bb4\\\\u0bbf\\\\u0baa\\\\u0bc6\\\\u0baf\\\\u0bb0\\\\u0bcd\\\\u0baa\\\\u0bcd\\\\u0baa\\\\u0bc1 \\\\u0ba4\\\\u0b95\\\\u0bb5\\\\u0bb2\\\\u0bcd \\\\u0ba8\\\\u0bcb\\\\u0b95\\\\u0bcd\\\\u0b95\\\\u0b99\\\\u0bcd\\\\u0b95\\\\u0bb3\\\\u0bc1\\\\u0b95\\\\u0bcd\\\\u0b95\\\\u0bbe\\\\u0b95 \\\\u0bae\\\\u0b9f\\\\u0bcd\\\\u0b9f\\\\u0bc1\\\\u0bae\\\\u0bc7. \\\\u0b86\\\\u0b99\\\\u0bcd\\\\u0b95\\\\u0bbf\\\\u0bb2 \\\\u0baa\\\\u0ba4\\\\u0bbf\\\\u0baa\\\\u0bcd\\\\u0baa\\\\u0bc1 \\\\u0b9a\\\\u0b9f\\\\u0bcd\\\\u0b9f\\\\u0baa\\\\u0bcd\\\\u0baa\\\\u0bc2\\\\u0bb0\\\\u0bcd\\\\u0bb5\\\\u0bae\\\\u0bbe\\\\u0b95 \\\\u0baa\\\\u0bbf\\\\u0ba3\\\\u0bc8\\\\u0b95\\\\u0bcd\\\\u0b95\\\\u0baa\\\\u0bcd\\\\u0baa\\\\u0b9f\\\\u0bcd\\\\u0b9f\\\\u0bc1\\\\u0bb3\\\\u0bcd\\\\u0bb3\\\\u0ba4\\\\u0bc1.",
s:[
["\\\\u0b9a\\\\u0bc7\\\\u0bb5\\\\u0bc8 \\\\u0bae\\\\u0bc7\\\\u0bb2\\\\u0bcb\\\\u0b9f\\\\u0bcd\\\\u0b9f\\\\u0bae\\\\u0bcd","@lifegrambot \\\\u0b8e\\\\u0ba9\\\\u0bcd\\\\u0baa\\\\u0ba4\\\\u0bc1 Telegram \\\\u0b87\\\\u0bb2\\\\u0bcd \\\\u0b9a\\\\u0bc6\\\\u0baf\\\\u0bb2\\\\u0bcd\\\\u0baa\\\\u0b9f\\\\u0bc1\\\\u0bae\\\\u0bcd \\\\u0baa\\\\u0bb2\\\\u0bcd\\\\u0ba8\\\\u0bcb\\\\u0b95\\\\u0bcd\\\\u0b95 \\\\u0baa\\\\u0bcb\\\\u0b9f\\\\u0bcd \\\\u0bae\\\\u0bb1\\\\u0bcd\\\\u0bb1\\\\u0bc1\\\\u0bae\\\\u0bcd Mini App \\\\u0b86\\\\u0b95\\\\u0bc1\\\\u0bae\\\\u0bcd.",["\\\\u0b9a\\\\u0bc6\\\\u0baf\\\\u0bcd\\\\u0ba4\\\\u0bbf \\\\u0b85\\\\u0ba9\\\\u0bc1\\\\u0baa\\\\u0bcd\\\\u0baa\\\\u0bc1\\\\u0ba4\\\\u0bb2\\\\u0bcd","\\\\u0bb5\\\\u0bc0\\\\u0b9f\\\\u0bbf\\\\u0baf\\\\u0bcb \\\\u0bb8\\\\u0bcd\\\\u0b9f\\\\u0bcd\\\\u0bb0\\\\u0bc0\\\\u0bae\\\\u0bbf\\\\u0b99\\\\u0bcd","\\\\u0b95\\\\u0bca\\\\u0b9f\\\\u0bc1\\\\u0baa\\\\u0bcd\\\\u0baa\\\\u0ba9\\\\u0bb5\\\\u0bc1\\\\u0b95\\\\u0bb3\\\\u0bcd \\\\u0bae\\\\u0bb1\\\\u0bcd\\\\u0bb1\\\\u0bc1\\\\u0bae\\\\u0bcd \\\\u0ba8\\\\u0ba9\\\\u0bcd\\\\u0b95\\\\u0bca\\\\u0b9f\\\\u0bc8\\\\u0b95\\\\u0bb3\\\\u0bcd","\\\\u0b95\\\\u0bc1\\\\u0bb4\\\\u0bc1 \\\\u0bae\\\\u0bc7\\\\u0bb2\\\\u0bbe\\\\u0ba3\\\\u0bcd\\\\u0bae\\\\u0bc8","AI \\\\u0b85\\\\u0bb0\\\\u0b9f\\\\u0bcd\\\\u0b9f\\\\u0bc8","\\\\u0ba8\\\\u0bc7\\\\u0bb0\\\\u0b9f\\\\u0bbf \\\\u0b85\\\\u0bb0\\\\u0b9f\\\\u0bcd\\\\u0b9f\\\\u0bc8 \\\\u0bb5\\\\u0bbf\\\\u0b9f\\\\u0bcd\\\\u0b9c\\\\u0bc6\\\\u0b9f\\\\u0bcd"]],
["\\\\u0ba8\\\\u0bbe\\\\u0b99\\\\u0bcd\\\\u0b95\\\\u0bb3\\\\u0bcd \\\\u0b9a\\\\u0bc7\\\\u0b95\\\\u0bb0\\\\u0bbf\\\\u0b95\\\\u0bcd\\\\u0b95\\\\u0bc1\\\\u0bae\\\\u0bcd \\\\u0ba4\\\\u0bb0\\\\u0bb5\\\\u0bc1","\\\\u0b9a\\\\u0bc7\\\\u0bb5\\\\u0bc8\\\\u0baf\\\\u0bc8 \\\\u0b87\\\\u0baf\\\\u0b95\\\\u0bcd\\\\u0b95 \\\\u0ba4\\\\u0bc7\\\\u0bb5\\\\u0bc8\\\\u0baf\\\\u0bbe\\\\u0ba9 \\\\u0ba4\\\\u0bb0\\\\u0bb5\\\\u0bc1 \\\\u0bae\\\\u0b9f\\\\u0bcd\\\\u0b9f\\\\u0bc1\\\\u0bae\\\\u0bc7:",["Telegram ID, \\\\u0bae\\\\u0bc1\\\\u0ba4\\\\u0bb2\\\\u0bcd \\\\u0baa\\\\u0bc6\\\\u0baf\\\\u0bb0\\\\u0bcd, \\\\u0baa\\\\u0baf\\\\u0ba9\\\\u0bb0\\\\u0bcd\\\\u0baa\\\\u0bc6\\\\u0baf\\\\u0bb0\\\\u0bcd","\\\\u0ba8\\\\u0bc0\\\\u0b99\\\\u0bcd\\\\u0b95\\\\u0bb3\\\\u0bcd \\\\u0b85\\\\u0ba9\\\\u0bc1\\\\u0baa\\\\u0bcd\\\\u0baa\\\\u0bc1\\\\u0bae\\\\u0bcd \\\\u0b9a\\\\u0bc6\\\\u0baf\\\\u0bcd\\\\u0ba4\\\\u0bbf\\\\u0b95\\\\u0bb3\\\\u0bcd \\\\u0bae\\\\u0bb1\\\\u0bcd\\\\u0bb1\\\\u0bc1\\\\u0bae\\\\u0bcd \\\\u0bae\\\\u0bc0\\\\u0b9f\\\\u0bbf\\\\u0baf\\\\u0bbe","\\\\u0b95\\\\u0b9f\\\\u0bcd\\\\u0b9f\\\\u0ba3 \\\\u0baa\\\\u0ba4\\\\u0bbf\\\\u0bb5\\\\u0bc1\\\\u0b95\\\\u0bb3\\\\u0bcd","IP \\\\u0bae\\\\u0bc1\\\\u0b95\\\\u0bb5\\\\u0bb0\\\\u0bbf, \\\\u0b9a\\\\u0bbe\\\\u0ba4\\\\u0ba9\\\\u0bae\\\\u0bcd/\\\\u0b89\\\\u0bb2\\\\u0bbe\\\\u0bb5\\\\u0bbf \\\\u0ba4\\\\u0b95\\\\u0bb5\\\\u0bb2\\\\u0bcd","\\\\u0bae\\\\u0bbf\\\\u0ba4\\\\u0bae\\\\u0bbe\\\\u0ba9 \\\\u0ba8\\\\u0b9f\\\\u0bb5\\\\u0b9f\\\\u0bbf\\\\u0b95\\\\u0bcd\\\\u0b95\\\\u0bc8\\\\u0b95\\\\u0bb3\\\\u0bcd"]],
["\\\\u0ba4\\\\u0bb0\\\\u0bb5\\\\u0bc1 \\\\u0baa\\\\u0baf\\\\u0ba9\\\\u0bcd\\\\u0baa\\\\u0bbe\\\\u0b9f\\\\u0bc1","\\\\u0b9a\\\\u0bc6\\\\u0baf\\\\u0bcd\\\\u0ba4\\\\u0bbf \\\\u0b85\\\\u0ba9\\\\u0bc1\\\\u0baa\\\\u0bcd\\\\u0baa\\\\u0bc1\\\\u0ba4\\\\u0bb2\\\\u0bcd, \\\\u0b95\\\\u0b9f\\\\u0bcd\\\\u0b9f\\\\u0ba3 \\\\u0b9a\\\\u0bc6\\\\u0baf\\\\u0bb2\\\\u0bbe\\\\u0b95\\\\u0bcd\\\\u0b95\\\\u0bae\\\\u0bcd, \\\\u0baa\\\\u0bbe\\\\u0ba4\\\\u0bc1\\\\u0b95\\\\u0bbe\\\\u0baa\\\\u0bcd\\\\u0baa\\\\u0bc1 \\\\u0bae\\\\u0bb1\\\\u0bcd\\\\u0bb1\\\\u0bc1\\\\u0bae\\\\u0bcd \\\\u0b9a\\\\u0bc7\\\\u0bb5\\\\u0bc8 \\\\u0bae\\\\u0bc7\\\\u0bae\\\\u0bcd\\\\u0baa\\\\u0bbe\\\\u0b9f\\\\u0bcd\\\\u0b9f\\\\u0bbf\\\\u0bb1\\\\u0bcd\\\\u0b95\\\\u0bbe\\\\u0b95 \\\\u0baa\\\\u0baf\\\\u0ba9\\\\u0bcd\\\\u0baa\\\\u0b9f\\\\u0bc1\\\\u0b95\\\\u0bbf\\\\u0bb1\\\\u0ba4\\\\u0bc1."],
["\\\\u0ba4\\\\u0bb0\\\\u0bb5\\\\u0bc1 \\\\u0bb5\\\\u0bc8\\\\u0ba4\\\\u0bcd\\\\u0ba4\\\\u0bbf\\\\u0bb0\\\\u0bc1\\\\u0ba4\\\\u0bcd\\\\u0ba4\\\\u0bb2\\\\u0bcd","\\\\u0b9a\\\\u0bc6\\\\u0baf\\\\u0bcd\\\\u0ba4\\\\u0bbf\\\\u0b95\\\\u0bb3\\\\u0bcd \\\\u0ba8\\\\u0bc0\\\\u0b99\\\\u0bcd\\\\u0b95\\\\u0bb3\\\\u0bcd \\\\u0ba8\\\\u0bc0\\\\u0b95\\\\u0bcd\\\\u0b95\\\\u0bc1\\\\u0bae\\\\u0bcd \\\\u0bb5\\\\u0bb0\\\\u0bc8 \\\\u0b9a\\\\u0bc7\\\\u0bae\\\\u0bbf\\\\u0b95\\\\u0bcd\\\\u0b95\\\\u0baa\\\\u0bcd\\\\u0baa\\\\u0b9f\\\\u0bc1\\\\u0bae\\\\u0bcd. AES-256 \\\\u0bae\\\\u0bb1\\\\u0bc8\\\\u0baf\\\\u0bbe\\\\u0b95\\\\u0bcd\\\\u0b95\\\\u0bae\\\\u0bcd \\\\u0bae\\\\u0bb1\\\\u0bcd\\\\u0bb1\\\\u0bc1\\\\u0bae\\\\u0bcd Cloudflare \\\\u0baa\\\\u0bbe\\\\u0ba4\\\\u0bc1\\\\u0b95\\\\u0bbe\\\\u0baa\\\\u0bcd\\\\u0baa\\\\u0bc1."],
["\\\\u0b89\\\\u0b99\\\\u0bcd\\\\u0b95\\\\u0bb3\\\\u0bcd \\\\u0b89\\\\u0bb0\\\\u0bbf\\\\u0bae\\\\u0bc8\\\\u0b95\\\\u0bb3\\\\u0bcd",null,["\\\\u0ba4\\\\u0bb0\\\\u0bb5\\\\u0bc1 \\\\u0b85\\\\u0ba3\\\\u0bc1\\\\u0b95\\\\u0bb2\\\\u0bcd \\\\u0b95\\\\u0bcb\\\\u0bb0\\\\u0bbf\\\\u0b95\\\\u0bcd\\\\u0b95\\\\u0bc8","\\\\u0ba4\\\\u0bb5\\\\u0bb1\\\\u0bbe\\\\u0ba9 \\\\u0ba4\\\\u0bb0\\\\u0bb5\\\\u0bc8 \\\\u0ba4\\\\u0bbf\\\\u0bb0\\\\u0bc1\\\\u0ba4\\\\u0bcd\\\\u0ba4\\\\u0bc1\\\\u0ba4\\\\u0bb2\\\\u0bcd","\\\\u0ba4\\\\u0bb0\\\\u0bb5\\\\u0bc1 \\\\u0ba8\\\\u0bc0\\\\u0b95\\\\u0bcd\\\\u0b95\\\\u0bae\\\\u0bcd (/deleteme)","\\\\u0b9a\\\\u0bc6\\\\u0baf\\\\u0bb2\\\\u0bbe\\\\u0b95\\\\u0bcd\\\\u0b95\\\\u0ba4\\\\u0bcd\\\\u0ba4\\\\u0bc8 \\\\u0b8e\\\\u0ba4\\\\u0bbf\\\\u0bb0\\\\u0bcd\\\\u0baa\\\\u0bcd\\\\u0baa\\\\u0bc1","\\\\u0ba4\\\\u0bb0\\\\u0bb5\\\\u0bc1 \\\\u0b8e\\\\u0b9f\\\\u0bc1\\\\u0ba4\\\\u0bcd\\\\u0ba4\\\\u0bc1\\\\u0b9a\\\\u0bcd\\\\u0b9a\\\\u0bc6\\\\u0bb2\\\\u0bcd\\\\u0bb2\\\\u0bb2\\\\u0bcd"]],
["\\\\u0b95\\\\u0bc1\\\\u0b95\\\\u0bcd\\\\u0b95\\\\u0bc0\\\\u0b95\\\\u0bb3\\\\u0bcd","Mini App \\\\u0b9a\\\\u0bc6\\\\u0baf\\\\u0bb2\\\\u0bcd\\\\u0baa\\\\u0bbe\\\\u0b9f\\\\u0bcd\\\\u0b9f\\\\u0bbf\\\\u0bb1\\\\u0bcd\\\\u0b95\\\\u0bc1 localStorage \\\\u0baa\\\\u0baf\\\\u0ba9\\\\u0bcd\\\\u0baa\\\\u0b9f\\\\u0bc1\\\\u0b95\\\\u0bbf\\\\u0bb1\\\\u0ba4\\\\u0bc1."],
["\\\\u0ba4\\\\u0bca\\\\u0b9f\\\\u0bb0\\\\u0bcd\\\\u0baa\\\\u0bc1",'<a href="mailto:support@areszyn.com">support@areszyn.com</a> &middot; <a href="https://t.me/lifegrambot">@lifegrambot</a>']
]};
T.zh={legal:"\\\\u2696\\\\ufe0f \\\\u6b64\\\\u7ffb\\\\u8bd1\\\\u4ec5\\\\u4f9b\\\\u53c2\\\\u8003\\\\u3002\\\\u82f1\\\\u6587\\\\u7248\\\\u672c\\\\u5177\\\\u6709\\\\u6cd5\\\\u5f8b\\\\u7ea6\\\\u675f\\\\u529b\\\\u3002",
s:[
["\\\\u670d\\\\u52a1\\\\u6982\\\\u8ff0","@lifegrambot \\\\u662f\\\\u4e00\\\\u4e2a\\\\u5728 Telegram \\\\u4e0a\\\\u8fd0\\\\u884c\\\\u7684\\\\u591a\\\\u529f\\\\u80fd\\\\u673a\\\\u5668\\\\u4eba\\\\u548c\\\\u8ff7\\\\u4f60\\\\u5e94\\\\u7528\\\\u3002",["\\\\u6d88\\\\u606f\\\\u6536\\\\u53d1","\\\\u89c6\\\\u9891\\\\u6d41\\\\u5a92\\\\u4f53","\\\\u652f\\\\u4ed8\\\\u4e0e\\\\u6350\\\\u8d60","\\\\u7fa4\\\\u7ec4\\\\u7ba1\\\\u7406","AI \\\\u804a\\\\u5929","\\\\u5b9e\\\\u65f6\\\\u804a\\\\u5929\\\\u5c0f\\\\u5de5\\\\u5177"]],
["\\\\u6211\\\\u4eec\\\\u6536\\\\u96c6\\\\u7684\\\\u6570\\\\u636e","\\\\u4ec5\\\\u6536\\\\u96c6\\\\u8fd0\\\\u8425\\\\u670d\\\\u52a1\\\\u6240\\\\u9700\\\\u7684\\\\u6570\\\\u636e\\\\uff1a",["Telegram ID\\\\u3001\\\\u59d3\\\\u540d\\\\u3001\\\\u7528\\\\u6237\\\\u540d","\\\\u60a8\\\\u53d1\\\\u9001\\\\u7684\\\\u6d88\\\\u606f\\\\u548c\\\\u5a92\\\\u4f53","\\\\u652f\\\\u4ed8\\\\u8bb0\\\\u5f55\\\\uff08\\\\u6350\\\\u8d60/\\\\u8ba2\\\\u9605\\\\uff09","IP \\\\u5730\\\\u5740\\\\u3001\\\\u8bbe\\\\u5907/\\\\u6d4f\\\\u89c8\\\\u5668\\\\u4fe1\\\\u606f","\\\\u7ba1\\\\u7406\\\\u64cd\\\\u4f5c\\\\uff08\\\\u5c01\\\\u7981\\\\u3001\\\\u8b66\\\\u544a\\\\uff09"]],
["\\\\u6570\\\\u636e\\\\u4f7f\\\\u7528","\\\\u7528\\\\u4e8e\\\\u6d88\\\\u606f\\\\u8def\\\\u7531\\\\u3001\\\\u652f\\\\u4ed8\\\\u5904\\\\u7406\\\\u3001\\\\u5b89\\\\u5168\\\\u9632\\\\u62a4\\\\u3001\\\\u6b3a\\\\u8bc8\\\\u9884\\\\u9632\\\\u548c\\\\u670d\\\\u52a1\\\\u6539\\\\u8fdb\\\\u3002"],
["\\\\u6570\\\\u636e\\\\u4fdd\\\\u7559","\\\\u6d88\\\\u606f\\\\u5b58\\\\u50a8\\\\u76f4\\\\u81f3\\\\u60a8\\\\u5220\\\\u9664\\\\u3002\\\\u4f7f\\\\u7528 AES-256 \\\\u52a0\\\\u5bc6\\\\u548c Cloudflare \\\\u5b89\\\\u5168\\\\u9632\\\\u62a4\\\\u3002"],
["\\\\u60a8\\\\u7684\\\\u6743\\\\u5229",null,["\\\\u8bf7\\\\u6c42\\\\u8bbf\\\\u95ee\\\\u6570\\\\u636e","\\\\u66f4\\\\u6b63\\\\u9519\\\\u8bef\\\\u6570\\\\u636e","\\\\u5220\\\\u9664\\\\u6570\\\\u636e\\\\uff08/deleteme\\\\uff09","\\\\u53cd\\\\u5bf9\\\\u5904\\\\u7406","\\\\u6570\\\\u636e\\\\u53ef\\\\u643a\\\\u5e26\\\\u6027"]],
["Cookie","Mini App \\\\u4f7f\\\\u7528 localStorage \\\\u5b9e\\\\u73b0\\\\u529f\\\\u80fd\\\\u3002\\\\u60a8\\\\u53ef\\\\u4ee5\\\\u968f\\\\u65f6\\\\u6e05\\\\u9664\\\\u6570\\\\u636e\\\\u3002"],
["\\\\u8054\\\\u7cfb\\\\u65b9\\\\u5f0f",'<a href="mailto:support@areszyn.com">support@areszyn.com</a> &middot; <a href="https://t.me/lifegrambot">@lifegrambot</a>']
]};
T.ar={legal:"\\\\u2696\\\\ufe0f \\\\u0647\\\\u0630\\\\u0647 \\\\u0627\\\\u0644\\\\u062a\\\\u0631\\\\u062c\\\\u0645\\\\u0629 \\\\u0644\\\\u0623\\\\u063a\\\\u0631\\\\u0627\\\\u0636 \\\\u0625\\\\u0639\\\\u0644\\\\u0627\\\\u0645\\\\u064a\\\\u0629 \\\\u0641\\\\u0642\\\\u0637. \\\\u0627\\\\u0644\\\\u0646\\\\u0633\\\\u062e\\\\u0629 \\\\u0627\\\\u0644\\\\u0625\\\\u0646\\\\u062c\\\\u0644\\\\u064a\\\\u0632\\\\u064a\\\\u0629 \\\\u0647\\\\u064a \\\\u0627\\\\u0644\\\\u0645\\\\u0644\\\\u0632\\\\u0645\\\\u0629 \\\\u0642\\\\u0627\\\\u0646\\\\u0648\\\\u0646\\\\u064a\\\\u0627\\\\u064b.",
dir:"rtl",
s:[
["\\\\u0646\\\\u0638\\\\u0631\\\\u0629 \\\\u0639\\\\u0627\\\\u0645\\\\u0629 \\\\u0639\\\\u0644\\\\u0649 \\\\u0627\\\\u0644\\\\u062e\\\\u062f\\\\u0645\\\\u0629","@lifegrambot \\\\u0647\\\\u0648 \\\\u0628\\\\u0648\\\\u062a \\\\u0645\\\\u062a\\\\u0639\\\\u062f\\\\u062f \\\\u0627\\\\u0644\\\\u0648\\\\u0638\\\\u0627\\\\u0626\\\\u0641 \\\\u0648\\\\u062a\\\\u0637\\\\u0628\\\\u064a\\\\u0642 \\\\u0645\\\\u0635\\\\u063a\\\\u0631 \\\\u064a\\\\u0639\\\\u0645\\\\u0644 \\\\u0639\\\\u0644\\\\u0649 Telegram.",["\\\\u0625\\\\u0631\\\\u0633\\\\u0627\\\\u0644 \\\\u0648\\\\u0627\\\\u0633\\\\u062a\\\\u0642\\\\u0628\\\\u0627\\\\u0644 \\\\u0627\\\\u0644\\\\u0631\\\\u0633\\\\u0627\\\\u0626\\\\u0644","\\\\u0628\\\\u062b \\\\u0627\\\\u0644\\\\u0641\\\\u064a\\\\u062f\\\\u064a\\\\u0648","\\\\u0627\\\\u0644\\\\u0645\\\\u062f\\\\u0641\\\\u0648\\\\u0639\\\\u0627\\\\u062a \\\\u0648\\\\u0627\\\\u0644\\\\u062a\\\\u0628\\\\u0631\\\\u0639\\\\u0627\\\\u062a","\\\\u0625\\\\u062f\\\\u0627\\\\u0631\\\\u0629 \\\\u0627\\\\u0644\\\\u0645\\\\u062c\\\\u0645\\\\u0648\\\\u0639\\\\u0627\\\\u062a","\\\\u0645\\\\u062d\\\\u0627\\\\u062f\\\\u062b\\\\u0629 \\\\u0627\\\\u0644\\\\u0630\\\\u0643\\\\u0627\\\\u0621 \\\\u0627\\\\u0644\\\\u0627\\\\u0635\\\\u0637\\\\u0646\\\\u0627\\\\u0639\\\\u064a","\\\\u0623\\\\u062f\\\\u0627\\\\u0629 \\\\u0627\\\\u0644\\\\u062f\\\\u0631\\\\u062f\\\\u0634\\\\u0629 \\\\u0627\\\\u0644\\\\u0645\\\\u0628\\\\u0627\\\\u0634\\\\u0631\\\\u0629"]],
["\\\\u0627\\\\u0644\\\\u0628\\\\u064a\\\\u0627\\\\u0646\\\\u0627\\\\u062a \\\\u0627\\\\u0644\\\\u062a\\\\u064a \\\\u0646\\\\u062c\\\\u0645\\\\u0639\\\\u0647\\\\u0627","\\\\u0646\\\\u062c\\\\u0645\\\\u0639 \\\\u0641\\\\u0642\\\\u0637 \\\\u0627\\\\u0644\\\\u0628\\\\u064a\\\\u0627\\\\u0646\\\\u0627\\\\u062a \\\\u0627\\\\u0644\\\\u0644\\\\u0627\\\\u0632\\\\u0645\\\\u0629 \\\\u0644\\\\u062a\\\\u0634\\\\u063a\\\\u064a\\\\u0644 \\\\u0627\\\\u0644\\\\u062e\\\\u062f\\\\u0645\\\\u0629:",["\\\\u0645\\\\u0639\\\\u0631\\\\u0641 Telegram\\\\u060c \\\\u0627\\\\u0644\\\\u0627\\\\u0633\\\\u0645\\\\u060c \\\\u0627\\\\u0633\\\\u0645 \\\\u0627\\\\u0644\\\\u0645\\\\u0633\\\\u062a\\\\u062e\\\\u062f\\\\u0645","\\\\u0627\\\\u0644\\\\u0631\\\\u0633\\\\u0627\\\\u0626\\\\u0644 \\\\u0648\\\\u0627\\\\u0644\\\\u0648\\\\u0633\\\\u0627\\\\u0626\\\\u0637 \\\\u0627\\\\u0644\\\\u062a\\\\u064a \\\\u062a\\\\u0631\\\\u0633\\\\u0644\\\\u0647\\\\u0627","\\\\u0633\\\\u062c\\\\u0644\\\\u0627\\\\u062a \\\\u0627\\\\u0644\\\\u062f\\\\u0641\\\\u0639 (\\\\u0627\\\\u0644\\\\u062a\\\\u0628\\\\u0631\\\\u0639\\\\u0627\\\\u062a/\\\\u0627\\\\u0644\\\\u0627\\\\u0634\\\\u062a\\\\u0631\\\\u0627\\\\u0643\\\\u0627\\\\u062a)","\\\\u0639\\\\u0646\\\\u0648\\\\u0627\\\\u0646 IP\\\\u060c \\\\u0645\\\\u0639\\\\u0644\\\\u0648\\\\u0645\\\\u0627\\\\u062a \\\\u0627\\\\u0644\\\\u062c\\\\u0647\\\\u0627\\\\u0632/\\\\u0627\\\\u0644\\\\u0645\\\\u062a\\\\u0635\\\\u0641\\\\u062d","\\\\u0625\\\\u062c\\\\u0631\\\\u0627\\\\u0621\\\\u0627\\\\u062a \\\\u0627\\\\u0644\\\\u0625\\\\u0634\\\\u0631\\\\u0627\\\\u0641 (\\\\u0627\\\\u0644\\\\u062d\\\\u0638\\\\u0631\\\\u060c \\\\u0627\\\\u0644\\\\u062a\\\\u062d\\\\u0630\\\\u064a\\\\u0631\\\\u0627\\\\u062a)"]],
["\\\\u0627\\\\u0633\\\\u062a\\\\u062e\\\\u062f\\\\u0627\\\\u0645 \\\\u0627\\\\u0644\\\\u0628\\\\u064a\\\\u0627\\\\u0646\\\\u0627\\\\u062a","\\\\u062a\\\\u064f\\\\u0633\\\\u062a\\\\u062e\\\\u062f\\\\u0645 \\\\u0644\\\\u062a\\\\u0648\\\\u062c\\\\u064a\\\\u0647 \\\\u0627\\\\u0644\\\\u0631\\\\u0633\\\\u0627\\\\u0626\\\\u0644\\\\u060c \\\\u0645\\\\u0639\\\\u0627\\\\u0644\\\\u062c\\\\u0629 \\\\u0627\\\\u0644\\\\u0645\\\\u062f\\\\u0641\\\\u0648\\\\u0639\\\\u0627\\\\u062a\\\\u060c \\\\u0627\\\\u0644\\\\u0623\\\\u0645\\\\u0627\\\\u0646\\\\u060c \\\\u0645\\\\u0646\\\\u0639 \\\\u0627\\\\u0644\\\\u0627\\\\u062d\\\\u062a\\\\u064a\\\\u0627\\\\u0644\\\\u060c \\\\u0648\\\\u062a\\\\u062d\\\\u0633\\\\u064a\\\\u0646 \\\\u0627\\\\u0644\\\\u062e\\\\u062f\\\\u0645\\\\u0629."],
["\\\\u0627\\\\u0644\\\\u0627\\\\u062d\\\\u062a\\\\u0641\\\\u0627\\\\u0638 \\\\u0628\\\\u0627\\\\u0644\\\\u0628\\\\u064a\\\\u0627\\\\u0646\\\\u0627\\\\u062a","\\\\u062a\\\\u064f\\\\u062e\\\\u0632\\\\u0646 \\\\u0627\\\\u0644\\\\u0631\\\\u0633\\\\u0627\\\\u0626\\\\u0644 \\\\u062d\\\\u062a\\\\u0649 \\\\u062a\\\\u0642\\\\u0648\\\\u0645 \\\\u0628\\\\u062d\\\\u0630\\\\u0641\\\\u0647\\\\u0627. \\\\u0646\\\\u0633\\\\u062a\\\\u062e\\\\u062f\\\\u0645 \\\\u062a\\\\u0634\\\\u0641\\\\u064a\\\\u0631 AES-256 \\\\u0648\\\\u062d\\\\u0645\\\\u0627\\\\u064a\\\\u0629 Cloudflare."],
["\\\\u062d\\\\u0642\\\\u0648\\\\u0642\\\\u0643",null,["\\\\u0637\\\\u0644\\\\u0628 \\\\u0627\\\\u0644\\\\u0648\\\\u0635\\\\u0648\\\\u0644 \\\\u0625\\\\u0644\\\\u0649 \\\\u0627\\\\u0644\\\\u0628\\\\u064a\\\\u0627\\\\u0646\\\\u0627\\\\u062a","\\\\u062a\\\\u0635\\\\u062d\\\\u064a\\\\u062d \\\\u0627\\\\u0644\\\\u0628\\\\u064a\\\\u0627\\\\u0646\\\\u0627\\\\u062a \\\\u0627\\\\u0644\\\\u062e\\\\u0627\\\\u0637\\\\u0626\\\\u0629","\\\\u062d\\\\u0630\\\\u0641 \\\\u0627\\\\u0644\\\\u0628\\\\u064a\\\\u0627\\\\u0646\\\\u0627\\\\u062a (/deleteme)","\\\\u0627\\\\u0644\\\\u0627\\\\u0639\\\\u062a\\\\u0631\\\\u0627\\\\u0636 \\\\u0639\\\\u0644\\\\u0649 \\\\u0627\\\\u0644\\\\u0645\\\\u0639\\\\u0627\\\\u0644\\\\u062c\\\\u0629","\\\\u0646\\\\u0642\\\\u0644 \\\\u0627\\\\u0644\\\\u0628\\\\u064a\\\\u0627\\\\u0646\\\\u0627\\\\u062a"]],
["\\\\u0645\\\\u0644\\\\u0641\\\\u0627\\\\u062a \\\\u062a\\\\u0639\\\\u0631\\\\u064a\\\\u0641 \\\\u0627\\\\u0644\\\\u0627\\\\u0631\\\\u062a\\\\u0628\\\\u0627\\\\u0637","\\\\u064a\\\\u0633\\\\u062a\\\\u062e\\\\u062f\\\\u0645 \\\\u0627\\\\u0644\\\\u062a\\\\u0637\\\\u0628\\\\u064a\\\\u0642 \\\\u0627\\\\u0644\\\\u0645\\\\u0635\\\\u063a\\\\u0631 localStorage \\\\u0644\\\\u0644\\\\u0648\\\\u0638\\\\u0627\\\\u0626\\\\u0641. \\\\u064a\\\\u0645\\\\u0643\\\\u0646\\\\u0643 \\\\u0645\\\\u0633\\\\u062d \\\\u0627\\\\u0644\\\\u0628\\\\u064a\\\\u0627\\\\u0646\\\\u0627\\\\u062a \\\\u0641\\\\u064a \\\\u0623\\\\u064a \\\\u0648\\\\u0642\\\\u062a."],
["\\\\u0627\\\\u062a\\\\u0635\\\\u0644 \\\\u0628\\\\u0646\\\\u0627",'<a href="mailto:support@areszyn.com">support@areszyn.com</a> &middot; <a href="https://t.me/lifegrambot">@lifegrambot</a>']
]};
T.es={legal:"\\\\u2696\\\\ufe0f Esta traducci\\\\u00f3n es solo para fines informativos. La versi\\\\u00f3n en ingl\\\\u00e9s es legalmente vinculante.",
s:[
["Descripci\\\\u00f3n del servicio","@lifegrambot es un bot multifuncional y Mini App que opera en Telegram.",["Mensajer\\\\u00eda","Transmisi\\\\u00f3n de video","Pagos y donaciones","Gesti\\\\u00f3n de grupos","Chat con IA","Widget de chat en vivo"]],
["Datos que recopilamos","Solo recopilamos los datos necesarios para operar el servicio:",["ID de Telegram, nombre, nombre de usuario","Mensajes y medios que env\\\\u00edas","Registros de pago (donaciones/suscripciones)","Direcci\\\\u00f3n IP, informaci\\\\u00f3n del dispositivo/navegador","Acciones de moderaci\\\\u00f3n (prohibiciones, advertencias)"]],
["Uso de datos","Se utilizan para enrutamiento de mensajes, procesamiento de pagos, seguridad, prevenci\\\\u00f3n de fraude y mejora del servicio."],
["Retenci\\\\u00f3n de datos","Los mensajes se almacenan hasta que los elimines. Usamos cifrado AES-256 y seguridad de Cloudflare."],
["Tus derechos",null,["Solicitar acceso a tus datos","Corregir datos incorrectos","Eliminar tus datos (/deleteme)","Oponerte al procesamiento","Portabilidad de datos"]],
["Cookies","La Mini App usa localStorage para funcionalidad. Puedes borrar los datos en cualquier momento."],
["Contacto",'<a href="mailto:support@areszyn.com">support@areszyn.com</a> &middot; <a href="https://t.me/lifegrambot">@lifegrambot</a>']
]};
T.ru={legal:"\\\\u2696\\\\ufe0f \\\\u042d\\\\u0442\\\\u043e\\\\u0442 \\\\u043f\\\\u0435\\\\u0440\\\\u0435\\\\u0432\\\\u043e\\\\u0434 \\\\u043f\\\\u0440\\\\u0435\\\\u0434\\\\u043e\\\\u0441\\\\u0442\\\\u0430\\\\u0432\\\\u043b\\\\u0435\\\\u043d \\\\u0438\\\\u0441\\\\u043a\\\\u043b\\\\u044e\\\\u0447\\\\u0438\\\\u0442\\\\u0435\\\\u043b\\\\u044c\\\\u043d\\\\u043e \\\\u0432 \\\\u0438\\\\u043d\\\\u0444\\\\u043e\\\\u0440\\\\u043c\\\\u0430\\\\u0446\\\\u0438\\\\u043e\\\\u043d\\\\u043d\\\\u044b\\\\u0445 \\\\u0446\\\\u0435\\\\u043b\\\\u044f\\\\u0445. \\\\u042e\\\\u0440\\\\u0438\\\\u0434\\\\u0438\\\\u0447\\\\u0435\\\\u0441\\\\u043a\\\\u0438 \\\\u043e\\\\u0431\\\\u044f\\\\u0437\\\\u0430\\\\u0442\\\\u0435\\\\u043b\\\\u044c\\\\u043d\\\\u043e\\\\u0439 \\\\u044f\\\\u0432\\\\u043b\\\\u044f\\\\u0435\\\\u0442\\\\u0441\\\\u044f \\\\u0432\\\\u0435\\\\u0440\\\\u0441\\\\u0438\\\\u044f \\\\u043d\\\\u0430 \\\\u0430\\\\u043d\\\\u0433\\\\u043b\\\\u0438\\\\u0439\\\\u0441\\\\u043a\\\\u043e\\\\u043c \\\\u044f\\\\u0437\\\\u044b\\\\u043a\\\\u0435.",
s:[
["\\\\u041e\\\\u0431\\\\u0437\\\\u043e\\\\u0440 \\\\u0441\\\\u0435\\\\u0440\\\\u0432\\\\u0438\\\\u0441\\\\u0430","@lifegrambot \\\\u2014 \\\\u043c\\\\u043d\\\\u043e\\\\u0433\\\\u043e\\\\u0444\\\\u0443\\\\u043d\\\\u043a\\\\u0446\\\\u0438\\\\u043e\\\\u043d\\\\u0430\\\\u043b\\\\u044c\\\\u043d\\\\u044b\\\\u0439 \\\\u0431\\\\u043e\\\\u0442 \\\\u0438 \\\\u043c\\\\u0438\\\\u043d\\\\u0438-\\\\u043f\\\\u0440\\\\u0438\\\\u043b\\\\u043e\\\\u0436\\\\u0435\\\\u043d\\\\u0438\\\\u0435 \\\\u0434\\\\u043b\\\\u044f Telegram.",["\\\\u041e\\\\u0431\\\\u043c\\\\u0435\\\\u043d \\\\u0441\\\\u043e\\\\u043e\\\\u0431\\\\u0449\\\\u0435\\\\u043d\\\\u0438\\\\u044f\\\\u043c\\\\u0438","\\\\u0412\\\\u0438\\\\u0434\\\\u0435\\\\u043e\\\\u0442\\\\u0440\\\\u0430\\\\u043d\\\\u0441\\\\u043b\\\\u044f\\\\u0446\\\\u0438\\\\u0438","\\\\u041f\\\\u043b\\\\u0430\\\\u0442\\\\u0435\\\\u0436\\\\u0438 \\\\u0438 \\\\u043f\\\\u043e\\\\u0436\\\\u0435\\\\u0440\\\\u0442\\\\u0432\\\\u043e\\\\u0432\\\\u0430\\\\u043d\\\\u0438\\\\u044f","\\\\u0423\\\\u043f\\\\u0440\\\\u0430\\\\u0432\\\\u043b\\\\u0435\\\\u043d\\\\u0438\\\\u0435 \\\\u0433\\\\u0440\\\\u0443\\\\u043f\\\\u043f\\\\u0430\\\\u043c\\\\u0438","AI-\\\\u0447\\\\u0430\\\\u0442","\\\\u0412\\\\u0438\\\\u0434\\\\u0436\\\\u0435\\\\u0442 \\\\u0436\\\\u0438\\\\u0432\\\\u043e\\\\u0433\\\\u043e \\\\u0447\\\\u0430\\\\u0442\\\\u0430"]],
["\\\\u0421\\\\u043e\\\\u0431\\\\u0438\\\\u0440\\\\u0430\\\\u0435\\\\u043c\\\\u044b\\\\u0435 \\\\u0434\\\\u0430\\\\u043d\\\\u043d\\\\u044b\\\\u0435","\\\\u041c\\\\u044b \\\\u0441\\\\u043e\\\\u0431\\\\u0438\\\\u0440\\\\u0430\\\\u0435\\\\u043c \\\\u0442\\\\u043e\\\\u043b\\\\u044c\\\\u043a\\\\u043e \\\\u0434\\\\u0430\\\\u043d\\\\u043d\\\\u044b\\\\u0435, \\\\u043d\\\\u0435\\\\u043e\\\\u0431\\\\u0445\\\\u043e\\\\u0434\\\\u0438\\\\u043c\\\\u044b\\\\u0435 \\\\u0434\\\\u043b\\\\u044f \\\\u0440\\\\u0430\\\\u0431\\\\u043e\\\\u0442\\\\u044b \\\\u0441\\\\u0435\\\\u0440\\\\u0432\\\\u0438\\\\u0441\\\\u0430:",["Telegram ID, \\\\u0438\\\\u043c\\\\u044f, \\\\u0438\\\\u043c\\\\u044f \\\\u043f\\\\u043e\\\\u043b\\\\u044c\\\\u0437\\\\u043e\\\\u0432\\\\u0430\\\\u0442\\\\u0435\\\\u043b\\\\u044f","\\\\u0421\\\\u043e\\\\u043e\\\\u0431\\\\u0449\\\\u0435\\\\u043d\\\\u0438\\\\u044f \\\\u0438 \\\\u043c\\\\u0435\\\\u0434\\\\u0438\\\\u0430\\\\u0444\\\\u0430\\\\u0439\\\\u043b\\\\u044b","\\\\u0417\\\\u0430\\\\u043f\\\\u0438\\\\u0441\\\\u0438 \\\\u043f\\\\u043b\\\\u0430\\\\u0442\\\\u0435\\\\u0436\\\\u0435\\\\u0439 (\\\\u043f\\\\u043e\\\\u0436\\\\u0435\\\\u0440\\\\u0442\\\\u0432\\\\u043e\\\\u0432\\\\u0430\\\\u043d\\\\u0438\\\\u044f/\\\\u043f\\\\u043e\\\\u0434\\\\u043f\\\\u0438\\\\u0441\\\\u043a\\\\u0438)","IP-\\\\u0430\\\\u0434\\\\u0440\\\\u0435\\\\u0441, \\\\u0438\\\\u043d\\\\u0444\\\\u043e\\\\u0440\\\\u043c\\\\u0430\\\\u0446\\\\u0438\\\\u044f \\\\u043e\\\\u0431 \\\\u0443\\\\u0441\\\\u0442\\\\u0440\\\\u043e\\\\u0439\\\\u0441\\\\u0442\\\\u0432\\\\u0435/\\\\u0431\\\\u0440\\\\u0430\\\\u0443\\\\u0437\\\\u0435\\\\u0440\\\\u0435","\\\\u0414\\\\u0435\\\\u0439\\\\u0441\\\\u0442\\\\u0432\\\\u0438\\\\u044f \\\\u043c\\\\u043e\\\\u0434\\\\u0435\\\\u0440\\\\u0430\\\\u0446\\\\u0438\\\\u0438 (\\\\u0431\\\\u0430\\\\u043d\\\\u044b, \\\\u043f\\\\u0440\\\\u0435\\\\u0434\\\\u0443\\\\u043f\\\\u0440\\\\u0435\\\\u0436\\\\u0434\\\\u0435\\\\u043d\\\\u0438\\\\u044f)"]],
["\\\\u0418\\\\u0441\\\\u043f\\\\u043e\\\\u043b\\\\u044c\\\\u0437\\\\u043e\\\\u0432\\\\u0430\\\\u043d\\\\u0438\\\\u0435 \\\\u0434\\\\u0430\\\\u043d\\\\u043d\\\\u044b\\\\u0445","\\\\u0418\\\\u0441\\\\u043f\\\\u043e\\\\u043b\\\\u044c\\\\u0437\\\\u0443\\\\u0435\\\\u0442\\\\u0441\\\\u044f \\\\u0434\\\\u043b\\\\u044f \\\\u043c\\\\u0430\\\\u0440\\\\u0448\\\\u0440\\\\u0443\\\\u0442\\\\u0438\\\\u0437\\\\u0430\\\\u0446\\\\u0438\\\\u0438 \\\\u0441\\\\u043e\\\\u043e\\\\u0431\\\\u0449\\\\u0435\\\\u043d\\\\u0438\\\\u0439, \\\\u043e\\\\u0431\\\\u0440\\\\u0430\\\\u0431\\\\u043e\\\\u0442\\\\u043a\\\\u0438 \\\\u043f\\\\u043b\\\\u0430\\\\u0442\\\\u0435\\\\u0436\\\\u0435\\\\u0439, \\\\u0431\\\\u0435\\\\u0437\\\\u043e\\\\u043f\\\\u0430\\\\u0441\\\\u043d\\\\u043e\\\\u0441\\\\u0442\\\\u0438, \\\\u043f\\\\u0440\\\\u0435\\\\u0434\\\\u043e\\\\u0442\\\\u0432\\\\u0440\\\\u0430\\\\u0449\\\\u0435\\\\u043d\\\\u0438\\\\u044f \\\\u043c\\\\u043e\\\\u0448\\\\u0435\\\\u043d\\\\u043d\\\\u0438\\\\u0447\\\\u0435\\\\u0441\\\\u0442\\\\u0432\\\\u0430 \\\\u0438 \\\\u0443\\\\u043b\\\\u0443\\\\u0447\\\\u0448\\\\u0435\\\\u043d\\\\u0438\\\\u044f \\\\u0441\\\\u0435\\\\u0440\\\\u0432\\\\u0438\\\\u0441\\\\u0430."],
["\\\\u0425\\\\u0440\\\\u0430\\\\u043d\\\\u0435\\\\u043d\\\\u0438\\\\u0435 \\\\u0434\\\\u0430\\\\u043d\\\\u043d\\\\u044b\\\\u0445","\\\\u0421\\\\u043e\\\\u043e\\\\u0431\\\\u0449\\\\u0435\\\\u043d\\\\u0438\\\\u044f \\\\u0445\\\\u0440\\\\u0430\\\\u043d\\\\u044f\\\\u0442\\\\u0441\\\\u044f \\\\u0434\\\\u043e \\\\u0443\\\\u0434\\\\u0430\\\\u043b\\\\u0435\\\\u043d\\\\u0438\\\\u044f \\\\u0432\\\\u0430\\\\u043c\\\\u0438. \\\\u0418\\\\u0441\\\\u043f\\\\u043e\\\\u043b\\\\u044c\\\\u0437\\\\u0443\\\\u0435\\\\u0442\\\\u0441\\\\u044f \\\\u0448\\\\u0438\\\\u0444\\\\u0440\\\\u043e\\\\u0432\\\\u0430\\\\u043d\\\\u0438\\\\u0435 AES-256 \\\\u0438 \\\\u0437\\\\u0430\\\\u0449\\\\u0438\\\\u0442\\\\u0430 Cloudflare."],
["\\\\u0412\\\\u0430\\\\u0448\\\\u0438 \\\\u043f\\\\u0440\\\\u0430\\\\u0432\\\\u0430",null,["\\\\u0417\\\\u0430\\\\u043f\\\\u0440\\\\u043e\\\\u0441 \\\\u0434\\\\u043e\\\\u0441\\\\u0442\\\\u0443\\\\u043f\\\\u0430 \\\\u043a \\\\u0434\\\\u0430\\\\u043d\\\\u043d\\\\u044b\\\\u043c","\\\\u0418\\\\u0441\\\\u043f\\\\u0440\\\\u0430\\\\u0432\\\\u043b\\\\u0435\\\\u043d\\\\u0438\\\\u0435 \\\\u043d\\\\u0435\\\\u0442\\\\u043e\\\\u0447\\\\u043d\\\\u044b\\\\u0445 \\\\u0434\\\\u0430\\\\u043d\\\\u043d\\\\u044b\\\\u0445","\\\\u0423\\\\u0434\\\\u0430\\\\u043b\\\\u0435\\\\u043d\\\\u0438\\\\u0435 \\\\u0434\\\\u0430\\\\u043d\\\\u043d\\\\u044b\\\\u0445 (/deleteme)","\\\\u0412\\\\u043e\\\\u0437\\\\u0440\\\\u0430\\\\u0436\\\\u0435\\\\u043d\\\\u0438\\\\u0435 \\\\u043f\\\\u0440\\\\u043e\\\\u0442\\\\u0438\\\\u0432 \\\\u043e\\\\u0431\\\\u0440\\\\u0430\\\\u0431\\\\u043e\\\\u0442\\\\u043a\\\\u0438","\\\\u041f\\\\u0435\\\\u0440\\\\u0435\\\\u043d\\\\u043e\\\\u0441\\\\u0438\\\\u043c\\\\u043e\\\\u0441\\\\u0442\\\\u044c \\\\u0434\\\\u0430\\\\u043d\\\\u043d\\\\u044b\\\\u0445"]],
["\\\\u0424\\\\u0430\\\\u0439\\\\u043b\\\\u044b cookie","\\\\u041c\\\\u0438\\\\u043d\\\\u0438-\\\\u043f\\\\u0440\\\\u0438\\\\u043b\\\\u043e\\\\u0436\\\\u0435\\\\u043d\\\\u0438\\\\u0435 \\\\u0438\\\\u0441\\\\u043f\\\\u043e\\\\u043b\\\\u044c\\\\u0437\\\\u0443\\\\u0435\\\\u0442 localStorage. \\\\u0412\\\\u044b \\\\u043c\\\\u043e\\\\u0436\\\\u0435\\\\u0442\\\\u0435 \\\\u043e\\\\u0447\\\\u0438\\\\u0441\\\\u0442\\\\u0438\\\\u0442\\\\u044c \\\\u0434\\\\u0430\\\\u043d\\\\u043d\\\\u044b\\\\u0435 \\\\u0432 \\\\u043b\\\\u044e\\\\u0431\\\\u043e\\\\u0435 \\\\u0432\\\\u0440\\\\u0435\\\\u043c\\\\u044f."],
["\\\\u041a\\\\u043e\\\\u043d\\\\u0442\\\\u0430\\\\u043a\\\\u0442",'<a href="mailto:support@areszyn.com">support@areszyn.com</a> &middot; <a href="https://t.me/lifegrambot">@lifegrambot</a>']
]};
function rn(l){var t=T[l];if(!t)return;
var h='<div class="highlight"><p>'+t.legal+'</p></div>';
for(var i=0;i<t.s.length;i++){var s=t.s[i];
h+='<h2>'+s[0]+'</h2>';
if(s[1])h+='<p>'+s[1]+'</p>';
if(s[2]){h+='<ul>';for(var j=0;j<s[2].length;j++)h+='<li>'+s[2][j]+'</li>';h+='</ul>';}
}
h+='<div style="margin-top:40px;padding-top:24px;border-top:1px solid #1a1a1a;text-align:center;font-size:12px;color:#3a3a3a;line-height:2"><p>@lifegrambot &middot; Privacy Policy</p><p><a href="https://mini.susagar.sbs/api/privacy" style="color:#3b82f6">View full policy in English</a></p></div>';
ov.innerHTML=h;ov.style.display="block";
if(t.dir)ov.setAttribute("dir",t.dir);else ov.removeAttribute("dir");
for(var k=0;k<orig.length;k++)orig[k].style.display="none";
}
function so(){ov.style.display="none";ov.removeAttribute("dir");
for(var k=0;k<orig.length;k++)orig[k].style.display="";}
var btns=document.querySelectorAll("#lang-bar-wrap .lang-btn");
for(var i=0;i<btns.length;i++){
(function(b){b.addEventListener("click",function(){
for(var j=0;j<btns.length;j++)btns[j].classList.remove("active");
b.classList.add("active");
document.getElementById("lang-label").textContent=b.textContent.trim();
var lang=b.getAttribute("data-lang");
if(lang==="en"){document.getElementById("lang-label").textContent="English";so();}
else rn(lang);
});})(btns[i]);
}
})();
</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});

export default privacy;
