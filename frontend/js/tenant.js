(() => {
  const API_BASE_URL = "https://stayeasy-hackathon-production.up.railway.app/api";
  const token = localStorage.getItem("stayeasy_token");

  const tenantMessage = document.getElementById("tenantMessage");
  const propertyBookingsBody = document.getElementById("tenantPropertyBookingsBody");
  const workerBookingsBody = document.getElementById("tenantWorkerBookingsBody");
  const complaintsBody = document.getElementById("tenantComplaintsBody");
  const complaintForm = document.getElementById("tenantComplaintForm");
  const complaintCategoryInput = document.getElementById("tenantComplaintCategory");
  const complaintPropertySelect = document.getElementById("tenantComplaintPropertyId");
  const complaintMessageInput = document.getElementById("tenantComplaintMessage");

  const recommendationForm = document.getElementById("tenantRecommendationForm");
  const recommendationCityInput = document.getElementById("tenantRecommendCity");
  const recommendationTypeInput = document.getElementById("tenantRecommendType");
  const recommendationBudgetInput = document.getElementById("tenantRecommendBudget");
  const recommendationPrefsInput = document.getElementById("tenantRecommendPrefs");
  const recommendationsGrid = document.getElementById("tenantRecommendationsGrid");
  const tenantReviewForm = document.getElementById("tenantReviewForm");
  const tenantReviewRating = document.getElementById("tenantReviewRating");
  const tenantReviewTitle = document.getElementById("tenantReviewTitle");
  const tenantReviewMessage = document.getElementById("tenantReviewMessage");
  const tenantReviewsBody = document.getElementById("tenantReviewsBody");

  const kpiPropertyBookingCount = document.getElementById("tenantPropertyBookingCount");
  const kpiActiveStaysCount = document.getElementById("tenantActiveStaysCount");
  const kpiWorkerBookingCount = document.getElementById("tenantWorkerBookingCount");
  const kpiOpenComplaintsCount = document.getElementById("tenantOpenComplaintsCount");
  const kpiSpendTotal = document.getElementById("tenantSpendTotal");

  if (!propertyBookingsBody || !workerBookingsBody || !complaintsBody || !recommendationsGrid) {
    return;
  }

  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem("stayeasy_user") || "{}");
    } catch (error) {
      return {};
    }
  })();

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

  const showMessage = (text, type = "error") => {
    if (!tenantMessage) return;
    tenantMessage.textContent = text;
    tenantMessage.className = `message show ${type}`;
    showToastSafe(text, type === "success" ? "success" : "error");
  };

  const clearMessage = () => {
    if (!tenantMessage) return;
    tenantMessage.textContent = "";
    tenantMessage.className = "message";
  };

  const statusPill = (status) =>
    `<span class="status-pill ${status}">${String(status || "-").replace("_", " ")}</span>`;

  const formatPrice = (value) =>
    Number(value || 0).toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    });

  const formatDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("en-IN");
  };

  const formatDateTime = (value, time = "") => {
    const dateLabel = formatDate(value);
    if (!time) return dateLabel;
    return `${dateLabel} ${time}`;
  };

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const setLoadingRows = (tbody, colspan, text = "Loading...") => {
    tbody.innerHTML = `<tr><td colspan="${colspan}" class="small-text">${escapeHtml(text)}</td></tr>`;
  };

  let propertyBookingsCache = [];
  let workerBookingsCache = [];
  let complaintsCache = [];

  const updateKpis = () => {
    const activeStays = propertyBookingsCache.filter((item) =>
      ["pending", "confirmed"].includes(item.status)
    ).length;

    const openComplaints = complaintsCache.filter((item) =>
      ["open", "in_progress", "escalated"].includes(item.status)
    ).length;

    const propertySpend = propertyBookingsCache
      .filter((item) => item.paymentStatus === "paid" && item.status !== "cancelled")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const workerSpend = workerBookingsCache
      .filter((item) => item.paymentStatus === "paid" && item.status !== "cancelled")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    if (kpiPropertyBookingCount) {
      kpiPropertyBookingCount.textContent = propertyBookingsCache.length;
    }
    if (kpiActiveStaysCount) {
      kpiActiveStaysCount.textContent = activeStays;
    }
    if (kpiWorkerBookingCount) {
      kpiWorkerBookingCount.textContent = workerBookingsCache.length;
    }
    if (kpiOpenComplaintsCount) {
      kpiOpenComplaintsCount.textContent = openComplaints;
    }
    if (kpiSpendTotal) {
      kpiSpendTotal.textContent = `Rs ${(propertySpend + workerSpend).toLocaleString("en-IN")}`;
    }
  };

  const renderComplaintPropertyOptions = () => {
    if (!complaintPropertySelect) return;

    const currentValue = complaintPropertySelect.value;
    const optionsMap = new Map();

    propertyBookingsCache.forEach((booking) => {
      const property = booking.propertyId || {};
      if (!property._id) return;
      if (!optionsMap.has(property._id)) {
        const label = `${property.title || "Property"}${property.city ? ` - ${property.city}` : ""}`;
        optionsMap.set(property._id, label);
      }
    });

    const options = [...optionsMap.entries()]
      .map(([id, label]) => `<option value="${escapeHtml(id)}">${escapeHtml(label)}</option>`)
      .join("");

    complaintPropertySelect.innerHTML = `
      <option value="">No property selected</option>
      ${options}
    `;

    if (currentValue && optionsMap.has(currentValue)) {
      complaintPropertySelect.value = currentValue;
    }
  };

  const renderPropertyBookings = () => {
    propertyBookingsBody.innerHTML = "";

    if (!propertyBookingsCache.length) {
      propertyBookingsBody.innerHTML =
        "<tr><td colspan='7' class='small-text'>No property bookings yet.</td></tr>";
      return;
    }

    propertyBookingsCache.forEach((booking) => {
      const bookingCode = booking._id ? booking._id.slice(-6).toUpperCase() : "N/A";
      const property = booking.propertyId || {};
      const propertyTitle = property.title || "N/A";
      const propertyId = property._id || "";
      const canCancel = ["pending", "confirmed"].includes(booking.status);

      const actions = [];
      if (propertyId) {
        actions.push(
          `<a class="btn ghost" style="text-decoration:none" href="./property-details.html?id=${encodeURIComponent(
            propertyId
          )}">View</a>`
        );
      }
      if (canCancel) {
        actions.push(
          `<button class="btn danger" type="button" data-action="cancel-property" data-id="${escapeHtml(
            booking._id
          )}">Cancel</button>`
        );
      }

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(bookingCode)}</td>
        <td>${escapeHtml(propertyTitle)}</td>
        <td>${escapeHtml(formatDate(booking.checkInDate))} - ${escapeHtml(
          formatDate(booking.checkOutDate)
        )}</td>
        <td>${escapeHtml(formatPrice(booking.amount))}</td>
        <td>${statusPill(booking.status)}</td>
        <td>${statusPill(booking.paymentStatus)}</td>
        <td><div class="inline-actions">${actions.join("") || "-"}</div></td>
      `;
      propertyBookingsBody.appendChild(row);
    });
  };

  const renderWorkerBookings = () => {
    workerBookingsBody.innerHTML = "";

    if (!workerBookingsCache.length) {
      workerBookingsBody.innerHTML =
        "<tr><td colspan='7' class='small-text'>No helper bookings yet.</td></tr>";
      return;
    }

    workerBookingsCache.forEach((booking) => {
      const bookingCode = booking._id ? booking._id.slice(-6).toUpperCase() : "N/A";
      const workerName = booking.workerId?.userId?.name || "Worker";
      const canCancel = ["pending", "confirmed"].includes(booking.status);

      const actions = [];
      if (canCancel) {
        actions.push(
          `<button class="btn danger" type="button" data-action="cancel-worker" data-id="${escapeHtml(
            booking._id
          )}">Cancel</button>`
        );
      }

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(bookingCode)}</td>
        <td>${escapeHtml(workerName)}</td>
        <td>${escapeHtml(booking.serviceType || "-")}</td>
        <td>${escapeHtml(formatDateTime(booking.date, booking.time))}</td>
        <td>${escapeHtml(formatPrice(booking.amount))}</td>
        <td>${statusPill(booking.status)}</td>
        <td><div class="inline-actions">${actions.join("") || "-"}</div></td>
      `;
      workerBookingsBody.appendChild(row);
    });
  };

  const renderComplaints = () => {
    complaintsBody.innerHTML = "";

    if (!complaintsCache.length) {
      complaintsBody.innerHTML = "<tr><td colspan='5' class='small-text'>No complaints yet.</td></tr>";
      return;
    }

    complaintsCache.forEach((complaint) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(complaint.category || "general")}</td>
        <td>${escapeHtml(complaint.message || "-")}</td>
        <td>${statusPill(complaint.status)}</td>
        <td>${escapeHtml(complaint.response || "-")}</td>
        <td>${escapeHtml(formatDate(complaint.updatedAt || complaint.createdAt))}</td>
      `;
      complaintsBody.appendChild(row);
    });
  };

  const renderRecommendations = (recommendations = []) => {
    recommendationsGrid.innerHTML = "";

    if (!recommendations.length) {
      recommendationsGrid.innerHTML = "<p class='small-text'>No recommendations found for this filter.</p>";
      return;
    }

    recommendations.forEach((property) => {
      const card = document.createElement("article");
      card.className = "card";
      card.innerHTML = `
        <h3>${escapeHtml(property.title)}</h3>
        <p class="small-text">${escapeHtml(property.city)} - ${escapeHtml(
          String(property.propertyType || "").toUpperCase()
        )}</p>
        <p>${escapeHtml(formatPrice(property.price))} / ${escapeHtml(property.priceType)}</p>
        <p class="small-text">AI Score: ${escapeHtml(property.aiScore)}</p>
        <p class="small-text">${escapeHtml(property.aiReason || "Matched to your profile and filters.")}</p>
        <a class="btn ghost" style="text-decoration:none; display:inline-block; margin-top:0.5rem" href="./property-details.html?id=${encodeURIComponent(
          property._id
        )}">
          View
        </a>
      `;
      recommendationsGrid.appendChild(card);
    });
  };

  const loadPropertyBookings = async () => {
    setLoadingRows(propertyBookingsBody, 7, "Loading property bookings...");
    try {
      const response = await fetch(`${API_BASE_URL}/bookings/my-bookings`, {
        headers: authHeaders(),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load property bookings.");
      }

      propertyBookingsCache = data.bookings || [];
      renderPropertyBookings();
      renderComplaintPropertyOptions();
      updateKpis();
    } catch (error) {
      propertyBookingsCache = [];
      renderPropertyBookings();
      renderComplaintPropertyOptions();
      updateKpis();
      showMessage(error.message);
    }
  };

  const loadWorkerBookings = async () => {
    setLoadingRows(workerBookingsBody, 7, "Loading helper bookings...");
    try {
      const response = await fetch(`${API_BASE_URL}/workers/my-bookings`, {
        headers: authHeaders(),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load helper bookings.");
      }

      workerBookingsCache = data.bookings || [];
      renderWorkerBookings();
      updateKpis();
    } catch (error) {
      workerBookingsCache = [];
      renderWorkerBookings();
      updateKpis();
      showMessage(error.message);
    }
  };

  const loadComplaints = async () => {
    setLoadingRows(complaintsBody, 5, "Loading complaints...");
    try {
      const response = await fetch(`${API_BASE_URL}/complaints/my`, {
        headers: authHeaders(),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load complaints.");
      }

      complaintsCache = data.complaints || [];
      renderComplaints();
      updateKpis();
    } catch (error) {
      complaintsCache = [];
      renderComplaints();
      updateKpis();
      showMessage(error.message);
    }
  };

  const loadRecommendations = async (event) => {
    if (event) event.preventDefault();

    recommendationsGrid.innerHTML = "<p class='small-text'>Loading recommendations...</p>";

    try {
      const params = new URLSearchParams();
      const city = recommendationCityInput?.value?.trim() || "";
      const type = recommendationTypeInput?.value || "";
      const budget = recommendationBudgetInput?.value?.trim() || "";
      const preferences = recommendationPrefsInput?.value?.trim() || "";

      if (city) params.set("city", city);
      if (type) params.set("type", type);
      if (budget) params.set("budget", budget);
      if (preferences) params.set("preferences", preferences);

      const response = await fetch(`${API_BASE_URL}/recommendations?${params.toString()}`, {
        headers: authHeaders(),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load recommendations.");
      }

      renderRecommendations(data.recommendations || []);
    } catch (error) {
      recommendationsGrid.innerHTML = `<p class='small-text'>${escapeHtml(error.message)}</p>`;
    }
  };

  const renderMyReviews = (reviews = []) => {
    if (!tenantReviewsBody) return;

    tenantReviewsBody.innerHTML = "";
    if (!reviews.length) {
      tenantReviewsBody.innerHTML =
        "<tr><td colspan='4' class='small-text'>No reviews submitted yet.</td></tr>";
      return;
    }

    reviews.forEach((review) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><span class="feedback-pill">${escapeHtml(review.rating)}/5</span></td>
        <td>${escapeHtml(review.title || "-")}</td>
        <td>${escapeHtml(review.message || "-")}</td>
        <td>${escapeHtml(formatDate(review.createdAt))}</td>
      `;
      tenantReviewsBody.appendChild(row);
    });
  };

  const loadMyReviews = async () => {
    if (!tenantReviewsBody) return;

    tenantReviewsBody.innerHTML =
      "<tr><td colspan='4' class='small-text'>Loading reviews...</td></tr>";
    try {
      const response = await fetch(`${API_BASE_URL}/reviews/my`, {
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to load your reviews.");
      }

      renderMyReviews(data.reviews || []);
    } catch (error) {
      tenantReviewsBody.innerHTML = `<tr><td colspan='4' class='small-text'>${escapeHtml(
        error.message
      )}</td></tr>`;
    }
  };

  const submitReview = async (event) => {
    event.preventDefault();

    const rating = Number(tenantReviewRating?.value || 0);
    const title = tenantReviewTitle?.value?.trim() || "";
    const message = tenantReviewMessage?.value?.trim() || "";

    if (!rating || !message) {
      showMessage("Rating and review message are required.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/reviews`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          rating,
          title,
          message,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to submit review.");
      }

      showMessage(data.message || "Review submitted.", "success");
      tenantReviewForm?.reset();
      if (tenantReviewRating) {
        tenantReviewRating.value = "5";
      }
      await loadMyReviews();
    } catch (error) {
      showMessage(error.message);
    }
  };

  const cancelPropertyBooking = async (bookingId) => {
    if (!bookingId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/cancel`, {
        method: "PUT",
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to cancel booking.");
      }
      showMessage(data.message || "Property booking cancelled.", "success");
      await loadPropertyBookings();
    } catch (error) {
      showMessage(error.message);
    }
  };

  const cancelWorkerBooking = async (bookingId) => {
    if (!bookingId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/workers/bookings/${bookingId}/cancel`, {
        method: "PUT",
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to cancel helper booking.");
      }
      showMessage(data.message || "Helper booking cancelled.", "success");
      await loadWorkerBookings();
    } catch (error) {
      showMessage(error.message);
    }
  };

  const submitComplaint = async (event) => {
    event.preventDefault();

    const category = complaintCategoryInput?.value?.trim() || "general";
    const message = complaintMessageInput?.value?.trim() || "";
    const propertyId = complaintPropertySelect?.value || "";

    if (!message) {
      showMessage("Complaint message is required.");
      return;
    }

    try {
      const payload = {
        category,
        message,
      };
      if (propertyId) {
        payload.propertyId = propertyId;
      }

      const response = await fetch(`${API_BASE_URL}/complaints`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to raise complaint.");
      }

      showMessage(data.message || "Complaint raised successfully.", "success");
      complaintForm.reset();
      await loadComplaints();
    } catch (error) {
      showMessage(error.message);
    }
  };

  const refreshAll = async () => {
    if (!token) {
      window.location.href = "./login.html";
      return;
    }

    clearMessage();

    if (recommendationCityInput && user?.city) {
      recommendationCityInput.value = recommendationCityInput.value || user.city;
    }

    await Promise.all([
      loadPropertyBookings(),
      loadWorkerBookings(),
      loadComplaints(),
      loadMyReviews(),
      loadRecommendations(),
    ]);
  };

  propertyBookingsBody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action='cancel-property']");
    if (!button) return;

    const bookingId = button.dataset.id;
    if (!bookingId) return;

    const confirmed = window.confirm("Cancel this property booking?");
    if (!confirmed) return;
    cancelPropertyBooking(bookingId);
  });

  workerBookingsBody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action='cancel-worker']");
    if (!button) return;

    const bookingId = button.dataset.id;
    if (!bookingId) return;

    const confirmed = window.confirm("Cancel this helper booking?");
    if (!confirmed) return;
    cancelWorkerBooking(bookingId);
  });

  complaintForm?.addEventListener("submit", submitComplaint);
  tenantReviewForm?.addEventListener("submit", submitReview);
  recommendationForm?.addEventListener("submit", loadRecommendations);

  refreshAll();
})();

