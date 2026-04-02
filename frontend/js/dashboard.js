const API_BASE_URL = "https://stayeasy-hackathon-production.up.railway.app/api";

const ROLE_REDIRECT_MAP = {
  student: "./student-dashboard.html",
  tenant: "./tenant-dashboard.html",
  flat_owner: "./owner-dashboard.html",
  pg_owner: "./owner-dashboard.html",
  hostel_owner: "./hostel-dashboard.html",
  parent: "./parent-dashboard.html",
  worker: "./worker-dashboard.html",
  admin: "./admin-dashboard.html",
};

const ROLE_PORTAL_LINK_MAP = {
  student: { label: "Student Portal", href: "./student-dashboard.html", role: "student" },
  tenant: { label: "Tenant Portal", href: "./tenant-dashboard.html", role: "tenant" },
  flat_owner: { label: "Owner Portal", href: "./owner-dashboard.html", role: "flat_owner" },
  pg_owner: { label: "Owner Portal", href: "./owner-dashboard.html", role: "pg_owner" },
  hostel_owner: { label: "Hostel Portal", href: "./hostel-dashboard.html", role: "hostel_owner" },
  parent: { label: "Parent Portal", href: "./parent-dashboard.html", role: "parent" },
  worker: { label: "Worker Portal", href: "./worker-dashboard.html", role: "worker" },
  admin: { label: "Admin Portal", href: "./admin-dashboard.html", role: "admin" },
};

const SIDEBAR_PRIMARY_LINKS = [
  { label: "Dashboard", href: "", icon: "DB", dashboard: true },
  { label: "Properties", href: "./search-results.html", icon: "PR" },
  { label: "Payments", href: "./booking.html", icon: "PY" },
  { label: "Maintenance", href: "./worker.html", icon: "MT" },
  { label: "Documents", href: "./user-dashboard.html", icon: "DC" },
  { label: "Community", href: "../index.html", icon: "CM" },
];

const SIDEBAR_UTILITY_LINKS = [
  { label: "Front Page", href: "../index.html", icon: "HM" },
  { label: "Search Listings", href: "./search-results.html", icon: "SR" },
  { label: "Worker Services", href: "./worker.html", icon: "WK" },
];

const ROLE_ACTION_COPY_MAP = {
  student: "Safety Center",
  tenant: "Book Property",
  flat_owner: "Add Property",
  pg_owner: "Add Property",
  hostel_owner: "Send Broadcast",
  parent: "Check Child",
  worker: "Set Online",
  admin: "Review Queue",
};

const logoutButtons = document.querySelectorAll(".logout-btn");
const userNameEl = document.getElementById("userName");
const userRoleEl = document.getElementById("userRole");
const profileBox = document.querySelector(".profile-box");

const clearSession = () => {
  localStorage.removeItem("stayeasy_token");
  localStorage.removeItem("stayeasy_user");
};

const getStoredUser = () => {
  const raw = localStorage.getItem("stayeasy_user");
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
};

const redirectByRole = (role) => {
  const target = ROLE_REDIRECT_MAP[role];
  if (!target) {
    window.location.href = "./login.html";
    return;
  }
  window.location.href = target;
};

const redirectToLogin = () => {
  clearSession();
  window.location.href = "./login.html";
};

const showToastSafe = (message, type = "info") => {
  if (window.showToast) {
    window.showToast(message, type);
  }
};

const formatRole = (role = "") =>
  String(role)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const normalizePath = (value = "") => String(value).split("?")[0].split("#")[0];

const isActiveSidebarLink = (href) => {
  const currentPath = normalizePath(window.location.pathname);
  const targetPath = normalizePath(new URL(href, window.location.href).pathname);
  return currentPath === targetPath;
};

const getInitial = (name = "") => String(name || "U").trim().charAt(0).toUpperCase() || "U";

const getSidebarSectionsForUser = (user = {}) => {
  const dashboardHref = ROLE_REDIRECT_MAP[user.role] || "./tenant-dashboard.html";
  const portalLink = ROLE_PORTAL_LINK_MAP[user.role];

  return [
    {
      title: "Navigation",
      links: SIDEBAR_PRIMARY_LINKS.map((item) => ({
        ...item,
        href: item.dashboard ? dashboardHref : item.href,
      })),
    },
    {
      title: "Utilities",
      links: SIDEBAR_UTILITY_LINKS,
    },
    {
      title: "Portal",
      links: portalLink ? [{ ...portalLink, icon: "PT" }] : [],
    },
  ];
};

const createSidebarSection = (section, userRole) => {
  const block = document.createElement("section");
  block.className = "portal-side-section";

  const title = document.createElement("h4");
  title.className = "portal-side-title";
  title.textContent = section.title;
  block.appendChild(title);

  const list = document.createElement("nav");
  list.className = "portal-side-links";

  section.links.forEach((item) => {
    const link = document.createElement("a");
    link.className = "portal-side-link";
    link.href = item.href;

    const icon = document.createElement("span");
    icon.className = "portal-side-link-icon";
    icon.textContent = item.icon || "--";

    const label = document.createElement("span");
    label.className = "portal-side-link-label";
    label.textContent = item.label;

    link.appendChild(icon);
    link.appendChild(label);

    if (item.role && item.role === userRole) {
      link.classList.add("recommended");
    }
    if (isActiveSidebarLink(item.href)) {
      link.classList.add("active");
    }

    list.appendChild(link);
  });

  block.appendChild(list);
  return block;
};

const createPortalSidebar = (user = {}) => {
  const aside = document.createElement("aside");
  aside.className = "portal-sidebar";

  const brand = document.createElement("a");
  brand.className = "portal-brand";
  brand.href = "../index.html";
  brand.innerHTML = `
    <span class="portal-brand-mark">SE</span>
    <span class="portal-brand-copy">
      <strong>StayEasy</strong>
      <small>Multi Portal Control</small>
    </span>
  `;
  aside.appendChild(brand);

  const userCard = document.createElement("div");
  userCard.className = "portal-user-card";

  const helperText = document.createElement("p");
  helperText.className = "portal-user-note";
  helperText.textContent = "Logged in as";

  const nameText = document.createElement("strong");
  nameText.className = "portal-user-name";
  nameText.textContent = user.name || "User";

  const roleText = document.createElement("span");
  roleText.className = "portal-user-role";
  roleText.textContent = formatRole(user.role || "user");

  userCard.appendChild(helperText);
  userCard.appendChild(nameText);
  userCard.appendChild(roleText);

  if (user.studentCode) {
    const studentCodeText = document.createElement("p");
    studentCodeText.className = "portal-user-code";
    studentCodeText.textContent = `Student ID: ${user.studentCode}`;
    userCard.appendChild(studentCodeText);
  }

  aside.appendChild(userCard);

  getSidebarSectionsForUser(user).forEach((section) => {
    const resolvedLinks = section.links || [];

    if (!resolvedLinks.length) return;

    aside.appendChild(
      createSidebarSection(
        {
          ...section,
          links: resolvedLinks,
        },
        user.role
      )
    );
  });

  const quickActionLink = document.createElement("a");
  quickActionLink.className = "sidebar-action-btn";
  quickActionLink.href = ROLE_REDIRECT_MAP[user.role] || "./tenant-dashboard.html";
  quickActionLink.textContent = `+ ${ROLE_ACTION_COPY_MAP[user.role] || "Quick Action"}`;
  aside.appendChild(quickActionLink);

  const sidebarFooter = document.createElement("div");
  sidebarFooter.className = "portal-side-footer";

  const supportLink = document.createElement("a");
  supportLink.className = "portal-footer-link";
  supportLink.href = "../index.html";
  supportLink.textContent = "Support";

  const logoutLink = document.createElement("button");
  logoutLink.type = "button";
  logoutLink.className = "portal-footer-link";
  logoutLink.textContent = "Logout";
  logoutLink.addEventListener("click", redirectToLogin);

  sidebarFooter.appendChild(supportLink);
  sidebarFooter.appendChild(logoutLink);
  aside.appendChild(sidebarFooter);

  return aside;
};

const enhanceTopbar = (user = {}) => {
    const topbar = document.querySelector(".topbar");
    if (!topbar) return;

  const brandLink = topbar.querySelector(".brand-link");
  if (brandLink && !brandLink.querySelector(".brand-link-sub")) {
    const currentLabel = brandLink.textContent.trim() || "StayEasy";
    brandLink.textContent = "";

    const copy = document.createElement("span");
    copy.className = "brand-link-copy";

    const strong = document.createElement("strong");
    strong.textContent = currentLabel;

    const sub = document.createElement("span");
    sub.className = "brand-link-sub";
    sub.textContent = "Volumetric Control";

    copy.appendChild(strong);
    copy.appendChild(sub);
    brandLink.appendChild(copy);
  }

  if (!topbar.querySelector(".top-search-wrap")) {
    const searchWrap = document.createElement("label");
    searchWrap.className = "top-search-wrap";
    searchWrap.innerHTML = `
      <span class="top-search-icon">S</span>
      <input type="search" placeholder="Search dashboard modules..." />
    `;

    if (brandLink?.nextSibling) {
      topbar.insertBefore(searchWrap, brandLink.nextSibling);
    } else {
      topbar.appendChild(searchWrap);
    }
  }

  if (profileBox && !profileBox.querySelector(".top-action-icons")) {
    const iconBand = document.createElement("div");
    iconBand.className = "top-action-icons";
    iconBand.innerHTML = `
      <button class="top-icon-btn" type="button" aria-label="Calendar">CL</button>
      <button class="top-icon-btn" type="button" aria-label="Settings">ST</button>
    `;
    profileBox.insertBefore(iconBand, profileBox.firstChild);
  }

  if (profileBox && !profileBox.querySelector(".profile-avatar")) {
    const avatar = document.createElement("span");
    avatar.className = "profile-avatar";
    avatar.textContent = getInitial(user.name);
    profileBox.appendChild(avatar);
  }
};

const initSmartTopbar = () => {
  const topbar = document.querySelector(".topbar");
  if (!topbar) return;

  let lastY = window.scrollY || 0;
  let ticking = false;

  const syncTopbar = () => {
    const currentY = window.scrollY || 0;
    const delta = currentY - lastY;

    if (currentY <= 56) {
      topbar.classList.remove("is-hidden");
    } else if (delta > 6) {
      topbar.classList.add("is-hidden");
    } else if (delta < -6) {
      topbar.classList.remove("is-hidden");
    }

    lastY = currentY;
    ticking = false;
  };

  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(syncTopbar);
    },
    { passive: true }
  );
};

const initTopbarSearch = () => {
  const searchInput = document.querySelector(".top-search-wrap input[type='search']");
  const sections = Array.from(document.querySelectorAll(".dashboard-main > .section-card, .dashboard-main > .intro"));
  if (!searchInput || !sections.length) return;

  let clearFocusTimer = null;

  const clearSectionFocus = () => {
    sections.forEach((section) => section.classList.remove("section-focus"));
  };

  const findSectionMatch = (query) => {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    if (!normalizedQuery) return null;

    return sections.find((section) => {
      const heading = section.querySelector("h1, h2, h3");
      const headingText = (heading?.textContent || "").toLowerCase();
      const sectionText = section.textContent.toLowerCase();
      return headingText.includes(normalizedQuery) || sectionText.includes(normalizedQuery);
    });
  };

  const jumpToSection = (query) => {
    const match = findSectionMatch(query);
    if (!match) {
      if (window.showToast) {
        window.showToast("No matching section found.", "info");
      }
      return;
    }

    clearSectionFocus();
    match.classList.add("section-focus");
    match.scrollIntoView({ behavior: "smooth", block: "start" });

    if (clearFocusTimer) {
      clearTimeout(clearFocusTimer);
    }
    clearFocusTimer = setTimeout(() => {
      match.classList.remove("section-focus");
    }, 2200);
  };

  searchInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    jumpToSection(searchInput.value);
  });

  searchInput.addEventListener("search", () => {
    if (!searchInput.value.trim()) {
      clearSectionFocus();
    }
  });
};

const initResponsiveTableCards = () => {
  const tables = Array.from(document.querySelectorAll(".data-table"));
  if (!tables.length) return;

  const applyLabels = (table) => {
    const headers = Array.from(table.querySelectorAll("thead th")).map((th) =>
      (th.textContent || "").trim()
    );

    const rows = table.querySelectorAll("tbody tr");
    rows.forEach((row) => {
      const cells = row.querySelectorAll("td");
      cells.forEach((cell, index) => {
        const fallback = `Column ${index + 1}`;
        cell.setAttribute("data-label", headers[index] || fallback);
      });
    });
  };

  tables.forEach((table) => {
    applyLabels(table);

    const observer = new MutationObserver(() => {
      applyLabels(table);
    });

    observer.observe(table, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  });
};

const initPortalSectionManager = () => {
  const main = document.querySelector(".dashboard-main");
  if (!main) return;

  const allSections = Array.from(main.querySelectorAll(".section-card"));
  if (!allSections.length) return;

  const managedSections = [];

  const getSectionLabel = (section, index) => {
    const titleNode = section.querySelector(".section-title h1, .section-title h2, .section-title h3");
    const title = (titleNode?.textContent || "").trim();
    if (title) return title;
    return `Section ${index + 1}`;
  };

  const setCollapsedState = (section, collapsed) => {
    const body = section.querySelector(":scope > .section-collapse-body");
    const toggleBtn = section.querySelector(":scope > .section-title .section-collapse-toggle");
    if (!body || !toggleBtn) return;

    section.classList.toggle("is-collapsed", collapsed);
    toggleBtn.setAttribute("aria-expanded", String(!collapsed));
    toggleBtn.textContent = collapsed ? "Expand" : "Collapse";
  };

  allSections.forEach((section, index) => {
    if (section.dataset.portalManaged === "1") return;

    const titleRow = section.querySelector(":scope > .section-title");
    if (!titleRow) return;

    const siblings = Array.from(section.children).filter((child) => child !== titleRow);
    if (!siblings.length) return;

    const body = document.createElement("div");
    body.className = "section-collapse-body";
    siblings.forEach((node) => body.appendChild(node));
    section.appendChild(body);

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "section-collapse-toggle";
    toggleBtn.textContent = "Collapse";
    toggleBtn.setAttribute("aria-expanded", "true");
    titleRow.appendChild(toggleBtn);

    if (!section.id) {
      section.id = `portal-section-${index + 1}`;
    }

    section.dataset.portalManaged = "1";
    managedSections.push({
      id: section.id,
      label: getSectionLabel(section, index),
      node: section,
    });

    toggleBtn.addEventListener("click", () => {
      const currentlyCollapsed = section.classList.contains("is-collapsed");
      setCollapsedState(section, !currentlyCollapsed);
    });
  });

  if (!managedSections.length) return;

  const switcher = document.createElement("section");
  switcher.className = "portal-module-switcher section-card";
  switcher.innerHTML = `
    <div class="section-title">
      <h2>Quick Modules</h2>
      <button type="button" class="portal-compact-toggle">Compact: ON</button>
    </div>
    <div class="portal-module-chips"></div>
  `;

  const chipsWrap = switcher.querySelector(".portal-module-chips");
  const compactToggle = switcher.querySelector(".portal-compact-toggle");

  const buttons = [];
  let compactMode = window.matchMedia("(max-width: 900px)").matches;

  const setActiveChip = (targetId) => {
    buttons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.target === targetId);
    });
  };

  const applyCompactMode = (targetId = managedSections[0].id) => {
    compactToggle.textContent = compactMode ? "Compact: ON" : "Compact: OFF";

    if (!compactMode) {
      managedSections.forEach((entry) => setCollapsedState(entry.node, false));
      setActiveChip("all");
      return;
    }

    managedSections.forEach((entry) => {
      const shouldOpen = entry.id === targetId;
      setCollapsedState(entry.node, !shouldOpen);
    });
    setActiveChip(targetId);
  };

  const jumpToSection = (entry) => {
    if (!entry) return;
    if (compactMode) {
      applyCompactMode(entry.id);
    } else {
      setCollapsedState(entry.node, false);
      setActiveChip(entry.id);
    }

    entry.node.scrollIntoView({ behavior: "smooth", block: "start" });
    entry.node.classList.add("section-focus");
    setTimeout(() => entry.node.classList.remove("section-focus"), 1800);
  };

  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = "portal-module-chip";
  allBtn.dataset.target = "all";
  allBtn.textContent = "All Sections";
  allBtn.addEventListener("click", () => {
    compactMode = false;
    applyCompactMode();
  });
  chipsWrap.appendChild(allBtn);
  buttons.push(allBtn);

  managedSections.forEach((entry) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "portal-module-chip";
    btn.dataset.target = entry.id;
    btn.textContent = entry.label;
    btn.addEventListener("click", () => {
      jumpToSection(entry);
    });
    chipsWrap.appendChild(btn);
    buttons.push(btn);
  });

  compactToggle.addEventListener("click", () => {
    compactMode = !compactMode;
    applyCompactMode();
  });

  const firstSection = managedSections[0]?.node;
  if (firstSection) {
    main.insertBefore(switcher, firstSection);
  } else {
    main.prepend(switcher);
  }

  applyCompactMode();
};

const mountDashboardSidebar = (user = {}) => {
  const shell = document.querySelector(".dashboard-shell");
  const topbar = shell?.querySelector(".topbar");

  if (!shell || !topbar || shell.querySelector(".portal-sidebar")) return;

  const layout = document.createElement("div");
  layout.className = "dashboard-layout";

  const main = document.createElement("main");
  main.className = "dashboard-main";

  const sections = Array.from(shell.children).filter((node) => node !== topbar);
  sections.forEach((node) => main.appendChild(node));

  layout.appendChild(createPortalSidebar(user));
  layout.appendChild(main);
  shell.appendChild(layout);
};

const updateSidebarIdentity = (user = {}) => {
  const nameEl = document.querySelector(".portal-user-name");
  const roleEl = document.querySelector(".portal-user-role");
  const codeEl = document.querySelector(".portal-user-code");
  const userCard = document.querySelector(".portal-user-card");

  if (nameEl) nameEl.textContent = user.name || "User";
  if (roleEl) roleEl.textContent = formatRole(user.role || "user");

  const avatarEl = profileBox?.querySelector(".profile-avatar");
  if (avatarEl) {
    avatarEl.textContent = getInitial(user.name || "User");
  }

  if (!userCard) return;

  if (user.studentCode) {
    if (codeEl) {
      codeEl.textContent = `Student ID: ${user.studentCode}`;
    } else {
      const studentCodeText = document.createElement("p");
      studentCodeText.className = "portal-user-code";
      studentCodeText.textContent = `Student ID: ${user.studentCode}`;
      userCard.appendChild(studentCodeText);
    }
  } else if (codeEl) {
    codeEl.remove();
  }
};

const ensureTopRoleBadge = (role) => {
  if (!profileBox) return;

  let badge = profileBox.querySelector(".top-role-badge");
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "top-role-badge";
    profileBox.insertBefore(badge, profileBox.firstChild);
  }

  badge.textContent = formatRole(role || "user");
};

const formatTimeAgo = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";

  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

const createNotificationBell = () => {
  if (!profileBox) return null;

  const wrapper = document.createElement("div");
  wrapper.className = "notification-wrap";
  wrapper.innerHTML = `
    <button class="notif-btn" id="notifToggleBtn" type="button" aria-label="Notifications">
      Alerts
      <span id="notifCount" class="notif-count" style="display:none">0</span>
    </button>
    <div id="notifDropdown" class="notif-dropdown">
      <div class="notif-head">
        <strong>Notifications</strong>
        <button id="notifClearBtn" class="notif-clear" type="button">Mark all read</button>
      </div>
      <div id="notifList" class="notif-list">
        <div class="notif-empty">Loading notifications...</div>
      </div>
    </div>
  `;

  profileBox.insertBefore(wrapper, profileBox.firstChild);

  return {
    wrapper,
    toggleBtn: wrapper.querySelector("#notifToggleBtn"),
    countEl: wrapper.querySelector("#notifCount"),
    dropdown: wrapper.querySelector("#notifDropdown"),
    clearBtn: wrapper.querySelector("#notifClearBtn"),
    listEl: wrapper.querySelector("#notifList"),
  };
};

const initNotificationBell = (token) => {
  const bell = createNotificationBell();
  if (!bell || !token) return;

  const headers = { Authorization: `Bearer ${token}` };
  let notifications = [];

  const render = () => {
    const unreadCount = notifications.filter((item) => !item.isRead).length;

    bell.countEl.textContent = unreadCount;
    bell.countEl.style.display = unreadCount ? "grid" : "none";

    if (!notifications.length) {
      bell.listEl.innerHTML = `<div class="notif-empty">No notifications yet.</div>`;
      return;
    }

    bell.listEl.innerHTML = notifications
      .map(
        (item) => `
          <article class="notif-item ${item.isRead ? "" : "unread"}" data-id="${item._id}">
            <div class="notif-title">${item.title}</div>
            <div class="notif-text">${item.message}</div>
            <div class="notif-meta">${formatTimeAgo(item.createdAt)}</div>
          </article>
        `
      )
      .join("");
  };

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications`, { headers });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to load notifications.");
      }

      notifications = data.notifications || [];
      render();
    } catch (error) {
      bell.listEl.innerHTML = `<div class="notif-empty">Failed to load notifications.</div>`;
    }
  };

  const markRead = async (notificationId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
        method: "PUT",
        headers,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to mark notification as read.");
      }

      notifications = notifications.map((item) =>
        item._id === notificationId ? { ...item, isRead: true } : item
      );
      render();
    } catch (error) {
      showToastSafe(error.message, "error");
    }
  };

  const markAllRead = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
        method: "PUT",
        headers,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to mark all as read.");
      }

      notifications = notifications.map((item) => ({ ...item, isRead: true }));
      render();
      showToastSafe("All notifications marked as read.", "success");
    } catch (error) {
      showToastSafe(error.message, "error");
    }
  };

  bell.toggleBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    bell.dropdown.classList.toggle("open");
  });

  bell.listEl.addEventListener("click", (event) => {
    const item = event.target.closest(".notif-item");
    if (!item) return;

    const notificationId = item.dataset.id;
    if (!notificationId) return;

    const targetNotification = notifications.find((entry) => entry._id === notificationId);
    if (targetNotification && !targetNotification.isRead) {
      markRead(notificationId);
    }
  });

  bell.clearBtn.addEventListener("click", () => {
    markAllRead();
  });

  document.addEventListener("click", (event) => {
    if (!bell.wrapper.contains(event.target)) {
      bell.dropdown.classList.remove("open");
    }
  });

  fetchNotifications();
  setInterval(fetchNotifications, 60000);
};

const verifySession = async (token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      redirectToLogin();
      return null;
    }

    const data = await response.json();
    localStorage.setItem("stayeasy_user", JSON.stringify(data.user));

    if (userNameEl) userNameEl.textContent = data.user.name;
    if (userRoleEl) userRoleEl.textContent = data.user.role;
    ensureTopRoleBadge(data.user.role);

    return data.user;
  } catch (error) {
    redirectToLogin();
    return null;
  }
};

const bootstrapDashboard = async () => {
  const token = localStorage.getItem("stayeasy_token");
  const user = getStoredUser();

  if (!token || !user?.role) {
    redirectToLogin();
    return;
  }

  const allowedRoleString = document.body.dataset.allowedRoles || "";
  const allowedRoles = allowedRoleString
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);

  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    redirectByRole(user.role);
    return;
  }

  if (userNameEl) userNameEl.textContent = user.name || "User";
  if (userRoleEl) userRoleEl.textContent = user.role;
  enhanceTopbar(user);
  initSmartTopbar();
  ensureTopRoleBadge(user.role);
  mountDashboardSidebar(user);
  initTopbarSearch();
  initResponsiveTableCards();
  initPortalSectionManager();

  initNotificationBell(token);
  const freshUser = await verifySession(token);
  if (freshUser) {
    if (userNameEl) userNameEl.textContent = freshUser.name || "User";
    if (userRoleEl) userRoleEl.textContent = freshUser.role;
    ensureTopRoleBadge(freshUser.role);
    updateSidebarIdentity(freshUser);
  }
};

logoutButtons.forEach((button) => {
  button.addEventListener("click", redirectToLogin);
});

bootstrapDashboard();

