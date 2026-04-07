import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/hooks/use-theme";

const EMBED_SNIPPET = `<script src="https://mini.susagar.sbs/api/w/embed.js?key=YOUR_KEY"
        data-key="YOUR_KEY" async></script>`;

const FULL_SNIPPET = `<!DOCTYPE html>
<html>
<head>...</head>
<body>
  <!-- Your website content -->

  <!-- Lifegram Widget -->
  <script src="https://mini.susagar.sbs/api/w/embed.js?key=YOUR_KEY"
          data-key="YOUR_KEY" async></script>
</body>
</html>`;

function CopyButton({ text, copiedLabel = "Copied", copyLabel = "Copy" }: { text: string; copiedLabel?: string; copyLabel?: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
          .then(() => { setCopied(true); setFailed(false); setTimeout(() => setCopied(false), 2000); })
          .catch(() => { setFailed(true); setTimeout(() => setFailed(false), 2000); });
      }}
      className="absolute top-3 right-3 px-2.5 py-1 text-[10px] font-medium rounded-md border border-border bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
    >
      {failed ? "Failed" : copied ? copiedLabel : copyLabel}
    </button>
  );
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

function FadeSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) { setVisible(true); return; }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [reduced]);
  return (
    <div ref={ref} className={`${reduced ? "" : "transition-all duration-700"} ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"} ${className}`}>
      {children}
    </div>
  );
}

const TOC_ITEMS_EN = [
  { id: "overview", label: "Overview" },
  { id: "step-1", label: "1. Create a Widget" },
  { id: "step-2", label: "2. Copy Embed Code" },
  { id: "step-3", label: "3. Paste on Website" },
  { id: "step-4", label: "4. Respond to Messages" },
  { id: "customization", label: "Customization" },
  { id: "features", label: "Features" },
  { id: "plans", label: "Plans" },
  { id: "help", label: "Need Help?" },
];

const TOC_ITEMS_NE = [
  { id: "overview", label: "अवलोकन" },
  { id: "step-1", label: "१. विजेट बनाउनुहोस्" },
  { id: "step-2", label: "२. एम्बेड कोड कपी" },
  { id: "step-3", label: "३. वेबसाइटमा पेस्ट" },
  { id: "step-4", label: "४. सन्देश जवाफ" },
  { id: "customization", label: "कस्टमाइजेसन" },
  { id: "features", label: "विशेषता" },
  { id: "plans", label: "योजना" },
  { id: "help", label: "सहयोग चाहिन्छ?" },
];

export function DocsPage() {
  const { lang } = useTheme();
  const L = (en: string, ne: string) => lang === "ne" ? ne : en;
  const [activeSection, setActiveSection] = useState("overview");
  const tocItems = lang === "ne" ? TOC_ITEMS_NE : TOC_ITEMS_EN;

  useEffect(() => {
    const els = TOC_ITEMS_EN.map(t => document.getElementById(t.id)).filter(Boolean) as HTMLElement[];
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { setActiveSection(e.target.id); break; }
      }
    }, { rootMargin: "-80px 0px -60% 0px", threshold: 0.1 });
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <section className="pt-28 pb-20 min-h-screen">
      <div className="max-w-6xl mx-auto px-6">

        <FadeSection>
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <span className="inline-block px-3 py-1 text-xs font-medium border border-border rounded-full text-muted-foreground">
                {L("Documentation", "कागजात")}
              </span>
              <span className="inline-block px-2.5 py-0.5 text-[10px] font-mono border border-border rounded-md text-muted-foreground/60">
                v1.0
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.05] mb-4">
              {L("Live Chat Widget", "लाइभ च्याट विजेट")}<br />
              <span className="text-muted-foreground">{L("Setup Guide", "सेटअप गाइड")}</span>
            </h1>
            <p className="text-muted-foreground text-base max-w-xl leading-relaxed">
              {L(
                "Add a live chat bubble to your website with a single line of code. Visitors chat with you in real-time — you respond from Telegram.",
                "एक लाइन कोडले तपाईंको वेबसाइटमा लाइभ च्याट बबल थप्नुहोस्। भिजिटरहरूले तपाईंसँग रियल-टाइममा कुरा गर्छन् — तपाईं टेलिग्रामबाट जवाफ दिनुहुन्छ।"
              )}
            </p>
          </div>
        </FadeSection>

        <div className="flex gap-12">

          <aside className="hidden lg:block w-48 shrink-0 sticky top-24 self-start">
            <nav className="space-y-0.5">
              {tocItems.map(item => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => { e.preventDefault(); document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                  className={`block text-xs py-1.5 pl-3 border-l-2 transition-all ${
                    activeSection === item.id
                      ? "border-foreground text-foreground font-medium"
                      : "border-transparent text-muted-foreground/60 hover:text-muted-foreground hover:border-border"
                  }`}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </aside>

          <div className="flex-1 min-w-0 max-w-3xl">

            <FadeSection>
              <div id="overview" className="scroll-mt-24 mb-14">
                <h2 className="text-lg font-semibold mb-5 flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-foreground" />
                  {L("What is Lifegram Widget?", "Lifegram विजेट के हो?")}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  {L(
                    "Lifegram Widget is an embeddable live chat bubble — like Zendesk or Intercom — that you add to your website with a single line of code. Visitors start real-time conversations with you, and you respond from the Lifegram Mini App on Telegram.",
                    "Lifegram विजेट एउटा एम्बेड गर्न मिल्ने लाइभ च्याट बबल हो — Zendesk वा Intercom जस्तो — जुन तपाईंले आफ्नो वेबसाइटमा एक लाइन कोडले थप्नुहुन्छ।"
                  )}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { icon: "💬", title: L("Real-time Chat", "रियल-टाइम च्याट"), desc: L("Visitors get instant replies via polling. No page refresh needed.", "भिजिटरहरूले पोलिङ मार्फत तुरुन्त जवाफ पाउँछन्।") },
                    { icon: "🎨", title: L("Custom Branding", "कस्टम ब्रान्डिङ"), desc: L("Choose colors, icons, greeting, position, and logo text.", "रंग, आइकन, अभिवादन, स्थिति, र लोगो टेक्स्ट छान्नुहोस्।") },
                    { icon: "📱", title: L("Mobile Ready", "मोबाइल तयार"), desc: L("Full-screen on mobile, floating bubble on desktop.", "मोबाइलमा फुलस्क्रिन, डेस्कटपमा फ्लोटिंग बबल।") },
                    { icon: "💾", title: L("Persistent Sessions", "स्थायी सत्र"), desc: L("Chat history saved in localStorage with 7-day auto-expiry.", "च्याट इतिहास localStorage मा ७-दिन अटो-एक्सपायरी सहित सुरक्षित।") },
                  ].map(card => (
                    <div key={card.title} className="border border-border rounded-xl p-4 bg-card/30 hover:bg-card/60 transition-colors group">
                      <div className="text-lg mb-2">{card.icon}</div>
                      <h3 className="text-sm font-semibold mb-1 group-hover:text-foreground transition-colors">{card.title}</h3>
                      <p className="text-xs text-muted-foreground/70 leading-relaxed">{card.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </FadeSection>

            <FadeSection>
              <div id="step-1" className="scroll-mt-24 mb-14">
                <div className="flex items-center gap-3 mb-4">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-border text-xs font-bold text-foreground bg-card">1</span>
                  <h2 className="text-lg font-semibold">{L("Create a Widget", "विजेट बनाउनुहोस्")}</h2>
                </div>
                <div className="pl-10">
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    {L(
                      "Open the Lifegram Mini App in Telegram, go to the Setup tab, and tap Create Widget. Configure your settings:",
                      "टेलिग्राममा Lifegram Mini App खोल्नुहोस्, Setup ट्याबमा जानुहोस्, र Create Widget मा ट्याप गर्नुहोस्।"
                    )}
                  </p>
                  <div className="space-y-2">
                    {[
                      { field: L("Website Name", "वेबसाइट नाम"), desc: L("Display name in chat header", "च्याट हेडरमा देखाइने नाम") },
                      { field: L("Theme Color", "थिम रंग"), desc: L("10 presets or custom hex code", "१० प्रिसेट वा कस्टम hex कोड") },
                      { field: L("Greeting", "अभिवादन"), desc: L("Welcome message shown on open", "खोल्दा देखाइने स्वागत सन्देश") },
                      { field: L("Position", "स्थिति"), desc: L("Bottom-left or bottom-right", "तल-बायाँ वा तल-दायाँ") },
                      { field: L("Allowed Domain", "अनुमति दिइएको डोमेन"), desc: L("Domain where widget will load", "विजेट लोड हुने डोमेन") },
                    ].map(row => (
                      <div key={row.field} className="flex items-baseline gap-3 text-sm">
                        <span className="font-mono text-xs px-2 py-0.5 rounded border border-border bg-muted shrink-0 text-foreground/80">{row.field}</span>
                        <span className="text-muted-foreground/70 text-xs">{row.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </FadeSection>

            <FadeSection>
              <div id="step-2" className="scroll-mt-24 mb-14">
                <div className="flex items-center gap-3 mb-4">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-border text-xs font-bold text-foreground bg-card">2</span>
                  <h2 className="text-lg font-semibold">{L("Copy Embed Code", "एम्बेड कोड कपी गर्नुहोस्")}</h2>
                </div>
                <div className="pl-10">
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    {L(
                      "After creating your widget, you'll get an API key and embed code. Copy it from the widget card.",
                      "विजेट बनाएपछि, तपाईंले API कुञ्जी र एम्बेड कोड पाउनुहुनेछ। विजेट कार्डबाट कपी गर्नुहोस्।"
                    )}
                  </p>
                  <div className="relative rounded-xl border border-border bg-muted/30 overflow-hidden">
                    <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border bg-muted/50">
                      <span className="w-2.5 h-2.5 rounded-full bg-foreground/10" />
                      <span className="w-2.5 h-2.5 rounded-full bg-foreground/10" />
                      <span className="w-2.5 h-2.5 rounded-full bg-foreground/10" />
                      <span className="ml-2 text-[10px] font-mono text-muted-foreground/50">embed.js</span>
                    </div>
                    <pre className="px-4 py-4 text-xs leading-relaxed overflow-x-auto font-mono text-foreground/70">
                      <code>{EMBED_SNIPPET}</code>
                    </pre>
                    <CopyButton text={EMBED_SNIPPET} copyLabel={L("Copy", "कपी")} copiedLabel={L("Copied", "कपी भयो")} />
                  </div>
                </div>
              </div>
            </FadeSection>

            <FadeSection>
              <div id="step-3" className="scroll-mt-24 mb-14">
                <div className="flex items-center gap-3 mb-4">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-border text-xs font-bold text-foreground bg-card">3</span>
                  <h2 className="text-lg font-semibold">{L("Paste on Your Website", "तपाईंको वेबसाइटमा पेस्ट गर्नुहोस्")}</h2>
                </div>
                <div className="pl-10">
                  <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                    {L(
                      "Add the embed code before the closing </body> tag on every page where you want the chat widget:",
                      "च्याट विजेट चाहिने हरेक पेजमा बन्द हुने </body> ट्याग अघि एम्बेड कोड थप्नुहोस्:"
                    )}
                  </p>
                  <div className="relative rounded-xl border border-border bg-muted/30 overflow-hidden mb-4">
                    <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border bg-muted/50">
                      <span className="w-2.5 h-2.5 rounded-full bg-foreground/10" />
                      <span className="w-2.5 h-2.5 rounded-full bg-foreground/10" />
                      <span className="w-2.5 h-2.5 rounded-full bg-foreground/10" />
                      <span className="ml-2 text-[10px] font-mono text-muted-foreground/50">index.html</span>
                    </div>
                    <pre className="px-4 py-4 text-xs leading-relaxed overflow-x-auto font-mono text-foreground/70">
                      <code>{FULL_SNIPPET}</code>
                    </pre>
                    <CopyButton text={FULL_SNIPPET} copyLabel={L("Copy", "कपी")} copiedLabel={L("Copied", "कपी भयो")} />
                  </div>

                  <div className="border-l-2 border-foreground/20 pl-4 py-2">
                    <p className="text-xs text-muted-foreground/70 leading-relaxed">
                      {L(
                        "Works with any platform: WordPress, Shopify, Wix, Squarespace, static HTML, React, Next.js, and more.",
                        "कुनै पनि प्लेटफर्मसँग काम गर्छ: WordPress, Shopify, Wix, Squarespace, static HTML, React, Next.js, आदि।"
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </FadeSection>

            <FadeSection>
              <div id="step-4" className="scroll-mt-24 mb-14">
                <div className="flex items-center gap-3 mb-4">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-border text-xs font-bold text-foreground bg-card">4</span>
                  <h2 className="text-lg font-semibold">{L("Respond to Messages", "सन्देशहरूको जवाफ दिनुहोस्")}</h2>
                </div>
                <div className="pl-10">
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    {L(
                      "When a visitor sends a message, it appears in your Widget Inbox tab inside the Lifegram Mini App. Reply in real-time — visitors see your responses within seconds.",
                      "जब भिजिटरले सन्देश पठाउँछ, यो तपाईंको Widget Inbox ट्याबमा Lifegram Mini App भित्र देखिन्छ। रियल-टाइममा जवाफ दिनुहोस्।"
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      L("Pre-chat form", "प्रि-च्याट फारम"),
                      L("Name + Email capture", "नाम + इमेल क्याप्चर"),
                      L("Unread badges", "अनरिड ब्याजेस"),
                      L("Typing indicator", "टाइपिंग इन्डिकेटर"),
                    ].map(tag => (
                      <span key={tag} className="text-[10px] font-medium px-2.5 py-1 rounded-md border border-border bg-muted/50 text-muted-foreground/70">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            </FadeSection>

            <FadeSection>
              <div id="customization" className="scroll-mt-24 mb-14">
                <h2 className="text-lg font-semibold mb-5 flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-foreground" />
                  {L("Customization Options", "कस्टमाइजेसन विकल्पहरू")}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                  {L("Make the widget match your brand:", "विजेटलाई तपाईंको ब्रान्डसँग मिलाउनुहोस्:")}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    L("10 color presets + custom hex", "१० रंग प्रिसेट + कस्टम hex"),
                    L("Left or right position", "बायाँ वा दायाँ स्थिति"),
                    L("4 bubble icon styles", "४ बबल आइकन शैली"),
                    L("Custom logo initials", "कस्टम लोगो इनिशियल"),
                    L("Custom greeting message", "कस्टम अभिवादन सन्देश"),
                    L("Pause / resume anytime", "जुनसुकै बेला रोक्नुहोस् / सुरु गर्नुहोस्"),
                    L("AI auto-reply", "AI अटो-रिप्लाई"),
                    L("Train AI from website URLs", "वेबसाइट URL बाट AI तालिम"),
                  ].map(tag => (
                    <div key={tag} className="border border-border rounded-lg p-3 bg-card/20 hover:bg-card/50 transition-colors">
                      <span className="text-xs text-muted-foreground/80">{tag}</span>
                    </div>
                  ))}
                </div>
              </div>
            </FadeSection>

            <FadeSection>
              <div id="features" className="scroll-mt-24 mb-14">
                <h2 className="text-lg font-semibold mb-5 flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-foreground" />
                  {L("Chat Features", "च्याट विशेषताहरू")}
                </h2>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/40">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground/60 border-b border-border">{L("Feature", "विशेषता")}</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground/60 border-b border-border">{L("Description", "विवरण")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        [L("Typing indicators", "टाइपिंग इन्डिकेटर"), L("Real-time typing dots for both visitor and agent", "भिजिटर र एजेन्ट दुवैका लागि रियल-टाइम टाइपिंग डट्स")],
                        [L("Read receipts", "रिड रिसिप्ट"), L("Single check (delivered) and double blue check (read)", "एकल चेक (डेलिभर) र डबल ब्लु चेक (रिड)")],
                        [L("Emoji reactions", "इमोजी रिएक्सन"), L("8 emoji reactions on messages for visitors and agents", "भिजिटर र एजेन्टका लागि सन्देशमा ८ इमोजी रिएक्सन")],
                        [L("Chat rating", "च्याट रेटिंग"), L("1-5 star rating with optional text feedback", "१-५ स्टार रेटिंग वैकल्पिक टेक्स्ट फिडब्याक सहित")],
                        [L("Multi-agent", "बहु-एजेन्ट"), L("Invite collaborators with unique invite codes", "अद्वितीय आमन्त्रण कोडसँग सहयोगीहरू आमन्त्रित गर्नुहोस्")],
                        [L("AI auto-reply", "AI अटो-रिप्लाई"), L("AI-powered responses with custom system prompt", "कस्टम सिस्टम प्रम्प्टसँग AI-संचालित जवाफ")],
                        [L("Website training", "वेबसाइट तालिम"), L("Auto-crawl your site to build AI knowledge base", "AI ज्ञान आधार बनाउन तपाईंको साइट अटो-क्रल गर्नुहोस्")],
                        [L("Domain verification", "डोमेन प्रमाणीकरण"), L("Widget only loads on authorized domains", "विजेट अधिकृत डोमेनमा मात्र लोड हुन्छ")],
                      ].map(([feat, desc]) => (
                        <tr key={feat} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground/80 whitespace-nowrap">{feat}</td>
                          <td className="px-4 py-3 text-muted-foreground/60">{desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </FadeSection>

            <FadeSection>
              <div id="plans" className="scroll-mt-24 mb-14">
                <h2 className="text-lg font-semibold mb-5 flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-foreground" />
                  {L("Widget Plans", "विजेट योजनाहरू")}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      plan: L("Free", "निःशुल्क"),
                      price: "$0",
                      items: [
                        L("1 widget", "१ विजेट"),
                        L("Basic customization", "आधारभूत कस्टमाइजेसन"),
                        L("Lifegram watermark", "Lifegram वाटरमार्क"),
                      ],
                    },
                    {
                      plan: L("Standard", "स्ट्यान्डर्ड"),
                      price: "250★",
                      items: [
                        L("3 widgets", "३ विजेट"),
                        L("AI auto-reply", "AI अटो-रिप्लाई"),
                        L("10 crawl pages", "१० क्रल पेज"),
                        L("No watermark", "वाटरमार्क छैन"),
                      ],
                    },
                    {
                      plan: L("Pro", "प्रो"),
                      price: "500★",
                      items: [
                        L("10 widgets", "१० विजेट"),
                        L("AI auto-reply", "AI अटो-रिप्लाई"),
                        L("25 crawl pages", "२५ क्रल पेज"),
                        L("Multi-agent", "बहु-एजेन्ट"),
                        L("No watermark", "वाटरमार्क छैन"),
                      ],
                    },
                  ].map(p => (
                    <div key={p.plan} className="border border-border rounded-xl p-5 bg-card/20 hover:bg-card/40 transition-colors">
                      <h3 className="text-sm font-bold mb-1">{p.plan}</h3>
                      <p className="text-xl font-extrabold tracking-tight mb-4 text-foreground/90">{p.price}</p>
                      <ul className="space-y-1.5">
                        {p.items.map(item => (
                          <li key={item} className="text-xs text-muted-foreground/70 flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-foreground/30 shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </FadeSection>

            <FadeSection>
              <div id="help" className="scroll-mt-24 mb-8">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-foreground" />
                  {L("Need Help?", "सहयोग चाहिन्छ?")}
                </h2>
                <div className="border border-border rounded-xl p-6 bg-card/30">
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    {L(
                      "Open the Lifegram Bot on Telegram and send a message. We'll help you get set up.",
                      "टेलिग्राममा Lifegram Bot खोल्नुहोस् र सन्देश पठाउनुहोस्। हामी तपाईंलाई सेटअपमा सहयोग गर्नेछौं।"
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href="https://t.me/lifegrambot"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                      @lifegrambot
                    </a>
                    <a
                      href="mailto:support@areszyn.com"
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium border border-border rounded-lg hover:bg-muted transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                      support@areszyn.com
                    </a>
                  </div>
                </div>
              </div>
            </FadeSection>

            <div className="mt-12 pt-8 border-t border-border">
              <p className="text-xs text-muted-foreground/40 text-center">
                @lifegrambot &middot; Lifegram Live Chat Widget &middot;{" "}
                <a href="https://areszyn.org/privacy" className="hover:text-muted-foreground transition-colors">{L("Privacy Policy", "गोपनीयता नीति")}</a>
              </p>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
