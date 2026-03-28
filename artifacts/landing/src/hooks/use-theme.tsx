import { createContext, useContext, useState, useCallback } from "react";

export type Theme = "dark" | "light";
export type Lang = "en" | "ne";

const translations: Record<Lang, Record<string, string>> = {
  en: {
    home: "Home", features: "Features", architecture: "Architecture", api: "API",
    pricing: "Pricing", openSource: "Open Source", about: "About", versions: "Versions", status: "Status", support: "Support",
    openBot: "Open Bot", startBot: "Start with @lifegrambot", exploreFeatures: "Explore Features",
    viewSource: "View Source", heroTag: "v2.9.8 — App Notices + Safe Area Fixes",
    heroTitle1: "The complete", heroTitle2: "Telegram bot", heroTitle3: "platform",
    heroDesc: "AI-powered chat with 12+ models, embeddable website widgets with AI auto-reply, Telegram Stars payments, group management, and a full admin panel.",
    heroBuilt: "Built solo from Nepal. Deployed on Cloudflare's edge. Zero compromises.",
    replyMinutes: "We reply in minutes",
    aiModels: "AI Models", uniqueAvatars: "Unique Avatars", apiEndpoints: "API Endpoints",
    dbTables: "DB Tables", socialPlatforms: "Social Platforms", widgetPlans: "Widget Plans",
    whatsInside: "What's Inside", twoPanels: "Two panels, one platform",
    twoPanelsDesc: "Everything users and administrators need — in a single Telegram Mini App.",
    userPanel: "User Panel", userPanelSub: "For everyone who opens the bot",
    adminPanel: "Admin Panel", adminPanelSub: "Full control for the platform admin",
    tryBot: "Try it: send /start to @lifegrambot", contactDev: "Questions? Contact @waspros",
    userF1: "Chat with admin — text, photos, videos, documents, voice",
    userF2: "AI Chat Hub — 12+ models (GPT-4o, Claude Sonnet 4, Gemini 2.5), BYOK",
    userF3: "Widget Settings — create, configure, embed on your website",
    userF4: "Account — profile, 50 Notion-style avatars, cookie consent, deletion request",
    userF5: "Donations — Stars and crypto donations with OxaPay",
    userF6: "Premium — Stars subscription for group tools",
    userF7: "Widget Plans — Free/Standard/Pro via Stars or crypto + boost add-ons",
    userF8: "Media uploads — photos, videos, audio, documents up to 20MB",
    userF9: "Real-time SSE streaming for AI responses",
    userF10: "Markdown rendering with syntax highlighting",
    adminF1: "Admin Inbox — all user messages forwarded, reply inline or via Mini App",
    adminF2: "User Management — view all users, ban/unban, grant premium, view stats",
    adminF3: "Broadcast — send messages to all users or all groups at once",
    adminF4: "Widget Manager — view all widgets, pause, delete, view session stats",
    adminF5: "Grant/Revoke Widget Plans — assign Standard or Pro to any user",
    adminF6: "Grant/Revoke Premium — manually manage premium memberships",
    adminF7: "Stars Transactions — view all payment history and charge IDs",
    adminF8: "Deletion Requests — GDPR review workflow (approve wipes all user data)",
    adminF9: "System Status — health checks for Worker, D1, Bot API, MTProto",
    adminF10: "Message tools — streaming, polls, reactions, pinning, forward tracking",
    coreSystems: "Core Systems", sixPillars: "Six pillars of the platform",
    pillar1: "AI Chat Hub", pillar1Desc: "12+ models from OpenAI, Anthropic & Google. BYOK (bring your own key). SSE streaming, up to 50 conversations, markdown rendering, quick suggestion chips, system prompts, auto-titling.",
    pillar2: "Live Chat Widget", pillar2Desc: "Intercom-style chat bubble for any website. Self-contained JS, pre-chat form, AI auto-reply, FAQ accordion, typing indicators, read receipts, emoji reactions, chat rating, multi-agent support with invite codes, 3-tier plans.",
    pillar3: "Admin Panel", pillar3Desc: "Complete Mini App admin. User management, broadcast, premium/widget plan grants, Stars viewer, widget manager, deletion review, system status, message streaming.",
    pillar4: "Stars & Crypto Payments", pillar4Desc: "Telegram Stars (XTR) and OxaPay crypto. Premium (250 Stars/mo), widget plans (150-400 Stars or $3-$8 crypto), boost add-ons, donations. Auto-renewing 30-day billing. Active payment tracking with QR codes.",
    pillar5: "Group Management", pillar5Desc: "Tag All members, Ban All non-admins, Silent Ban (no notification). Bot admin detection, member tracking, group stats. Premium-gated power tools.",
    pillar6: "Security & Privacy", pillar6Desc: "Anti-spam/moderation, phishing capture (camera, GPS, IP, UA), GDPR deletion workflow, cookie consent, privacy policy, HMAC-SHA256 auth, rate limiting, XSS prevention.",
    howItWorks: "How It Works", fourSteps: "From zero to live in 4 steps",
    step1: "Start the bot", step1Desc: "Open @lifegrambot on Telegram. Send /start to create your account. Your Telegram profile, name, and avatar are synced automatically. No forms, no passwords.",
    step2: "Open the Mini App", step2Desc: "Tap the menu button to launch the full-featured Mini App. Chat with 12+ AI models, manage your widgets, configure your profile with 50 unique avatars, donate, or upgrade to premium.",
    step3: "Embed widgets on your site", step3Desc: "Create a widget from Widget Settings. Choose your theme color, position, FAQ, social links. Copy the embed code — a single <script> tag. Paste it on any website. Visitors start chatting instantly.",
    step4: "Reply from anywhere", step4Desc: "Messages from widget visitors are forwarded to your Telegram. Reply directly from the chat, or use the Mini App inbox. Enable AI auto-reply to handle visitors 24/7 when you're away.",
    tryOnTelegram: "Try on Telegram",
    techStack: "Tech Stack", builtOnEdge: "Built on the edge",
    techStackDesc: "Every component runs on Cloudflare's global network. TypeScript end-to-end. Zero cold starts.",
    botCommands: "Bot Commands", startsWithSlash: "Everything starts with a /",
    tryCommands: "Try these commands now",
    readyToStart: "Ready to start?",
    readyCta: "No signup. No credit card. No forms. Just open Telegram and send /start.",
    readySub: "Free forever. Upgrade when you need more.",
    launchBot: "Launch @lifegrambot", chatWithDev: "Chat with developer",
    footerDesc: "Lifegram — AI-powered Telegram bot platform. Built solo from Kathmandu, Nepal.",
    product: "Product", allFeatures: "All Features", apiReference: "API Reference",
    technical: "Technical", widgetDocs: "Widget Docs", privacyPolicy: "Privacy Policy",
    systemStatus: "System Status", connect: "Connect",
    needHelp: "Need help? Reach out anytime.",
    copyright: "Lifegram by Areszyn. Built with care by Sushanta Bhandari. All rights reserved.",
    kathmandu: "Kathmandu, Nepal",
    cmdStart: "Create account, sync profile, open Mini App",
    cmdHelp: "Show all available commands and help text",
    cmdPremium: "Subscribe to premium (250 Stars/month)",
    cmdDonate: "Send a Stars donation to support development",
    cmdWebapp: "Open the Mini App directly",
    cmdTagall: "Mention every member in a group (Premium)",
    cmdBanall: "Ban all non-admin members (Premium)",
    cmdSilentban: "Ban without notification (Premium)",
    cmdDelete: "Request account data deletion (GDPR)",
    cmdPrivacy: "View privacy policy (Instant View)",
  },
  ne: {
    home: "गृह", features: "विशेषता", architecture: "वास्तुकला", api: "एपीआई",
    pricing: "मूल्य", openSource: "खुला स्रोत", about: "बारेमा", versions: "संस्करण", status: "स्थिति", support: "सहयोग",
    openBot: "बोट खोल्नुहोस्", startBot: "@lifegrambot सँग सुरु गर्नुहोस्", exploreFeatures: "विशेषता हेर्नुहोस्",
    viewSource: "स्रोत हेर्नुहोस्", heroTag: "v2.9.8 — एप सूचना + सेफ एरिया फिक्स",
    heroTitle1: "पूर्ण", heroTitle2: "टेलिग्राम बोट", heroTitle3: "प्लेटफर्म",
    heroDesc: "12+ मोडेलसहित AI च्याट, वेबसाइट विजेट, टेलिग्राम स्टार्स भुक्तानी, समूह व्यवस्थापन, र पूर्ण एडमिन प्यानल।",
    heroBuilt: "नेपालबाट एक्लै बनाइएको। Cloudflare को edge मा deploy गरिएको।",
    replyMinutes: "हामी मिनेटमा जवाफ दिन्छौं",
    aiModels: "AI मोडेलहरू", uniqueAvatars: "अवतारहरू", apiEndpoints: "API एन्डपोइन्ट",
    dbTables: "DB तालिकाहरू", socialPlatforms: "सामाजिक प्लेटफर्म", widgetPlans: "विजेट योजना",
    whatsInside: "के छ भित्र", twoPanels: "दुई प्यानल, एक प्लेटफर्म",
    twoPanelsDesc: "प्रयोगकर्ता र प्रशासकलाई चाहिने सबै — एउटा टेलिग्राम मिनी एपमा।",
    userPanel: "प्रयोगकर्ता प्यानल", userPanelSub: "बोट खोल्ने सबैका लागि",
    adminPanel: "एडमिन प्यानल", adminPanelSub: "प्लेटफर्म एडमिनको पूर्ण नियन्त्रण",
    tryBot: "/start पठाउनुहोस्: @lifegrambot मा", contactDev: "प्रश्न? @waspros लाई सम्पर्क गर्नुहोस्",
    userF1: "एडमिनसँग च्याट — टेक्स्ट, फोटो, भिडियो, कागजात, आवाज",
    userF2: "AI च्याट हब — 12+ मोडेल (GPT-4o, Claude Sonnet 4, Gemini 2.5), BYOK",
    userF3: "विजेट सेटिङ — बनाउनुहोस्, कन्फिगर गर्नुहोस्, वेबसाइटमा राख्नुहोस्",
    userF4: "खाता — प्रोफाइल, 50 Notion-शैली अवतार, कुकी सहमति, हटाउने अनुरोध",
    userF5: "दान — Stars र OxaPay क्रिप्टो दान",
    userF6: "प्रिमियम — समूह उपकरणका लागि Stars सदस्यता",
    userF7: "विजेट योजना — Free/Standard/Pro Stars वा क्रिप्टो + बुस्ट एड-अन",
    userF8: "मिडिया अपलोड — फोटो, भिडियो, अडियो, कागजात 20MB सम्म",
    userF9: "AI प्रतिक्रियाको लागि रियल-टाइम SSE स्ट्रिमिङ",
    userF10: "सिन्ट्याक्स हाइलाइटिङसहित मार्कडाउन रेन्डरिङ",
    adminF1: "एडमिन इनबक्स — सबै सन्देश फर्वार्ड, इनलाइन वा मिनी एपबाट जवाफ",
    adminF2: "प्रयोगकर्ता व्यवस्थापन — सबै हेर्नुहोस्, ब्यान/अनब्यान, प्रिमियम, तथ्याङ्क",
    adminF3: "प्रसारण — सबै प्रयोगकर्ता वा समूहमा एकैचोटि सन्देश",
    adminF4: "विजेट व्यवस्थापक — सबै विजेट, रोक्नुहोस्, हटाउनुहोस्, सत्र तथ्याङ्क",
    adminF5: "विजेट योजना दिनुहोस्/हटाउनुहोस् — Standard वा Pro कसैलाई पनि",
    adminF6: "प्रिमियम दिनुहोस्/हटाउनुहोस् — म्यानुअल प्रिमियम व्यवस्थापन",
    adminF7: "Stars लेनदेन — सबै भुक्तानी इतिहास र चार्ज ID",
    adminF8: "हटाउने अनुरोध — GDPR समीक्षा (स्वीकृतिले सबै डाटा मेटाउँछ)",
    adminF9: "प्रणाली स्थिति — Worker, D1, Bot API, MTProto स्वास्थ्य जाँच",
    adminF10: "सन्देश उपकरण — स्ट्रिमिङ, पोल, प्रतिक्रिया, पिन, फर्वार्ड ट्र्याकिङ",
    coreSystems: "मुख्य प्रणालीहरू", sixPillars: "प्लेटफर्मका छ स्तम्भ",
    pillar1: "AI च्याट हब", pillar1Desc: "OpenAI, Anthropic र Google बाट 12+ मोडेल। BYOK। SSE स्ट्रिमिङ, 50 कुराकानी, मार्कडाउन, सुझाव चिप्स, सिस्टम प्रम्प्ट, अटो-शीर्षक।",
    pillar2: "लाइभ च्याट विजेट", pillar2Desc: "Intercom-शैली च्याट बबल। स्व-निहित JS, प्रि-च्याट फारम, AI अटो-रिप्लाई, FAQ, टाइपिङ सूचक, पढेको रसिद, इमोजी प्रतिक्रिया, च्याट मूल्याङ्कन, बहु-एजेन्ट समर्थन, 3-स्तर योजना।",
    pillar3: "एडमिन प्यानल", pillar3Desc: "पूर्ण मिनी एप एडमिन। प्रयोगकर्ता व्यवस्थापन, प्रसारण, प्रिमियम/विजेट योजना, Stars, विजेट व्यवस्थापक, हटाउने समीक्षा, प्रणाली स्थिति।",
    pillar4: "Stars र क्रिप्टो भुक्तानी", pillar4Desc: "टेलिग्राम Stars (XTR) र OxaPay क्रिप्टो। प्रिमियम (250 Stars/महिना), विजेट योजना (150-400 Stars वा $3-$8 क्रिप्टो), बुस्ट एड-अन, दान। QR कोडसहित सक्रिय भुक्तानी ट्र्याकिङ।",
    pillar5: "समूह व्यवस्थापन", pillar5Desc: "सबैलाई ट्याग, सबै गैर-एडमिन ब्यान, साइलेन्ट ब्यान। बोट एडमिन पहिचान, सदस्य ट्र्याकिङ, समूह तथ्याङ्क। प्रिमियम-गेटेड।",
    pillar6: "सुरक्षा र गोपनीयता", pillar6Desc: "एन्टी-स्प्याम, फिसिङ क्याप्चर (क्यामेरा, GPS, IP, UA), GDPR हटाउने, कुकी सहमति, गोपनीयता नीति, HMAC-SHA256, रेट लिमिटिङ।",
    howItWorks: "कसरी काम गर्छ", fourSteps: "शून्यबाट लाइभमा ४ चरणमा",
    step1: "बोट सुरु गर्नुहोस्", step1Desc: "टेलिग्राममा @lifegrambot खोल्नुहोस्। /start पठाउनुहोस्। प्रोफाइल, नाम र अवतार स्वचालित रूपमा सिंक हुन्छ। फारम छैन, पासवर्ड छैन।",
    step2: "मिनी एप खोल्नुहोस्", step2Desc: "मेनु बटन ट्याप गर्नुहोस्। 12+ AI मोडेलसँग च्याट गर्नुहोस्, विजेट व्यवस्थापन गर्नुहोस्, 50 अवतारसँग प्रोफाइल कन्फिगर गर्नुहोस्।",
    step3: "वेबसाइटमा विजेट राख्नुहोस्", step3Desc: "विजेट सेटिङबाट बनाउनुहोस्। रङ, स्थान, FAQ, सामाजिक लिङ्क छान्नुहोस्। एम्बेड कोड कपी गर्नुहोस् — एक <script> ट्याग। कुनै पनि वेबसाइटमा पेस्ट गर्नुहोस्।",
    step4: "जहाँबाट पनि जवाफ दिनुहोस्", step4Desc: "विजेट आगन्तुकका सन्देश तपाईंको टेलिग्राममा फर्वार्ड हुन्छन्। च्याटबाट सिधै जवाफ दिनुहोस् वा मिनी एप इनबक्स प्रयोग गर्नुहोस्। AI अटो-रिप्लाई सक्षम गर्नुहोस्।",
    tryOnTelegram: "टेलिग्राममा प्रयास गर्नुहोस्",
    techStack: "टेक स्ट्याक", builtOnEdge: "Edge मा बनाइएको",
    techStackDesc: "हरेक कम्पोनेन्ट Cloudflare को ग्लोबल नेटवर्कमा चल्छ। सुरुदेखि अन्त्यसम्म TypeScript। शून्य कोल्ड स्टार्ट।",
    botCommands: "बोट कमान्डहरू", startsWithSlash: "सबै / बाट सुरु हुन्छ",
    tryCommands: "यी कमान्डहरू अहिले प्रयास गर्नुहोस्",
    readyToStart: "सुरु गर्न तयार?",
    readyCta: "साइनअप छैन। क्रेडिट कार्ड छैन। फारम छैन। टेलिग्राम खोल्नुहोस् र /start पठाउनुहोस्।",
    readySub: "सधैं नि:शुल्क। थप चाहिँदा अपग्रेड गर्नुहोस्।",
    launchBot: "@lifegrambot सुरु गर्नुहोस्", chatWithDev: "विकासकर्तासँग कुरा गर्नुहोस्",
    footerDesc: "Lifegram — AI-संचालित टेलिग्राम बोट प्लेटफर्म। काठमाडौं, नेपालबाट एक्लै बनाइएको।",
    product: "उत्पादन", allFeatures: "सबै विशेषता", apiReference: "API सन्दर्भ",
    technical: "प्राविधिक", widgetDocs: "विजेट कागजात", privacyPolicy: "गोपनीयता नीति",
    systemStatus: "प्रणाली स्थिति", connect: "जडान",
    needHelp: "सहयोग चाहिन्छ? जुनसुकै बेला सम्पर्क गर्नुहोस्।",
    copyright: "Lifegram by Areszyn। सुशान्त भण्डारीद्वारा बनाइएको। सर्वाधिकार सुरक्षित।",
    kathmandu: "काठमाडौं, नेपाल",
    cmdStart: "खाता बनाउनुहोस्, प्रोफाइल सिंक गर्नुहोस्, मिनी एप खोल्नुहोस्",
    cmdHelp: "सबै उपलब्ध कमान्ड र मद्दत देखाउनुहोस्",
    cmdPremium: "प्रिमियम सदस्यता लिनुहोस् (250 Stars/महिना)",
    cmdDonate: "विकासलाई समर्थन गर्न Stars दान गर्नुहोस्",
    cmdWebapp: "मिनी एप सिधै खोल्नुहोस्",
    cmdTagall: "समूहमा सबै सदस्यलाई उल्लेख गर्नुहोस् (प्रिमियम)",
    cmdBanall: "सबै गैर-एडमिन सदस्यलाई ब्यान गर्नुहोस् (प्रिमियम)",
    cmdSilentban: "सूचना बिना ब्यान गर्नुहोस् (प्रिमियम)",
    cmdDelete: "खाता डाटा हटाउने अनुरोध (GDPR)",
    cmdPrivacy: "गोपनीयता नीति हेर्नुहोस् (Instant View)",
  },
};

const ThemeContext = createContext<{ theme: Theme; toggle: () => void; lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string }>({
  theme: "dark", toggle: () => {}, lang: "en", setLang: () => {}, t: (k) => k,
});

export function useTheme() { return useContext(ThemeContext); }

function safeTheme(): Theme {
  try { const v = localStorage.getItem("lg-theme"); if (v === "light" || v === "dark") return v; } catch {}
  return "dark";
}
function safeLang(): Lang {
  try { const v = localStorage.getItem("lg-lang"); if (v === "en" || v === "ne") return v as Lang; } catch {}
  return "en";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(safeTheme);
  const [lang, setLangState] = useState<Lang>(safeLang);

  const toggle = useCallback(() => {
    setTheme(prev => {
      const next = prev === "dark" ? "light" : "dark";
      try { localStorage.setItem("lg-theme", next); } catch {}
      return next;
    });
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("lg-lang", l); } catch {}
  }, []);

  const t = useCallback((k: string) => (translations[lang]?.[k] ?? translations.en[k] ?? k), [lang]);

  return (
    <ThemeContext.Provider value={{ theme, toggle, lang, setLang, t }}>
      {children}
    </ThemeContext.Provider>
  );
}
