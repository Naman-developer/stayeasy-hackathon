const API_BASE_URL = "http://localhost:5000/api";

const token = localStorage.getItem("stayeasy_token");

const searchForm = document.getElementById("searchForm");
const resultsGrid = document.getElementById("resultsGrid");
const emptyState = document.getElementById("emptyState");
const citySuggestions = document.getElementById("citySuggestions");

const cityInput = document.getElementById("city");
const localityInput = document.getElementById("locality");
const typeInput = document.getElementById("type");
const minPriceInput = document.getElementById("minPrice");
const maxPriceInput = document.getElementById("maxPrice");
const preferencesInput = document.getElementById("preferences");

const aiRecommendationGrid = document.getElementById("aiRecommendationGrid");
const aiRecommendationEmpty = document.getElementById("aiRecommendationEmpty");
const refreshAiBtn = document.getElementById("refreshAiBtn");

const fallbackImage =
  "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80";

const formatPrice = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });

const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
});

const showToastSafe = (message, type = "info") => {
  if (window.showToast) {
    window.showToast(message, type);
  }
};

const getQueryParams = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    city: params.get("city") || "",
    locality: params.get("locality") || "",
    type: params.get("type") || "",
    minPrice: params.get("minPrice") || "",
    maxPrice: params.get("maxPrice") || "",
    preferences: params.get("preferences") || "",
  };
};

const setFormFromQuery = () => {
  const query = getQueryParams();
  cityInput.value = query.city;
  localityInput.value = query.locality;
  typeInput.value = query.type;
  minPriceInput.value = query.minPrice;
  maxPriceInput.value = query.maxPrice;
  preferencesInput.value = query.preferences;
};

const updateUrlWithFilters = ({
  city,
  locality,
  type,
  minPrice,
  maxPrice,
  preferences,
}) => {
  const params = new URLSearchParams();
  if (city) params.set("city", city);
  if (locality) params.set("locality", locality);
  if (type) params.set("type", type);
  if (minPrice) params.set("minPrice", minPrice);
  if (maxPrice) params.set("maxPrice", maxPrice);
  if (preferences) params.set("preferences", preferences);

  const query = params.toString();
  const newUrl = query
    ? `${window.location.pathname}?${query}`
    : window.location.pathname;
  window.history.replaceState({}, "", newUrl);
};

const renderSkeleton = () => {
  resultsGrid.innerHTML = `
    <div class="skeleton-grid" style="grid-column: 1 / -1; width: 100%;">
      ${Array.from({ length: 6 })
        .map(
          () => `
            <article class="skeleton-card">
              <div class="skeleton-media"></div>
              <div class="skeleton-body">
                <div class="skeleton-line"></div>
                <div class="skeleton-line"></div>
                <div class="skeleton-line short"></div>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
};

const renderProperties = (properties) => {
  resultsGrid.innerHTML = "";

  if (!properties.length) {
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";

  const fragment = document.createDocumentFragment();

  properties.forEach((property) => {
    const card = document.createElement("article");
    card.className = "property-card";
    card.innerHTML = `
      <img loading="lazy" decoding="async" src="${property.images?.[0] || fallbackImage}" alt="${
      property.title
    }" />
      <div class="card-body">
        <h3>${property.title}</h3>
        <p class="property-meta">${property.city} - ${property.propertyType.toUpperCase()}</p>
        <p class="property-price">${formatPrice(property.price)} / ${property.priceType}</p>
        <p>
          <span class="badge ${property.isVerified ? "verified" : "pending"}">
            ${property.isVerified ? "Verified" : "Approved"}
          </span>
        </p>
        <a class="market-btn primary" style="display:inline-block; margin-top:0.6rem" href="./property-details.html?id=${
          property._id
        }">
          View Details
        </a>
      </div>
    `;
    fragment.appendChild(card);
  });

  resultsGrid.appendChild(fragment);
};

const fetchProperties = async () => {
  try {
    renderSkeleton();
    emptyState.style.display = "none";
    const query = getQueryParams();

    const params = new URLSearchParams();
    if (query.city) params.set("city", query.city);
    if (query.locality) params.set("locality", query.locality);
    if (query.type) params.set("type", query.type);
    if (query.minPrice) params.set("minPrice", query.minPrice);
    if (query.maxPrice) params.set("maxPrice", query.maxPrice);

    const response = await fetch(`${API_BASE_URL}/properties?${params.toString()}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Unable to fetch properties.");
    }

    renderProperties(data.properties || []);
  } catch (error) {
    resultsGrid.innerHTML = `<div class="empty-block">${error.message}</div>`;
    emptyState.style.display = "none";
    showToastSafe(error.message, "error");
  }
};

const renderSuggestions = (suggestions) => {
  if (!citySuggestions) return;

  citySuggestions.innerHTML = "";
  if (!suggestions.length) {
    citySuggestions.classList.remove("open");
    return;
  }

  citySuggestions.innerHTML = suggestions
    .map(
      (item) => `
        <div class="suggestion-item" data-city="${item.city}">
          <strong>${item.city}</strong> - ${item.title}
        </div>
      `
    )
    .join("");
  citySuggestions.classList.add("open");
};

const fetchSuggestions = async (keyword) => {
  if (!citySuggestions) return;

  const q = keyword.trim();
  if (q.length < 2) {
    renderSuggestions([]);
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/properties/suggestions?q=${encodeURIComponent(q)}`
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Unable to load suggestions.");
    }

    renderSuggestions(data.suggestions || []);
  } catch (error) {
    renderSuggestions([]);
  }
};

const renderRecommendationCards = (recommendations) => {
  if (!aiRecommendationGrid || !aiRecommendationEmpty) return;

  aiRecommendationGrid.innerHTML = "";
  aiRecommendationEmpty.style.display = "none";

  if (!recommendations.length) {
    aiRecommendationEmpty.textContent =
      "No AI recommendations for the selected filters.";
    aiRecommendationEmpty.style.display = "block";
    return;
  }

  const fragment = document.createDocumentFragment();

  recommendations.forEach((property) => {
    const card = document.createElement("article");
    card.className = "property-card";
    card.innerHTML = `
      <img loading="lazy" decoding="async" src="${property.images?.[0] || fallbackImage}" alt="${
      property.title
    }" />
      <div class="card-body">
        <h3>${property.title}</h3>
        <p class="property-meta">${property.city} - ${property.propertyType.toUpperCase()}</p>
        <p class="property-price">${formatPrice(property.price)} / ${property.priceType}</p>
        <p class="muted-text"><strong>AI Score:</strong> ${property.aiScore}</p>
        <p class="muted-text">${property.aiReason || "Matched your search preference."}</p>
        <a class="market-btn primary" style="display:inline-block; margin-top:0.6rem" href="./property-details.html?id=${
          property._id
        }">
          View Details
        </a>
      </div>
    `;
    fragment.appendChild(card);
  });

  aiRecommendationGrid.appendChild(fragment);
};

const fetchRecommendations = async () => {
  if (!aiRecommendationGrid || !aiRecommendationEmpty) return;

  aiRecommendationGrid.innerHTML = "";

  if (!token) {
    aiRecommendationEmpty.textContent =
      "Login to unlock AI recommendations personalized to your role and history.";
    aiRecommendationEmpty.style.display = "block";
    return;
  }

  const query = getQueryParams();
  const params = new URLSearchParams();
  if (query.city) params.set("city", query.city);
  if (query.locality) params.set("locality", query.locality);
  if (query.type) params.set("type", query.type);
  if (query.maxPrice) params.set("budget", query.maxPrice);
  if (query.preferences) params.set("preferences", query.preferences);

  aiRecommendationGrid.innerHTML = `
    <div class="empty-block" style="grid-column: 1 / -1">Loading AI recommendations...</div>
  `;

  try {
    const response = await fetch(`${API_BASE_URL}/recommendations?${params.toString()}`, {
      headers: authHeaders(),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Unable to load recommendations.");
    }

    renderRecommendationCards(data.recommendations || []);
  } catch (error) {
    aiRecommendationGrid.innerHTML = "";
    aiRecommendationEmpty.textContent = error.message;
    aiRecommendationEmpty.style.display = "block";
  }
};

const syncFiltersAndFetch = () => {
  const query = {
    city: cityInput.value.trim(),
    locality: localityInput.value.trim(),
    type: typeInput.value,
    minPrice: minPriceInput.value.trim(),
    maxPrice: maxPriceInput.value.trim(),
    preferences: preferencesInput.value.trim(),
  };
  updateUrlWithFilters(query);
  fetchProperties();
  fetchRecommendations();
};

const debouncedSuggestionFetch = window.StayEasyUI
  ? window.StayEasyUI.debounce(fetchSuggestions, 260)
  : fetchSuggestions;

const debouncedFilterFetch = window.StayEasyUI
  ? window.StayEasyUI.debounce(syncFiltersAndFetch, 380)
  : null;

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  syncFiltersAndFetch();
});

if (cityInput) {
  cityInput.addEventListener("input", (event) => {
    debouncedSuggestionFetch(event.target.value);
    if (debouncedFilterFetch) debouncedFilterFetch();
  });
}

[localityInput, typeInput, minPriceInput, maxPriceInput, preferencesInput].forEach((input) => {
  if (!input || !debouncedFilterFetch) return;
  const eventName = input.tagName === "SELECT" ? "change" : "input";
  input.addEventListener(eventName, debouncedFilterFetch);
});

if (citySuggestions) {
  citySuggestions.addEventListener("click", (event) => {
    const item = event.target.closest(".suggestion-item");
    if (!item) return;

    cityInput.value = item.dataset.city || "";
    citySuggestions.classList.remove("open");
    syncFiltersAndFetch();
  });

  document.addEventListener("click", (event) => {
    if (!citySuggestions.contains(event.target) && event.target !== cityInput) {
      citySuggestions.classList.remove("open");
    }
  });
}

refreshAiBtn?.addEventListener("click", fetchRecommendations);

setFormFromQuery();
fetchProperties();
fetchRecommendations();
