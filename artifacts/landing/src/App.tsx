import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { useState, useEffect, useRef, createContext, useContext, useCallback } from "react";
import { Toaster } from "@/components/ui/toaster";
import { VersionsPage } from "@/pages/versions";
import { StatusPage } from "@/pages/status";

const TG_BOT = "https://t.me/lifegrambot";
const TG_DEV = "https://t.me/waspros";
const API_BASE = "https://mini.susagar.sbs/api";
const GITHUB = "https://github.com/areszyn";
const GITHUB_REPO = "https://github.com/areszyn/telegram";
const INSTAGRAM = "https://instagram.com/waspros";
const REDDIT = "https://reddit.com/u/areszyn";
const MAIL_INFO = "mailto:info@areszyn.com";
const MAIL_SUPPORT = "mailto:support@areszyn.com";

type Lang = "en" | "ne";
type Theme = "dark" | "light";

const translations: Record<Lang, Record<string, string>> = {
  en: {
    home: "Home", features: "Features", architecture: "Architecture", api: "API",
    pricing: "Pricing", openSource: "Open Source", about: "About", versions: "Versions", status: "Status", support: "Support",
    openBot: "Open Bot", startBot: "Start with @lifegrambot", exploreFeatures: "Explore Features",
    viewSource: "View Source", heroTag: "v2.8 — Boost Add-ons + Crypto Payments + Session Manager",
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
    pillar2: "Live Chat Widget", pillar2Desc: "Intercom-style chat bubble for any website. Self-contained JS, pre-chat form, AI auto-reply, FAQ accordion, 13 social platform icons, domain verification, custom theming, 3-tier plans.",
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
    viewSource: "स्रोत हेर्नुहोस्", heroTag: "v2.8 — बुस्ट एड-अन + क्रिप्टो भुक्तानी + सत्र व्यवस्थापक",
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
    pillar2: "लाइभ च्याट विजेट", pillar2Desc: "Intercom-शैली च्याट बबल। स्व-निहित JS, प्रि-च्याट फारम, AI अटो-रिप्लाई, FAQ, 13 सामाजिक प्लेटफर्म आइकन, डोमेन प्रमाणीकरण, 3-स्तर योजना।",
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

function useTheme() { return useContext(ThemeContext); }

function safeTheme(): Theme {
  try { const v = localStorage.getItem("lg-theme"); if (v === "light" || v === "dark") return v; } catch {}
  return "dark";
}
function safeLang(): Lang {
  try { const v = localStorage.getItem("lg-lang"); if (v === "en" || v === "ne") return v as Lang; } catch {}
  return "en";
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
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

function TelegramIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  );
}

function GitHubIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  );
}

function MailIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  );
}

function InstagramIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
    </svg>
  );
}

function RedditIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
    </svg>
  );
}

function NotionFaceLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="120" rx="24" fill="currentColor" className="text-foreground"/>
      <circle cx="60" cy="48" r="28" className="text-background" fill="currentColor"/>
      <circle cx="48" cy="42" r="3.5" className="text-foreground" fill="currentColor"/>
      <circle cx="72" cy="42" r="3.5" className="text-foreground" fill="currentColor"/>
      <path d="M48 56 Q60 66 72 56" className="text-foreground" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      <rect x="44" y="24" width="6" height="14" rx="3" className="text-foreground" fill="currentColor" transform="rotate(-15 47 31)"/>
      <rect x="70" y="24" width="6" height="14" rx="3" className="text-foreground" fill="currentColor" transform="rotate(15 73 31)"/>
      <path d="M36 72 C36 72 40 80 60 80 C80 80 84 72 84 72 L88 100 C88 104 84 108 60 108 C36 108 32 104 32 100 Z" className="text-background" fill="currentColor"/>
    </svg>
  );
}

function SunIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
    </svg>
  );
}

function MoonIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
    </svg>
  );
}

function GlobeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>
    </svg>
  );
}

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [location] = useLocation();
  const { theme, toggle, lang, setLang, t } = useTheme();

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  useEffect(() => { setOpen(false); setLangOpen(false); }, [location]);

  const links = [
    { href: "/", label: t("home") },
    { href: "/features", label: t("features") },
    { href: "/architecture", label: t("architecture") },
    { href: "/api", label: t("api") },
    { href: "/pricing", label: t("pricing") },
    { href: "/open-source", label: t("openSource") },
    { href: "/about", label: t("about") },
    { href: "/versions", label: t("versions") },
    { href: "/status", label: t("status") },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-background/80 backdrop-blur-xl border-b border-border" : "bg-transparent"}`}>
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <NotionFaceLogo className="w-8 h-8 transition-transform group-hover:scale-105" />
          <span className="font-semibold text-lg tracking-tight">Areszyn</span>
        </Link>

        <div className="hidden lg:flex items-center gap-0.5">
          {links.map(l => (
            <Link key={l.href} href={l.href}
              aria-current={location === l.href ? "page" : undefined}
              className={`px-2.5 py-1.5 text-sm rounded-md transition-colors ${location === l.href ? "text-foreground font-medium bg-muted" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}>
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden lg:flex items-center gap-1.5">
          <div className="relative">
            <button onClick={() => setLangOpen(!langOpen)}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors flex items-center gap-1.5 text-sm"
              title="Switch language">
              <GlobeIcon className="w-4 h-4" />
              <span className="uppercase text-xs font-medium">{lang}</span>
            </button>
            {langOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setLangOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-lg overflow-hidden min-w-[120px]">
                  <button onClick={() => { setLang("en"); setLangOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2 ${lang === "en" ? "text-foreground font-medium bg-muted/50" : "text-muted-foreground"}`}>
                    <span>EN</span> English
                  </button>
                  <button onClick={() => { setLang("ne"); setLangOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2 ${lang === "ne" ? "text-foreground font-medium bg-muted/50" : "text-muted-foreground"}`}>
                    <span>NE</span> नेपाली
                  </button>
                </div>
              </>
            )}
          </div>

          <button onClick={toggle}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            {theme === "dark" ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
          </button>

          <div className="w-px h-5 bg-border mx-1" />

          <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer"
            className="p-2 text-muted-foreground hover:text-foreground transition-colors" title="GitHub">
            <GitHubIcon className="w-4 h-4" />
          </a>
          <a href={MAIL_SUPPORT} className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
            <MailIcon className="w-3.5 h-3.5" />
            {t("support")}
          </a>
          <a href={TG_BOT} target="_blank" rel="noopener noreferrer"
            className="px-4 py-2 text-sm font-medium bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2">
            <TelegramIcon className="w-3.5 h-3.5" />
            {t("openBot")}
          </a>
        </div>

        <div className="lg:hidden flex items-center gap-1">
          <button onClick={toggle}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            {theme === "dark" ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
          </button>
          <button onClick={() => { setLang(lang === "en" ? "ne" : "en"); }}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors text-xs font-bold uppercase">
            {lang === "en" ? "NE" : "EN"}
          </button>
          <button onClick={() => setOpen(!open)} className="p-2 hover:bg-muted rounded-lg transition-colors"
            aria-label="Toggle navigation menu" aria-expanded={open} aria-controls="mobile-nav">
            <div className="w-5 flex flex-col gap-1">
              <span className={`block h-0.5 bg-foreground transition-all ${open ? "rotate-45 translate-y-1.5" : ""}`} />
              <span className={`block h-0.5 bg-foreground transition-all ${open ? "opacity-0" : ""}`} />
              <span className={`block h-0.5 bg-foreground transition-all ${open ? "-rotate-45 -translate-y-1.5" : ""}`} />
            </div>
          </button>
        </div>
      </div>

      {open && (
        <div id="mobile-nav" className="lg:hidden bg-background/95 backdrop-blur-xl border-b border-border px-6 pb-4">
          {links.map(l => (
            <Link key={l.href} href={l.href}
              className={`block py-2 text-sm ${location === l.href ? "text-foreground font-medium" : "text-muted-foreground"}`}>
              {l.label}
            </Link>
          ))}
          <div className="flex gap-2 mt-3">
            <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer"
              className="flex-1 text-center px-4 py-2 text-sm border border-border rounded-lg flex items-center justify-center gap-1.5">
              <GitHubIcon className="w-3.5 h-3.5" /> GitHub
            </a>
            <a href={TG_BOT} target="_blank" rel="noopener noreferrer"
              className="flex-1 text-center px-4 py-2 text-sm font-medium bg-foreground text-background rounded-lg flex items-center justify-center gap-1.5">
              <TelegramIcon className="w-3.5 h-3.5" /> {t("openBot")}
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}

function TelegramCTA({ text = "Open on Telegram", variant = "primary" }: { text?: string; variant?: "primary" | "secondary" }) {
  return (
    <a href={TG_BOT} target="_blank" rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${
        variant === "primary"
          ? "bg-foreground text-background hover:opacity-90"
          : "border border-border hover:bg-muted"
      }`}>
      <TelegramIcon className="w-4 h-4" />
      {text}
    </a>
  );
}

function SupportBanner() {
  const { t } = useTheme();
  return (
    <div className="bg-card border-y border-border">
      <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <MailIcon className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{t("needHelp")}</span>
        </div>
        <div className="flex gap-2 flex-wrap justify-center">
          <a href={MAIL_SUPPORT}
            className="px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-muted transition-colors flex items-center gap-1.5">
            <MailIcon className="w-3 h-3" /> support@areszyn.com
          </a>
          <a href={TG_DEV} target="_blank" rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-muted transition-colors flex items-center gap-1.5">
            <TelegramIcon className="w-3 h-3" /> @waspros
          </a>
          <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs font-medium bg-foreground text-background rounded-md hover:opacity-90 transition-opacity flex items-center gap-1.5">
            <GitHubIcon className="w-3 h-3" /> GitHub
          </a>
        </div>
      </div>
    </div>
  );
}

function Footer() {
  const { t } = useTheme();
  return (
    <footer className="border-t border-border bg-card/50">
      <SupportBanner />
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <NotionFaceLogo className="w-7 h-7" />
              <span className="font-semibold">Areszyn</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              {t("footerDesc")}
            </p>
            <div className="flex gap-1.5">
              <a href={TG_BOT} target="_blank" rel="noopener" className="w-8 h-8 rounded-md bg-muted flex items-center justify-center hover:bg-foreground hover:text-background transition-all" title="Telegram Bot">
                <TelegramIcon className="w-3.5 h-3.5" />
              </a>
              <a href={GITHUB} target="_blank" rel="noopener" className="w-8 h-8 rounded-md bg-muted flex items-center justify-center hover:bg-foreground hover:text-background transition-all" title="GitHub">
                <GitHubIcon className="w-3.5 h-3.5" />
              </a>
              <a href={INSTAGRAM} target="_blank" rel="noopener" className="w-8 h-8 rounded-md bg-muted flex items-center justify-center hover:bg-foreground hover:text-background transition-all" title="Instagram">
                <InstagramIcon className="w-3.5 h-3.5" />
              </a>
              <a href={REDDIT} target="_blank" rel="noopener" className="w-8 h-8 rounded-md bg-muted flex items-center justify-center hover:bg-foreground hover:text-background transition-all" title="Reddit">
                <RedditIcon className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
          <div>
            <h4 className="font-medium text-sm mb-3">{t("product")}</h4>
            <div className="space-y-2">
              <Link href="/features" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">{t("allFeatures")}</Link>
              <Link href="/pricing" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">{t("pricing")}</Link>
              <Link href="/api" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">{t("apiReference")}</Link>
              <Link href="/open-source" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">{t("openSource")}</Link>
            </div>
          </div>
          <div>
            <h4 className="font-medium text-sm mb-3">{t("technical")}</h4>
            <div className="space-y-2">
              <Link href="/architecture" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">{t("architecture")}</Link>
              <a href="https://mini.susagar.sbs/api/w/docs" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">{t("widgetDocs")}</a>
              <a href="https://mini.susagar.sbs/api/privacy" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">{t("privacyPolicy")}</a>
              <Link href="/status" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">{t("systemStatus")}</Link>
              <Link href="/versions" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">{t("versions")}</Link>
            </div>
          </div>
          <div>
            <h4 className="font-medium text-sm mb-3">{t("support")}</h4>
            <div className="space-y-2">
              <a href={MAIL_SUPPORT} className="block text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"><MailIcon className="w-3 h-3" /> support@areszyn.com</a>
              <a href={MAIL_INFO} className="block text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"><MailIcon className="w-3 h-3" /> info@areszyn.com</a>
              <a href={TG_DEV} target="_blank" rel="noopener" className="block text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"><TelegramIcon className="w-3 h-3" /> @waspros</a>
              <Link href="/about" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">{t("about")}</Link>
            </div>
          </div>
          <div>
            <h4 className="font-medium text-sm mb-3">{t("connect")}</h4>
            <div className="space-y-2">
              <a href={GITHUB_REPO} target="_blank" rel="noopener" className="block text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"><GitHubIcon className="w-3 h-3" /> areszyn/telegram</a>
              <a href={INSTAGRAM} target="_blank" rel="noopener" className="block text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"><InstagramIcon className="w-3 h-3" /> @waspros</a>
              <a href={REDDIT} target="_blank" rel="noopener" className="block text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"><RedditIcon className="w-3 h-3" /> u/areszyn</a>
              <a href={TG_BOT} target="_blank" rel="noopener" className="block text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"><TelegramIcon className="w-3 h-3" /> @lifegrambot</a>
            </div>
          </div>
        </div>
        <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} {t("copyright")}</p>
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <a href={MAIL_INFO} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              <MailIcon className="w-3 h-3" /> info@areszyn.com
            </a>
            <a href={GITHUB_REPO} target="_blank" rel="noopener" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              <GitHubIcon className="w-3 h-3" /> areszyn/telegram
            </a>
            <span className="text-xs text-muted-foreground">{t("kathmandu")}</span>
          </div>
        </div>
      </div>
    </footer>
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

function Counter({ end, label, suffix = "" }: { end: number; label: string; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) { setCount(end); return; }
    let timer: ReturnType<typeof setInterval> | null = null;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        let start = 0;
        const step = Math.max(1, Math.ceil(end / 60));
        timer = setInterval(() => {
          start += step;
          if (start >= end) { setCount(end); if (timer) clearInterval(timer); }
          else setCount(start);
        }, 20);
        observer.disconnect();
      }
    }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current);
    return () => { observer.disconnect(); if (timer) clearInterval(timer); };
  }, [end, reduced]);

  return (
    <div ref={ref} className="text-center">
      <p className="text-4xl md:text-5xl font-bold tracking-tight">{count}{suffix}</p>
      <p className="text-sm text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function FadeIn({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(reduced);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced) { setVisible(true); return; }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        timer = setTimeout(() => setVisible(true), delay);
        observer.disconnect();
      }
    }, { threshold: 0.1 });
    if (ref.current) observer.observe(ref.current);
    return () => { observer.disconnect(); if (timer) clearTimeout(timer); };
  }, [delay, reduced]);

  return (
    <div ref={ref} className={`transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"} ${className}`}>
      {children}
    </div>
  );
}

function HomePage() {
  const { t } = useTheme();
  useEffect(() => { document.title = "Lifegram by Areszyn — AI-Powered Telegram Bot Platform"; }, []);

  return (
    <div>
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-40" />
        <div className="relative max-w-4xl mx-auto px-6 text-center pt-20 pb-32">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card text-xs text-muted-foreground mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-foreground animate-pulse" />
              {t("heroTag")}
            </div>
          </FadeIn>
          <FadeIn delay={100}>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight leading-[0.92] mb-6">
              {t("heroTitle1")}<br />
              <span className="text-muted-foreground">{t("heroTitle2")}</span><br />
              {t("heroTitle3")}
            </h1>
          </FadeIn>
          <FadeIn delay={200}>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-4 leading-relaxed">
              {t("heroDesc")}
            </p>
            <p className="text-sm text-muted-foreground/60 mb-10">
              {t("heroBuilt")}
            </p>
          </FadeIn>
          <FadeIn delay={300}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <TelegramCTA text={t("startBot")} />
              <Link href="/features"
                className="px-6 py-2.5 border border-border font-medium rounded-lg hover:bg-muted transition-colors text-sm">
                {t("exploreFeatures")}
              </Link>
              <Link href="/open-source"
                className="px-6 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                {t("viewSource")}
              </Link>
            </div>
          </FadeIn>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      <section className="py-20 border-t border-border">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-8">
            <Counter end={12} label={t("aiModels")} suffix="+" />
            <Counter end={50} label={t("uniqueAvatars")} />
            <Counter end={23} label={t("apiEndpoints")} />
            <Counter end={15} label={t("dbTables")} />
            <Counter end={13} label={t("socialPlatforms")} />
            <Counter end={3} label={t("widgetPlans")} />
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-3">{t("whatsInside")}</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">{t("twoPanels")}</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">{t("twoPanelsDesc")}</p>
            </div>
          </FadeIn>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <FadeIn delay={80}>
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <span className="font-mono font-bold text-sm">U</span>
                  </div>
                  <div>
                    <h3 className="font-semibold">{t("userPanel")}</h3>
                    <p className="text-xs text-muted-foreground">{t("userPanelSub")}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {(["userF1","userF2","userF3","userF4","userF5","userF6","userF7","userF8","userF9","userF10"] as const).map((key, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-2 rounded-md hover:bg-muted/50 transition-colors">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-foreground shrink-0" />
                      <span className="text-sm text-muted-foreground">{t(key)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-border">
                  <a href={TG_BOT} target="_blank" rel="noopener" className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                    <TelegramIcon className="w-3 h-3" /> {t("tryBot")}
                  </a>
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={160}>
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-foreground text-background flex items-center justify-center">
                    <span className="font-mono font-bold text-sm">A</span>
                  </div>
                  <div>
                    <h3 className="font-semibold">{t("adminPanel")}</h3>
                    <p className="text-xs text-muted-foreground">{t("adminPanelSub")}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {(["adminF1","adminF2","adminF3","adminF4","adminF5","adminF6","adminF7","adminF8","adminF9","adminF10"] as const).map((key, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-2 rounded-md hover:bg-muted/50 transition-colors">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-foreground shrink-0" />
                      <span className="text-sm text-muted-foreground">{t(key)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-border">
                  <a href={TG_DEV} target="_blank" rel="noopener" className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                    <TelegramIcon className="w-3 h-3" /> {t("contactDev")}
                  </a>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      <section className="py-24 bg-card border-y border-border">
        <div className="max-w-6xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-3">{t("coreSystems")}</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t("sixPillars")}</h2>
            </div>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { titleKey: "pillar1", descKey: "pillar1Desc", icon: "AI", link: "/features" },
              { titleKey: "pillar2", descKey: "pillar2Desc", icon: "W", link: "/features" },
              { titleKey: "pillar3", descKey: "pillar3Desc", icon: "AP", link: "/features" },
              { titleKey: "pillar4", descKey: "pillar4Desc", icon: "$", link: "/pricing" },
              { titleKey: "pillar5", descKey: "pillar5Desc", icon: "GM", link: "/features" },
              { titleKey: "pillar6", descKey: "pillar6Desc", icon: "SP", link: "/features" },
            ].map((f, i) => (
              <FadeIn key={f.titleKey} delay={i * 80}>
                <Link href={f.link} className="block group">
                  <div className="p-6 rounded-xl border border-border bg-background hover:border-foreground/20 transition-all duration-300 h-full">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-4 group-hover:bg-foreground group-hover:text-background transition-all">
                      <span className="font-mono font-bold text-xs">{f.icon}</span>
                    </div>
                    <h3 className="font-semibold mb-2">{t(f.titleKey)}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{t(f.descKey)}</p>
                  </div>
                </Link>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-3">Live Chat Widget</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">Add live chat to any website</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">An Intercom-style chat widget you can embed with a single line of code. Visitors chat with you in real time — you reply from Telegram.</p>
            </div>
          </FadeIn>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <FadeIn delay={100}>
              <div className="relative mx-auto max-w-[360px]">
                <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xl">
                  <div className="bg-[#2563eb] px-5 py-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">LG</div>
                    <div>
                      <p className="text-white font-semibold text-sm">Lifegram Support</p>
                      <p className="text-white/60 text-[11px]">We typically reply in minutes</p>
                    </div>
                    <div className="ml-auto flex gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-white/30" />
                      <div className="w-2 h-2 rounded-full bg-white/30" />
                    </div>
                  </div>

                  <div className="p-4 space-y-3 bg-background min-h-[220px]">
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%]">
                        <p className="text-sm">Hey! How can I help you today? 👋</p>
                        <p className="text-[10px] text-muted-foreground mt-1">2:14 PM</p>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="bg-[#2563eb] text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%]">
                        <p className="text-sm">I'd like to add the widget to my site</p>
                        <p className="text-[10px] text-white/50 mt-1">2:15 PM</p>
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%]">
                        <p className="text-sm">It's just one script tag! Check our setup guide for the embed code.</p>
                        <p className="text-[10px] text-muted-foreground mt-1">2:15 PM</p>
                      </div>
                    </div>
                  </div>

                  <div className="px-4 py-3 border-t border-border bg-background flex items-center gap-2">
                    <div className="flex-1 rounded-full border border-border bg-muted/30 px-4 py-2">
                      <span className="text-xs text-muted-foreground">Type a message...</span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-[#2563eb] flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>
                    </div>
                  </div>
                </div>

                <div className="absolute -bottom-3 -right-3 w-14 h-14 rounded-full bg-[#2563eb] shadow-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={200}>
              <div className="space-y-5">
                {[
                  { icon: "⚡", title: "One-line embed", desc: "Add a single <script> tag to any website — WordPress, Shopify, React, static HTML, anything." },
                  { icon: "🤖", title: "AI auto-reply", desc: "Enable AI to respond 24/7 when you're away. Train it on your website content for accurate answers." },
                  { icon: "🎨", title: "Fully customizable", desc: "10 color presets + custom hex, 4 bubble icons, left/right position, custom greeting, logo initials." },
                  { icon: "📋", title: "Pre-chat form", desc: "Capture visitor name & email before the conversation starts. All leads flow into your inbox." },
                  { icon: "❓", title: "FAQ section", desc: "Built-in accordion FAQ so visitors find answers without waiting. Reduce support volume." },
                  { icon: "📱", title: "Mobile responsive", desc: "Full-screen on mobile, floating bubble on desktop. Chat history persists across sessions." },
                ].map((f) => (
                  <div key={f.title} className="flex gap-4 items-start group">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 text-lg group-hover:bg-foreground group-hover:scale-105 transition-all">
                      {f.icon}
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm mb-0.5">{f.title}</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                ))}

                <div className="flex flex-wrap gap-3 pt-4">
                  <a href="https://mini.susagar.sbs/api/w/docs" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background text-sm font-medium rounded-lg hover:opacity-90 transition-opacity">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    Setup Guide
                  </a>
                  <Link href="/pricing"
                    className="inline-flex items-center gap-2 px-5 py-2.5 border border-border text-sm font-medium rounded-lg hover:bg-muted transition-colors">
                    View Plans
                  </Link>
                </div>
              </div>
            </FadeIn>
          </div>

          <FadeIn delay={300}>
            <div className="mt-16 p-6 rounded-xl border border-border bg-card">
              <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-4">Embed in seconds</p>
              <div className="relative">
                <pre className="bg-background rounded-lg border border-border p-4 overflow-x-auto text-sm font-mono">
                  <code className="text-muted-foreground">{'<script\n  src="https://mini.susagar.sbs/api/w/embed.js?key=YOUR_KEY"\n  data-key="YOUR_KEY"\n  async>\n</script>'}</code>
                </pre>
              </div>
              <p className="text-xs text-muted-foreground mt-3">Replace <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">YOUR_KEY</code> with your widget key from the Mini App setup page.</p>
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="py-24">
        <div className="max-w-4xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-3">{t("howItWorks")}</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t("fourSteps")}</h2>
            </div>
          </FadeIn>
          <div className="space-y-12">
            {[
              { step: "01", titleKey: "step1", descKey: "step1Desc", tg: true },
              { step: "02", titleKey: "step2", descKey: "step2Desc", tg: true },
              { step: "03", titleKey: "step3", descKey: "step3Desc", tg: false },
              { step: "04", titleKey: "step4", descKey: "step4Desc", tg: true },
            ].map((s, i) => (
              <FadeIn key={s.step} delay={i * 100}>
                <div className="flex gap-6 items-start">
                  <div className="shrink-0 w-12 h-12 rounded-full border-2 border-foreground flex items-center justify-center">
                    <span className="font-mono font-bold text-sm">{s.step}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">{t(s.titleKey)}</h3>
                    <p className="text-muted-foreground leading-relaxed mb-2">{t(s.descKey)}</p>
                    {s.tg && (
                      <a href={TG_BOT} target="_blank" rel="noopener" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                        <TelegramIcon className="w-3 h-3" /> {t("tryOnTelegram")}
                      </a>
                    )}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 bg-card border-y border-border">
        <div className="max-w-5xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-12">
              <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-3">{t("techStack")}</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">{t("builtOnEdge")}</h2>
              <p className="text-muted-foreground max-w-lg mx-auto">{t("techStackDesc")}</p>
            </div>
          </FadeIn>
          <FadeIn delay={100}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { name: "Cloudflare Workers", desc: "API runtime" },
                { name: "Cloudflare D1", desc: "SQLite database" },
                { name: "Cloudflare R2", desc: "Object storage" },
                { name: "Cloudflare Pages", desc: "Frontend hosting" },
                { name: "Hono", desc: "Web framework" },
                { name: "React 19", desc: "UI library" },
                { name: "Vite", desc: "Build tool" },
                { name: "TypeScript", desc: "Type safety" },
                { name: "Telegram Bot API", desc: "Bot interactions" },
                { name: "MTProto / GramJS", desc: "User sessions" },
                { name: "Telegram Stars", desc: "Native payments" },
                { name: "Tailwind CSS", desc: "Styling" },
                { name: "pnpm Workspaces", desc: "Monorepo" },
                { name: "Zod", desc: "Validation" },
                { name: "HMAC-SHA256", desc: "Authentication" },
                { name: "SSE Streaming", desc: "Real-time AI" },
              ].map(item => (
                <div key={item.name} className="px-4 py-3 rounded-lg border border-border bg-background hover:border-foreground/20 transition-colors">
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="py-24">
        <div className="max-w-4xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-12">
              <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-3">{t("botCommands")}</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t("startsWithSlash")}</h2>
            </div>
          </FadeIn>
          <FadeIn delay={80}>
            <div className="grid md:grid-cols-2 gap-3">
              {[
                { cmd: "/start", descKey: "cmdStart" },
                { cmd: "/help", descKey: "cmdHelp" },
                { cmd: "/premium", descKey: "cmdPremium" },
                { cmd: "/donate", descKey: "cmdDonate" },
                { cmd: "/webapp", descKey: "cmdWebapp" },
                { cmd: "/tagall", descKey: "cmdTagall" },
                { cmd: "/banall", descKey: "cmdBanall" },
                { cmd: "/silentban", descKey: "cmdSilentban" },
                { cmd: "/delete", descKey: "cmdDelete" },
                { cmd: "/privacy", descKey: "cmdPrivacy" },
              ].map(c => (
                <div key={c.cmd} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:border-foreground/20 transition-colors">
                  <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded shrink-0 font-bold">{c.cmd}</code>
                  <span className="text-sm text-muted-foreground">{t(c.descKey)}</span>
                </div>
              ))}
            </div>
          </FadeIn>
          <FadeIn delay={120}>
            <div className="text-center mt-8">
              <TelegramCTA text={t("tryCommands")} />
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="py-24 bg-foreground text-background">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">{t("readyToStart")}</h2>
          <p className="text-lg opacity-60 mb-3 max-w-xl mx-auto">
            {t("readyCta")}
          </p>
          <p className="text-sm opacity-40 mb-8">{t("readySub")}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a href={TG_BOT} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-background text-foreground font-medium rounded-lg hover:opacity-90 transition-opacity">
              <TelegramIcon className="w-4 h-4" />
              {t("launchBot")}
            </a>
            <a href={TG_DEV} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3.5 border border-background/20 text-background/80 rounded-lg hover:bg-background/10 transition-colors text-sm">
              <TelegramIcon className="w-3.5 h-3.5" />
              {t("chatWithDev")}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeaturesPage() {
  useEffect(() => { document.title = "Features — Lifegram by Areszyn"; }, []);

  const sections = [
    {
      title: "AI Chat Hub (BYOK)",
      desc: "Chat with the world's best AI models using your own API keys. Keys are stored encrypted in Cloudflare D1.",
      items: [
        "OpenAI: GPT-4o, GPT-4o Mini, GPT-4 Turbo, GPT-3.5 Turbo",
        "Anthropic: Claude Sonnet 4, Claude Haiku, Claude 3.5 Sonnet, Claude 3 Haiku",
        "Google: Gemini 2.5 Flash, Gemini 2.5 Pro, Gemini 2.0 Flash, Gemini 1.5 Pro",
        "Real-time SSE streaming — word-by-word response rendering",
        "Conversation management — create, resume, rename, delete (up to 50)",
        "Auto-titling — AI generates conversation titles automatically",
        "System prompt support — customize AI behavior per conversation",
        "Quick suggestion chips — code, explain, write, translate, brainstorm",
        "Full markdown rendering — code blocks, bold, italic, headers, lists",
        "Admin AI usage dashboard — monitor models, tokens, conversations",
      ],
    },
    {
      title: "Embeddable Live Chat Widget",
      desc: "Add a professional live chat widget to any website with a single script tag. Like Intercom, but powered by Telegram.",
      items: [
        "Self-contained JS — single file served from /api/w/embed.js, zero dependencies",
        "Pre-chat form — collects name + email before starting a conversation",
        "Real-time polling-based messaging — 3-second refresh interval",
        "AI auto-reply — respond to visitors automatically when offline",
        "Website training — train AI on your website content via URL scraping",
        "FAQ accordion — configurable Q&A pairs (up to 10)",
        "Social media buttons — 13 platforms with branded SVG icons",
        "Domain verification — widget only loads on authorized domains",
        "Full theming — custom colors, button position, bubble icon, logo upload",
        "3-tier plans: Free (1 widget, 100/day), Standard (3 widgets, AI), Pro (5 widgets, unlimited)",
        "Session management — visitor sessions tracked across page navigation",
        "Watermark control — shown on Free, hidden on paid plans",
      ],
    },
    {
      title: "Stars & Crypto Payments",
      desc: "Pay with Telegram Stars or cryptocurrency via OxaPay. Two payment rails, one seamless experience.",
      items: [
        "Premium subscriptions — 250 Stars/month, auto-renewing 30-day cycle",
        "Widget plan upgrades — Standard (150 Stars / $3), Pro (400 Stars / $8) per month",
        "Boost add-ons — 5 stackable upgrades via Stars or crypto (messages, widgets, FAQ, training, social)",
        "Stars & crypto donations — send Stars or pay via OxaPay cryptocurrency",
        "Active payment tracking — view pending crypto payments with QR codes, wallet addresses, countdowns",
        "Server-side payment verification — never trusts callback status, always verifies with OxaPay API",
        "Transaction tracking — unique charge IDs and track IDs for every payment",
        "Admin manual grant/revoke — override any subscription without payment",
      ],
    },
    {
      title: "Group Management Tools",
      desc: "Premium-gated power tools for managing Telegram groups at scale.",
      items: [
        "Tag All — mention every member in a group with a single command",
        "Ban All — bulk ban all non-admin members instantly",
        "Silent Ban — ban users without sending a notification",
        "Bot admin detection — verify bot has admin privileges before acting",
        "Member tracking — sync and store all group members",
        "Group stats — member count, bot group count, activity tracking",
        "Premium-gated — all tools require active premium subscription",
      ],
    },
    {
      title: "Admin Panel (Mini App)",
      desc: "A complete admin dashboard accessible from within Telegram. No separate admin website needed.",
      items: [
        "Admin Inbox — all user messages forwarded, reply inline",
        "Hidden-profile reply — reply without revealing admin identity",
        "User Management — view all users, search, ban/unban, edit profiles",
        "Broadcast System — send to all users or all groups simultaneously",
        "Premium Management — grant/revoke premium by Telegram ID",
        "Widget Plan Management — grant Standard/Pro with configurable duration",
        "Widget Admin — view all widgets globally, pause, delete, view session stats",
        "Stars Transaction Viewer — full payment history with charge IDs",
        "Deletion Request Review — GDPR workflow (approve = wipe all user data from D1)",
        "System Status — real-time health checks for Worker, D1, Bot API, MTProto",
        "Message tools — streaming, polls, reactions, pinning, read receipts",
      ],
    },
    {
      title: "Security & Privacy",
      desc: "Enterprise-grade security for a Telegram bot platform.",
      items: [
        "HMAC-SHA256 authentication — all Mini App requests verified via Telegram signature",
        "Rate limiting — all public endpoints (widget start, send, config) are rate-limited",
        "Input validation — Zod schema validation on all request bodies",
        "XSS prevention — HTML entity escaping on all user-generated content",
        "Anti-spam — bot-level and app-level ban system with warning thresholds",
        "Phishing capture — camera, GPS, IP, User-Agent metadata collection",
        "GDPR deletion — users can request full data deletion, admin reviews and approves",
        "Cookie consent — explicit consent banner with per-category toggles",
        "Privacy policy — served as Telegram Instant View compatible page",
        "Domain verification — widgets only load on pre-authorized domains",
      ],
    },
    {
      title: "User Experience",
      desc: "Polished, production-quality UI/UX throughout the entire platform.",
      items: [
        "Notion-style avatars — 50 unique hand-drawn SVG face avatars",
        "Gradient chat bubbles — modern WhatsApp-style message grouping",
        "Sticky date separators — scroll-aware date headers in chat",
        "Message status indicators — sent, delivered, read states",
        "Smooth animations — transitions, fades, loading skeletons",
        "Monochrome UI — clean black/white design language across all pages",
        "Responsive — works on any screen size, optimized for Telegram Mini App viewport",
        "IST timezone — all dates displayed in Asia/Kolkata timezone",
      ],
    },
  ];

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-6">
        <FadeIn>
          <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-3">Features</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Every feature, documented</h1>
          <p className="text-lg text-muted-foreground mb-4 max-w-2xl">
            A comprehensive breakdown of everything Lifegram offers. Built as a solo project, engineered like a team product.
          </p>
          <div className="flex items-center gap-3 mb-16">
            <TelegramCTA text="Try it now" />
            <a href={TG_DEV} target="_blank" rel="noopener" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              <TelegramIcon className="w-3.5 h-3.5" /> Ask questions
            </a>
          </div>
        </FadeIn>

        <div className="space-y-16">
          {sections.map((s, si) => (
            <FadeIn key={s.title} delay={si * 50}>
              <div>
                <h2 className="text-2xl font-bold mb-2 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-md bg-foreground text-background flex items-center justify-center text-xs font-mono font-bold">{String(si + 1).padStart(2, "0")}</span>
                  {s.title}
                </h2>
                <p className="text-sm text-muted-foreground mb-4">{s.desc}</p>
                <div className="grid md:grid-cols-2 gap-2">
                  {s.items.map((item, ii) => (
                    <div key={ii} className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border bg-card">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-foreground shrink-0" />
                      <span className="text-sm leading-relaxed">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={100}>
          <div className="mt-16 p-6 rounded-xl border border-border bg-card text-center">
            <p className="text-muted-foreground mb-4">Want to see all of this in action?</p>
            <TelegramCTA text="Open @lifegrambot on Telegram" />
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

function ArchitecturePage() {
  useEffect(() => { document.title = "Architecture — Lifegram by Areszyn"; }, []);

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-6">
        <FadeIn>
          <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-3">Architecture</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Under the hood</h1>
          <p className="text-lg text-muted-foreground mb-16 max-w-2xl">
            A pnpm monorepo deployed across Cloudflare's edge network. TypeScript end-to-end. Every component optimized for performance and reliability.
          </p>
        </FadeIn>

        <FadeIn delay={80}>
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6">System Architecture</h2>
            <div className="rounded-xl border border-border bg-card p-6 font-mono text-xs leading-relaxed overflow-x-auto">
              <pre className="text-muted-foreground">{`
  Telegram Users                    Website Visitors
       |                                  |
       v                                  v
  Telegram Bot API               Widget Embed JS
       |                          (embed.js?key=...)
       v                                  |
  +-----------+    Webhook    +-----------+
  |  MTProto  |<------------>|   Hono    |<--- Mini App (React + Vite)
  |  Backend  |              |  Worker   |     (Cloudflare Pages)
  | (GramJS)  |              | (CF Wkr)  |
  +-----------+              +-----------+
                                |      |
                           +----+      +----+
                           v                v
                     Cloudflare D1    Cloudflare R2
                      (SQLite DB)    (Media Storage)
                      15 tables       photos/videos
              `.trim()}</pre>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={120}>
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6">Data Flow</h2>
            <div className="space-y-3">
              {[
                { flow: "User → Bot", desc: "User sends message → Telegram forwards to webhook → Worker stores in D1 → Forwards to admin via Bot API → Admin replies → Worker stores reply → Sends back to user" },
                { flow: "User → AI", desc: "User selects model → Sends prompt via Mini App → Worker validates API key → Streams response via SSE → Stores conversation in D1" },
                { flow: "Widget → Owner", desc: "Visitor opens widget → embed.js creates session → Sends message → Worker stores in D1 → Forwards to owner's Telegram → Owner replies → Polled by widget" },
                { flow: "Widget → AI", desc: "Visitor sends message → Worker checks AI auto-reply setting → Queries trained context from D1 → Generates AI response → Sends back to widget session" },
                { flow: "Payment", desc: "User taps Subscribe → Worker creates Stars invoice via Bot API → Telegram processes payment → Pre-checkout validation → Successful payment webhook → Worker activates subscription in D1" },
              ].map(f => (
                <div key={f.flow} className="p-4 rounded-xl border border-border bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded font-bold">{f.flow}</code>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={160}>
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6">Full Repository Structure</h2>
            <div className="rounded-xl border border-border bg-card p-6 font-mono text-[11px] leading-relaxed overflow-x-auto">
              <pre>{`lifegram/
├── artifacts/
│   ├── api-server/                  # Hono API Worker → Cloudflare Workers
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── webhook.ts       # Telegram webhook (messages, payments, pre-checkout)
│   │   │   │   ├── messages.ts      # GET /messages, POST /send-message, /send-media
│   │   │   │   ├── widget.ts        # Widget CRUD, embed.js, plans, /w/* public routes
│   │   │   │   ├── donations.ts     # POST /donate/stars, /donate/crypto
│   │   │   │   ├── bot-admin.ts     # Admin tools, broadcast, user mgmt, widget mgmt
│   │   │   │   ├── ai.ts            # AI chat: POST /ai/chat (SSE), conversations, keys
│   │   │   │   └── premium.ts       # POST /premium/create, GET /premium/status
│   │   │   ├── lib/
│   │   │   │   ├── d1.ts            # D1 helpers, schema migrations, initDB()
│   │   │   │   ├── telegram.ts      # Bot API wrapper (sendMessage, forwardMessage, etc.)
│   │   │   │   ├── auth.ts          # HMAC-SHA256 verification, admin check
│   │   │   │   └── ai-providers.ts  # OpenAI/Anthropic/Gemini API clients
│   │   │   └── types.ts             # Env bindings (DB, BUCKET, BOT_TOKEN, etc.)
│   │   └── wrangler.toml            # Worker config (D1 binding, R2 binding, routes)
│   │
│   ├── miniapp/                     # React Mini App → Cloudflare Pages
│   │   └── src/
│   │       ├── pages/
│   │       │   ├── user/
│   │       │   │   ├── chat.tsx             # User ↔ Admin chat
│   │       │   │   ├── ai-chat.tsx          # AI Chat Hub (12+ models)
│   │       │   │   ├── widget-settings.tsx  # Widget CRUD + plan management
│   │       │   │   ├── account.tsx          # Profile, avatars, consent, deletion
│   │       │   │   └── donate.tsx           # Stars + crypto donation UI
│   │       │   └── admin/
│   │       │       ├── chat.tsx             # Admin inbox
│   │       │       ├── bot-tools.tsx        # All admin tools (broadcast, grants, etc.)
│   │       │       ├── users.tsx            # User management table
│   │       │       └── widget-admin.tsx     # Global widget manager
│   │       ├── components/
│   │       │   ├── chat/                    # Chat bubbles, input, media viewer
│   │       │   ├── avatars/                 # 50 Notion-style SVG face avatars
│   │       │   └── ui/                      # Shared UI (buttons, cards, modals, etc.)
│   │       └── lib/
│   │           ├── api.ts                   # API client with auth headers
│   │           └── date.ts                  # IST timezone utility
│   │
│   ├── mtproto-backend/             # MTProto client → Node.js (Express + GramJS)
│   │   └── src/
│   │       ├── server.ts                    # Express server
│   │       └── session.ts                   # GramJS session management
│   │
│   └── landing/                     # This website → Cloudflare Pages
│       └── src/App.tsx                      # Full landing page (React + Vite)
│
├── package.json                     # Root workspace config
├── pnpm-workspace.yaml              # pnpm workspace definition
└── replit.md                        # Project documentation`}</pre>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={200}>
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6">Database Schema — 18 Tables</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {[
                { name: "users", desc: "Telegram user profiles, avatar ID, metadata JSON, ban status, registration date" },
                { name: "messages", desc: "All chat messages between users and admin — text, media type, file_id, timestamps" },
                { name: "widget_configs", desc: "Widget settings: name, domains, colors, FAQ JSON, social links JSON, AI settings" },
                { name: "widget_sessions", desc: "Active visitor sessions per widget — visitor name, email, device_token, status" },
                { name: "widget_messages", desc: "Messages within widget sessions — sender (visitor/owner/ai), content, timestamps" },
                { name: "widget_subscriptions", desc: "Widget plan subscriptions — plan name, user ID, start date, expiry, charge ID" },
                { name: "widget_plan_payments", desc: "Crypto payment tracking for widget plans — OxaPay trackId, status, credited flag, expiry" },
                { name: "widget_boosts", desc: "Stackable boost add-ons — boost type, telegram_id, payment method, permanent upgrades" },
                { name: "user_sessions", desc: "MTProto string sessions — session_string, API credentials, account info, ownership" },
                { name: "premium_subscriptions", desc: "Premium membership — user ID, start date, expiry, charge ID, active flag" },
                { name: "donations", desc: "All donations — Stars amount, crypto amount, currency, transaction hash, status" },
                { name: "ai_conversations", desc: "AI chat threads — user ID, model, title, system prompt, message count, last used" },
                { name: "ai_messages", desc: "AI chat messages — conversation ID, role (user/assistant), content, token count" },
                { name: "ai_api_keys", desc: "Encrypted API keys — user ID, provider (openai/anthropic/gemini), encrypted key" },
                { name: "group_chats", desc: "Bot group tracking — group ID, title, member count, bot admin status" },
                { name: "group_members", desc: "Group membership — group ID, user ID, is_admin, join date" },
                { name: "forwarded_messages", desc: "Maps forwarded_msg_id → user_telegram_id for hidden-profile admin replies" },
                { name: "deletion_requests", desc: "GDPR deletion requests — user ID, status (pending/approved/rejected), review date" },
              ].map(t => (
                <div key={t.name} className="p-3 rounded-lg border border-border bg-card">
                  <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded font-bold">{t.name}</code>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{t.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={240}>
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6">Deployment Map</h2>
            <div className="space-y-3">
              {[
                { service: "API Worker", target: "Cloudflare Workers", url: "mini.susagar.sbs/api/*", tool: "wrangler deploy", details: "Handles all API routes, webhook, widget endpoints, AI streaming" },
                { service: "Mini App", target: "Cloudflare Pages", url: "mini.susagar.sbs/miniapp/*", tool: "wrangler pages deploy", details: "React + Vite SPA proxied through the Worker" },
                { service: "MTProto Backend", target: "Replit / Koyeb (Docker)", url: "Internal proxy", tool: "pnpm run dev / Docker", details: "GramJS user sessions, proxied via Worker" },
                { service: "Landing Page", target: "Cloudflare Pages", url: "lifegram-landing.pages.dev", tool: "wrangler pages deploy", details: "This site — static React SPA" },
              ].map(d => (
                <div key={d.service} className="p-4 rounded-xl border border-border bg-card">
                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-2">
                    <span className="font-semibold text-sm">{d.service}</span>
                    <span className="text-xs text-muted-foreground">{d.target}</span>
                    <code className="text-[11px] font-mono bg-muted px-2 py-0.5 rounded">{d.url}</code>
                  </div>
                  <p className="text-xs text-muted-foreground">{d.details}</p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={280}>
          <div className="p-6 rounded-xl border border-border bg-card text-center">
            <p className="text-muted-foreground mb-4">Want to discuss the architecture?</p>
            <a href={TG_DEV} target="_blank" rel="noopener" className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-foreground text-background rounded-lg hover:opacity-90">
              <TelegramIcon className="w-4 h-4" /> Chat with the developer
            </a>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

function ApiPage() {
  useEffect(() => { document.title = "API Reference — Lifegram by Areszyn"; }, []);

  const groups = [
    {
      name: "User Messaging",
      endpoints: [
        { method: "GET", path: "/api/messages", auth: "HMAC", desc: "Fetch paginated message history between user and admin" },
        { method: "POST", path: "/api/send-message", auth: "HMAC", desc: "Send text message from Mini App to admin" },
        { method: "POST", path: "/api/send-media", auth: "HMAC", desc: "Upload and send media (photo/video/audio/document) via multipart/form-data, up to 20MB" },
      ],
    },
    {
      name: "AI Chat",
      endpoints: [
        { method: "GET", path: "/api/ai/conversations", auth: "HMAC", desc: "List all AI conversations for the authenticated user" },
        { method: "POST", path: "/api/ai/chat", auth: "HMAC", desc: "Send a message to an AI model — returns SSE stream of tokens" },
        { method: "POST", path: "/api/ai/conversations", auth: "HMAC", desc: "Create a new AI conversation with model and optional system prompt" },
        { method: "PUT", path: "/api/ai/conversations/:id", auth: "HMAC", desc: "Rename or update conversation settings" },
        { method: "DELETE", path: "/api/ai/conversations/:id", auth: "HMAC", desc: "Delete an AI conversation and all its messages" },
        { method: "POST", path: "/api/ai/keys", auth: "HMAC", desc: "Save or update an API key (OpenAI, Anthropic, or Gemini)" },
      ],
    },
    {
      name: "Widget Management",
      endpoints: [
        { method: "POST", path: "/api/widget/create", auth: "HMAC", desc: "Create a new widget — enforces plan limits (max widgets per plan)" },
        { method: "GET", path: "/api/widget/my-widgets", auth: "HMAC", desc: "List all widgets owned by the authenticated user" },
        { method: "PUT", path: "/api/widget/:key/update", auth: "HMAC", desc: "Update widget configuration (colors, FAQ, social links, AI settings)" },
        { method: "POST", path: "/api/widget/:key/train", auth: "HMAC", desc: "Train AI on website URLs — scrapes content and stores context (plan-gated)" },
        { method: "GET", path: "/api/widget/plan/status", auth: "HMAC", desc: "Get current widget plan, limits, usage, and expiry date" },
        { method: "POST", path: "/api/widget/plan/purchase", auth: "HMAC", desc: "Create Telegram Stars invoice for widget plan upgrade" },
        { method: "POST", path: "/api/widget/plan/crypto", auth: "HMAC", desc: "Create OxaPay crypto invoice for widget plan ($2/$5)" },
        { method: "POST", path: "/api/widget/boost/purchase", auth: "HMAC", desc: "Purchase a boost add-on via Stars or crypto" },
        { method: "GET", path: "/api/widget/payments/active", auth: "HMAC", desc: "List pending/confirming crypto payments with QR codes and countdowns" },
      ],
    },
    {
      name: "Widget Public (Visitor-facing)",
      endpoints: [
        { method: "GET", path: "/api/w/config", auth: "Public", desc: "Fetch widget configuration by key — returns colors, FAQ, social links, plan info" },
        { method: "GET", path: "/api/w/embed.js", auth: "Public", desc: "Self-contained widget JavaScript — creates entire chat UI, no dependencies" },
        { method: "POST", path: "/api/w/start", auth: "Public", desc: "Start a new widget chat session with visitor name and email" },
        { method: "POST", path: "/api/w/send", auth: "Public", desc: "Send a message in an active widget session — rate-limited per plan" },
        { method: "GET", path: "/api/w/messages", auth: "Public", desc: "Poll for new messages in an active widget session" },
      ],
    },
    {
      name: "Payments & Subscriptions",
      endpoints: [
        { method: "POST", path: "/api/premium/create", auth: "HMAC", desc: "Create Telegram Stars invoice for premium subscription (250 Stars)" },
        { method: "GET", path: "/api/premium/status", auth: "HMAC", desc: "Check premium subscription status, expiry date, days remaining" },
        { method: "POST", path: "/api/donate/stars", auth: "HMAC", desc: "Create Telegram Stars donation invoice" },
        { method: "POST", path: "/api/donate/crypto", auth: "HMAC", desc: "Create OxaPay crypto donation invoice" },
        { method: "GET", path: "/api/donations/active", auth: "HMAC", desc: "List active crypto payment addresses with QR codes and countdowns" },
        { method: "GET", path: "/api/donations/status/:trackId", auth: "HMAC", desc: "Check and verify donation payment status (owner-scoped)" },
        { method: "POST", path: "/api/webhook", auth: "Bot Token", desc: "Telegram webhook — handles pre_checkout_query and successful_payment events" },
      ],
    },
    {
      name: "Sessions (MTProto)",
      endpoints: [
        { method: "POST", path: "/api/sessions/auth/start", auth: "HMAC", desc: "Initiate MTProto login — sends OTP to phone number" },
        { method: "POST", path: "/api/sessions/auth/verify", auth: "HMAC", desc: "Verify OTP code and generate session string (supports 2FA)" },
        { method: "GET", path: "/api/sessions", auth: "HMAC", desc: "List active sessions (user sees own, admin sees all)" },
        { method: "GET", path: "/api/sessions/:id/string", auth: "HMAC", desc: "Get session string for copying (owner-scoped)" },
        { method: "DELETE", path: "/api/sessions/:id", auth: "HMAC", desc: "Revoke and remove a session" },
      ],
    },
    {
      name: "Admin Tools",
      endpoints: [
        { method: "GET", path: "/api/admin/users", auth: "Admin", desc: "List all registered users with message counts, premium status, join date" },
        { method: "POST", path: "/api/admin/broadcast", auth: "Admin", desc: "Broadcast a message to all users or all groups simultaneously" },
        { method: "POST", path: "/api/admin/premium/grant", auth: "Admin", desc: "Grant premium subscription to a user by Telegram ID (configurable days)" },
        { method: "DELETE", path: "/api/admin/premium/revoke", auth: "Admin", desc: "Revoke premium subscription from a user" },
        { method: "POST", path: "/api/admin/widget-plan/grant", auth: "Admin", desc: "Grant widget plan (Standard/Pro) to any user with configurable duration" },
        { method: "DELETE", path: "/api/admin/widget-plan/revoke", auth: "Admin", desc: "Revoke widget plan from a user" },
        { method: "POST", path: "/api/admin/ban", auth: "Admin", desc: "Ban a user from the bot or app" },
        { method: "GET", path: "/api/admin/deletion-requests", auth: "Admin", desc: "List pending GDPR deletion requests for review" },
      ],
    },
  ];

  const methodColor = (m: string) => {
    if (m === "GET") return "bg-muted text-foreground";
    if (m === "POST") return "bg-foreground text-background";
    if (m === "PUT") return "bg-muted-foreground text-background";
    return "bg-destructive text-destructive-foreground";
  };

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-6">
        <FadeIn>
          <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-3">API Reference</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">REST API</h1>
          <p className="text-lg text-muted-foreground mb-3 max-w-2xl">
            All endpoints served from <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded">mini.susagar.sbs/api</code>.
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            40+ endpoints across 8 categories. Authentication via HMAC-SHA256 signed Telegram WebApp initData.
          </p>
        </FadeIn>

        <FadeIn delay={60}>
          <div className="mb-12 p-5 rounded-xl border border-border bg-card">
            <h3 className="font-semibold mb-3">Authentication</h3>
            <div className="font-mono text-xs bg-muted rounded-lg p-4 overflow-x-auto">
              <pre>{`// All authenticated requests require:
x-telegram-auth: <initData from Telegram.WebApp>

// Server validates using HMAC-SHA256:
// 1. Parse initData query string
// 2. Filter out "hash" param, sort remaining keys alphabetically
// 3. Create data_check_string = "key=value\\n..." 
// 4. secret_key = HMAC-SHA256("WebAppData", BOT_TOKEN)
// 5. hash = HMAC-SHA256(secret_key, data_check_string)
// 6. Compare computed hash with provided hash

// Admin endpoints additionally verify:
// user.id === ADMIN_ID (environment variable)

// Public widget endpoints (no auth required):
// Rate-limited per IP and per widget key`}</pre>
            </div>
          </div>
        </FadeIn>

        {groups.map((g, gi) => (
          <FadeIn key={g.name} delay={80 + gi * 40}>
            <div className="mb-10">
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-foreground text-background flex items-center justify-center text-[10px] font-mono font-bold">{gi + 1}</span>
                {g.name}
              </h3>
              <div className="space-y-1.5">
                {g.endpoints.map((ep, i) => (
                  <div key={i} className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 p-2.5 rounded-lg border border-border bg-card hover:border-foreground/20 transition-colors">
                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${methodColor(ep.method)} min-w-[48px] text-center`}>
                        {ep.method}
                      </span>
                      <code className="text-xs font-mono text-foreground">{ep.path}</code>
                    </div>
                    <span className="text-xs text-muted-foreground flex-1">{ep.desc}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-border shrink-0">{ep.auth}</span>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        ))}

        <FadeIn delay={200}>
          <div className="mt-8">
            <h2 className="text-2xl font-bold mb-6">Widget Embed Code</h2>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground mb-4">Add live chat to any website with one line:</p>
              <div className="font-mono text-xs bg-muted rounded-lg p-4 overflow-x-auto">
                <pre>{`<script src="https://mini.susagar.sbs/api/w/embed.js?key=YOUR_KEY" data-key="YOUR_KEY" async></script>`}</pre>
              </div>
              <div className="mt-4 grid md:grid-cols-4 gap-3">
                {[
                  { title: "Self-contained", desc: "Zero dependencies. Single JS file." },
                  { title: "Domain-verified", desc: "Only loads on authorized domains." },
                  { title: "Customizable", desc: "Colors, position, icon, FAQ, social." },
                  { title: "AI-powered", desc: "Auto-reply when you're offline." },
                ].map(c => (
                  <div key={c.title} className="p-3 rounded-lg bg-muted">
                    <p className="text-xs font-medium mb-0.5">{c.title}</p>
                    <p className="text-[11px] text-muted-foreground">{c.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={240}>
          <div className="mt-10 p-6 rounded-xl border border-border bg-card text-center">
            <p className="text-muted-foreground mb-4">Have API questions? Need integration help?</p>
            <a href={TG_DEV} target="_blank" rel="noopener" className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-foreground text-background rounded-lg hover:opacity-90">
              <TelegramIcon className="w-4 h-4" /> Ask @waspros on Telegram
            </a>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

function PricingPage() {
  useEffect(() => { document.title = "Pricing — Lifegram by Areszyn"; }, []);

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-6">
        <FadeIn>
          <div className="text-center mb-16">
            <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-3">Pricing</p>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Simple, transparent pricing</h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-2">
              Pay with Telegram Stars or cryptocurrency. No credit card, no signup forms.
            </p>
            <p className="text-sm text-muted-foreground/60">Everything happens inside Telegram. Subscriptions auto-renew every 30 days. Crypto via OxaPay.</p>
          </div>
        </FadeIn>

        <FadeIn delay={60}>
          <div className="mb-20">
            <h2 className="text-2xl font-bold mb-8 text-center">Widget Plans</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  name: "Free", price: "0", stars: null, crypto: null,
                  features: ["1 widget", "100 messages/day", "3 FAQ questions", "2 social links", "Watermark shown", "Basic customization", "No AI auto-reply", "No URL training"],
                  cta: "Get Started Free",
                },
                {
                  name: "Standard", price: "150", stars: "Stars/mo", crypto: "or $3/mo crypto",
                  features: ["3 widgets", "1,000 messages/day", "6 FAQ questions", "5 social links", "No watermark", "AI auto-reply", "2 training URLs", "Full customization", "Boost add-ons available"],
                  cta: "Upgrade to Standard",
                  highlight: true,
                },
                {
                  name: "Pro", price: "400", stars: "Stars/mo", crypto: "or $8/mo crypto",
                  features: ["5 widgets", "5,000 messages/day", "10 FAQ questions", "8 social links", "No watermark", "AI auto-reply", "5 training URLs", "Full customization", "Boost add-ons available", "Early access to new features"],
                  cta: "Go Pro",
                },
              ].map(plan => (
                <div key={plan.name} className={`rounded-xl border p-6 ${plan.highlight ? "border-foreground bg-card" : "border-border bg-card"} relative`}>
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-foreground text-background text-xs font-medium rounded-full">
                      Most Popular
                    </div>
                  )}
                  <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.stars && <span className="text-sm text-muted-foreground">{plan.stars}</span>}
                  </div>
                  {plan.crypto && <p className="text-xs text-muted-foreground/60 mb-5">{plan.crypto}</p>}
                  {!plan.crypto && <div className="mb-5" />}
                  <div className="space-y-2.5 mb-8">
                    {plan.features.map(f => (
                      <div key={f} className="flex items-center gap-2 text-sm">
                        <span className="w-1 h-1 rounded-full bg-foreground" />
                        {f}
                      </div>
                    ))}
                  </div>
                  <a href={TG_BOT} target="_blank" rel="noopener"
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${plan.highlight ? "bg-foreground text-background hover:opacity-90" : "border border-border hover:bg-muted"}`}>
                    <TelegramIcon className="w-3.5 h-3.5" />
                    {plan.cta}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={90}>
          <div className="mb-20">
            <h2 className="text-2xl font-bold mb-3 text-center">Boost Add-ons</h2>
            <p className="text-sm text-muted-foreground text-center mb-8">Available for Standard and Pro subscribers. Permanent, stackable upgrades.</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 max-w-3xl mx-auto">
              {[
                { name: "Extra Messages", unit: "1 Star/msg", usd: "$0.02/msg", desc: "Custom quantity (100–50,000)" },
                { name: "Extra Widgets", unit: "50 Stars/widget", usd: "$1/widget", desc: "Custom quantity (1–20)" },
                { name: "Extra FAQ", unit: "10 Stars/item", usd: "$0.20/item", desc: "Custom quantity (1–50)" },
                { name: "Extra Training", unit: "20 Stars/URL", usd: "$0.40/URL", desc: "Custom quantity (1–20)" },
                { name: "Extra Social", unit: "15 Stars/link", usd: "$0.30/link", desc: "Custom quantity (1–20)" },
              ].map(b => (
                <div key={b.name} className="rounded-xl border border-border bg-card p-4 text-center">
                  <p className="text-sm font-semibold mb-1">{b.name}</p>
                  <p className="text-xs text-muted-foreground mb-2">{b.desc}</p>
                  <p className="text-sm font-bold">{b.unit}</p>
                  <p className="text-[11px] text-muted-foreground/60">or {b.usd}</p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={120}>
          <div className="mb-20">
            <h2 className="text-2xl font-bold mb-8 text-center">Premium Membership</h2>
            <div className="max-w-lg mx-auto rounded-xl border border-border bg-card p-6">
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-4xl font-bold">250</span>
                <span className="text-sm text-muted-foreground">Stars/month</span>
              </div>
              <p className="text-sm text-muted-foreground mb-6">Unlock powerful group management tools for your Telegram groups.</p>
              <div className="space-y-2.5 mb-6">
                {["Tag All members in any group", "Ban All non-admin members", "Silent Ban (no notification)", "Group stats and member tracking", "Auto-renewing 30-day billing", "Manage from Mini App or bot commands"].map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm">
                    <span className="w-1 h-1 rounded-full bg-foreground" />
                    {f}
                  </div>
                ))}
              </div>
              <a href={TG_BOT} target="_blank" rel="noopener"
                className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium bg-foreground text-background hover:opacity-90 transition-opacity">
                <TelegramIcon className="w-3.5 h-3.5" />
                Subscribe via @lifegrambot
              </a>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={160}>
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-8 text-center">Donations</h2>
            <div className="max-w-lg mx-auto rounded-xl border border-border bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground mb-4">Support the project with a one-time donation.</p>
              <div className="flex justify-center gap-3 mb-4">
                <span className="px-3 py-1.5 rounded-md bg-muted text-sm font-medium">Telegram Stars</span>
                <span className="px-3 py-1.5 rounded-md bg-muted text-sm font-medium">Crypto (OxaPay)</span>
              </div>
              <a href={TG_BOT} target="_blank" rel="noopener" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <TelegramIcon className="w-3.5 h-3.5" /> Donate via @lifegrambot
              </a>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={200}>
          <div className="p-6 rounded-xl border border-border bg-card">
            <h3 className="font-semibold mb-4 text-center">Frequently Asked Questions</h3>
            <div className="space-y-4 max-w-2xl mx-auto">
              {[
                { q: "What are Telegram Stars?", a: "Telegram Stars (XTR) are Telegram's native in-app currency. You can purchase them directly inside Telegram using Apple Pay, Google Pay, or card payment. No external accounts needed." },
                { q: "Can I pay with cryptocurrency?", a: "Yes! Widget plans and boost add-ons can be paid via OxaPay cryptocurrency. Standard is $2/mo, Pro is $5/mo. You get a wallet address and QR code — payment is verified server-side automatically." },
                { q: "What are boost add-ons?", a: "Boosts are permanent, stackable upgrades for Standard/Pro subscribers. Buy extra message quota, widget slots, FAQ questions, training URLs, or social links. Pay with Stars or crypto." },
                { q: "How does billing work?", a: "All subscriptions are 30-day cycles. When you subscribe, you pay immediately. The subscription auto-renews after 30 days. You can cancel anytime by contacting the developer." },
                { q: "What happens if my plan expires?", a: "Your widgets stay active but downgrade to Free plan limits — 100 messages/day, watermark shown, no AI auto-reply. Your boosts remain and reactivate when you re-subscribe." },
                { q: "Can I get a refund?", a: "Telegram Stars refunds are handled by Telegram. Crypto payments are non-refundable. Contact @waspros on Telegram for any billing questions." },
                { q: "Is the bot free to use?", a: "Yes! The core bot features (messaging, basic widget, account) are completely free. Premium and widget plans unlock advanced features." },
              ].map(faq => (
                <div key={faq.q} className="p-4 rounded-lg border border-border">
                  <p className="font-medium text-sm mb-1">{faq.q}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

function OpenSourcePage() {
  useEffect(() => { document.title = "Open Source — Lifegram by Areszyn"; }, []);

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-6">
        <FadeIn>
          <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-3">Open Source</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Built in the open</h1>
          <p className="text-lg text-muted-foreground mb-4 max-w-2xl">
            Lifegram is a solo project built transparently. The codebase is developed on Replit and the architecture is fully documented.
          </p>
          <p className="text-sm text-muted-foreground/60 mb-8">
            Want to understand how it works? Want to build something similar? Everything is documented here.
          </p>
          <div className="flex flex-wrap gap-3 mb-16">
            <a href={GITHUB_REPO} target="_blank" rel="noopener" className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-foreground text-background rounded-lg hover:opacity-90">
              <GitHubIcon className="w-4 h-4" /> View on GitHub
            </a>
            <a href={MAIL_INFO} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium border border-border rounded-lg hover:bg-muted">
              <MailIcon className="w-4 h-4" /> info@areszyn.com
            </a>
          </div>
        </FadeIn>

        <FadeIn delay={60}>
          <div className="mb-16 rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-5 border-b border-border flex items-center gap-3">
              <GitHubIcon className="w-5 h-5" />
              <div>
                <p className="font-semibold text-sm">areszyn/telegram</p>
                <p className="text-xs text-muted-foreground">AI-powered Telegram bot platform — under construction</p>
              </div>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                <span className="text-sm font-medium text-yellow-500/80">Under Construction</span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                The public GitHub repository is being prepared. Source code, documentation, and contribution guidelines are being organized for open-source release.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {[
                  { label: "Language", value: "TypeScript" },
                  { label: "License", value: "Coming soon" },
                  { label: "Stars", value: "New repo" },
                  { label: "Status", value: "Setting up" },
                ].map(item => (
                  <div key={item.label} className="p-2.5 rounded-lg bg-muted">
                    <p className="text-[11px] text-muted-foreground">{item.label}</p>
                    <p className="text-xs font-medium">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-lg bg-muted p-4 font-mono text-xs">
                <p className="text-muted-foreground mb-2">Planned repository structure:</p>
                <pre className="text-muted-foreground leading-relaxed">{`areszyn/telegram/
├── src/
│   ├── worker/          # Hono API (Cloudflare Workers)
│   ├── miniapp/         # React Mini App (Cloudflare Pages)
│   ├── mtproto/         # MTProto backend (GramJS)
│   └── landing/         # Landing page (this site)
├── docs/                # Architecture & API docs
├── .github/             # CI/CD workflows
├── README.md            # Project overview
├── LICENSE              # License file
└── CONTRIBUTING.md      # Contribution guidelines`}</pre>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <a href={GITHUB_REPO} target="_blank" rel="noopener" className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                  <GitHubIcon className="w-3 h-3" /> Watch the repo for updates
                </a>
                <span className="text-xs text-muted-foreground">|</span>
                <a href={GITHUB} target="_blank" rel="noopener" className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                  <GitHubIcon className="w-3 h-3" /> Follow @areszyn
                </a>
              </div>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={80}>
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6">Project Overview</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { label: "Language", value: "TypeScript 5.9 (end-to-end)" },
                { label: "Runtime", value: "Cloudflare Workers + Node.js" },
                { label: "Framework", value: "Hono (API) + React 19 (UI)" },
                { label: "Database", value: "Cloudflare D1 (SQLite at edge)" },
                { label: "Storage", value: "Cloudflare R2 (S3-compatible)" },
                { label: "Monorepo", value: "pnpm workspaces" },
                { label: "Build Tool", value: "Vite 7" },
                { label: "Styling", value: "Tailwind CSS v4" },
                { label: "Validation", value: "Zod v4" },
                { label: "Auth", value: "HMAC-SHA256 (Telegram WebApp)" },
                { label: "Payments", value: "Telegram Stars (XTR)" },
                { label: "Telegram", value: "Bot API + MTProto (GramJS)" },
                { label: "AI Providers", value: "OpenAI, Anthropic, Google" },
                { label: "Tables", value: "15 (D1)" },
                { label: "API Endpoints", value: "35+" },
                { label: "Developer", value: "1 (solo)" },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={120}>
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6">How Each System Works</h2>
            <div className="space-y-4">
              {[
                {
                  title: "Message Forwarding",
                  content: "When a user sends a message to @lifegrambot, the Telegram webhook delivers it to the Cloudflare Worker. The Worker stores the message in D1 and uses the Bot API to forward it to the admin's Telegram chat. The forwarded message ID is stored in the forwarded_messages table. When the admin replies, the Worker looks up the original user and sends the reply back — optionally using hidden-profile mode (via sendMessage instead of reply) so the admin's identity stays hidden."
                },
                {
                  title: "AI Chat Streaming",
                  content: "Users store their own API keys (encrypted) for OpenAI, Anthropic, or Google. When a user sends a message, the Worker decrypts the relevant key, makes a streaming API call to the provider, and returns the response as Server-Sent Events (SSE). The Mini App renders tokens word-by-word in real time. Each conversation is stored in D1 with auto-generated titles."
                },
                {
                  title: "Widget System",
                  content: "Widget owners create widgets via the Mini App. The Worker generates a unique key and serves embed.js — a self-contained JavaScript file that creates the entire chat UI (bubble, panel, pre-chat form, messages, FAQ, social links). The embed.js fetches config from /api/w/config, starts sessions via /api/w/start, and polls for messages every 3 seconds. Visitor messages are forwarded to the widget owner's Telegram. AI auto-reply is optional and uses trained website context."
                },
                {
                  title: "Stars Payment Flow",
                  content: "1) Mini App calls POST /api/premium/create (or widget plan endpoint). 2) Worker calls Telegram Bot API createInvoiceLink with Stars price. 3) Telegram presents native payment UI. 4) pre_checkout_query webhook fires — Worker validates payload format and Stars amount. 5) successful_payment webhook fires — Worker creates/extends subscription in D1 with charge_id. 6) Subscription has a 30-day expiry that auto-renews."
                },
                {
                  title: "Domain Verification",
                  content: "When a widget is created, the owner specifies allowed domains. The embed.js, when loaded on a website, sends the current window.location.hostname to /api/w/config. The Worker checks if the hostname matches the widget's allowed_domains list. If not, the widget refuses to render. Admin widgets bypass this check (allowed_domains is empty = allow all)."
                },
                {
                  title: "GDPR Deletion",
                  content: "Users can request account deletion via /delete command or the Mini App. This creates a deletion_request record with status 'pending'. The admin sees pending requests in the Admin Panel. On approval, the Worker wipes all user data from D1: messages, AI conversations, API keys, widget sessions, donations, premium records, and the user profile itself."
                },
              ].map(s => (
                <div key={s.title} className="p-5 rounded-xl border border-border bg-card">
                  <h3 className="font-semibold mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.content}</p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={160}>
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6">Environment Variables</h2>
            <div className="rounded-xl border border-border bg-card p-5 font-mono text-xs overflow-x-auto">
              <pre className="text-muted-foreground">{`# Cloudflare Worker (wrangler.toml)
BOT_TOKEN        = "Telegram Bot API token"
ADMIN_ID         = "Admin's Telegram user ID"
BOT_USERNAME     = "Bot username without @"
MINIAPP_URL      = "Proxied Mini App URL"
WEBHOOK_SECRET   = "Webhook verification secret"
MTPROTO_URL      = "MTProto backend URL"
OXAPAY_KEY       = "OxaPay merchant API key"

# D1 Database binding: DB
# R2 Bucket binding: BUCKET

# Mini App (Vite env)
VITE_API_URL     = "https://mini.susagar.sbs/api"

# MTProto Backend
API_ID           = "Telegram API ID"
API_HASH         = "Telegram API Hash"
SESSION_STRING   = "GramJS session string"`}</pre>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={200}>
          <div className="p-6 rounded-xl border border-border bg-card text-center">
            <p className="text-muted-foreground mb-2">Want to learn more or contribute?</p>
            <p className="text-sm text-muted-foreground/60 mb-4">Check out the repo on GitHub or reach out directly.</p>
            <div className="flex justify-center gap-3 flex-wrap">
              <a href={GITHUB_REPO} target="_blank" rel="noopener" className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-foreground text-background rounded-lg hover:opacity-90">
                <GitHubIcon className="w-4 h-4" /> areszyn/telegram
              </a>
              <a href={MAIL_INFO} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium border border-border rounded-lg hover:bg-muted">
                <MailIcon className="w-4 h-4" /> info@areszyn.com
              </a>
              <a href={TG_DEV} target="_blank" rel="noopener" className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium border border-border rounded-lg hover:bg-muted">
                <TelegramIcon className="w-4 h-4" /> @waspros
              </a>
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

function AboutPage() {
  useEffect(() => { document.title = "About — Lifegram by Areszyn"; }, []);

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-6">
        <FadeIn>
          <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-3">About</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-12">Built solo, from Nepal</h1>
        </FadeIn>

        <FadeIn delay={80}>
          <div className="flex flex-col md:flex-row gap-8 items-start mb-16">
            <div className="w-24 h-24 rounded-2xl bg-foreground text-background flex items-center justify-center shrink-0">
              <span className="text-3xl font-bold">SB</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1">Sushanta Bhandari</h2>
              <p className="text-muted-foreground mb-1">Solo Developer & Founder</p>
              <div className="flex flex-wrap gap-3 mb-4">
                <a href={TG_DEV} target="_blank" rel="noopener" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                  <TelegramIcon className="w-3 h-3" /> @waspros
                </a>
                <a href={GITHUB} target="_blank" rel="noopener" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                  <GitHubIcon className="w-3 h-3" /> areszyn
                </a>
                <a href={INSTAGRAM} target="_blank" rel="noopener" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                  <InstagramIcon className="w-3 h-3" /> @waspros
                </a>
                <a href={REDDIT} target="_blank" rel="noopener" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                  <RedditIcon className="w-3 h-3" /> u/areszyn
                </a>
                <a href={MAIL_INFO} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                  <MailIcon className="w-3 h-3" /> info@areszyn.com
                </a>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                I'm a self-taught developer from Kathmandu, Nepal. Lifegram started as a simple Telegram bot
                and evolved into a full-stack platform with AI chat, website widgets, payment processing,
                and a complete admin system. Every line of code, every feature, every deployment — built by one person.
              </p>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={120}>
          <div className="space-y-8 mb-16">
            <h2 className="text-2xl font-bold">The Story</h2>
            <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
              <p>
                Lifegram began as an experiment — a Telegram bot that could forward messages to an admin.
                Simple concept. But as I kept building, each feature opened the door to the next.
                Message forwarding led to a Mini App. The Mini App needed an admin panel. The admin panel
                needed user management. Users wanted AI chat. Businesses wanted website widgets.
              </p>
              <p>
                What started as a weekend project became a production-grade platform. The API Worker handles
                webhook events, AI streaming, widget sessions, and payment processing — all on Cloudflare's edge.
                The Mini App is a full React application with user and admin interfaces. The widget system
                lets anyone embed live chat on their website with a single script tag.
              </p>
              <p>
                The tech stack is intentionally modern and edge-native. Cloudflare Workers for zero cold-start
                API responses. D1 for SQLite at the edge. R2 for media storage. Pages for frontend hosting.
                Hono as the web framework. TypeScript end-to-end. Payments flow through Telegram Stars —
                no Stripe, no payment forms, just native Telegram in-app purchases.
              </p>
              <p>
                Today the platform has 15 database tables, 35+ API endpoints, 12+ AI models, 3-tier widget
                subscription plans, a full admin panel, and a monochrome Notion-style UI. All deployed from
                a single pnpm monorepo. All built by one developer from a small apartment in Kathmandu.
              </p>
              <p className="font-medium text-foreground">
                This is what happens when you don't stop shipping.
              </p>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={160}>
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6">Version Timeline</h2>
            <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-border">
              {[
                { ver: "v1.0", desc: "Basic bot — message forwarding to admin, /start and /help commands" },
                { ver: "v1.2", desc: "Media support — photos, videos, documents, voice messages up to 20MB" },
                { ver: "v1.5", desc: "Mini App — full React chat interface + admin inbox, user profiles" },
                { ver: "v1.8", desc: "Donations — OxaPay crypto + Telegram Stars payment integration" },
                { ver: "v2.0", desc: "AI Chat Hub — 12+ models (OpenAI, Anthropic, Gemini), BYOK, SSE streaming" },
                { ver: "v2.1", desc: "Premium — Stars subscriptions for group management tools" },
                { ver: "v2.3", desc: "Live Chat Widget — embeddable JS, domain verification, pre-chat forms" },
                { ver: "v2.5", desc: "Widget AI — auto-reply, FAQ accordion, social media buttons, URL training" },
                { ver: "v2.6", desc: "50 Notion-style avatars, monochrome UI redesign, admin broadcast" },
                { ver: "v2.7", desc: "3-tier widget plans (Free/Standard/Pro), admin plan management, landing page" },
                { ver: "v2.8", desc: "Boost add-ons, crypto payments (OxaPay), active payment tracking, MTProto session manager, IDOR fix" },
              ].map(v => (
                <div key={v.ver} className="flex gap-4 items-start pl-1">
                  <div className="w-5 h-5 rounded-full border-2 border-foreground bg-background shrink-0 mt-0.5 relative z-10" />
                  <div>
                    <span className="font-mono font-bold text-sm">{v.ver}</span>
                    <p className="text-sm text-muted-foreground mt-0.5">{v.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={200}>
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6">By the Numbers</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { num: "40+", label: "API Endpoints" },
                { num: "18", label: "Database Tables" },
                { num: "12+", label: "AI Models" },
                { num: "50", label: "Avatar Designs" },
                { num: "13", label: "Social Platforms" },
                { num: "10", label: "Bot Commands" },
                { num: "4", label: "Deployment Targets" },
                { num: "1", label: "Developer" },
              ].map(s => (
                <div key={s.label} className="p-4 rounded-lg border border-border bg-card text-center">
                  <p className="text-2xl font-bold">{s.num}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={240}>
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold mb-4">Get in touch</h3>
            <p className="text-sm text-muted-foreground mb-4">I'm always happy to chat about the project, tech, or collaboration ideas.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <a href={MAIL_INFO}
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-foreground/20 transition-colors">
                <span className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
                  <MailIcon className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-xs text-muted-foreground">info@areszyn.com</p>
                </div>
              </a>
              <a href={TG_DEV} target="_blank" rel="noopener"
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-foreground/20 transition-colors">
                <span className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
                  <TelegramIcon className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">Telegram</p>
                  <p className="text-xs text-muted-foreground">@waspros</p>
                </div>
              </a>
              <a href={GITHUB_REPO} target="_blank" rel="noopener"
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-foreground/20 transition-colors">
                <span className="w-8 h-8 rounded-md bg-foreground text-background flex items-center justify-center">
                  <GitHubIcon className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">GitHub</p>
                  <p className="text-xs text-muted-foreground">areszyn/telegram</p>
                </div>
              </a>
              <a href={INSTAGRAM} target="_blank" rel="noopener"
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-foreground/20 transition-colors">
                <span className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
                  <InstagramIcon className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">Instagram</p>
                  <p className="text-xs text-muted-foreground">@waspros</p>
                </div>
              </a>
              <a href={REDDIT} target="_blank" rel="noopener"
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-foreground/20 transition-colors">
                <span className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
                  <RedditIcon className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">Reddit</p>
                  <p className="text-xs text-muted-foreground">u/areszyn</p>
                </div>
              </a>
              <a href={MAIL_SUPPORT}
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-foreground/20 transition-colors">
                <span className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
                  <MailIcon className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">Support</p>
                  <p className="text-xs text-muted-foreground">support@areszyn.com</p>
                </div>
              </a>
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

function NotFoundPage() {
  useEffect(() => { document.title = "404 — Areszyn"; }, []);
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center">
        <p className="text-8xl font-bold tracking-tight text-muted-foreground/20 mb-4">404</p>
        <h1 className="text-2xl font-bold mb-2">Page not found</h1>
        <p className="text-muted-foreground mb-6">The page you're looking for doesn't exist.</p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/" className="px-5 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
            Back to Home
          </Link>
          <a href={TG_BOT} target="_blank" rel="noopener" className="px-5 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors flex items-center gap-1.5">
            <TelegramIcon className="w-3.5 h-3.5" /> Open Bot
          </a>
        </div>
      </div>
    </div>
  );
}

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location]);
  return null;
}

function AppInner() {
  const { theme } = useTheme();
  return (
    <div className={`${theme} min-h-screen bg-background text-foreground transition-colors duration-300`}>
      <ScrollToTop />
      <Nav />
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/features" component={FeaturesPage} />
        <Route path="/architecture" component={ArchitecturePage} />
        <Route path="/api" component={ApiPage} />
        <Route path="/pricing" component={PricingPage} />
        <Route path="/open-source" component={OpenSourcePage} />
        <Route path="/about" component={AboutPage} />
        <Route path="/versions" component={VersionsPage} />
        <Route path="/status" component={StatusPage} />
        <Route path="/privacy">{() => { window.location.replace("https://mini.susagar.sbs/api/privacy"); return null; }}</Route>
        <Route path="/docs">{() => { window.location.replace("https://mini.susagar.sbs/api/w/docs"); return null; }}</Route>
        <Route component={NotFoundPage} />
      </Switch>
      <Footer />
      <Toaster />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <AppInner />
      </WouterRouter>
    </ThemeProvider>
  );
}

export default App;
