/* ============================================================
   RELAX TIME TRADING - Main JS
   Ticker tape, animated background (candles/particles), sticky
   header, mobile nav, scroll-reveal, animated counters, FAQ
   accordion, active-link highlighting, back-to-top, contact form.
   ============================================================ */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isArabic = (document.documentElement.lang || "").toLowerCase().indexOf("ar") === 0;

  /* ---------------- footer year ---------------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------------- ticker tape (real live market data) ----------------
     Data sources (all free, keyless, CORS-enabled, called directly from
     the visitor's browser since this is a static site with no backend):
       - Crypto (BTC, ETH): CoinGecko /simple/price
       - Gold   (XAU/USD):  goldprice.dev /v1/prices
       - Forex  (EUR, GBP, JPY vs USD): Frankfurter.dev (ECB rates)
     Forex data from free ECB-based sources only updates once per business
     day, it is genuinely real but not intraday, so those items are marked
     with a small "REF" badge and a tooltip rather than the live dot.
     If a fetch fails (offline, ad-blocker, rate limit), the ticker simply
     keeps showing the last good value instead of guessing. */
  var symbols = [
    { sym: "XAU/USD", price: 2378.42, kind: "gold" },
    { sym: "EUR/USD", price: 1.0842, kind: "forex" },
    { sym: "GBP/USD", price: 1.2695, kind: "forex" },
    { sym: "BTC/USD", price: 67240, kind: "crypto", cgId: "bitcoin" },
    { sym: "ETH/USD", price: 3412, kind: "crypto", cgId: "ethereum" },
    { sym: "USD/JPY", price: 149.32, kind: "forex" }
  ];

  function fmt(sym, val) {
    if (sym === "BTC/USD" || sym === "ETH/USD") return val.toLocaleString("en-US", { maximumFractionDigits: 0 });
    if (sym === "XAU/USD") return val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return val.toFixed(4);
  }

  function buildGroup() {
    var frag = document.createDocumentFragment();
    symbols.forEach(function (s) {
      var item = document.createElement("span");
      item.className = "ticker__item";
      item.setAttribute("data-symbol", s.sym);
      item.setAttribute("data-dir", "up");
      item.setAttribute("data-kind", s.kind);
      var badge = s.kind === "forex"
        ? '<span class="ticker__tag" title="Daily reference rate (ECB), not real-time">REF</span>'
        : '<span class="ticker__dot" title="Live price" aria-hidden="true"></span>';
      item.innerHTML =
        badge +
        '<span class="sym">' + s.sym + '</span>' +
        '<span class="price">' + fmt(s.sym, s.price) + '</span>' +
        '<span class="arrow">&#9650;</span>';
      frag.appendChild(item);
    });
    return frag;
  }

  var track = document.getElementById("tickerTrack");
  if (track) {
    track.appendChild(buildGroup());
    track.appendChild(buildGroup());

    var applyPrice = function (s, newPrice) {
      if (typeof newPrice !== "number" || !isFinite(newPrice) || newPrice <= 0) return;
      var dir = newPrice >= s.price ? "up" : "down";
      s.price = newPrice;
      var nodes = track.querySelectorAll('[data-symbol="' + s.sym.replace("/", "\\/") + '"]');
      nodes.forEach(function (n) {
        n.setAttribute("data-dir", dir);
        var priceEl = n.querySelector(".price");
        var arrowEl = n.querySelector(".arrow");
        if (priceEl) priceEl.textContent = fmt(s.sym, s.price);
        if (arrowEl) arrowEl.innerHTML = dir === "up" ? "&#9650;" : "&#9660;";
      });
    };

    var fetchJSON = function (url) {
      return fetch(url, { cache: "no-store" }).then(function (res) {
        if (!res.ok) throw new Error("bad response " + res.status + " from " + url);
        return res.json();
      });
    };

    /* crypto: CoinGecko simple price, e.g. {"bitcoin":{"usd":67240},"ethereum":{"usd":3412}} */
    var fetchCrypto = function () {
      var ids = symbols.filter(function (s) { return s.kind === "crypto"; }).map(function (s) { return s.cgId; });
      if (!ids.length) return;
      fetchJSON("https://api.coingecko.com/api/v3/simple/price?ids=" + ids.join(",") + "&vs_currencies=usd")
        .then(function (data) {
          symbols.forEach(function (s) {
            if (s.kind === "crypto" && data && data[s.cgId] && typeof data[s.cgId].usd === "number") {
              applyPrice(s, data[s.cgId].usd);
            }
          });
        })
        .catch(function (err) { console.warn("Live crypto price update failed, keeping last known value:", err); });
    };

    /* gold: goldprice.dev spot price, keyless, response includes a "price" field */
    var fetchGold = function () {
      var goldItem = symbols.filter(function (s) { return s.kind === "gold"; })[0];
      if (!goldItem) return;
      fetchJSON("https://api.goldprice.dev/v1/prices?symbol=XAU-USD-SPOT")
        .then(function (data) {
          var val = data && (data.price || data.ask || data.bid ||
            (data.data && (data.data.price || data.data.ask)));
          if (typeof val === "number") applyPrice(goldItem, val);
        })
        .catch(function (err) { console.warn("Live gold price update failed, keeping last known value:", err); });
    };

    /* forex: Frankfurter.dev daily ECB reference rates, base USD.
       rates.EUR/rates.GBP are USD->EUR/GBP, so invert for EUR/USD & GBP/USD.
       rates.JPY is already USD->JPY, matching the USD/JPY quote convention. */
    var fetchForex = function () {
      fetchJSON("https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,GBP,JPY")
        .then(function (data) {
          if (!data || !data.rates) return;
          symbols.forEach(function (s) {
            if (s.sym === "EUR/USD" && typeof data.rates.EUR === "number") applyPrice(s, 1 / data.rates.EUR);
            if (s.sym === "GBP/USD" && typeof data.rates.GBP === "number") applyPrice(s, 1 / data.rates.GBP);
            if (s.sym === "USD/JPY" && typeof data.rates.JPY === "number") applyPrice(s, data.rates.JPY);
          });
        })
        .catch(function (err) { console.warn("Forex reference rate update failed, keeping last known value:", err); });
    };

    /* price updates are real data, not decorative motion, so these run
       regardless of prefers-reduced-motion (only the scrolling marquee
       animation itself is disabled for that, via CSS). */
    fetchCrypto();
    fetchGold();
    fetchForex();
    setInterval(fetchCrypto, 45000);
    setInterval(fetchGold, 60000);
    setInterval(fetchForex, 60 * 60 * 1000);
  }

  /* ---------------- floating candles ---------------- */
  var candleField = document.getElementById("candleField");
  if (candleField && !reduceMotion) {
    var candleCount = window.innerWidth < 640 ? 7 : 14;
    for (var i = 0; i < candleCount; i++) {
      var c = document.createElement("div");
      c.className = "candle" + (Math.random() > 0.6 ? " candle--ink" : "");
      var left = Math.random() * 100;
      var height = 18 + Math.random() * 46;
      var duration = 18 + Math.random() * 16;
      var delay = Math.random() * -duration;
      c.style.left = left + "%";
      c.style.height = height + "px";
      c.style.animationDuration = duration + "s";
      c.style.animationDelay = delay + "s";
      candleField.appendChild(c);
    }
  }

  /* ---------------- floating particles ---------------- */
  var particleField = document.getElementById("particleField");
  if (particleField && !reduceMotion) {
    var particleCount = window.innerWidth < 640 ? 8 : 18;
    for (var j = 0; j < particleCount; j++) {
      var p = document.createElement("div");
      p.className = "particle";
      var pleft = Math.random() * 100;
      var pduration = 14 + Math.random() * 14;
      var pdelay = Math.random() * -pduration;
      var drift = (Math.random() * 60 - 30) + "px";
      p.style.left = pleft + "%";
      p.style.animationDuration = pduration + "s";
      p.style.animationDelay = pdelay + "s";
      p.style.setProperty("--drift", drift);
      particleField.appendChild(p);
    }
  }

  /* ---------------- sticky header shrink ---------------- */
  var header = document.getElementById("siteHeader");
  function onScrollHeader() {
    if (!header) return;
    if (window.scrollY > 12) header.classList.add("is-scrolled");
    else header.classList.remove("is-scrolled");
  }
  document.addEventListener("scroll", onScrollHeader, { passive: true });
  onScrollHeader();

  /* ---------------- mobile nav toggle ---------------- */
  var navToggle = document.getElementById("navToggle");
  var navLinks = document.getElementById("navLinks");
  if (navToggle && navLinks) {
    navToggle.addEventListener("click", function () {
      var isOpen = navLinks.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      document.body.style.overflow = isOpen ? "hidden" : "";
    });
    navLinks.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        navLinks.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      });
    });
  }

  /* ---------------- active nav link on scroll ---------------- */
  var sections = Array.prototype.slice.call(document.querySelectorAll("main section[id], section[id]"));
  var navAnchors = Array.prototype.slice.call(document.querySelectorAll(".nav__links a"));
  function highlightNav() {
    var scrollPos = window.scrollY + 140;
    var current = null;
    sections.forEach(function (sec) {
      if (sec.offsetTop <= scrollPos) current = sec.id;
    });
    navAnchors.forEach(function (a) {
      var match = a.getAttribute("href") === "#" + current;
      a.classList.toggle("is-active", !!match);
    });
  }
  document.addEventListener("scroll", highlightNav, { passive: true });
  highlightNav();

  /* ---------------- scroll reveal ---------------- */
  var revealEls = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  var staggerChildSelectors = ".reveal-stagger > *";

  if ("IntersectionObserver" in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -60px 0px" });
    revealEls.forEach(function (el) { io.observe(el); });

    // timeline items get their own visible state for the numbered dot
    var timelineItems = document.querySelectorAll(".timeline__item");
    var tio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
        }
      });
    }, { threshold: 0.5 });
    timelineItems.forEach(function (el) { tio.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
    document.querySelectorAll(".timeline__item").forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ---------------- animated counters ---------------- */
  var counters = Array.prototype.slice.call(document.querySelectorAll("[data-count]"));
  function animateCounter(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    var suffix = el.getAttribute("data-suffix") || "";
    var prefix = el.getAttribute("data-prefix") || "";
    if (reduceMotion || isNaN(target)) {
      el.textContent = prefix + target + suffix;
      return;
    }
    var duration = 1400;
    var start = null;
    function step(ts) {
      if (!start) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var value = Math.round(target * eased);
      el.textContent = prefix + value + suffix;
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = prefix + target + suffix;
    }
    requestAnimationFrame(step);
  }
  if ("IntersectionObserver" in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          cio.unobserve(entry.target);
        }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { cio.observe(el); });
  } else {
    counters.forEach(animateCounter);
  }

  /* ---------------- FAQ accordion ---------------- */
  var faqItems = Array.prototype.slice.call(document.querySelectorAll(".faq-item"));
  function setFaqState(item, open) {
    var q = item.querySelector(".faq-q");
    var a = item.querySelector(".faq-a");
    item.classList.toggle("is-open", open);
    q.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      a.style.maxHeight = a.scrollHeight + "px";
    } else {
      a.style.maxHeight = 0;
    }
  }
  faqItems.forEach(function (item) {
    var q = item.querySelector(".faq-q");
    setFaqState(item, item.classList.contains("is-open"));
    q.addEventListener("click", function () {
      var willOpen = !item.classList.contains("is-open");
      faqItems.forEach(function (other) { setFaqState(other, false); });
      setFaqState(item, willOpen);
    });
  });
  window.addEventListener("resize", function () {
    faqItems.forEach(function (item) {
      if (item.classList.contains("is-open")) setFaqState(item, true);
    });
  });

  /* ---------------- back to top ---------------- */
  var backToTop = document.getElementById("backToTop");
  if (backToTop) {
    document.addEventListener("scroll", function () {
      backToTop.classList.toggle("is-visible", window.scrollY > 700);
    }, { passive: true });
    backToTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    });
  }

  /* ---------------- contact form -> WhatsApp ---------------- */
  var contactForm = document.getElementById("contactForm");
  if (contactForm) {
    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = document.getElementById("cf-name").value.trim();
      var phone = document.getElementById("cf-phone").value.trim();
      var interest = document.getElementById("cf-interest").value;
      var message = document.getElementById("cf-message").value.trim();
      var text;
      if (isArabic) {
        text = "مرحباً ريلاكس تايم، اسمي " + name + " (" + phone + "). أنا مهتم بـ: " + interest + ".";
      } else {
        text = "Hi Relax Time, my name is " + name + " (" + phone + "). I'm interested in: " + interest + ".";
      }
      if (message) text += " " + message;
      var url = "https://wa.me/96181178540?text=" + encodeURIComponent(text);
      window.open(url, "_blank", "noopener");
    });
  }

  /* ---------------- RelaxTime Assistant (guided quick-reply widget) ----------------
     Not a generative AI chatbot: a small guided menu of topics pulled straight from
     the site's own service descriptions, plus simple keyword matching on free text,
     that always resolves to a WhatsApp handoff with a relevant pre-filled message. */
  var assistantRoot = document.getElementById("assistant");
  if (assistantRoot) {
    var aLauncher = document.getElementById("assistantLauncher");
    var aPanel = document.getElementById("assistantPanel");
    var aClose = document.getElementById("assistantClose");
    var aMessages = document.getElementById("assistantMessages");
    var aQuickReplies = document.getElementById("assistantQuickReplies");
    var aComposer = document.getElementById("assistantComposer");
    var aInput = document.getElementById("assistantInput");
    var aWhatsApp = document.getElementById("assistantWhatsAppCta");
    var aStarted = false;
    var WA_NUMBER = "96181178540";

    var T = isArabic ? {
      greeting: "مرحباً! أنا مساعد ريلاكس تايم. عن أي موضوع تحب أن تسأل؟",
      otherLabel: "شيء آخر",
      otherReply: "لا مشكلة، أخبرني قليلاً عمّا تحتاجه وسأجهّز لك رسالة جاهزة لمتابعة الحديث مع فريقنا عبر واتساب.",
      fallbackReply: "لضمان حصولك على إجابة دقيقة، من الأفضل إكمال هذا السؤال مباشرة مع فريقنا عبر واتساب.",
      resetLabel: "اسأل عن موضوع آخر",
      waGeneric: "مرحباً ريلاكس تايم، أرغب في التحدث مع فريقكم.",
      waWithText: function (t) { return "مرحباً ريلاكس تايم، لدي سؤال: " + t; }
    } : {
      greeting: "Hi! I'm the RelaxTime Assistant. What would you like to know about?",
      otherLabel: "Something else",
      otherReply: "No problem, tell me a little about what you need and I'll get a message ready to continue with our team on WhatsApp.",
      fallbackReply: "To make sure you get an accurate answer, it's best to continue this question directly with our team on WhatsApp.",
      resetLabel: "Ask about something else",
      waGeneric: "Hi Relax Time, I'd like to talk to your team.",
      waWithText: function (t) { return "Hi Relax Time, I have a question: " + t; }
    };

    var TOPICS = isArabic ? [
      { label: "القناة المجانية", reply: "القناة المجانية تمنحك من فرصة إلى فرصتي تداول يومياً دون أي اشتراك، مثالية للمبتدئين وللتعرف على أسلوب ريلاكس تايم.", wa: "مرحباً ريلاكس تايم، أرغب في معرفة المزيد عن القناة المجانية.", kw: ["مجان", "تجربة"] },
      { label: "قناة VIP", reply: "قناة VIP تمنحك من 5 إلى 7 فرص تداول يومياً، خطة إدارة رأس مال، متابعة يومية، إضافة إلى قناة Double Load الإضافية.", wa: "مرحباً ريلاكس تايم، أرغب في معرفة المزيد عن قناة VIP.", kw: ["vip", "في اي بي", "دبل لود", "double"] },
      { label: "نسخ الصفقات", reply: "في خدمة نسخ الصفقات، تفتح حساباً وتربطه باستراتيجيتنا لتنفيذ الصفقات تلقائياً، مع بقاء حسابك ملكاً لك بالكامل.", wa: "مرحباً ريلاكس تايم، أرغب في معرفة المزيد عن نسخ الصفقات.", kw: ["نسخ", "كوبي", "copy"] },
      { label: "فتح حساب", reply: "نرافقك خطوة بخطوة في فهم وفتح وإعداد حساب تداول، خاصة إذا كانت هذه أول تجربة لك.", wa: "مرحباً ريلاكس تايم، أحتاج مساعدة في فتح حساب تداول.", kw: ["فتح حساب", "حساب تداول", "فتح الحساب"] },
      { label: "الأكاديمية", reply: "أكاديمية ريلاكس تايم تضم ستة محاور: أساسيات التداول، استراتيجيات التداول، تحليل السوق، إدارة رأس المال والمخاطر، علم نفس التداول، وتحليل مسار السوق.", wa: "مرحباً ريلاكس تايم، أرغب في معرفة المزيد عن أكاديمية ريلاكس تايم للتداول.", kw: ["أكاديمية", "تعلم", "تدريب", "دورة", "كورس"] }
    ] : [
      { label: "Free Channel", reply: "The Free Channel gives you about 1 to 2 trading opportunities a day, no subscription required, ideal if you're just getting familiar with our approach.", wa: "Hi Relax Time, I'd like to learn more about the Free Channel.", kw: ["free channel", "free"] },
      { label: "VIP Channel", reply: "VIP gives you 5 to 7 opportunities a day, a structured capital-management plan, daily follow-up, and access to the Double Load Channel.", wa: "Hi Relax Time, I'd like to learn more about the VIP Channel.", kw: ["vip", "double load", "signal"] },
      { label: "Copy Trading", reply: "With Copy Trading, you open an account with Relax Time and automatically follow our strategy activity, while keeping full ownership of your own account.", wa: "Hi Relax Time, I'd like to learn more about Copy Trading.", kw: ["copy trading", "copy"] },
      { label: "Account Opening", reply: "We'll guide you step by step through understanding, opening, and setting up a trading account, especially helpful if this is your first time.", wa: "Hi Relax Time, I'd like help opening a trading account.", kw: ["open account", "open an account", "account opening", "new account"] },
      { label: "Trading Academy", reply: "The Academy covers six modules: Principles of Trading, Trading Strategies, Market Analysis, Risk & Capital Management, Trading Psychology, and Market Trajectory Analysis.", wa: "Hi Relax Time, I'd like to learn more about the Trading Academy.", kw: ["academy", "course", "training", "module"] }
    ];

    var waLink = function (text) { return "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(text); };
    var setWaCta = function (text) { if (aWhatsApp) aWhatsApp.href = waLink(text); };

    var addMessage = function (text, who) {
      var div = document.createElement("div");
      div.className = "assistant__msg assistant__msg--" + who;
      div.textContent = text;
      aMessages.appendChild(div);
      aMessages.scrollTop = aMessages.scrollHeight;
    };

    var showResetChip = function () {
      aQuickReplies.innerHTML = "";
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "assistant__chip";
      btn.textContent = T.resetLabel;
      btn.addEventListener("click", function () {
        addMessage(T.resetLabel, "user");
        showTopicMenu();
      });
      aQuickReplies.appendChild(btn);
    };

    var selectTopic = function (topic) {
      addMessage(topic.label, "user");
      addMessage(topic.reply, "bot");
      setWaCta(topic.wa);
      showResetChip();
    };

    function showTopicMenu() {
      aQuickReplies.innerHTML = "";
      TOPICS.forEach(function (topic) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "assistant__chip";
        btn.textContent = topic.label;
        btn.addEventListener("click", function () { selectTopic(topic); });
        aQuickReplies.appendChild(btn);
      });
      var otherBtn = document.createElement("button");
      otherBtn.type = "button";
      otherBtn.className = "assistant__chip";
      otherBtn.textContent = T.otherLabel;
      otherBtn.addEventListener("click", function () {
        addMessage(T.otherLabel, "user");
        addMessage(T.otherReply, "bot");
        setWaCta(T.waGeneric);
        showResetChip();
      });
      aQuickReplies.appendChild(otherBtn);
    }

    var matchTopic = function (text) {
      var lower = text.toLowerCase();
      for (var i = 0; i < TOPICS.length; i++) {
        var kws = TOPICS[i].kw || [];
        for (var j = 0; j < kws.length; j++) {
          if (lower.indexOf(kws[j].toLowerCase()) !== -1) return TOPICS[i];
        }
      }
      return null;
    };

    var openAssistant = function () {
      assistantRoot.classList.add("is-open");
      aLauncher.setAttribute("aria-expanded", "true");
      aPanel.setAttribute("aria-hidden", "false");
      if (!aStarted) {
        aStarted = true;
        addMessage(T.greeting, "bot");
        showTopicMenu();
      }
      if (aInput && !reduceMotion) setTimeout(function () { aInput.focus(); }, 260);
    };

    var closeAssistant = function () {
      assistantRoot.classList.remove("is-open");
      aLauncher.setAttribute("aria-expanded", "false");
      aPanel.setAttribute("aria-hidden", "true");
    };

    aLauncher.addEventListener("click", function () {
      if (assistantRoot.classList.contains("is-open")) closeAssistant();
      else openAssistant();
    });
    if (aClose) aClose.addEventListener("click", closeAssistant);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && assistantRoot.classList.contains("is-open")) closeAssistant();
    });

    /* stop clicks inside the widget from ever reaching the document-level
       "click outside to close" listener below, this also protects against
       chip buttons that remove themselves from the DOM inside their own
       click handler, which would otherwise make a bubbled-event target
       check unreliable */
    assistantRoot.addEventListener("click", function (e) { e.stopPropagation(); });

    document.addEventListener("click", function () {
      if (assistantRoot.classList.contains("is-open")) closeAssistant();
    });

    if (aComposer) {
      aComposer.addEventListener("submit", function (e) {
        e.preventDefault();
        var text = aInput.value.trim();
        if (!text) return;
        addMessage(text, "user");
        aInput.value = "";
        var match = matchTopic(text);
        if (match) {
          addMessage(match.reply, "bot");
          setWaCta(match.wa);
        } else {
          addMessage(T.fallbackReply, "bot");
          setWaCta(T.waWithText(text));
        }
        showResetChip();
      });
    }
  }

  /* ---------------- smooth-scroll offset for sticky header ---------------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href");
      if (id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var headerH = header ? header.offsetHeight : 0;
      var y = target.getBoundingClientRect().top + window.pageYOffset - headerH - 12;
      window.scrollTo({ top: y, behavior: reduceMotion ? "auto" : "smooth" });
      history.pushState(null, "", id);
    });
  });
})();
