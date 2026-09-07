/* ============================================================
   RELAX TIME TRADING - Main JS
   Ticker tape, animated background (candles/particles), sticky
   header, mobile nav, scroll-reveal, animated counters, FAQ
   accordion, active-link highlighting, back-to-top, contact form.
   ============================================================ */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- footer year ---------------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------------- ticker tape ---------------- */
  var symbols = [
    { sym: "XAU/USD", price: 2378.42 },
    { sym: "EUR/USD", price: 1.0842 },
    { sym: "GBP/USD", price: 1.2695 },
    { sym: "BTC/USD", price: 67240 },
    { sym: "ETH/USD", price: 3412 },
    { sym: "USD/JPY", price: 149.32 }
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
      item.innerHTML =
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

    if (!reduceMotion) {
      setInterval(function () {
        var s = symbols[Math.floor(Math.random() * symbols.length)];
        var pct = (Math.random() * 0.006) - 0.003;
        var next = s.price * (1 + pct);
        var dir = next >= s.price ? "up" : "down";
        s.price = next;
        var nodes = track.querySelectorAll('[data-symbol="' + s.sym.replace("/", "\\/") + '"]');
        nodes.forEach(function (n) {
          n.setAttribute("data-dir", dir);
          var priceEl = n.querySelector(".price");
          var arrowEl = n.querySelector(".arrow");
          if (priceEl) priceEl.textContent = fmt(s.sym, s.price);
          if (arrowEl) arrowEl.innerHTML = dir === "up" ? "&#9650;" : "&#9660;";
        });
      }, 2200);
    }
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
    var isArabic = (document.documentElement.lang || "").toLowerCase().indexOf("ar") === 0;
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
