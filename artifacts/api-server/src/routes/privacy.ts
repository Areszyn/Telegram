import { Router } from "express";

const router = Router();

const UPDATED = "2026-03-21"; // keep in sync with actual date
const BOT_NAME = "@lifegrammbot";
const CONTACT_EMAIL = "support@susagar.sbs";
const POLICY_URL = "https://mini.susagar.sbs/api/privacy";

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0a0a0a">
<title>Privacy Policy &amp; Terms — ${BOT_NAME}</title>
<meta property="og:type"        content="article">
<meta property="og:title"       content="Privacy Policy &amp; Terms — ${BOT_NAME}">
<meta property="og:description" content="What we collect, how we use it, your rights, and the terms governing use of ${BOT_NAME}.">
<meta property="og:url"         content="${POLICY_URL}">
<meta property="article:published_time" content="${UPDATED}T00:00:00Z">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{
  background:#0d0d0d;color:#d0d0d0;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  font-size:15px;line-height:1.75;
}
article{max-width:720px;margin:0 auto;padding:40px 20px 80px}
header{margin-bottom:36px;padding-bottom:24px;border-bottom:1px solid #1e1e1e}
header h1{font-size:1.65rem;font-weight:700;color:#f0f0f0;line-height:1.3;margin-bottom:10px}
.meta{font-size:12px;color:#444;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.badge{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:6px;padding:3px 9px;font-size:11px;color:#666}
h2{font-size:1.1rem;font-weight:600;color:#e8e8e8;margin:36px 0 12px;
   padding-left:12px;border-left:3px solid #3b82f6}
h3{font-size:.95rem;font-weight:600;color:#ccc;margin:22px 0 8px}
p{margin-bottom:12px;color:#aaa}
ul,ol{padding-left:20px;margin-bottom:12px}
li{margin-bottom:6px;color:#aaa}
li strong{color:#ccc}
a{color:#3b82f6;text-decoration:none}
a:hover{text-decoration:underline}
.highlight{
  background:#111;border:1px solid #1e1e1e;border-left:3px solid #3b82f6;
  border-radius:0 10px 10px 0;padding:14px 18px;margin:16px 0;
}
.highlight p{margin:0;font-size:.9rem;color:#888}
.card{
  background:#111;border:1px solid #1e1e1e;border-radius:12px;
  padding:18px 20px;margin:14px 0;
}
.card h3{margin-top:0}
table{width:100%;border-collapse:collapse;margin:14px 0;font-size:.88rem}
th{background:#161616;color:#888;font-weight:500;text-align:left;
   padding:10px 12px;border-bottom:1px solid #222}
td{padding:9px 12px;border-bottom:1px solid #181818;color:#999;vertical-align:top}
tr:last-child td{border-bottom:none}
.toc{background:#111;border:1px solid #1e1e1e;border-radius:12px;padding:18px 20px;margin-bottom:32px}
.toc p{font-size:12px;color:#555;margin-bottom:10px}
.toc ol{margin:0;padding-left:18px}
.toc li{margin-bottom:4px;font-size:13px}
.toc a{color:#666}
.toc a:hover{color:#3b82f6}
footer{margin-top:48px;padding-top:24px;border-top:1px solid #1a1a1a;
       font-size:12px;color:#444;text-align:center}
@media(max-width:520px){
  article{padding:28px 16px 60px}
  header h1{font-size:1.35rem}
  h2{font-size:1rem}
  table{display:block;overflow-x:auto}
}
</style>
</head>
<body>
<article>
<header>
  <h1>Privacy Policy, Terms of Service &amp; Terms and Conditions</h1>
  <div class="meta">
    <span>${BOT_NAME}</span>
    <span class="badge">Last updated: <time datetime="${UPDATED}">${UPDATED}</time></span>
    <span class="badge">English</span>
  </div>
</header>

<div class="toc">
  <p>Contents</p>
  <ol>
    <li><a href="#overview">Overview</a></li>
    <li><a href="#data-collected">Data We Collect</a></li>
    <li><a href="#how-we-use">How We Use Your Data</a></li>
    <li><a href="#retention">Data Retention</a></li>
    <li><a href="#third-party">Third-Party Services</a></li>
    <li><a href="#rights">Your Rights</a></li>
    <li><a href="#terms">Terms of Service</a></li>
    <li><a href="#conditions">Terms and Conditions</a></li>
    <li><a href="#cookies">Cookies &amp; Local Storage</a></li>
    <li><a href="#ip-collection">IP Address &amp; Device Data</a></li>
    <li><a href="#user-rights-extended">In-App Data Rights Controls</a></li>
    <li><a href="#changes">Policy Changes</a></li>
    <li><a href="#contact">Contact</a></li>
  </ol>
</div>

<h2 id="overview">1. Overview</h2>
<p>
  ${BOT_NAME} is a Telegram bot that lets users send messages to an administrator,
  share files, stream videos, make crypto donations, subscribe to premium plans, and
  interact with managed group chats. This document explains what information is collected
  when you use the bot, why it is collected, how it is stored, and your rights over it.
</p>
<div class="highlight">
  <p>By sending any message to ${BOT_NAME} you acknowledge that you have read and agree
  to this Privacy Policy and Terms of Service.</p>
</div>

<h2 id="data-collected">2. Data We Collect</h2>
<p>We collect only what is necessary to operate the service. The table below lists every
category of data stored.</p>

<table>
  <thead>
    <tr><th>Category</th><th>Data Points</th><th>Source</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Identity</strong></td>
      <td>Telegram user ID, first name, username (if set)</td>
      <td>Telegram API — provided automatically with every update</td>
    </tr>
    <tr>
      <td><strong>Messages</strong></td>
      <td>Text content, timestamps, read status, Telegram message IDs</td>
      <td>Messages you send to the bot</td>
    </tr>
    <tr>
      <td><strong>Media</strong></td>
      <td>Telegram file IDs (not the files themselves), video stream tokens</td>
      <td>Files and videos you or the admin share via the bot</td>
    </tr>
    <tr>
      <td><strong>Donations</strong></td>
      <td>Amount, currency, transaction ID, payment status, crypto address used</td>
      <td>OxaPay payment gateway or Telegram Stars payments</td>
    </tr>
    <tr>
      <td><strong>Subscriptions</strong></td>
      <td>Plan name, start/end dates, status, amount paid</td>
      <td>Created when you purchase a premium plan</td>
    </tr>
    <tr>
      <td><strong>Group membership</strong></td>
      <td>Telegram group/channel IDs, join date, role flags</td>
      <td>Groups the bot is added to and manages</td>
    </tr>
    <tr>
      <td><strong>Sessions</strong></td>
      <td>MTProto string session (encrypted), creation date</td>
      <td>Created if you link an account for advanced features</td>
    </tr>
    <tr>
      <td><strong>Moderation</strong></td>
      <td>Action type (ban/warn/mute), reason, duration, log entries</td>
      <td>Generated by automatic anti-spam or admin actions</td>
    </tr>
    <tr>
      <td><strong>Anti-spam</strong></td>
      <td>Rate-limit windows (message counts per time window)</td>
      <td>Calculated automatically; not tied to message content</td>
    </tr>
  </tbody>
</table>

<div class="highlight">
  <p>We do <strong>not</strong> collect passwords, payment card numbers, government IDs,
  location data, contacts, or any biometric data.</p>
</div>

<h2 id="how-we-use">3. How We Use Your Data</h2>
<div class="card">
  <h3>Core operations</h3>
  <ul>
    <li>Routing messages between you and the administrator</li>
    <li>Delivering video streams and media files</li>
    <li>Processing and recording crypto or Stars donations</li>
    <li>Managing premium subscription access</li>
    <li>Enforcing anti-spam limits and moderation rules in groups</li>
  </ul>
</div>
<div class="card">
  <h3>Service improvement</h3>
  <ul>
    <li>Aggregate usage analytics (message counts, donation volumes) — no individual profiling</li>
    <li>Debugging errors and improving reliability</li>
  </ul>
</div>
<div class="card">
  <h3>What we never do</h3>
  <ul>
    <li>Sell, rent, or trade your data with third parties</li>
    <li>Use your data for advertising or behavioural profiling</li>
    <li>Read your message content for any purpose other than delivery to the admin</li>
    <li>Share your data with anyone other than the services listed in Section 5</li>
  </ul>
</div>

<h2 id="retention">4. Data Retention</h2>
<table>
  <thead>
    <tr><th>Data Type</th><th>Retention Period</th></tr>
  </thead>
  <tbody>
    <tr><td>Messages</td><td>Until manually deleted by the admin or upon account deletion request</td></tr>
    <tr><td>User profile (ID, name, username)</td><td>Indefinite while account is active; deleted on request</td></tr>
    <tr><td>Donation records</td><td>Minimum 12 months for financial compliance; deleted on request thereafter</td></tr>
    <tr><td>Subscription records</td><td>Duration of subscription + 6 months</td></tr>
    <tr><td>Moderation logs</td><td>90 days, then auto-purged</td></tr>
    <tr><td>Anti-spam windows</td><td>Rolling 60-second windows; not persisted beyond that</td></tr>
    <tr><td>Video stream tokens</td><td>24 hours (expire automatically)</td></tr>
    <tr><td>MTProto sessions</td><td>Until you revoke them or request deletion</td></tr>
  </tbody>
</table>

<h2 id="third-party">5. Third-Party Services</h2>
<p>The bot relies on the following external services. Each has its own privacy policy.</p>
<ul>
  <li><strong>Telegram</strong> — message delivery infrastructure.
    <a href="https://telegram.org/privacy" target="_blank">Telegram Privacy Policy</a></li>
  <li><strong>Cloudflare D1</strong> — database storage (EU/US data centres, encrypted at rest).
    <a href="https://www.cloudflare.com/privacypolicy/" target="_blank">Cloudflare Privacy Policy</a></li>
  <li><strong>Cloudflare R2</strong> — object/file storage (encrypted at rest).
    <a href="https://www.cloudflare.com/privacypolicy/" target="_blank">Cloudflare Privacy Policy</a></li>
  <li><strong>OxaPay</strong> — cryptocurrency payment processing.
    <a href="https://oxapay.com/privacy-policy" target="_blank">OxaPay Privacy Policy</a></li>
  <li><strong>Telegram Payments</strong> — Telegram Stars purchases processed by Telegram.
    <a href="https://telegram.org/privacy" target="_blank">Telegram Privacy Policy</a></li>
</ul>
<p>We do not use cookies, tracking pixels, or analytics scripts on this page or via the bot.</p>

<h2 id="rights">6. Your Rights</h2>
<p>Depending on your jurisdiction you may have some or all of the following rights:</p>
<ul>
  <li><strong>Access</strong> — request a copy of all data held about you</li>
  <li><strong>Rectification</strong> — correct inaccurate data</li>
  <li><strong>Erasure</strong> — request deletion of your personal data ("right to be forgotten")</li>
  <li><strong>Restriction</strong> — ask us to stop processing your data while a dispute is resolved</li>
  <li><strong>Portability</strong> — receive your data in a structured, machine-readable format</li>
  <li><strong>Objection</strong> — object to processing based on legitimate interests</li>
  <li><strong>Withdraw consent</strong> — stop using the bot at any time; no action required</li>
</ul>
<p>To exercise any right, contact us at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>
or send <code>/deleteme</code> to the bot. We will respond within 30 days.</p>

<h2 id="terms">7. Terms of Service</h2>
<h3>7.1 Eligibility</h3>
<p>You must be at least 13 years of age (or the minimum age required by Telegram in your
country) to use this bot. By using the bot you represent that you meet this requirement.</p>

<h3>7.2 Permitted use</h3>
<ul>
  <li>Contacting the administrator with genuine enquiries, questions, or feedback</li>
  <li>Sending files and media for review by the administrator</li>
  <li>Making voluntary donations via supported payment methods</li>
  <li>Accessing premium features you have paid for</li>
</ul>

<h3>7.3 Prohibited use</h3>
<ul>
  <li>Sending spam, unsolicited commercial messages, or bulk automated messages</li>
  <li>Attempting to probe, scan, or test the vulnerability of the service</li>
  <li>Impersonating any person or entity</li>
  <li>Uploading malware, viruses, or any harmful code</li>
  <li>Using the bot to facilitate illegal activity of any kind</li>
  <li>Attempting to circumvent rate limits, anti-spam measures, or access controls</li>
  <li>Sending content that is illegal, abusive, threatening, defamatory, or obscene</li>
</ul>

<h3>7.4 Service availability</h3>
<p>The bot is provided on an "as is" and "as available" basis. We do not guarantee
uninterrupted or error-free operation. We reserve the right to suspend or terminate
the service at any time without notice.</p>

<h3>7.5 Payments and refunds</h3>
<p>Donations are voluntary and non-refundable except where required by applicable law.
Premium subscription fees are non-refundable once the subscription period has begun.
Cryptocurrency payments are irreversible by their nature once confirmed on-chain.</p>

<h3>7.6 Termination</h3>
<p>We reserve the right to restrict or terminate your access to the bot at any time,
without notice, if we believe you have violated these terms or applicable law. You may
stop using the bot at any time by blocking it on Telegram.</p>

<h2 id="conditions">8. Terms and Conditions</h2>
<h3>8.1 Intellectual property</h3>
<p>All content, code, and branding associated with this bot is owned by or licensed to
the operator. You may not copy, modify, distribute, or create derivative works without
written permission.</p>

<h3>8.2 User content</h3>
<p>By sending content (text, images, videos, files) through the bot you grant the
operator a limited licence to store and transmit that content solely for the purpose
of delivering the service. You retain all ownership of your content.</p>

<h3>8.3 Limitation of liability</h3>
<p>To the maximum extent permitted by applicable law, the operator shall not be liable
for any indirect, incidental, special, consequential, or punitive damages arising from
your use of (or inability to use) the bot, even if advised of the possibility of such
damages.</p>

<h3>8.4 Indemnification</h3>
<p>You agree to indemnify and hold harmless the operator from any claims, damages,
losses, or expenses (including legal fees) arising from your use of the bot or
violation of these terms.</p>

<h3>8.5 Governing law</h3>
<p>These terms are governed by applicable international law. Any disputes shall first
be attempted to be resolved by contacting us directly at
<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>

<h3>8.6 Entire agreement</h3>
<p>This document constitutes the entire agreement between you and the operator regarding
use of ${BOT_NAME} and supersedes any prior agreements or understandings.</p>

<h2 id="cookies">9. Cookies &amp; Local Storage</h2>
<h3>9.1 What we set</h3>
<p>We use browser <strong>localStorage</strong> (not traditional cookies) to store your consent
preference and session state. No cross-site tracking cookies are set. The Mini App and video
player each store a single consent key:</p>
<table>
  <thead>
    <tr><th>Key</th><th>Value</th><th>Purpose</th><th>Expires</th></tr>
  </thead>
  <tbody>
    <tr><td><code>cookie_consent_v1</code></td><td><code>accepted</code> or <code>declined</code></td><td>Records your consent preference in the Mini App</td><td>Until manually cleared</td></tr>
    <tr><td><code>ck_player_v1</code></td><td><code>accepted</code> or <code>declined</code></td><td>Records your consent preference in the video player</td><td>Until manually cleared</td></tr>
  </tbody>
</table>
<p>No advertising, analytics, or third-party tracking cookies are placed on your device.</p>

<h3>9.2 Essential vs non-essential</h3>
<ul>
  <li><strong>Essential data</strong> (collected regardless of consent): Telegram user ID and
  first name — required to operate the bot and deliver messages.</li>
  <li><strong>Enhanced data</strong> (collected when consent is given or when you use the Mini App
  or video player): IP address, country, city, device type, browser, screen resolution,
  language, and timezone.</li>
</ul>

<h3>9.3 Managing consent</h3>
<p>You can withdraw or change your consent at any time via the <strong>Account → Cookie &amp;
Data Consent</strong> section inside the Mini App, or by clearing your browser's localStorage for
this site. Withdrawing consent does not delete data already collected; to request deletion,
use Section 6 or the in-app deletion request feature.</p>

<h2 id="ip-collection">10. IP Address &amp; Device Data Collection</h2>
<p>When you use the Mini App or open a video streaming link, the following technical data
is automatically collected and stored:</p>
<table>
  <thead>
    <tr><th>Data</th><th>How collected</th><th>Why</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>IP address</td>
      <td>From the HTTP request to our server (via Cloudflare CDN header <code>cf-connecting-ip</code>)</td>
      <td>Security, fraud prevention, geolocation for service delivery</td>
    </tr>
    <tr>
      <td>Country &amp; city</td>
      <td>Derived from IP via <a href="https://ip-api.com">ip-api.com</a> (free tier, no account created)</td>
      <td>Approximate location to detect unusual access patterns</td>
    </tr>
    <tr>
      <td>User agent string</td>
      <td>Standard HTTP header sent by your browser or Telegram client</td>
      <td>Identify device type and OS for compatibility purposes</td>
    </tr>
    <tr>
      <td>Screen resolution</td>
      <td>Read via <code>window.screen</code> in the Mini App JavaScript</td>
      <td>Display optimisation</td>
    </tr>
    <tr>
      <td>Browser language</td>
      <td>Read via <code>navigator.language</code></td>
      <td>Future localisation support</td>
    </tr>
    <tr>
      <td>Timezone</td>
      <td>Read via <code>Intl.DateTimeFormat().resolvedOptions().timeZone</code></td>
      <td>Scheduling and timestamp display</td>
    </tr>
    <tr>
      <td>Platform</td>
      <td>Read via <code>navigator.platform</code></td>
      <td>Device classification</td>
    </tr>
  </tbody>
</table>
<p>This data is stored in our Cloudflare D1 database, linked to your Telegram user ID, and
is visible only to the administrator. It is not shared with third parties.</p>
<p>IP addresses are stored in full and are not anonymised. If you wish to have your IP and
device data removed, use the in-app <strong>Request Data Deletion</strong> feature described
in Section 6, or contact us at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>

<h2 id="user-rights-extended">11. In-App Data Rights Controls</h2>
<p>The Mini App provides built-in tools for exercising your data rights:</p>
<ul>
  <li><strong>Account tab → Request Data Deletion</strong>: Submit a formal deletion request
  with a written reason. The administrator reviews and approves or declines within 30 days.
  On approval, all records associated with your Telegram ID are permanently deleted.</li>
  <li><strong>Account tab → Cookie &amp; Data Consent</strong>: Change your consent preference
  at any time. This updates the stored consent flag associated with your profile.</li>
  <li><strong>Bot command <code>/deleteme</code></strong>: Sends a deletion request via the bot
  as an alternative to the in-app form.</li>
</ul>

<h2 id="changes">12. Policy Changes</h2>
<p>We may update this policy periodically. Material changes will be announced through
the bot. The "last updated" date at the top will always reflect the most recent version.
Continued use of the bot after changes constitutes acceptance of the revised policy.</p>

<h2 id="contact">13. Contact</h2>
<p>For privacy requests, data deletion, or any questions about this policy:</p>
<ul>
  <li>Email: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></li>
  <li>Telegram bot: <a href="https://t.me/lifegrammbot">${BOT_NAME}</a></li>
  <li>Policy URL: <a href="${POLICY_URL}">${POLICY_URL}</a></li>
</ul>

<footer>
  <p>${BOT_NAME} &nbsp;·&nbsp; Privacy Policy, Terms of Service &amp; Terms and Conditions</p>
  <p style="margin-top:4px">Last updated <time datetime="${UPDATED}">${UPDATED}</time>
  &nbsp;·&nbsp; <a href="${POLICY_URL}">Permalink</a></p>
</footer>

</article>
</body>
</html>`;

router.get("/privacy", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(html);
});

export default router;
