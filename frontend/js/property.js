(() => {
  const API_BASE_URL = localStorage.getItem("stayeasy_api_base_url") || "https://stayeasy-hackathon-production.up.railway.app/api";

  const token = localStorage.getItem("stayeasy_token");
  const storedUserRaw = localStorage.getItem("stayeasy_user");
  let storedUser = null;
  try {
    storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;
  } catch (error) {
    storedUser = null;
  }

  const authHeaders = () => {
    const headers = { "Content-Type": "application/json" };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  };

  const showToastSafe = (message, type = "info") => {
    if (window.showToast) {
      window.showToast(message, type);
    }
  };

  const formatPrice = (value) =>
    Number(value || 0).toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    });

  const getStatusPill = (status) =>
    `<span class="status-pill ${status}">${status.replace("_", " ")}</span>`;

  const parseCsv = (value) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const uniqueItems = (values) => [...new Set(values.filter(Boolean))];

  // -------------------------
  // Property details page
  // -------------------------
  const detailsCard = document.getElementById("propertyDetailsCard");

  const loadPropertyDetailsPage = async () => {
    if (!detailsCard) return;

    const params = new URLSearchParams(window.location.search);
    const propertyId = params.get("id");

    if (!propertyId) {
      detailsCard.innerHTML = "<div class='empty-block'>Property ID is missing.</div>";
      return;
    }

    detailsCard.innerHTML = `
      <div class="skeleton-grid single-column">
        <article class="skeleton-card">
          <div class="skeleton-media skeleton-media-tall"></div>
          <div class="skeleton-body">
            <div class="skeleton-line"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line short"></div>
          </div>
        </article>
      </div>
    `;

    try {
      const response = await fetch(`${API_BASE_URL}/properties/${propertyId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load property details.");
      }

      const property = data.property;
      const images = property.images?.length
        ? property.images
        : [
            "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
          ];

      detailsCard.innerHTML = `
        <div class="detail-layout">
          <article>
            <img id="mainPropertyImage" class="hero-image" src="${images[0]}" alt="${
        property.title
      }" />
            <div class="thumb-grid">
              ${images
                .map(
                  (img) =>
                    `<img loading="lazy" decoding="async" class="gallery-thumb" src="${img}" alt="${property.title} image" />`
                )
                .join("")}
            </div>
          </article>

          <article class="property-side">
            <h2>${property.title}</h2>
            <p class="muted-text">${property.city} - ${String(property.propertyType || "stay").toUpperCase()}</p>
            <p class="property-detail-price">
              ${formatPrice(property.price)} / ${property.priceType}
            </p>
            <p class="muted-text">
              Occupancy: ${property.occupancy} - Gender: ${property.genderPreference}
            </p>
            <p class="muted-text property-address">Address: ${property.address}</p>

            <div class="amenities-list">
              ${(property.amenities || [])
                .map((item) => `<span class="amenity-pill">${item}</span>`)
                .join("") || "<span class='amenity-pill'>Basic stay amenities</span>"}
            </div>

            <a class="market-btn primary" href="./booking.html?propertyId=${property._id}">
              Continue to Booking
            </a>

            <div class="property-owner-box">
              <h4>Owner Info</h4>
              <p class="muted-text">${property.ownerId?.name || "Owner"} - ${
        property.ownerId?.phone || "N/A"
      }</p>
            </div>
          </article>
        </div>

        <section class="property-section">
          <h3>Description</h3>
          <p class="muted-text">${property.description}</p>
        </section>

        <section class="property-section">
          <h3>Reviews</h3>
          <p class="muted-text">Rating: ${property.rating}/5 from ${property.totalReviews} reviews</p>
          <article class="review-card">
            <strong>Demo Review</strong>
            <p class="muted-text">Clean rooms, safe environment, and smooth booking process.</p>
          </article>
        </section>
      `;

      const mainImg = document.getElementById("mainPropertyImage");
      const thumbs = document.querySelectorAll(".gallery-thumb");
      thumbs.forEach((thumb) => {
        thumb.addEventListener("click", () => {
          mainImg.src = thumb.src;
        });
      });
    } catch (error) {
      detailsCard.innerHTML = `<div class="empty-block">${error.message}</div>`;
      showToastSafe(error.message, "error");
    }
  };

  // -------------------------
  // Owner dashboard page
  // -------------------------
  const ownerForm = document.getElementById("propertyForm");
  const ownerListingsTableBody = document.getElementById("ownerListingsTableBody");
  const ownerBookingsTableBody = document.getElementById("ownerBookingsTableBody");
  const ownerMessage = document.getElementById("ownerFormMessage");
  const formTitle = document.getElementById("propertyFormTitle");
  const editPropertyIdInput = document.getElementById("editPropertyId");
  const cancelEditBtn = document.getElementById("cancelEditBtn");
  const savePropertyBtn = document.getElementById("savePropertyBtn");
  const kpiTotalListings = document.getElementById("kpiTotalListings");
  const kpiApprovedListings = document.getElementById("kpiApprovedListings");
  const kpiPendingListings = document.getElementById("kpiPendingListings");
  const kpiEarnings = document.getElementById("kpiEarnings");
  const kpiBookingCount = document.getElementById("kpiBookingCount");
  const ownerOccupancyRateKpi = document.getElementById("ownerOccupancyRateKpi");
  const ownerOccupancyKpiSubtext = document.getElementById("ownerOccupancyKpiSubtext");
  const imageFilesInput = document.getElementById("imageFiles");
  const imagePreviewGrid = document.getElementById("imagePreviewGrid");
  const clearImageSelectionBtn = document.getElementById("clearImageSelectionBtn");
  const rentSuggestionForm = document.getElementById("rentSuggestionForm");
  const rentSuggestionBtn = document.getElementById("rentSuggestionBtn");
  const rentSuggestionResult = document.getElementById("rentSuggestionResult");
  const tenantTrustTableBody = document.getElementById("tenantTrustTableBody");
  const ownerReviewsBody = document.getElementById("ownerReviewsBody");

  let ownerListingsCache = [];
  let imagePayloadCache = [];

  const formatOccupancy = (property = {}) => {
    const total = Number(property.manualTotalRooms || 0);
    const filled = Number(property.manualFilledRooms || 0);
    if (total <= 0) return "0/0 rooms (0%)";
    const rate = Math.round((filled / total) * 100);
    return `${filled}/${total} rooms (${rate}%)`;
  };

  const showOwnerMessage = (text, type = "error") => {
    if (!ownerMessage) return;
    ownerMessage.textContent = text;
    ownerMessage.className = `message show ${type}`;
    showToastSafe(text, type === "success" ? "success" : "error");
  };

  const resetOwnerMessage = () => {
    if (!ownerMessage) return;
    ownerMessage.textContent = "";
    ownerMessage.className = "message";
  };

  const renderImagePreview = () => {
    if (!imagePreviewGrid) return;

    imagePreviewGrid.innerHTML = "";
    if (!imagePayloadCache.length) {
      imagePreviewGrid.innerHTML = `<p class="small-text">No uploaded images selected.</p>`;
      return;
    }

    imagePayloadCache.forEach((imageUrl, index) => {
      const wrapper = document.createElement("div");
      wrapper.className = "preview-thumb";
      wrapper.innerHTML = `
        <img src="${imageUrl}" alt="Property preview ${index + 1}" />
        <button type="button" class="preview-remove" data-index="${index}">x</button>
      `;
      imagePreviewGrid.appendChild(wrapper);
    });
  };

  const resetPropertyForm = () => {
    ownerForm.reset();
    editPropertyIdInput.value = "";
    formTitle.textContent = "Add New Property";
    savePropertyBtn.textContent = "Save Property";
    cancelEditBtn.style.display = "none";
    imagePayloadCache = [];
    if (imageFilesInput) {
      imageFilesInput.value = "";
    }
    renderImagePreview();
  };

  const renderOwnerListings = (listings) => {
    if (!ownerListingsTableBody) return;

    ownerListingsTableBody.innerHTML = "";

    if (!listings.length) {
      ownerListingsTableBody.innerHTML = `
        <tr>
          <td colspan="8" class="small-text">No listings yet. Add your first property.</td>
        </tr>
      `;
      return;
    }

    listings.forEach((property) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${property.title}</td>
        <td>${property.city}</td>
        <td>${property.propertyType}</td>
        <td>${formatPrice(property.price)} / ${property.priceType}</td>
        <td>${property.isFeatured ? `<span class="featured-badge">Featured</span>` : "-"}</td>
        <td><span class="occupancy-pill">${formatOccupancy(property)}</span></td>
        <td>${getStatusPill(property.status)}</td>
        <td>
          <div class="inline-actions">
            <button class="btn ghost" data-action="edit" data-id="${property._id}">Edit</button>
            <button class="btn warning" data-action="boost" data-id="${property._id}">Boost</button>
            <button class="btn danger" data-action="delete" data-id="${property._id}">Delete</button>
          </div>
        </td>
      `;
      ownerListingsTableBody.appendChild(row);
    });
  };

  const renderOwnerBookings = (bookings) => {
    if (!ownerBookingsTableBody) return;

    ownerBookingsTableBody.innerHTML = "";

    if (!bookings.length) {
      ownerBookingsTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="small-text">No bookings found on your properties.</td>
        </tr>
      `;
      return;
    }

    bookings.forEach((booking) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${booking._id.slice(-6).toUpperCase()}</td>
        <td>${booking.propertyId?.title || "N/A"}</td>
        <td>${booking.userId?.name || "N/A"}</td>
        <td>${formatPrice(booking.amount)}</td>
        <td>${getStatusPill(booking.status)}</td>
        <td>${getStatusPill(booking.paymentStatus)}</td>
      `;
      ownerBookingsTableBody.appendChild(row);
    });
  };

  const renderTenantTrustScores = (scoreRows) => {
    if (!tenantTrustTableBody) return;

    tenantTrustTableBody.innerHTML = "";

    if (!scoreRows.length) {
      tenantTrustTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="small-text">No tenant booking history available.</td>
        </tr>
      `;
      return;
    }

    scoreRows.forEach((item) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${item.tenantName}</td>
        <td>${item.score}</td>
        <td>${getStatusPill(item.bandClass)}</td>
        <td>${item.paidPercent}%</td>
        <td>${item.activeComplaints}</td>
      `;
      tenantTrustTableBody.appendChild(row);
    });
  };

  const renderOwnerReviews = (reviews = []) => {
    if (!ownerReviewsBody) return;

    ownerReviewsBody.innerHTML = "";
    if (!reviews.length) {
      ownerReviewsBody.innerHTML = `
        <tr>
          <td colspan="6" class="small-text">No reviews submitted yet.</td>
        </tr>
      `;
      return;
    }

    reviews.forEach((review) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${review.reviewerName || "User"}</td>
        <td>${review.reviewerRole || "-"}</td>
        <td><span class="feedback-pill">${review.rating || 0}/5</span></td>
        <td>${review.title || "-"}</td>
        <td>${review.message || "-"}</td>
        <td>${new Date(review.createdAt).toLocaleDateString("en-IN")}</td>
      `;
      ownerReviewsBody.appendChild(row);
    });
  };

  const loadOwnerReviews = async () => {
    if (!ownerReviewsBody) return;

    ownerReviewsBody.innerHTML = `
      <tr>
        <td colspan="6" class="small-text">
          <span class="loading-inline"><span class="loading-spinner"></span> Loading reviews...</span>
        </td>
      </tr>
    `;

    try {
      const response = await fetch(`${API_BASE_URL}/reviews/owner`, {
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to load reviews.");
      }
      renderOwnerReviews(data.reviews || []);
    } catch (error) {
      ownerReviewsBody.innerHTML = `
        <tr>
          <td colspan="6" class="small-text">${error.message}</td>
        </tr>
      `;
    }
  };

  const loadTenantTrustScores = async (bookings) => {
    if (!tenantTrustTableBody) return;

    const uniqueTenants = [
      ...new Map(
        bookings
          .filter((booking) => booking.userId?._id)
          .map((booking) => [booking.userId._id, booking.userId])
      ).values(),
    ];

    if (!uniqueTenants.length) {
      renderTenantTrustScores([]);
      return;
    }

    tenantTrustTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="small-text">
          <span class="loading-inline"><span class="loading-spinner"></span> Calculating trust scores...</span>
        </td>
      </tr>
    `;

    const scores = await Promise.all(
      uniqueTenants.map(async (tenant) => {
        try {
          const response = await fetch(
            `${API_BASE_URL}/bookings/owner/tenant-risk/${tenant._id}`,
            { headers: authHeaders() }
          );
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.message || "Failed to fetch trust score.");
          }

          const bandClass =
            data.trustBand === "High Trust"
              ? "approved"
              : data.trustBand === "Medium Trust"
                ? "pending"
                : "rejected";

          return {
            tenantName: data.tenant?.name || tenant.name || "Tenant",
            score: data.score,
            bandClass,
            paidPercent: data.factors?.paymentReliability ?? 0,
            activeComplaints: data.factors?.activeComplaintsAgainstTenant ?? 0,
          };
        } catch (error) {
          return {
            tenantName: tenant.name || "Tenant",
            score: "N/A",
            bandClass: "pending",
            paidPercent: 0,
            activeComplaints: 0,
          };
        }
      })
    );

    renderTenantTrustScores(scores);
  };

  const updateOwnerKpis = (listings, bookings) => {
    const total = listings.length;
    const approved = listings.filter((item) => item.status === "approved").length;
    const pending = listings.filter((item) => item.status === "pending").length;
    const earnings = bookings
      .filter((item) => item.paymentStatus === "paid" && item.status !== "cancelled")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    kpiTotalListings.textContent = total;
    kpiApprovedListings.textContent = approved;
    kpiPendingListings.textContent = pending;
    kpiEarnings.textContent = `Rs ${earnings.toLocaleString("en-IN")}`;
    if (kpiBookingCount) {
      kpiBookingCount.textContent = bookings.length;
    }

    if (ownerOccupancyRateKpi && ownerOccupancyKpiSubtext) {
      const totals = listings.reduce(
        (acc, item) => {
          acc.totalRooms += Number(item.manualTotalRooms || 0);
          acc.filledRooms += Number(item.manualFilledRooms || 0);
          return acc;
        },
        { totalRooms: 0, filledRooms: 0 }
      );
      const rate =
        totals.totalRooms > 0
          ? Math.round((totals.filledRooms / totals.totalRooms) * 100)
          : 0;
      ownerOccupancyRateKpi.textContent = `${rate}%`;
      ownerOccupancyKpiSubtext.textContent = `${totals.filledRooms}/${totals.totalRooms} rooms filled`;
    }
  };

  const loadOwnerDashboardData = async () => {
    try {
      const [listingsResponse, bookingsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/properties/my-listings`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/bookings/owner`, { headers: authHeaders() }),
      ]);

      const listingsData = await listingsResponse.json();
      const bookingsData = await bookingsResponse.json();

      if (!listingsResponse.ok) {
        throw new Error(listingsData.message || "Unable to load listings.");
      }

      if (!bookingsResponse.ok) {
        throw new Error(bookingsData.message || "Unable to load bookings.");
      }

      ownerListingsCache = listingsData.properties || [];
      const ownerBookings = bookingsData.bookings || [];

      renderOwnerListings(ownerListingsCache);
      renderOwnerBookings(ownerBookings);
      updateOwnerKpis(ownerListingsCache, ownerBookings);
      await Promise.all([loadTenantTrustScores(ownerBookings), loadOwnerReviews()]);
    } catch (error) {
      showOwnerMessage(error.message);
    }
  };

  const submitRentSuggestion = async (event) => {
    event.preventDefault();

    if (!rentSuggestionForm || !rentSuggestionResult) return;

    const payload = {
      city: document.getElementById("rentCity").value.trim(),
      locality: document.getElementById("rentLocality").value.trim(),
      propertyType: document.getElementById("rentPropertyType").value,
      occupancy: Number(document.getElementById("rentOccupancy").value || 1),
      amenities: document.getElementById("rentAmenities").value,
    };

    try {
      rentSuggestionBtn.disabled = true;
      rentSuggestionBtn.textContent = "Analyzing...";
      rentSuggestionResult.innerHTML = `<span class="loading-inline"><span class="loading-spinner"></span> Building rent hint...</span>`;

      const response = await fetch(`${API_BASE_URL}/properties/price-suggestion`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to generate rent suggestion.");
      }

      rentSuggestionResult.innerHTML = `
        <p><strong>Recommended Rent:</strong> ${formatPrice(data.recommendedRent)}</p>
        <p class="small-text">Suggested Range: ${formatPrice(data.suggestedRange.min)} to ${formatPrice(
          data.suggestedRange.max
        )}</p>
        <p class="small-text">Market Avg: ${formatPrice(data.marketAverage)} | Median: ${formatPrice(
          data.marketMedian
        )}</p>
        <p class="small-text">Comparables used: ${data.comparableCount}</p>
        <p class="small-text">${(data.factors || []).join(" | ")}</p>
      `;
      showToastSafe("AI rent suggestion generated.", "success");
    } catch (error) {
      rentSuggestionResult.innerHTML = `<p class="small-text">${error.message}</p>`;
      showToastSafe(error.message, "error");
    } finally {
      rentSuggestionBtn.disabled = false;
      rentSuggestionBtn.textContent = "Get AI Rent Hint";
    }
  };

  const fillFormForEdit = (property) => {
    editPropertyIdInput.value = property._id;
    formTitle.textContent = "Edit Property";
    savePropertyBtn.textContent = "Update Property";
    cancelEditBtn.style.display = "inline-block";

    document.getElementById("title").value = property.title || "";
    document.getElementById("description").value = property.description || "";
    document.getElementById("propertyType").value = property.propertyType || "";
    document.getElementById("city").value = property.city || "";
    document.getElementById("address").value = property.address || "";
    document.getElementById("price").value = property.price || "";
    document.getElementById("priceType").value = property.priceType || "monthly";
    document.getElementById("occupancy").value = property.occupancy || 1;
    document.getElementById("genderPreference").value = property.genderPreference || "any";
    document.getElementById("images").value = (property.images || []).join(", ");
    document.getElementById("amenities").value = (property.amenities || []).join(", ");

    imagePayloadCache = [];
    if (imageFilesInput) {
      imageFilesInput.value = "";
    }
    renderImagePreview();
  };

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error(`Unable to read file ${file.name}.`));
      reader.readAsDataURL(file);
    });

  const handleImageFileSelection = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    try {
      if (files.length + imagePayloadCache.length > 8) {
        showOwnerMessage("Maximum 8 images allowed per listing.");
        imageFilesInput.value = "";
        return;
      }

      const fileDataUrls = await Promise.all(files.map((file) => readFileAsDataUrl(file)));
      imagePayloadCache = uniqueItems([...imagePayloadCache, ...fileDataUrls]);
      renderImagePreview();
      showToastSafe(`${files.length} image(s) ready for upload.`, "success");
    } catch (error) {
      showOwnerMessage(error.message || "Failed to process selected images.");
    }
  };

  const saveProperty = async (event) => {
    event.preventDefault();
    resetOwnerMessage();

    const propertyId = editPropertyIdInput.value;
    const manualImageUrls = parseCsv(document.getElementById("images").value);
    const payload = {
      title: document.getElementById("title").value.trim(),
      description: document.getElementById("description").value.trim(),
      propertyType: document.getElementById("propertyType").value,
      city: document.getElementById("city").value.trim(),
      address: document.getElementById("address").value.trim(),
      price: Number(document.getElementById("price").value),
      priceType: document.getElementById("priceType").value,
      occupancy: Number(document.getElementById("occupancy").value),
      genderPreference: document.getElementById("genderPreference").value,
      images: uniqueItems([...manualImageUrls, ...imagePayloadCache]),
      amenities: parseCsv(document.getElementById("amenities").value),
    };

    const requestUrl = propertyId
      ? `${API_BASE_URL}/properties/${propertyId}`
      : `${API_BASE_URL}/properties`;
    const method = propertyId ? "PUT" : "POST";

    try {
      savePropertyBtn.disabled = true;
      savePropertyBtn.textContent = propertyId ? "Updating..." : "Saving...";

      const response = await fetch(requestUrl, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to save property.");
      }

      showOwnerMessage(data.message, "success");
      resetPropertyForm();
      await loadOwnerDashboardData();
    } catch (error) {
      showOwnerMessage(error.message);
    } finally {
      savePropertyBtn.disabled = false;
      savePropertyBtn.textContent = propertyId ? "Update Property" : "Save Property";
    }
  };

  const handleListingActions = async (event) => {
    const action = event.target.dataset.action;
    const propertyId = event.target.dataset.id;
    if (!action || !propertyId) return;

    const selectedProperty = ownerListingsCache.find((item) => item._id === propertyId);
    if (!selectedProperty) return;

    if (action === "edit") {
      fillFormForEdit(selectedProperty);
      return;
    }

    if (action === "delete") {
      const confirmed = window.confirm("Delete this property listing?");
      if (!confirmed) return;

      try {
        const response = await fetch(`${API_BASE_URL}/properties/${propertyId}`, {
          method: "DELETE",
          headers: authHeaders(),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Unable to delete property.");
        }

        showOwnerMessage(data.message, "success");
        await loadOwnerDashboardData();
      } catch (error) {
        showOwnerMessage(error.message);
      }
    }

    if (action === "boost") {
      try {
        const response = await fetch(`${API_BASE_URL}/properties/${propertyId}/boost`, {
          method: "POST",
          headers: authHeaders(),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Unable to boost property.");
        }

        showOwnerMessage(data.message, "success");
        await loadOwnerDashboardData();
      } catch (error) {
        showOwnerMessage(error.message);
      }
    }
  };

  const bootstrapOwnerDashboard = () => {
    if (!ownerForm) return;

    if (!token || !storedUser) {
      window.location.href = "./login.html";
      return;
    }

    ownerForm.addEventListener("submit", saveProperty);
    ownerListingsTableBody.addEventListener("click", handleListingActions);

    cancelEditBtn.addEventListener("click", () => {
      resetPropertyForm();
      resetOwnerMessage();
    });

    if (imageFilesInput) {
      imageFilesInput.addEventListener("change", handleImageFileSelection);
    }

    if (clearImageSelectionBtn) {
      clearImageSelectionBtn.addEventListener("click", () => {
        imagePayloadCache = [];
        if (imageFilesInput) imageFilesInput.value = "";
        renderImagePreview();
      });
    }

    if (imagePreviewGrid) {
      imagePreviewGrid.addEventListener("click", (event) => {
        const removeBtn = event.target.closest(".preview-remove");
        if (!removeBtn) return;
        const index = Number(removeBtn.dataset.index);
        if (!Number.isInteger(index)) return;
        imagePayloadCache.splice(index, 1);
        renderImagePreview();
      });
    }

    renderImagePreview();

    if (rentSuggestionForm) {
      const fallbackCity = storedUser?.city || "";
      const rentCityInput = document.getElementById("rentCity");
      if (rentCityInput && fallbackCity) {
        rentCityInput.value = fallbackCity;
      }
      rentSuggestionForm.addEventListener("submit", submitRentSuggestion);
    }

    loadOwnerDashboardData();
  };

  loadPropertyDetailsPage();
  bootstrapOwnerDashboard();
})();

