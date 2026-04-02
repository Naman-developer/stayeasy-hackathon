(() => {
  const API_BASE_URL = "https://stayeasy-hackathon-production.up.railway.app/api";

  const token = localStorage.getItem("stayeasy_token");

  const kpiUsers = document.getElementById("kpiUsers");
  const kpiProperties = document.getElementById("kpiProperties");
  const kpiBookings = document.getElementById("kpiBookings");
  const kpiRevenue = document.getElementById("kpiRevenue");
  const kpiWorkers = document.getElementById("kpiWorkers");
  const kpiOwners = document.getElementById("kpiOwners");
  const kpiHostelStudents = document.getElementById("kpiHostelStudents");
  const kpiEscalatedComplaints = document.getElementById("kpiEscalatedComplaints");

  const kpiCards = document.querySelectorAll(".clickable-kpi");
  const kpiDetailTitle = document.getElementById("kpiDetailTitle");
  const kpiDetailDesc = document.getElementById("kpiDetailDesc");
  const kpiDetailBody = document.getElementById("kpiDetailBody");
  const kpiDetailTableHead = document.getElementById("kpiDetailTableHead");
  const kpiDetailTableBody = document.getElementById("kpiDetailTableBody");
  const kpiDetailTableNote = document.getElementById("kpiDetailTableNote");
  const briefKpiGrid = document.getElementById("briefKpiGrid");

  const pendingPropertiesBody = document.getElementById("pendingPropertiesBody");
  const adminBookingsBody = document.getElementById("adminBookingsBody");
  const escalatedComplaintsBody = document.getElementById("escalatedComplaintsBody");
  const adminAllComplaintsBody = document.getElementById("adminAllComplaintsBody");
  const adminReviewsBody = document.getElementById("adminReviewsBody");
  const adminComplaintStatusFilter = document.getElementById("adminComplaintStatusFilter");
  const adminComplaintRefreshBtn = document.getElementById("adminComplaintRefreshBtn");
  const adminComplaintStats = document.getElementById("adminComplaintStats");
  const adminMessage = document.getElementById("adminMessage");
  const revenueChartCanvas = document.getElementById("revenueChart");
  const recentActivityList = document.getElementById("recentActivityList");
  const topPropertiesGrid = document.getElementById("topPropertiesGrid");
  const adminOccupancyBody = document.getElementById("adminOccupancyBody");

  let revenueChart = null;
  let dashboardCache = null;
  let activeKpiKey = "totalUsers";

  const formatPrice = (value) =>
    Number(value || 0).toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    });

  const formatNumber = (value) => Number(value || 0).toLocaleString("en-IN");
  const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("en-IN");
  };
  const formatShortId = (value) =>
    value ? String(value).slice(-6).toUpperCase() : "-";
  const OWNER_ROLE_KEYS = ["owner", "flat_owner", "pg_owner", "hostel_owner"];

  const toReadableLabel = (value = "") =>
    String(value)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  });

  const showToastSafe = (message, type = "info") => {
    if (window.showToast) {
      window.showToast(message, type);
    }
  };

  const showMessage = (text, type = "error") => {
    adminMessage.textContent = text;
    adminMessage.className = `message show ${type}`;
    showToastSafe(text, type === "success" ? "success" : "error");
  };

  const clearMessage = () => {
    adminMessage.textContent = "";
    adminMessage.className = "message";
  };

  const statusPill = (status) =>
    `<span class="status-pill ${status}">${status.replace("_", " ")}</span>`;

  const renderPendingProperties = (properties) => {
    pendingPropertiesBody.innerHTML = "";

    if (!properties.length) {
      pendingPropertiesBody.innerHTML = `
        <tr>
          <td colspan="6" class="small-text">No pending properties right now.</td>
        </tr>
      `;
      return;
    }

    properties.forEach((property) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${property.title}</td>
        <td>${property.ownerId?.name || "N/A"}</td>
        <td>${property.city}</td>
        <td>${property.propertyType}</td>
        <td>${statusPill(property.status)}</td>
        <td>
          <div class="inline-actions">
            <button class="btn success" data-action="approve" data-id="${property._id}">
              Approve
            </button>
            <button class="btn danger" data-action="reject" data-id="${property._id}">
              Reject
            </button>
          </div>
        </td>
      `;
      pendingPropertiesBody.appendChild(row);
    });
  };

  const renderBookings = (bookings) => {
    adminBookingsBody.innerHTML = "";

    if (!bookings.length) {
      adminBookingsBody.innerHTML = `
        <tr>
          <td colspan="6" class="small-text">No bookings found.</td>
        </tr>
      `;
      return;
    }

    bookings.forEach((booking) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${booking._id.slice(-6).toUpperCase()}</td>
        <td>${booking.userId?.name || "N/A"}</td>
        <td>${booking.propertyId?.title || "N/A"}</td>
        <td>${formatPrice(booking.amount)}</td>
        <td>${statusPill(booking.status)}</td>
        <td>${statusPill(booking.paymentStatus)}</td>
      `;
      adminBookingsBody.appendChild(row);
    });
  };

  const renderEscalatedComplaints = (complaints) => {
    escalatedComplaintsBody.innerHTML = "";

    if (!complaints.length) {
      escalatedComplaintsBody.innerHTML = `
        <tr>
          <td colspan="5" class="small-text">No escalated complaints.</td>
        </tr>
      `;
      return;
    }

    complaints.forEach((complaint) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${complaint.category || "general"}</td>
        <td>${complaint.userId?.name || "N/A"}</td>
        <td>${complaint.targetUserId?.name || "N/A"}</td>
        <td>${complaint.propertyId?.title || "N/A"}</td>
        <td>${statusPill(complaint.status)}</td>
      `;
      escalatedComplaintsBody.appendChild(row);
    });
  };

  const renderComplaintStats = (statusCounts = {}) => {
    if (!adminComplaintStats) return;

    const orderedKeys = ["open", "in_progress", "escalated", "resolved"];
    adminComplaintStats.innerHTML = orderedKeys
      .map((key) => {
        const count = Number(statusCounts[key] || 0);
        return `
          <article class="kpi-breakdown-item">
            <p>${toReadableLabel(key)}</p>
            <h4>${formatNumber(count)}</h4>
          </article>
        `;
      })
      .join("");
  };

  const renderAllComplaints = (complaints = []) => {
    if (!adminAllComplaintsBody) return;

    adminAllComplaintsBody.innerHTML = "";

    if (!complaints.length) {
      adminAllComplaintsBody.innerHTML = `
        <tr>
          <td colspan="10" class="small-text">No complaints found for selected filter.</td>
        </tr>
      `;
      return;
    }

    complaints.forEach((complaint) => {
      const row = document.createElement("tr");
      const canResolve = complaint.status !== "resolved";

      row.innerHTML = `
        <td>${formatShortId(complaint._id)}</td>
        <td>${complaint.category || "general"}</td>
        <td>${complaint.userId?.name || "N/A"}<br /><span class="small-text">${
          complaint.userId?.role || "user"
        }</span></td>
        <td>${complaint.targetUserId?.name || "N/A"}<br /><span class="small-text">${
          complaint.targetUserId?.role || "-"
        }</span></td>
        <td>${complaint.propertyId?.title || "N/A"}</td>
        <td>${complaint.message || "-"}</td>
        <td>${statusPill(complaint.status)}</td>
        <td>${complaint.response || "-"}</td>
        <td>${formatDateTime(complaint.createdAt)}</td>
        <td>
          ${
            canResolve
              ? `<button class="btn success" data-action="resolve-complaint" data-id="${complaint._id}">Resolve</button>`
              : "-"
          }
        </td>
      `;
      adminAllComplaintsBody.appendChild(row);
    });
  };

  const loadAllComplaints = async () => {
    if (!adminAllComplaintsBody) return;

    try {
      renderLoadingTable(adminAllComplaintsBody, 10);

      if (adminComplaintStats) {
        adminComplaintStats.innerHTML =
          '<div class="loading-inline"><span class="loading-spinner"></span> Loading complaint stats...</div>';
      }

      const selectedStatus = adminComplaintStatusFilter?.value || "all";
      const params = new URLSearchParams();
      if (selectedStatus && selectedStatus !== "all") {
        params.set("status", selectedStatus);
      }

      const query = params.toString();
      const response = await fetch(
        `${API_BASE_URL}/complaints/admin/all${query ? `?${query}` : ""}`,
        {
          headers: authHeaders(),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load complaints.");
      }

      renderComplaintStats(data.statusCounts || {});
      renderAllComplaints(data.complaints || []);
    } catch (error) {
      if (adminComplaintStats) {
        adminComplaintStats.innerHTML = `<div class="small-text">${error.message}</div>`;
      }
      renderAllComplaints([]);
      showMessage(error.message);
    }
  };

  const renderAdminReviews = (reviews = []) => {
    if (!adminReviewsBody) return;

    adminReviewsBody.innerHTML = "";
    if (!reviews.length) {
      adminReviewsBody.innerHTML = `
        <tr>
          <td colspan="8" class="small-text">No user reviews found.</td>
        </tr>
      `;
      return;
    }

    reviews.forEach((review) => {
      const visibility = review.visibility || "public";
      const nextVisibility = visibility === "public" ? "hidden" : "public";
      const actionLabel = visibility === "public" ? "Hide" : "Show";

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(review.reviewerName || "User")}</td>
        <td>${escapeHtml(review.reviewerRole || "-")}</td>
        <td><span class="feedback-pill">${escapeHtml(review.rating || 0)}/5</span></td>
        <td>${escapeHtml(review.title || "-")}</td>
        <td>${escapeHtml(review.message || "-")}</td>
        <td><span class="tag-chip">${escapeHtml(visibility)}</span></td>
        <td>${formatDateTime(review.createdAt)}</td>
        <td>
          <button
            class="btn ghost"
            data-action="toggle-review-visibility"
            data-id="${escapeHtml(review.id)}"
            data-visibility="${escapeHtml(nextVisibility)}"
          >
            ${actionLabel}
          </button>
        </td>
      `;
      adminReviewsBody.appendChild(row);
    });
  };

  const loadAdminReviews = async () => {
    if (!adminReviewsBody) return;

    renderLoadingTable(adminReviewsBody, 8);
    try {
      const response = await fetch(`${API_BASE_URL}/reviews/admin`, {
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to load user reviews.");
      }
      renderAdminReviews(data.reviews || []);
    } catch (error) {
      adminReviewsBody.innerHTML = `
        <tr>
          <td colspan="8" class="small-text">${error.message}</td>
        </tr>
      `;
    }
  };

  const handleReviewAction = async (event) => {
    const button = event.target.closest("button[data-action='toggle-review-visibility']");
    if (!button) return;

    const reviewId = button.dataset.id;
    const visibility = button.dataset.visibility;
    if (!reviewId || !visibility) return;
    const originalLabel = button.textContent;

    try {
      button.disabled = true;
      button.textContent = "Saving...";
      const response = await fetch(`${API_BASE_URL}/reviews/${reviewId}/visibility`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({
          visibility,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to update review visibility.");
      }

      showMessage(data.message, "success");
      await loadAdminReviews();
    } catch (error) {
      showMessage(error.message);
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  };

  const renderRecentActivity = (activities) => {
    if (!recentActivityList) return;

    if (!activities.length) {
      recentActivityList.innerHTML = `<div class="empty-state">No recent activity yet.</div>`;
      return;
    }

    recentActivityList.innerHTML = activities
      .map(
        (item) => `
          <article class="activity-item">
            <strong>${item.title}</strong>
            <p>${item.message}</p>
            <div class="activity-meta">
              ${item.userName} (${item.userRole}) - ${new Date(item.createdAt).toLocaleString("en-IN")}
            </div>
          </article>
        `
      )
      .join("");
  };

  const renderRevenueChart = (monthlyRevenue) => {
    const labels = monthlyRevenue.map((entry) => entry.label);
    const values = monthlyRevenue.map((entry) => entry.revenue);

    if (revenueChart) {
      revenueChart.destroy();
    }

    revenueChart = new Chart(revenueChartCanvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Revenue (INR)",
            data: values,
            borderRadius: 8,
            backgroundColor: "rgba(43, 95, 247, 0.7)",
            borderColor: "rgba(43, 95, 247, 1)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: {
            beginAtZero: true,
          },
        },
      },
    });
  };

  const renderLoadingTable = (tbody, cols) => {
    tbody.innerHTML = `
      <tr>
        <td colspan="${cols}" class="small-text">
          <span class="loading-inline"><span class="loading-spinner"></span> Loading...</span>
        </td>
      </tr>
    `;
  };

  const renderTopProperties = (rows = []) => {
    if (!topPropertiesGrid) return;
    if (!rows.length) {
      topPropertiesGrid.innerHTML = `<div class="empty-state">No paid booking data available yet.</div>`;
      return;
    }

    topPropertiesGrid.innerHTML = rows
      .map(
        (item) => `
          <article class="top-property-card">
            <h4>${item.title}</h4>
            <p class="top-property-meta">${item.city} • ${String(item.propertyType || "").toUpperCase()}</p>
            <div class="top-property-values">
              <span class="feedback-pill">Revenue: ${formatPrice(item.revenue)}</span>
              <span class="feedback-pill">Bookings: ${formatNumber(item.bookingCount)}</span>
              <span class="feedback-pill">Occupancy: ${item.occupancyRate || 0}%</span>
              ${item.isFeatured ? `<span class="featured-badge">Featured</span>` : ""}
            </div>
          </article>
        `
      )
      .join("");
  };

  const renderOccupancyEditor = (properties = []) => {
    if (!adminOccupancyBody) return;

    adminOccupancyBody.innerHTML = "";
    if (!properties.length) {
      adminOccupancyBody.innerHTML = `
        <tr>
          <td colspan="6" class="small-text">No properties available.</td>
        </tr>
      `;
      return;
    }

    properties.slice(0, 60).forEach((property) => {
      const total = Number(property.manualTotalRooms || 0);
      const filled = Number(property.manualFilledRooms || 0);
      const occupancy = total > 0 ? Math.round((filled / total) * 100) : 0;
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${property.title}${property.isFeatured ? `<br/><span class="featured-badge">Featured</span>` : ""}</td>
        <td>${property.city}</td>
        <td>
          <input data-field="total" type="number" min="0" value="${total}" style="width:88px" />
        </td>
        <td>
          <input data-field="filled" type="number" min="0" value="${filled}" style="width:88px" />
        </td>
        <td><span class="occupancy-pill">${filled}/${total} (${occupancy}%)</span></td>
        <td>
          <button class="btn primary" data-action="save-occupancy" data-id="${property.id}">Save</button>
        </td>
      `;
      adminOccupancyBody.appendChild(row);
    });
  };

  const buildCountItems = (map = {}, suffix = "") =>
    Object.entries(map)
      .map(([key, value]) => ({
        label: `${toReadableLabel(key)}${suffix ? ` ${suffix}` : ""}`,
        value,
      }))
      .sort((a, b) => b.value - a.value);

  const buildInlineSummary = (map = {}, keys = []) =>
    keys
      .map((key) => `${toReadableLabel(key)} ${formatNumber(map[key] || 0)}`)
      .join(", ");

  const renderKpiDetailCards = (items = []) => {
    if (!kpiDetailBody) return;

    if (!items.length) {
      kpiDetailBody.innerHTML = `<div class="empty-state">No breakdown data available.</div>`;
      return;
    }

    kpiDetailBody.innerHTML = items
      .map((item) => {
        const valueText = item.format === "currency" ? formatPrice(item.value) : formatNumber(item.value);
        return `
          <article class="kpi-breakdown-item">
            <p>${item.label}</p>
            <h4>${valueText}</h4>
          </article>
        `;
      })
      .join("");
  };

  const renderKpiDetailTable = (columns = [], rows = [], emptyText = "No records found.") => {
    if (!kpiDetailTableHead || !kpiDetailTableBody) return;

    if (!columns.length) {
      kpiDetailTableHead.innerHTML = "";
      kpiDetailTableBody.innerHTML = `
        <tr>
          <td class="small-text">Click a KPI card to view detailed records.</td>
        </tr>
      `;
      if (kpiDetailTableNote) {
        kpiDetailTableNote.textContent = "";
      }
      return;
    }

    const headRow = document.createElement("tr");
    columns.forEach((column) => {
      const th = document.createElement("th");
      th.textContent = column.label;
      headRow.appendChild(th);
    });
    kpiDetailTableHead.innerHTML = "";
    kpiDetailTableHead.appendChild(headRow);

    kpiDetailTableBody.innerHTML = "";

    if (!rows.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = columns.length;
      cell.className = "small-text";
      cell.textContent = emptyText;
      row.appendChild(cell);
      kpiDetailTableBody.appendChild(row);
      if (kpiDetailTableNote) {
        kpiDetailTableNote.textContent = "No records available for this KPI yet.";
      }
      return;
    }

    rows.forEach((record) => {
      const row = document.createElement("tr");

      columns.forEach((column) => {
        const cell = document.createElement("td");
        const rawValue =
          typeof column.render === "function" ? column.render(record) : record[column.key];

        if (column.type === "status") {
          const statusValue = String(rawValue || "-").toLowerCase().replace(/\s+/g, "_");
          const span = document.createElement("span");
          span.className = `status-pill ${statusValue}`;
          span.textContent = String(rawValue || "-").replace(/_/g, " ");
          cell.appendChild(span);
        } else if (column.type === "currency") {
          cell.textContent = formatPrice(rawValue);
        } else if (column.type === "date") {
          cell.textContent = formatDateTime(rawValue);
        } else if (column.type === "boolean") {
          cell.textContent = rawValue ? "Yes" : "No";
        } else {
          cell.textContent = rawValue ?? "-";
        }

        row.appendChild(cell);
      });

      kpiDetailTableBody.appendChild(row);
    });

    if (kpiDetailTableNote) {
      kpiDetailTableNote.textContent = `Showing ${formatNumber(rows.length)} records.`;
    }
  };

  const renderBriefKpiSummary = () => {
    if (!briefKpiGrid || !dashboardCache) return;

    const { kpis = {}, breakdowns = {} } = dashboardCache;
    const roleCounts = breakdowns.roleCounts || {};
    const propertyStatusCounts = breakdowns.propertyStatusCounts || {};
    const propertyTypeCounts = breakdowns.propertyTypeCounts || {};
    const bookingStatusCounts = breakdowns.bookingStatusCounts || {};
    const bookingPaymentCounts = breakdowns.bookingPaymentCounts || {};
    const workerVerificationCounts = breakdowns.workerVerificationCounts || {};
    const workerServiceCounts = breakdowns.workerServiceCounts || {};
    const hostelFeeCounts = breakdowns.hostelFeeCounts || {};
    const complaintStatusCounts = breakdowns.complaintStatusCounts || {};

    const cards = [
      {
        title: `Total Users: ${formatNumber(kpis.totalUsers)}`,
        brief: `Roles: ${buildInlineSummary(roleCounts, [
          "admin",
          "hostel_owner",
          "owner",
          "flat_owner",
          "pg_owner",
          "student",
          "tenant",
          "parent",
          "worker",
        ])}`,
      },
      {
        title: `Total Properties: ${formatNumber(kpis.totalProperties)}`,
        brief: `Status: ${buildInlineSummary(propertyStatusCounts, [
          "approved",
          "pending",
          "rejected",
        ])} | Types: ${buildInlineSummary(propertyTypeCounts, [
          "hostel",
          "pg",
          "flat",
          "room",
          "hotel",
        ])}`,
      },
      {
        title: `Total Bookings: ${formatNumber(kpis.totalBookings)}`,
        brief: `Booking status: ${buildInlineSummary(bookingStatusCounts, [
          "confirmed",
          "pending",
          "cancelled",
        ])} | Payment: ${buildInlineSummary(bookingPaymentCounts, [
          "paid",
          "unpaid",
          "failed",
          "refunded",
        ])}`,
      },
      {
        title: `Total Revenue: ${formatPrice(kpis.totalRevenue)}`,
        brief: `Paid non-cancelled bookings: ${formatNumber(breakdowns.paidBookingCount || 0)}`,
      },
      {
        title: `Total Workers: ${formatNumber(kpis.totalWorkers)}`,
        brief: `Verification: ${buildInlineSummary(workerVerificationCounts, [
          "verified",
          "pending",
          "rejected",
        ])} | Services: ${buildInlineSummary(workerServiceCounts, [
          "maid",
          "cook",
          "sweeper",
          "electrician",
          "plumber",
          "cleaner",
        ])}`,
      },
      {
        title: `Total Owners: ${formatNumber(kpis.totalOwners)}`,
        brief: `Roles: ${buildInlineSummary(roleCounts, OWNER_ROLE_KEYS)}`,
      },
      {
        title: `Hostel Students: ${formatNumber(kpis.hostelStudents)}`,
        brief: `Fee status: ${buildInlineSummary(hostelFeeCounts, ["paid", "pending", "overdue"])}`,
      },
      {
        title: `Escalated Complaints: ${formatNumber(kpis.escalatedComplaints)}`,
        brief: `Complaint status: ${buildInlineSummary(complaintStatusCounts, [
          "open",
          "in_progress",
          "resolved",
          "escalated",
        ])}`,
      },
    ];

    briefKpiGrid.innerHTML = cards
      .map(
        (card) => `
          <article class="kpi-breakdown-item">
            <h4>${card.title}</h4>
            <p class="brief-sub">${card.brief}</p>
          </article>
        `
      )
      .join("");
  };

  const setActiveKpi = (kpiKey) => {
    kpiCards.forEach((card) => {
      card.classList.toggle("active", card.dataset.kpi === kpiKey);
    });
  };

  const renderKpiDetail = (kpiKey) => {
    if (!dashboardCache || !kpiDetailTitle || !kpiDetailDesc) return;

    const { breakdowns = {}, monthlyRevenue = [], kpis = {}, detailRecords = {} } = dashboardCache;

    let title = "KPI Details";
    let desc = "";
    let items = [];
    let tableColumns = [];
    let tableRows = [];
    let emptyText = "No records found.";

    switch (kpiKey) {
      case "totalUsers":
        title = "Total Users Breakdown";
        desc = "Includes all registered accounts grouped by role. Clicked KPI shows user-level detail.";
        items = buildCountItems(breakdowns.roleCounts, "users");
        tableColumns = [
          { label: "Name", key: "name" },
          { label: "Role", key: "role" },
          { label: "Email", key: "email" },
          { label: "Phone", key: "phone" },
          { label: "City", key: "city" },
          { label: "Verified", key: "isVerified", type: "boolean" },
          { label: "Last Login", key: "lastLoginAt", type: "date" },
          { label: "Account Created", key: "createdAt", type: "date" },
        ];
        tableRows = detailRecords.users || [];
        emptyText = "No user records found.";
        break;

      case "totalProperties":
        title = "Total Properties Breakdown";
        desc = "Includes every listing regardless of status.";
        items = [
          ...buildCountItems(breakdowns.propertyStatusCounts, "listings"),
          ...buildCountItems(breakdowns.propertyTypeCounts, "type"),
        ];
        tableColumns = [
          { label: "Title", key: "title" },
          { label: "Type", key: "propertyType" },
          { label: "City", key: "city" },
          { label: "Location", key: "address" },
          { label: "Price", key: "price", type: "currency" },
          { label: "Price Type", key: "priceType" },
          { label: "Status", key: "status", type: "status" },
          { label: "Owner", key: "ownerName" },
          { label: "Owner Contact", key: "ownerEmail" },
          { label: "Created", key: "createdAt", type: "date" },
        ];
        tableRows = detailRecords.properties || [];
        emptyText = "No property records found.";
        break;

      case "totalBookings":
        title = "Total Bookings Breakdown";
        desc = "Booking total split by booking status and payment status.";
        items = [
          ...buildCountItems(breakdowns.bookingStatusCounts, "bookings"),
          ...buildCountItems(breakdowns.bookingPaymentCounts, "payments"),
        ];
        tableColumns = [
          { label: "Booking ID", render: (row) => formatShortId(row.id) },
          { label: "User", key: "userName" },
          { label: "User City", key: "userCity" },
          { label: "Property", key: "propertyTitle" },
          { label: "Property City", key: "propertyCity" },
          { label: "Check In", key: "checkInDate", type: "date" },
          { label: "Check Out", key: "checkOutDate", type: "date" },
          { label: "Amount", key: "amount", type: "currency" },
          { label: "Booking Status", key: "status", type: "status" },
          { label: "Payment Status", key: "paymentStatus", type: "status" },
          { label: "Created", key: "createdAt", type: "date" },
        ];
        tableRows = detailRecords.bookings || [];
        emptyText = "No booking records found.";
        break;

      case "totalRevenue":
        title = "Revenue Breakdown";
        desc = "Revenue includes paid and non-cancelled bookings only.";
        items = [
          {
            label: "Total Revenue",
            value: kpis.totalRevenue || 0,
            format: "currency",
          },
          {
            label: "Paid Confirmed Bookings",
            value: breakdowns.paidBookingCount || 0,
          },
          ...monthlyRevenue.map((entry) => ({
            label: `${entry.label} Revenue`,
            value: entry.revenue,
            format: "currency",
          })),
        ];
        tableColumns = [
          { label: "Booking ID", render: (row) => formatShortId(row.id) },
          { label: "User", key: "userName" },
          { label: "Property", key: "propertyTitle" },
          { label: "Property City", key: "propertyCity" },
          { label: "Amount", key: "amount", type: "currency" },
          { label: "Payment Status", key: "paymentStatus", type: "status" },
          { label: "Booking Status", key: "status", type: "status" },
          { label: "Payment ID", key: "paymentId" },
          { label: "Order ID", key: "paymentOrderId" },
          { label: "Paid/Created On", key: "createdAt", type: "date" },
        ];
        tableRows = detailRecords.revenueBookings || [];
        emptyText = "No paid booking records found.";
        break;

      case "totalWorkers":
        title = "Workers Breakdown";
        desc = "Workers split by verification stage and service type.";
        items = [
          ...buildCountItems(breakdowns.workerVerificationCounts, "workers"),
          ...buildCountItems(breakdowns.workerServiceCounts, "services"),
        ];
        tableColumns = [
          { label: "Name", key: "name" },
          { label: "Service", key: "serviceType" },
          { label: "City", key: "city" },
          { label: "Charges", key: "charges", type: "currency" },
          { label: "Availability", key: "availability" },
          { label: "Verification", key: "verificationStatus", type: "status" },
          { label: "Rating", key: "rating" },
          { label: "Total Jobs", key: "totalJobs" },
          { label: "Last Login", key: "lastLoginAt", type: "date" },
          { label: "Registered", key: "createdAt", type: "date" },
        ];
        tableRows = detailRecords.workers || [];
        emptyText = "No worker records found.";
        break;

      case "totalOwners":
        title = "All Owners Breakdown";
        desc = "All owner accounts across owner, flat_owner, pg_owner, and hostel_owner roles.";
        items = [
          {
            label: "Owner Accounts",
            value: kpis.totalOwners || 0,
          },
          {
            label: "Total Owner Listings",
            value: (detailRecords.owners || []).reduce(
              (sum, row) => sum + Number(row.totalListings || 0),
              0
            ),
          },
          ...OWNER_ROLE_KEYS.map((role) => ({
            label: `${toReadableLabel(role)} Accounts`,
            value: breakdowns.roleCounts?.[role] || 0,
          })),
        ];
        tableColumns = [
          { label: "Owner Name", key: "name" },
          { label: "Role", key: "role" },
          { label: "Email", key: "email" },
          { label: "Phone", key: "phone" },
          { label: "City", key: "city" },
          { label: "Total Listings", key: "totalListings" },
          { label: "Hostel Listings", key: "hostelListings" },
          { label: "PG Listings", key: "pgListings" },
          { label: "Flat Listings", key: "flatListings" },
          { label: "Room Listings", key: "roomListings" },
          { label: "Hotel Listings", key: "hotelListings" },
          { label: "Last Login", key: "lastLoginAt", type: "date" },
          { label: "Account Created", key: "createdAt", type: "date" },
        ];
        tableRows = detailRecords.owners || [];
        emptyText = "No owner accounts found.";
        break;

      case "hostelStudents":
        title = "Hostel Students Breakdown";
        desc = "Student records mapped under hostel operations.";
        items = buildCountItems(breakdowns.hostelFeeCounts, "fee records");
        tableColumns = [
          { label: "Student", key: "studentName" },
          { label: "Student Email", key: "studentEmail" },
          { label: "Student City", key: "studentCity" },
          { label: "Hostel Owner", key: "hostelOwnerName" },
          { label: "Property", key: "propertyTitle" },
          { label: "Property City", key: "propertyCity" },
          { label: "Room", key: "roomNumber" },
          { label: "Fee Status", key: "feeStatus", type: "status" },
          { label: "Attendance Entries", key: "attendanceCount" },
          { label: "In/Out Logs", key: "inOutCount" },
          { label: "Last Attendance", key: "lastAttendanceDate", type: "date" },
          { label: "Record Created", key: "createdAt", type: "date" },
        ];
        tableRows = detailRecords.hostelStudents || [];
        emptyText = "No hostel student records found.";
        break;

      case "escalatedComplaints":
        title = "Complaints Breakdown";
        desc = "Complaint counts by status across the platform.";
        items = [
          ...buildCountItems(breakdowns.complaintStatusCounts, "complaints"),
          {
            label: "Escalated Complaints",
            value: kpis.escalatedComplaints || 0,
          },
        ];
        tableColumns = [
          { label: "Category", key: "category" },
          { label: "Raised By", key: "raisedByName" },
          { label: "Against", key: "targetName" },
          { label: "Property", key: "propertyTitle" },
          { label: "Property City", key: "propertyCity" },
          { label: "Status", key: "status", type: "status" },
          { label: "Message", key: "message" },
          { label: "Raised On", key: "createdAt", type: "date" },
          { label: "Resolved On", key: "resolvedAt", type: "date" },
        ];
        tableRows = detailRecords.escalatedComplaints || [];
        emptyText = "No escalated complaints found.";
        break;

      default:
        title = "KPI Details";
        desc = "Click any KPI card above to view exact composition.";
        items = [];
        tableColumns = [];
        tableRows = [];
    }

    kpiDetailTitle.textContent = title;
    kpiDetailDesc.textContent = desc;
    renderKpiDetailCards(items);
    renderKpiDetailTable(tableColumns, tableRows, emptyText);
  };

  const bindKpiCardEvents = () => {
    if (!kpiCards.length) return;

    kpiCards.forEach((card) => {
      card.addEventListener("click", () => {
        const kpiKey = card.dataset.kpi;
        if (!kpiKey) return;

        activeKpiKey = kpiKey;
        setActiveKpi(activeKpiKey);
        renderKpiDetail(activeKpiKey);
      });
    });
  };

  const loadDashboard = async () => {
    if (!token) {
      window.location.href = "./login.html";
      return;
    }

    try {
      clearMessage();
      renderLoadingTable(pendingPropertiesBody, 6);
      renderLoadingTable(adminBookingsBody, 6);
      renderLoadingTable(escalatedComplaintsBody, 5);
      if (recentActivityList) {
        recentActivityList.innerHTML =
          '<div class="loading-inline"><span class="loading-spinner"></span> Loading recent activity...</div>';
      }
      if (topPropertiesGrid) {
        topPropertiesGrid.innerHTML =
          '<div class="loading-inline"><span class="loading-spinner"></span> Loading top properties...</div>';
      }
      if (adminOccupancyBody) {
        renderLoadingTable(adminOccupancyBody, 6);
      }
      if (kpiDetailBody) {
        kpiDetailBody.innerHTML =
          '<div class="loading-inline"><span class="loading-spinner"></span> Loading KPI details...</div>';
      }
      if (kpiDetailTableHead) {
        kpiDetailTableHead.innerHTML = "";
      }
      if (kpiDetailTableBody) {
        kpiDetailTableBody.innerHTML = `
          <tr>
            <td class="small-text">
              <span class="loading-inline"><span class="loading-spinner"></span> Loading detailed records...</span>
            </td>
          </tr>
        `;
      }
      if (kpiDetailTableNote) {
        kpiDetailTableNote.textContent = "";
      }
      if (briefKpiGrid) {
        briefKpiGrid.innerHTML =
          '<div class="loading-inline"><span class="loading-spinner"></span> Loading brief summary...</div>';
      }

      const response = await fetch(`${API_BASE_URL}/admin/dashboard`, {
        headers: authHeaders(),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load admin dashboard.");
      }

      dashboardCache = data;

      kpiUsers.textContent = data.kpis.totalUsers;
      kpiProperties.textContent = data.kpis.totalProperties;
      kpiBookings.textContent = data.kpis.totalBookings;
      kpiRevenue.textContent = `Rs ${Number(data.kpis.totalRevenue).toLocaleString("en-IN")}`;
      kpiWorkers.textContent = data.kpis.totalWorkers || 0;
      kpiOwners.textContent = data.kpis.totalOwners || 0;
      kpiHostelStudents.textContent = data.kpis.hostelStudents || 0;
      kpiEscalatedComplaints.textContent = data.kpis.escalatedComplaints || 0;

      renderPendingProperties(data.pendingProperties || []);
      renderBookings(data.recentBookings || []);
      renderEscalatedComplaints(data.escalatedComplaintsList || []);
      renderRevenueChart(data.monthlyRevenue || []);
      renderRecentActivity(data.recentActivity || []);
      renderTopProperties(data.topPropertiesByRevenue || []);
      renderOccupancyEditor(data.detailRecords?.properties || []);

      setActiveKpi(activeKpiKey);
      renderKpiDetail(activeKpiKey);
      renderBriefKpiSummary();
      await Promise.all([loadAllComplaints(), loadAdminReviews()]);
    } catch (error) {
      showMessage(error.message);
    }
  };

  const handlePropertyAction = async (event) => {
    const action = event.target.dataset.action;
    const propertyId = event.target.dataset.id;
    if (!action || !propertyId) return;

    const endpoint =
      action === "approve"
        ? `${API_BASE_URL}/admin/properties/${propertyId}/approve`
        : `${API_BASE_URL}/admin/properties/${propertyId}/reject`;

    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: authHeaders(),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Property action failed.");
      }

      showMessage(data.message, "success");
      await loadDashboard();
    } catch (error) {
      showMessage(error.message);
    }
  };

  const handleComplaintAction = async (event) => {
    const action = event.target.dataset.action;
    const complaintId = event.target.dataset.id;
    if (!action || !complaintId) return;

    if (action !== "resolve-complaint") return;

    const responseNote = window.prompt(
      "Add resolution note (optional):",
      "Issue reviewed and resolved by admin."
    );
    if (responseNote === null) return;

    try {
      const response = await fetch(`${API_BASE_URL}/complaints/${complaintId}/resolve`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          response: responseNote.trim(),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to resolve complaint.");
      }

      showMessage(data.message || "Complaint resolved.", "success");
      await loadDashboard();
    } catch (error) {
      showMessage(error.message);
    }
  };

  pendingPropertiesBody.addEventListener("click", handlePropertyAction);
  adminOccupancyBody?.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action='save-occupancy']");
    if (!button) return;

    const propertyId = button.dataset.id;
    const row = button.closest("tr");
    if (!propertyId || !row) return;

    const totalInput = row.querySelector("input[data-field='total']");
    const filledInput = row.querySelector("input[data-field='filled']");
    const manualTotalRooms = Number(totalInput?.value || 0);
    const manualFilledRooms = Number(filledInput?.value || 0);

    if (
      !Number.isInteger(manualTotalRooms) ||
      !Number.isInteger(manualFilledRooms) ||
      manualTotalRooms < 0 ||
      manualFilledRooms < 0
    ) {
      showMessage("Occupancy values must be non-negative integers.");
      return;
    }

    try {
      button.disabled = true;
      button.textContent = "Saving...";
      const response = await fetch(`${API_BASE_URL}/admin/properties/${propertyId}/occupancy`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({
          manualTotalRooms,
          manualFilledRooms,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to update occupancy.");
      }

      showMessage(data.message, "success");
      await loadDashboard();
    } catch (error) {
      showMessage(error.message);
    } finally {
      button.disabled = false;
      button.textContent = "Save";
    }
  });
  adminAllComplaintsBody?.addEventListener("click", handleComplaintAction);
  adminReviewsBody?.addEventListener("click", handleReviewAction);
  adminComplaintRefreshBtn?.addEventListener("click", loadAllComplaints);
  adminComplaintStatusFilter?.addEventListener("change", loadAllComplaints);
  bindKpiCardEvents();
  loadDashboard();
})();

