(() => {
  const API_BASE_URL = localStorage.getItem("stayeasy_api_base_url") || "https://stayeasy-hackathon-production.up.railway.app/api";
  const token = localStorage.getItem("stayeasy_token");

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  });

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
  const FALLBACK_WORKER_IMAGE =
    "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1200&q=80";
  const IMAGE_URL_REGEX = /^https?:\/\/\S+$/i;
  const IMAGE_DATA_URI_REGEX = /^data:image\/[a-zA-Z0-9.+-]+;base64,/i;

  const resolveWorkerImage = (value) => {
    const normalized = String(value || "").trim();
    if (IMAGE_URL_REGEX.test(normalized) || IMAGE_DATA_URI_REGEX.test(normalized)) {
      return normalized;
    }
    return FALLBACK_WORKER_IMAGE;
  };

  const createStatusPill = (status) =>
    `<span class="status-pill ${status}">${status.replace("_", " ")}</span>`;

  // Helper marketplace page context
  const workerSearchForm = document.getElementById("workerSearchForm");
  const workerCardsGrid = document.getElementById("workerCardsGrid");
  const workerEmptyState = document.getElementById("workerEmptyState");
  const workerBookingForm = document.getElementById("workerBookingForm");
  const workerBookingMessage = document.getElementById("workerBookingMessage");
  const selectedWorkerNameInput = document.getElementById("selectedWorkerName");
  const workerServiceTypeInput = document.getElementById("workerServiceType");
  const workerAmountInput = document.getElementById("workerAmount");
  const workerCityInput = document.getElementById("workerCity");
  const workerTypeInput = document.getElementById("workerType");
  const workerDateInput = document.getElementById("workerDate");
  const workerTimeInput = document.getElementById("workerTime");

  let selectedWorker = null;

  const showWorkerBookingMessage = (text, type = "error") => {
    if (!workerBookingMessage) return;
    workerBookingMessage.textContent = text;
    workerBookingMessage.className = `message-box show ${type}`;
    showToastSafe(text, type === "success" ? "success" : "error");
  };

  const clearWorkerBookingMessage = () => {
    if (!workerBookingMessage) return;
    workerBookingMessage.textContent = "";
    workerBookingMessage.className = "message-box";
  };

  const renderWorkerCards = (workers) => {
    if (!workerCardsGrid) return;

    workerCardsGrid.innerHTML = "";
    if (!workers.length) {
      workerEmptyState.style.display = "block";
      return;
    }
    workerEmptyState.style.display = "none";

    workers.forEach((worker) => {
      const workerImage = resolveWorkerImage(worker.userId?.profileImage);
      const card = document.createElement("article");
      card.className = "property-card";
      card.innerHTML = `
        <img src="${workerImage}" alt="${
          worker.userId?.name || "Worker"
        }" />
        <div class="card-body">
          <h3>${worker.userId?.name || "Worker"}</h3>
          <p class="property-meta">${worker.city} - ${worker.serviceType.toUpperCase()}</p>
          <p class="property-price">${formatPrice(worker.charges)} / visit</p>
          <p class="muted-text">Rating: ${worker.rating} | Jobs: ${worker.totalJobs}</p>
          <p class="muted-text">Verification: ${worker.verificationStatus}</p>
          <button class="market-btn primary select-worker-btn" data-id="${worker._id}">
            Select Worker
          </button>
        </div>
      `;
      workerCardsGrid.appendChild(card);

      const button = card.querySelector(".select-worker-btn");
      button.addEventListener("click", () => {
        selectedWorker = worker;
        selectedWorkerNameInput.value = worker.userId?.name || "Worker";
        workerServiceTypeInput.value = worker.serviceType;
        workerAmountInput.value = worker.charges;
        showWorkerBookingMessage("Worker selected. Fill date/time and book.", "success");
      });
    });
  };

  const fetchWorkers = async () => {
    if (!workerCardsGrid) return;

    try {
      workerCardsGrid.innerHTML = "<p class='muted-text'>Loading workers...</p>";
      const params = new URLSearchParams();
      if (workerCityInput.value.trim()) params.set("city", workerCityInput.value.trim());
      if (workerTypeInput.value) params.set("type", workerTypeInput.value);

      const response = await fetch(`${API_BASE_URL}/workers?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch workers.");
      }
      renderWorkerCards(data.workers || []);
    } catch (error) {
      workerCardsGrid.innerHTML = `<p class="muted-text">${error.message}</p>`;
    }
  };

  const handleWorkerSearch = (event) => {
    event.preventDefault();
    fetchWorkers();
  };

  const handleWorkerBooking = async (event) => {
    event.preventDefault();
    clearWorkerBookingMessage();

    if (!token) {
      showWorkerBookingMessage("Please login to book a worker.");
      return;
    }

    if (!selectedWorker) {
      showWorkerBookingMessage("Select a worker first.");
      return;
    }

    if (!workerDateInput.value || !workerTimeInput.value) {
      showWorkerBookingMessage("Please choose date and time.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/workers/book`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          workerId: selectedWorker._id,
          serviceType: workerServiceTypeInput.value,
          date: workerDateInput.value,
          time: workerTimeInput.value,
          amount: Number(workerAmountInput.value),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to book worker.");
      }

      showWorkerBookingMessage(
        `${data.message} Commission: Rs ${data.pricing.commission}. Worker gets: Rs ${data.pricing.finalWorkerAmount}.`,
        "success"
      );
      workerBookingForm.reset();
      selectedWorkerNameInput.value = selectedWorker.userId?.name || "";
      workerServiceTypeInput.value = selectedWorker.serviceType || "";
      workerAmountInput.value = selectedWorker.charges || "";
    } catch (error) {
      showWorkerBookingMessage(error.message);
    }
  };

  if (workerSearchForm) {
    workerSearchForm.addEventListener("submit", handleWorkerSearch);
    workerBookingForm.addEventListener("submit", handleWorkerBooking);
    fetchWorkers();
  }

  // Worker dashboard page context
  const workerProfileForm = document.getElementById("workerProfileForm");
  const workerProfileMessage = document.getElementById("workerProfileMessage");
  const workerBookingsBody = document.getElementById("workerBookingsBody");
  const workerTotalJobs = document.getElementById("workerTotalJobs");
  const workerCompletedJobs = document.getElementById("workerCompletedJobs");
  const workerConfirmedJobs = document.getElementById("workerConfirmedJobs");
  const workerTotalEarnings = document.getElementById("workerTotalEarnings");
  const workerVerificationStatus = document.getElementById("workerVerificationStatus");
  const workerRatingStatus = document.getElementById("workerRatingStatus");
  const workerAvailabilityStatus = document.getElementById("workerAvailabilityStatus");
  const profileAvailabilityToggle = document.getElementById("profileAvailabilityToggle");
  const profileImageUrlInput = document.getElementById("profileImageUrl");
  const profileImageFileInput = document.getElementById("profileImageFile");
  const workerPhotoPreview = document.getElementById("workerPhotoPreview");
  const workerDailyEarningsBars = document.getElementById("workerDailyEarningsBars");
  const workerDailyEarningsTotal = document.getElementById("workerDailyEarningsTotal");

  const showWorkerProfileMessage = (text, type = "error") => {
    if (!workerProfileMessage) return;
    workerProfileMessage.textContent = text;
    workerProfileMessage.className = `message show ${type}`;
    if (text) {
      showToastSafe(text, type === "success" ? "success" : "error");
    }
  };

  const renderDailyEarningsBars = (rows = []) => {
    if (!workerDailyEarningsBars) return;
    if (!rows.length) {
      workerDailyEarningsBars.innerHTML = `<div class="empty-state">No earnings data for last 7 days.</div>`;
      if (workerDailyEarningsTotal) workerDailyEarningsTotal.textContent = "Weekly earnings: Rs 0";
      return;
    }

    const maxValue = Math.max(...rows.map((item) => Number(item.earnings || 0)), 1);
    const total = rows.reduce((sum, item) => sum + Number(item.earnings || 0), 0);

    workerDailyEarningsBars.innerHTML = rows
      .map((item) => {
        const value = Number(item.earnings || 0);
        const widthPct = Math.max(6, Math.round((value / maxValue) * 100));
        return `
          <div class="bar-item">
            <span>${item.label}</span>
            <div class="bar-track">
              <div class="bar-fill" style="width:${widthPct}%"></div>
            </div>
            <strong>${Math.round(value).toLocaleString("en-IN")}</strong>
          </div>
        `;
      })
      .join("");

    if (workerDailyEarningsTotal) {
      workerDailyEarningsTotal.textContent = `Weekly earnings: Rs ${total.toLocaleString("en-IN")}`;
    }
  };

  const toToggleAvailability = (value = "") => {
    const normalized = String(value).trim().toLowerCase();
    return normalized === "online" || normalized === "available";
  };

  const syncWorkerPhotoPreview = () => {
    if (!workerPhotoPreview) return;
    workerPhotoPreview.src = resolveWorkerImage(profileImageUrlInput?.value || "");
  };

  const readImageAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
      reader.readAsDataURL(file);
    });

  const handleProfileImageFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showWorkerProfileMessage("Please select a valid image file.");
      event.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showWorkerProfileMessage("Image size should be less than 2 MB.");
      event.target.value = "";
      return;
    }

    try {
      const imageDataUrl = await readImageAsDataUrl(file);
      if (profileImageUrlInput) {
        profileImageUrlInput.value = imageDataUrl;
      }
      syncWorkerPhotoPreview();
      showWorkerProfileMessage("Photo selected. Save profile to update marketplace image.", "success");
    } catch (error) {
      showWorkerProfileMessage(error.message || "Unable to process selected image.");
    }
  };

  const loadWorkerDashboard = async () => {
    if (!workerProfileForm) return;
    if (!token) {
      window.location.href = "./login.html";
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/workers/dashboard`, {
        headers: authHeaders(),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load worker dashboard.");
      }

      document.getElementById("profileServiceType").value = data.worker.serviceType || "";
      document.getElementById("profileCity").value = data.worker.city || "";
      document.getElementById("profileCharges").value = data.worker.charges || "";
      if (profileImageUrlInput) {
        profileImageUrlInput.value = data.worker.userId?.profileImage || "";
      }
      if (profileImageFileInput) {
        profileImageFileInput.value = "";
      }
      syncWorkerPhotoPreview();
      if (profileAvailabilityToggle) {
        profileAvailabilityToggle.checked = toToggleAvailability(data.worker.availability);
      }

      workerTotalJobs.textContent = data.worker.totalJobs || 0;
      workerCompletedJobs.textContent = data.stats.completedJobs || 0;
      workerConfirmedJobs.textContent = data.stats.confirmedJobs || 0;
      workerTotalEarnings.textContent = `Rs ${Number(
        data.stats.totalEarnings || 0
      ).toLocaleString("en-IN")}`;

      workerVerificationStatus.textContent = `Verification: ${data.worker.verificationStatus}`;
      workerRatingStatus.textContent = `Rating: ${data.worker.rating} / 5`;
      workerAvailabilityStatus.textContent = `Availability: ${
        toToggleAvailability(data.worker.availability) ? "Online" : "Offline"
      }`;

      renderDailyEarningsBars(data.dailyEarnings7d || []);

      workerBookingsBody.innerHTML = "";
      if (!(data.bookings || []).length) {
        workerBookingsBody.innerHTML = `
          <tr>
            <td colspan="8" class="small-text">No bookings yet.</td>
          </tr>
        `;
        return;
      }

      data.bookings.forEach((booking) => {
        const repeatTag = booking.isRepeatCustomer
          ? `<span class="tag-chip" style="margin-top:0.24rem">Booked before</span>`
          : "";
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${booking._id.slice(-6).toUpperCase()}</td>
          <td>${booking.customerId?.name || "N/A"}${repeatTag ? `<br/>${repeatTag}` : ""}</td>
          <td>${booking.serviceType}</td>
          <td>${new Date(booking.date).toLocaleDateString("en-IN")} ${booking.time}</td>
          <td>${formatPrice(booking.amount)}</td>
          <td>${createStatusPill(booking.status)}</td>
          <td>${createStatusPill(booking.paymentStatus)}</td>
          <td>
            <div class="inline-actions">
              <button class="btn success" data-action="complete" data-id="${booking._id}">Complete</button>
              <button class="btn danger" data-action="cancel" data-id="${booking._id}">Cancel</button>
            </div>
          </td>
        `;
        workerBookingsBody.appendChild(row);
      });
    } catch (error) {
      showWorkerProfileMessage(error.message);
    }
  };

  const saveWorkerProfile = async (event) => {
    event.preventDefault();
    showWorkerProfileMessage("", "error");

    try {
      const response = await fetch(`${API_BASE_URL}/workers/register`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          serviceType: document.getElementById("profileServiceType").value,
          city: document.getElementById("profileCity").value.trim(),
          charges: Number(document.getElementById("profileCharges").value),
          availability: profileAvailabilityToggle?.checked ? "online" : "offline",
          profileImage: profileImageUrlInput?.value.trim() || "",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to save worker profile.");
      }
      showWorkerProfileMessage(data.message, "success");
      loadWorkerDashboard();
    } catch (error) {
      showWorkerProfileMessage(error.message);
    }
  };

  const handleWorkerBookingActions = async (event) => {
    const action = event.target.dataset.action;
    const bookingId = event.target.dataset.id;
    if (!action || !bookingId) return;

    const endpoint =
      action === "complete"
        ? `${API_BASE_URL}/workers/bookings/${bookingId}/complete`
        : `${API_BASE_URL}/workers/bookings/${bookingId}/cancel`;

    try {
      const response = await fetch(endpoint, { method: "PUT", headers: authHeaders() });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Worker action failed.");
      }
      showWorkerProfileMessage(data.message, "success");
      loadWorkerDashboard();
    } catch (error) {
      showWorkerProfileMessage(error.message);
    }
  };

  if (workerProfileForm) {
    profileImageUrlInput?.addEventListener("input", syncWorkerPhotoPreview);
    profileImageUrlInput?.addEventListener("blur", () => {
      if (profileImageUrlInput) {
        profileImageUrlInput.value = profileImageUrlInput.value.trim();
      }
      syncWorkerPhotoPreview();
    });
    profileImageFileInput?.addEventListener("change", handleProfileImageFileChange);
    syncWorkerPhotoPreview();
    workerProfileForm.addEventListener("submit", saveWorkerProfile);
    workerBookingsBody.addEventListener("click", handleWorkerBookingActions);
    loadWorkerDashboard();
  }
})();

