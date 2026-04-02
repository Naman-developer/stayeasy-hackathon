(() => {
  const API_BASE_URL = "https://stayeasy-hackathon-production.up.railway.app/api";
  const ASSISTANT_OPEN_KEY = "stayeasy_assistant_open";
  const MAX_HISTORY_ITEMS = 40;
  const BRAND_LOGO_FILENAME = "arosaty-logo.jpeg";

  const createToastContainer = () => {
    let container = document.getElementById("toastContainer");
    if (container) return container;

    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
    return container;
  };

  const showToast = (message, type = "info", timeout = 3000) => {
    if (!message) return;
    const container = createToastContainer();
    const toast = document.createElement("div");
    toast.className = `toast-item ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add("visible");
    });

    setTimeout(() => {
      toast.classList.remove("visible");
      setTimeout(() => toast.remove(), 240);
    }, timeout);
  };

  const debounce = (fn, delay = 300) => {
    let timer = null;
    return (...args) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  };

  const safeParse = (value, fallback = null) => {
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  };

  const getStoredUser = () => safeParse(localStorage.getItem("stayeasy_user"), null);

  const ROLE_DASHBOARD_PAGE_MAP = {
    student: "student-dashboard.html",
    tenant: "tenant-dashboard.html",
    flat_owner: "owner-dashboard.html",
    pg_owner: "owner-dashboard.html",
    hostel_owner: "hostel-dashboard.html",
    parent: "parent-dashboard.html",
    worker: "worker-dashboard.html",
    admin: "admin-dashboard.html",
  };

  const getChatHistoryKey = () => {
    const user = getStoredUser();
    const id = user?._id || "guest";
    return `stayeasy_assistant_history_${id}`;
  };

  const saveChatHistory = (items = []) => {
    localStorage.setItem(getChatHistoryKey(), JSON.stringify(items.slice(-MAX_HISTORY_ITEMS)));
  };

  const loadChatHistory = () =>
    safeParse(localStorage.getItem(getChatHistoryKey()), []) || [];

  const formatCurrency = (value) =>
    Number(value || 0).toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    });

  const getFrontendBasePath = () => {
    const marker = "/frontend/";
    const index = window.location.pathname.indexOf(marker);
    if (index === -1) return "/";
    return window.location.pathname.slice(0, index + marker.length);
  };

  const isPagesRoute = () => window.location.pathname.includes("/pages/");

  const resolvePageHref = (pageName) => {
    if (!pageName) return "";
    if (isPagesRoute()) {
      return `./${pageName}`;
    }
    return `${getFrontendBasePath()}pages/${pageName}`;
  };

  const resolveHomeHref = () => {
    if (isPagesRoute()) {
      return "../index.html";
    }
    return `${getFrontendBasePath()}index.html`;
  };

  const resolveAssetHref = (assetFile = "") => {
    if (!assetFile) return "";
    if (isPagesRoute()) {
      return `../assets/${assetFile}`;
    }
    return `${getFrontendBasePath()}assets/${assetFile}`;
  };

  const getBrandLogoPath = () => resolveAssetHref(BRAND_LOGO_FILENAME);

  const formatRoleLabel = (role = "") =>
    String(role)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const getDashboardHrefForUser = (user) =>
    resolvePageHref(ROLE_DASHBOARD_PAGE_MAP[user?.role || ""]);

  const clearAuthSession = () => {
    localStorage.removeItem("stayeasy_token");
    localStorage.removeItem("stayeasy_user");
  };

  const isAuthActionHref = (href = "") =>
    /(?:^|\/)(login|signup)\.html(?:$|[?#])/i.test(href);

  const getInitial = (name = "") => String(name || "U").trim().charAt(0).toUpperCase() || "U";

  const injectBrandStyles = () => {
    if (document.getElementById("stayeasyBrandStyle")) return;

    const style = document.createElement("style");
    style.id = "stayeasyBrandStyle";
    style.textContent = `
      .brand-with-logo {
        display: inline-flex;
        align-items: center;
        gap: 0.55rem;
      }

      .brand-logo-inline {
        width: 34px;
        height: 34px;
        border-radius: 10px;
        object-fit: cover;
        border: 1px solid #e2e8f0;
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
        background: #fff;
        flex: 0 0 34px;
      }

      .brand-logo-inline.logo-sm {
        width: 30px;
        height: 30px;
        flex-basis: 30px;
      }

      .brand-logo-inline.logo-lg {
        width: 52px;
        height: 52px;
        border-radius: 14px;
        flex-basis: 52px;
      }

      .auth-logo-display {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 0.9rem;
      }
    `;
    document.head.appendChild(style);
  };

  const createBrandLogoNode = (extraClass = "") => {
    const img = document.createElement("img");
    img.className = `brand-logo-inline ${extraClass}`.trim();
    img.alt = "Arostay Logo";
    img.loading = "eager";
    img.decoding = "async";
    img.src = getBrandLogoPath();
    return img;
  };

  const prependLogoIfMissing = (target, extraClass = "") => {
    if (!target) return;
    if (target.querySelector(".brand-logo-inline")) return;
    target.classList.add("brand-with-logo");
    target.insertBefore(createBrandLogoNode(extraClass), target.firstChild);
  };

  const injectBrandLogos = () => {
    document.querySelectorAll("a.brand-link, a.market-brand").forEach((brandAnchor) => {
      prependLogoIfMissing(brandAnchor, "logo-sm");
    });

    document.querySelectorAll(".brand").forEach((homeBrand) => {
      const badge = homeBrand.querySelector(".brand-badge");
      if (badge) badge.remove();
      prependLogoIfMissing(homeBrand, "logo-sm");
    });

    document.querySelectorAll(".portal-brand").forEach((portalBrand) => {
      const oldMark = portalBrand.querySelector(".portal-brand-mark");
      if (oldMark) oldMark.remove();
      prependLogoIfMissing(portalBrand, "logo-sm");
    });

    document.querySelectorAll(".auth-brand").forEach((authPanel) => {
      if (authPanel.querySelector(".auth-logo-display")) return;
      const logoWrap = document.createElement("div");
      logoWrap.className = "auth-logo-display";
      logoWrap.appendChild(createBrandLogoNode("logo-lg"));
      authPanel.insertBefore(logoWrap, authPanel.firstChild);
    });
  };

  const renderMarketplaceAuthActions = () => {
    const nav = document.querySelector(".market-nav");
    const actions = nav?.querySelector(".market-actions");

    if (!actions) return;

    const token = localStorage.getItem("stayeasy_token");
    const user = getStoredUser();
    const dashboardHref = getDashboardHrefForUser(user);
    const brand = nav.querySelector(".market-brand");

    if (brand) {
      brand.setAttribute("href", resolveHomeHref());
    }

    if (!token || !user || !dashboardHref) {
      return;
    }

    const contextualLinks = [...actions.querySelectorAll("a.market-btn")].filter((anchor) => {
      const href = anchor.getAttribute("href") || "";
      return !isAuthActionHref(href);
    });

    actions.innerHTML = "";

    contextualLinks.forEach((link) => {
      actions.appendChild(link);
    });

    const profileChip = document.createElement("button");
    profileChip.type = "button";
    profileChip.className = "market-user-chip";

    const avatar = document.createElement("span");
    avatar.className = "market-user-avatar";
    avatar.textContent = getInitial(user.name);

    const userMeta = document.createElement("span");
    userMeta.className = "market-user-meta";

    const userName = document.createElement("strong");
    userName.textContent = user.name || "User";

    const userRole = document.createElement("small");
    userRole.textContent = formatRoleLabel(user.role);

    userMeta.appendChild(userName);
    userMeta.appendChild(userRole);

    profileChip.appendChild(avatar);
    profileChip.appendChild(userMeta);
    profileChip.addEventListener("click", () => {
      window.location.href = dashboardHref;
    });
    actions.appendChild(profileChip);

    const dashboardLink = document.createElement("a");
    dashboardLink.className = "market-btn primary";
    dashboardLink.href = dashboardHref;
    dashboardLink.textContent = `${formatRoleLabel(user.role)} Portal`;
    actions.appendChild(dashboardLink);

    const logoutBtn = document.createElement("button");
    logoutBtn.type = "button";
    logoutBtn.className = "market-btn ghost market-logout-btn";
    logoutBtn.textContent = "Logout";
    logoutBtn.addEventListener("click", () => {
      clearAuthSession();
      window.location.reload();
    });
    actions.appendChild(logoutBtn);
  };

  const injectAssistantStyles = () => {
    if (document.getElementById("stayeasyAssistantStyle")) return;

    const style = document.createElement("style");
    style.id = "stayeasyAssistantStyle";
    style.textContent = `
      .stayeasy-chat-root {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 1100;
      }

      .stayeasy-chat-fab {
        width: 58px;
        height: 58px;
        border: none;
        border-radius: 999px;
        cursor: pointer;
        font: inherit;
        font-weight: 700;
        color: #fff;
        background: #6366f1;
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }

      .stayeasy-chat-fab:hover {
        transform: translateY(-2px);
        background: #4f46e5;
      }

      .stayeasy-chat-fab.hidden {
        display: none;
      }

      .stayeasy-chat-panel {
        width: min(390px, calc(100vw - 26px));
        height: min(620px, calc(100vh - 32px));
        border-radius: 16px;
        border: 1px solid #e2e8f0;
        background: #fff;
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
        display: none;
        grid-template-rows: auto auto 1fr auto auto;
        overflow: hidden;
      }

      .stayeasy-chat-panel.open {
        display: grid;
      }

      .stayeasy-chat-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        padding: 0.72rem 0.75rem;
        border-bottom: 1px solid #e2e8f0;
        background: #ffffff;
      }

      .stayeasy-chat-title {
        font-size: 0.93rem;
        font-weight: 700;
        color: #153465;
      }

      .stayeasy-chat-subtitle {
        font-size: 0.74rem;
        color: #5c7398;
      }

      .stayeasy-chat-header-actions {
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }

      .stayeasy-chat-icon-btn {
        border: 1px solid #d2e0ff;
        border-radius: 10px;
        background: #f7faff;
        color: #2a59b2;
        font-size: 0.76rem;
        font-weight: 600;
        padding: 0.36rem 0.52rem;
        cursor: pointer;
      }

      .stayeasy-chat-suggestions {
        display: flex;
        gap: 0.4rem;
        flex-wrap: wrap;
        padding: 0.6rem 0.68rem;
        border-bottom: 1px solid #edf2ff;
      }

      .stayeasy-chat-chip {
        border: 1px solid #d7e4ff;
        border-radius: 999px;
        background: #f8fbff;
        color: #33588f;
        font-size: 0.73rem;
        padding: 0.28rem 0.62rem;
        cursor: pointer;
      }

      .stayeasy-chat-messages {
        padding: 0.72rem;
        overflow-y: auto;
        background: #f8fafc;
        display: grid;
        align-content: start;
        gap: 0.55rem;
      }

      .stayeasy-chat-message {
        display: flex;
      }

      .stayeasy-chat-message.user {
        justify-content: flex-end;
      }

      .stayeasy-chat-bubble {
        max-width: 88%;
        border-radius: 12px;
        padding: 0.58rem 0.68rem;
        font-size: 0.84rem;
        line-height: 1.45;
        border: 1px solid #dce8ff;
        background: #f9fbff;
        color: #183560;
      }

      .stayeasy-chat-message.user .stayeasy-chat-bubble {
        background: #6366f1;
        border-color: #6366f1;
        color: #fff;
      }

      .stayeasy-chat-message.system .stayeasy-chat-bubble {
        background: #fff3dc;
        border-color: #ffe0a8;
        color: #6d4a00;
      }

      .stayeasy-chat-cards {
        margin-top: 0.45rem;
        display: grid;
        gap: 0.4rem;
      }

      .stayeasy-chat-card {
        border: 1px solid #dce8ff;
        border-radius: 10px;
        background: #fff;
        padding: 0.5rem;
      }

      .stayeasy-chat-card h5 {
        color: #153b79;
        font-size: 0.8rem;
      }

      .stayeasy-chat-card p {
        margin-top: 0.2rem;
        color: #4f668d;
        font-size: 0.73rem;
      }

      .stayeasy-chat-card a {
        margin-top: 0.32rem;
        display: inline-block;
        color: #2b5df2;
        font-size: 0.73rem;
        font-weight: 600;
        text-decoration: none;
      }

      .stayeasy-chat-typing {
        display: none;
        padding: 0 0.75rem 0.6rem;
        color: #5d7396;
        font-size: 0.75rem;
      }

      .stayeasy-chat-typing.visible {
        display: block;
      }

      .stayeasy-chat-form {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 0.45rem;
        padding: 0.68rem;
        border-top: 1px solid #e8eeff;
      }

      .stayeasy-chat-input {
        border: 1px solid #d8e4ff;
        border-radius: 11px;
        padding: 0.58rem 0.65rem;
        resize: none;
        min-height: 42px;
        max-height: 120px;
        font: inherit;
        font-size: 0.84rem;
      }

      .stayeasy-chat-input:focus {
        outline: none;
        border-color: #8eaaff;
        box-shadow: 0 0 0 3px rgba(81, 131, 255, 0.18);
      }

      .stayeasy-chat-send {
        border: none;
        border-radius: 10px;
        padding: 0.55rem 0.75rem;
        background: #6366f1;
        color: #fff;
        cursor: pointer;
        font: inherit;
        font-size: 0.78rem;
        font-weight: 600;
      }

      .stayeasy-chat-send:disabled {
        cursor: not-allowed;
        opacity: 0.7;
      }

      @media (max-width: 640px) {
        .stayeasy-chat-root {
          right: 10px;
          bottom: 10px;
        }

        .stayeasy-chat-panel {
          width: min(380px, calc(100vw - 16px));
          height: min(600px, calc(100vh - 18px));
        }
      }
    `;

    document.head.appendChild(style);
  };

  const injectGlobalMotionStyles = () => {
    if (document.getElementById("stayeasyGlobalMotionStyle")) return;

    const style = document.createElement("style");
    style.id = "stayeasyGlobalMotionStyle";
    style.textContent = `
      .stayeasy-motion-item {
        opacity: 0;
        transform: translateY(10px) scale(0.995);
        transition: opacity 0.34s ease, transform 0.34s ease;
        will-change: transform, opacity;
      }

      .stayeasy-motion-item.stayeasy-motion-in {
        opacity: 1;
        transform: translateY(0) scale(1);
      }

      .section-card,
      .content-card,
      .filter-card,
      .search-card,
      .auth-card,
      .auth-brand,
      .property-card,
      .kpi-card,
      .metric-tile,
      .info-card,
      .trust-badge,
      .testimonial,
      .service-chip,
      .top-property-card {
        transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
      }

      .section-card:hover,
      .content-card:hover,
      .filter-card:hover,
      .property-card:hover,
      .kpi-card:hover,
      .metric-tile:hover,
      .info-card:hover,
      .trust-badge:hover,
      .testimonial:hover,
      .service-chip:hover,
      .top-property-card:hover {
        transform: translateY(-2px);
      }

      button,
      .btn,
      .solid-btn,
      .ghost-btn,
      .market-btn {
        transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
      }

      button:hover,
      .btn:hover,
      .solid-btn:hover,
      .ghost-btn:hover,
      .market-btn:hover {
        transform: translateY(-1px);
      }

      @media (prefers-reduced-motion: reduce) {
        .stayeasy-motion-item,
        .stayeasy-motion-item.stayeasy-motion-in,
        button,
        .btn,
        .solid-btn,
        .ghost-btn,
        .market-btn {
          transition: none !important;
          transform: none !important;
          opacity: 1 !important;
        }
      }
    `;

    document.head.appendChild(style);
  };

  const initGlobalMotion = () => {
    injectGlobalMotionStyles();

    const targets = Array.from(
      document.querySelectorAll(
        ".section, .section-card, .content-card, .filter-card, .search-card, .auth-card, .auth-brand, .property-card, .kpi-card, .metric-tile, .info-card, .trust-badge, .testimonial, .service-chip, .top-property-card"
      )
    ).filter((node) => !node.classList.contains("stayeasy-motion-item"));

    if (!targets.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("stayeasy-motion-in");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.08 }
    );

    targets.forEach((node) => {
      node.classList.add("stayeasy-motion-item");
      observer.observe(node);
    });
  };

  const createMessageNode = (role, text) => {
    const wrapper = document.createElement("article");
    wrapper.className = `stayeasy-chat-message ${role}`;

    const bubble = document.createElement("div");
    bubble.className = "stayeasy-chat-bubble";
    bubble.textContent = text;

    wrapper.appendChild(bubble);
    return { wrapper, bubble };
  };

  const createCardNode = (card = {}) => {
    const node = document.createElement("article");
    node.className = "stayeasy-chat-card";

    const title = document.createElement("h5");
    const line1 = document.createElement("p");
    const line2 = document.createElement("p");

    if (card.type === "complaint") {
      title.textContent = `Complaint: ${card.category || "general"}`;
      line1.textContent = `Status: ${card.status || "-"}`;
      line2.textContent = card.message || "";
      node.appendChild(title);
      node.appendChild(line1);
      if (card.message) node.appendChild(line2);
      return node;
    }

    title.textContent = card.title || "Recommendation";
    const type = String(card.type || card.propertyType || "").toUpperCase();
    line1.textContent = `${card.city || "Unknown"}${type ? ` - ${type}` : ""}`;

    const hasPrice = card.price !== undefined && card.price !== null;
    line2.textContent = hasPrice
      ? `${formatCurrency(card.price)} / ${card.priceType || "monthly"}`
      : card.aiReason || "Suggested based on your context.";

    node.appendChild(title);
    node.appendChild(line1);
    node.appendChild(line2);

    if (card.aiReason && hasPrice) {
      const reason = document.createElement("p");
      reason.textContent = card.aiReason;
      node.appendChild(reason);
    }

    if (card.id) {
      const detailsLink = document.createElement("a");
      detailsLink.href = `${getFrontendBasePath()}pages/property-details.html?id=${encodeURIComponent(card.id)}`;
      detailsLink.textContent = "View details";
      node.appendChild(detailsLink);
    }

    return node;
  };

  const bootstrapAssistant = () => {
    if (document.getElementById("stayeasyAssistantRoot")) return;

    injectAssistantStyles();

    const root = document.createElement("section");
    root.id = "stayeasyAssistantRoot";
    root.className = "stayeasy-chat-root";

    const fab = document.createElement("button");
    fab.type = "button";
    fab.className = "stayeasy-chat-fab";
    fab.textContent = "AI";

    const panel = document.createElement("section");
    panel.className = "stayeasy-chat-panel";

    const header = document.createElement("header");
    header.className = "stayeasy-chat-header";

    const headerText = document.createElement("div");
    const title = document.createElement("p");
    title.className = "stayeasy-chat-title";
    title.textContent = "StayEasy AI Assistant";
    const subtitle = document.createElement("p");
    subtitle.className = "stayeasy-chat-subtitle";
    subtitle.textContent = "Ask like ChatGPT: search, complaints, guidance";
    headerText.appendChild(title);
    headerText.appendChild(subtitle);

    const headerActions = document.createElement("div");
    headerActions.className = "stayeasy-chat-header-actions";

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "stayeasy-chat-icon-btn";
    clearBtn.textContent = "New Chat";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "stayeasy-chat-icon-btn";
    closeBtn.textContent = "Close";

    headerActions.appendChild(clearBtn);
    headerActions.appendChild(closeBtn);

    header.appendChild(headerText);
    header.appendChild(headerActions);

    const suggestions = document.createElement("div");
    suggestions.className = "stayeasy-chat-suggestions";

    const suggestionPrompts = [
      "Show me cheap PG in Delhi under 12000",
      "Recommend flat in Noida under 20000",
      "Why is my complaint pending?",
    ];

    suggestionPrompts.forEach((prompt) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "stayeasy-chat-chip";
      chip.textContent = prompt;
      chip.dataset.prompt = prompt;
      suggestions.appendChild(chip);
    });

    const messages = document.createElement("div");
    messages.className = "stayeasy-chat-messages";

    const typing = document.createElement("div");
    typing.className = "stayeasy-chat-typing";
    typing.textContent = "Assistant is thinking...";

    const form = document.createElement("form");
    form.className = "stayeasy-chat-form";

    const textarea = document.createElement("textarea");
    textarea.className = "stayeasy-chat-input";
    textarea.placeholder = "Type your message...";
    textarea.rows = 1;

    const sendBtn = document.createElement("button");
    sendBtn.type = "submit";
    sendBtn.className = "stayeasy-chat-send";
    sendBtn.textContent = "Send";

    form.appendChild(textarea);
    form.appendChild(sendBtn);

    panel.appendChild(header);
    panel.appendChild(suggestions);
    panel.appendChild(messages);
    panel.appendChild(typing);
    panel.appendChild(form);

    root.appendChild(fab);
    root.appendChild(panel);
    document.body.appendChild(root);

    let history = loadChatHistory();
    let busy = false;

    const persistHistory = () => saveChatHistory(history);

    const scrollToBottom = () => {
      messages.scrollTop = messages.scrollHeight;
    };

    const setTyping = (visible) => {
      typing.classList.toggle("visible", Boolean(visible));
      scrollToBottom();
    };

    const setOpen = (open) => {
      panel.classList.toggle("open", open);
      fab.classList.toggle("hidden", open);
      localStorage.setItem(ASSISTANT_OPEN_KEY, open ? "1" : "0");

      if (open) {
        setTimeout(() => textarea.focus(), 80);
      }
    };

    const appendMessage = ({ role, text, cards = [], save = true }) => {
      const { wrapper, bubble } = createMessageNode(role, text);

      if (cards.length) {
        const cardWrap = document.createElement("div");
        cardWrap.className = "stayeasy-chat-cards";
        cards.forEach((card) => cardWrap.appendChild(createCardNode(card)));
        bubble.appendChild(cardWrap);
      }

      messages.appendChild(wrapper);
      scrollToBottom();

      if (save) {
        history.push({ role, text, cards });
        history = history.slice(-MAX_HISTORY_ITEMS);
        persistHistory();
      }
    };

    const renderHistory = () => {
      messages.innerHTML = "";

      if (!history.length) {
        appendMessage({
          role: "assistant",
          text: "Hi! I can help with property search, recommendations, and complaint status. Try a prompt below.",
          save: true,
        });
        return;
      }

      history.forEach((item) => {
        appendMessage({
          role: item.role || "assistant",
          text: item.text || "",
          cards: Array.isArray(item.cards) ? item.cards : [],
          save: false,
        });
      });
    };

    const clearChat = () => {
      history = [];
      persistHistory();
      renderHistory();
    };

    const sendMessage = async (rawValue) => {
      const message = String(rawValue || "").trim();
      if (!message || busy) return;

      appendMessage({ role: "user", text: message });
      textarea.value = "";

      const token = localStorage.getItem("stayeasy_token");
      if (!token) {
        appendMessage({
          role: "system",
          text: "Please login first to use AI Assistant.",
        });
        return;
      }

      busy = true;
      sendBtn.disabled = true;
      setTyping(true);

      try {
        const response = await fetch(`${API_BASE_URL}/assistant/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ message }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.message || "Assistant is unavailable right now.");
        }

        appendMessage({
          role: "assistant",
          text: data.reply || "Here is what I found.",
          cards: Array.isArray(data.cards) ? data.cards : [],
        });
      } catch (error) {
        appendMessage({
          role: "system",
          text: error.message || "Unable to connect to assistant.",
        });
      } finally {
        busy = false;
        sendBtn.disabled = false;
        setTyping(false);
      }
    };

    fab.addEventListener("click", () => setOpen(true));
    closeBtn.addEventListener("click", () => setOpen(false));
    clearBtn.addEventListener("click", clearChat);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      sendMessage(textarea.value);
    });

    textarea.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
      }
    });

    suggestions.addEventListener("click", (event) => {
      const chip = event.target.closest(".stayeasy-chat-chip");
      if (!chip) return;
      sendMessage(chip.dataset.prompt || "");
    });

    renderHistory();

    const shouldOpen = localStorage.getItem(ASSISTANT_OPEN_KEY) === "1";
    setOpen(shouldOpen);
  };

  window.showToast = showToast;
  window.StayEasyUI = {
    showToast,
    debounce,
    getBrandLogoPath,
    injectBrandLogos,
  };

  const initGlobalUi = () => {
    renderMarketplaceAuthActions();
    injectBrandStyles();
    injectBrandLogos();
    initGlobalMotion();
    const scheduleLogoInjection = debounce(() => {
      injectBrandLogos();
    }, 120);
    const brandObserver = new MutationObserver(() => {
      scheduleLogoInjection();
    });
    brandObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
    bootstrapAssistant();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initGlobalUi);
  } else {
    initGlobalUi();
  }
})();

