const API_BASE_URL = "https://stayeasy-hackathon-production.up.railway.app/api";

const ROLE_REDIRECT_MAP = {
  student: "./pages/student-dashboard.html",
  tenant: "./pages/tenant-dashboard.html",
  owner: "./pages/owner-dashboard.html",
  flat_owner: "./pages/owner-dashboard.html",
  pg_owner: "./pages/owner-dashboard.html",
  hostel_owner: "./pages/hostel-dashboard.html",
  parent: "./pages/parent-dashboard.html",
  worker: "./pages/worker-dashboard.html",
  admin: "./pages/admin-dashboard.html",
};

const navActions = document.querySelector(".nav-actions");

const getStoredUser = () => {
  const raw = localStorage.getItem("stayeasy_user");
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
};

const clearSession = () => {
  localStorage.removeItem("stayeasy_token");
  localStorage.removeItem("stayeasy_user");
};

const formatRole = (role = "") =>
  String(role)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const renderNavbarForAuthState = () => {
  if (!navActions) return;

  const token = localStorage.getItem("stayeasy_token");
  const user = getStoredUser();
  const dashboardUrl = user?.role ? ROLE_REDIRECT_MAP[user.role] : "";

  if (!token || !dashboardUrl) {
    return;
  }

  navActions.innerHTML = `
    <a class="ghost-btn" href="#how-it-works">How It Works</a>
    <a class="ghost-btn" href="./pages/worker.html">Helpers</a>
    <span class="home-user-chip">${user.name || "User"} (${formatRole(user.role)})</span>
    <a class="solid-btn" href="${dashboardUrl}">Open Dashboard</a>
    <button id="homeLogoutBtn" class="ghost-btn home-logout-btn" type="button">Logout</button>
  `;

  const logoutButton = document.getElementById("homeLogoutBtn");
  logoutButton?.addEventListener("click", () => {
    clearSession();
    window.location.href = "./index.html";
  });
};

const redirectToDashboardIfLoggedIn = () => {
  const token = localStorage.getItem("stayeasy_token");
  const user = getStoredUser();

  if (token && user?.role && ROLE_REDIRECT_MAP[user.role]) {
    window.location.href = ROLE_REDIRECT_MAP[user.role];
  }
};

const detectLocationBtn = document.getElementById("detectLocationBtn");
const locationInput = document.getElementById("locationInput");
const quickSearchForm = document.getElementById("quickSearchForm");
const propertyTypeSelect = document.getElementById("propertyType");
const quickBudgetInput = document.getElementById("quickBudget");
const categoryButtons = document.querySelectorAll(".tag-btn[data-type]");
const featuredTrack = document.getElementById("featuredTrack");
const featuredPrev = document.getElementById("featuredPrev");
const featuredNext = document.getElementById("featuredNext");
const landingReviewGrid = document.getElementById("landingReviewGrid");

const featuredFallback = [
  {
    title: "Sunrise Girls Hostel",
    city: "Delhi",
    propertyType: "hostel",
    price: 9500,
    priceType: "monthly",
    images: [
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Metro View 1BHK",
    city: "Noida",
    propertyType: "flat",
    price: 17000,
    priceType: "monthly",
    images: [
      "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "City Budget PG",
    city: "Delhi",
    propertyType: "pg",
    price: 8200,
    priceType: "monthly",
    images: [
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80",
    ],
  },
];

const reviewFallback = [
  {
    reviewerName: "Aditi",
    reviewerRole: "student",
    rating: 5,
    title: "Smooth student onboarding",
    message:
      "Found my PG in less than 10 minutes. The verified badge gave me confidence to book.",
  },
  {
    reviewerName: "Rohit",
    reviewerRole: "tenant",
    rating: 4,
    title: "Good listing quality",
    message:
      "Listing and approval was clear. I could track status and bookings from one owner dashboard.",
  },
  {
    reviewerName: "Kavita",
    reviewerRole: "parent",
    rating: 5,
    title: "Parent visibility is useful",
    message:
      "Parent view plus outpass approvals makes hostel management transparent and safer for students.",
  },
];

const formatPrice = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const syncCategoryButtons = () => {
  const selectedType = propertyTypeSelect?.value || "";
  categoryButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.type === selectedType);
  });
};

const buildSearchUrl = () => {
  const city = locationInput?.value?.trim() || "";
  const type = propertyTypeSelect?.value || "";
  const maxPrice = quickBudgetInput?.value?.trim() || "";

  const params = new URLSearchParams();
  if (city) params.set("city", city);
  if (type) params.set("type", type);
  if (maxPrice) params.set("maxPrice", maxPrice);

  const query = params.toString();
  return query ? `./pages/search-results.html?${query}` : "./pages/search-results.html";
};

const renderFeaturedListings = (properties) => {
  if (!featuredTrack) return;

  const list = properties.length ? properties : featuredFallback;
  featuredTrack.innerHTML = "";

  list.forEach((property) => {
    const fallbackQuery = new URLSearchParams();
    if (property.city) fallbackQuery.set("city", property.city);
    if (property.propertyType) fallbackQuery.set("type", property.propertyType);

    const targetUrl = property._id
      ? `./pages/property-details.html?id=${property._id}`
      : `./pages/search-results.html?${fallbackQuery.toString()}`;

    const card = document.createElement("article");
    card.className = "featured-card";
    card.innerHTML = `
      <a class="featured-link" href="${targetUrl}">
        <img loading="lazy" src="${property.images?.[0] || featuredFallback[0].images[0]}" alt="${
      property.title
    }" />
        <div class="featured-body">
          <h3>${property.title}</h3>
          <p class="featured-meta">${property.city} - ${property.propertyType.toUpperCase()}</p>
          <p class="featured-price">${formatPrice(property.price)} / ${property.priceType}</p>
          <span class="featured-action">View Details</span>
        </div>
      </a>
    `;
    featuredTrack.appendChild(card);
  });
};

const loadFeaturedListings = async () => {
  if (!featuredTrack) return;

  featuredTrack.innerHTML = `
    <div class="featured-card" style="display:grid; place-items:center; min-height: 210px;">
      <p class="featured-meta">Loading listings <span class="loading-dots"><span></span><span></span><span></span></span></p>
    </div>
  `;

  try {
    const response = await fetch(`${API_BASE_URL}/properties`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Unable to load featured listings.");
    }

    renderFeaturedListings((data.properties || []).slice(0, 8));
  } catch (error) {
    renderFeaturedListings([]);
    if (window.showToast) {
      window.showToast("Showing fallback featured listings.", "info");
    }
  }
};

const renderLandingReviews = (reviews = []) => {
  if (!landingReviewGrid) return;

  const list = reviews.length ? reviews : reviewFallback;
  landingReviewGrid.innerHTML = list
    .map(
      (review) => `
        <article class="testimonial">
          <h3>${escapeHtml(review.title || "Community Feedback")}</h3>
          <p style="margin-top:0.4rem">
            "${escapeHtml(review.message || "Great experience with StayEasy.")}"
          </p>
          <p class="featured-meta" style="margin-top:0.65rem">
            ${escapeHtml(review.reviewerName || "User")} - ${escapeHtml(
              String(review.reviewerRole || "user").replace(/_/g, " ")
            )} - Rating ${escapeHtml(review.rating || 0)}/5
          </p>
        </article>
      `
    )
    .join("");
};

const loadLandingReviews = async () => {
  if (!landingReviewGrid) return;

  try {
    const response = await fetch(`${API_BASE_URL}/reviews/public?limit=6`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Unable to load community reviews.");
    }

    renderLandingReviews(data.reviews || []);
  } catch (error) {
    renderLandingReviews([]);
  }
};

const initFeaturedCarousel = () => {
  if (!featuredTrack || !featuredPrev || !featuredNext) return;

  featuredPrev.addEventListener("click", () => {
    featuredTrack.scrollBy({ left: -260, behavior: "smooth" });
  });

  featuredNext.addEventListener("click", () => {
    featuredTrack.scrollBy({ left: 260, behavior: "smooth" });
  });
};

const initRevealAnimations = () => {
  const revealElements = document.querySelectorAll(".reveal");
  if (!revealElements.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.16 }
  );

  revealElements.forEach((element) => observer.observe(element));
};

if (detectLocationBtn && locationInput) {
  detectLocationBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
      if (window.showToast) {
        window.showToast("Geolocation is not supported in this browser.", "error");
      }
      return;
    }

    detectLocationBtn.disabled = true;
    detectLocationBtn.textContent = "Detecting...";

    navigator.geolocation.getCurrentPosition(
      () => {
        locationInput.value = "Current Location";
        if (window.showToast) {
          window.showToast("Current location captured.", "success");
        }
        detectLocationBtn.disabled = false;
        detectLocationBtn.textContent = "Use Location";
      },
      () => {
        if (window.showToast) {
          window.showToast("Unable to detect location. Enter city manually.", "error");
        }
        detectLocationBtn.disabled = false;
        detectLocationBtn.textContent = "Use Location";
      }
    );
  });
}

if (categoryButtons.length && propertyTypeSelect) {
  categoryButtons.forEach((button) => {
    button.addEventListener("click", () => {
      propertyTypeSelect.value = button.dataset.type || "";
      syncCategoryButtons();
    });
  });

  propertyTypeSelect.addEventListener("change", syncCategoryButtons);
  syncCategoryButtons();
}

if (quickSearchForm) {
  quickSearchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    window.location.href = buildSearchUrl();
  });
}

renderNavbarForAuthState();
loadFeaturedListings();
loadLandingReviews();
initFeaturedCarousel();
initRevealAnimations();

