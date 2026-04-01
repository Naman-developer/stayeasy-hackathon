(() => {
  const API_BASE_URL = "http://localhost:5000/api";
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

  const hostelMessage = document.getElementById("hostelMessage");
  const addStudentForm = document.getElementById("hostelAddStudentForm");
  const attendanceForm = document.getElementById("hostelAttendanceForm");
  const messForm = document.getElementById("hostelMessForm");
  const studentsBody = document.getElementById("hostelStudentsBody");
  const outpassBody = document.getElementById("hostelOutpassBody");
  const hostelListingsBody = document.getElementById("hostelListingsBody");
  const hostelLateEntriesList = document.getElementById("hostelLateEntriesList");
  const hostelBroadcastForm = document.getElementById("hostelBroadcastForm");
  const hostelBroadcastResult = document.getElementById("hostelBroadcastResult");
  const hostelMessFeedbackUp = document.getElementById("hostelMessFeedbackUp");
  const hostelMessFeedbackDown = document.getElementById("hostelMessFeedbackDown");
  const hostelMessFeedbackTotal = document.getElementById("hostelMessFeedbackTotal");
  const hostelMessFeedbackMeta = document.getElementById("hostelMessFeedbackMeta");
  const hostelMessFeedbackRefreshBtn = document.getElementById("hostelMessFeedbackRefreshBtn");

  const hostelStudentCount = document.getElementById("hostelStudentCount");
  const hostelPresentCount = document.getElementById("hostelPresentCount");
  const hostelAbsentCount = document.getElementById("hostelAbsentCount");
  const hostelPendingOutpass = document.getElementById("hostelPendingOutpass");

  const propertySelect = document.getElementById("hostelPropertySelect");
  const messPropertySelect = document.getElementById("messPropertySelect");

  const showMessage = (text, type = "error") => {
    if (!hostelMessage) return;
    hostelMessage.textContent = text;
    hostelMessage.className = `message show ${type}`;
    showToastSafe(text, type === "success" ? "success" : "error");
  };

  const createStatusPill = (status) =>
    `<span class="status-pill ${status}">${status.replace("_", " ")}</span>`;

  const formatPrice = (value) =>
    Number(value || 0).toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    });

  const renderHostelListings = (listings) => {
    if (!hostelListingsBody) return;

    hostelListingsBody.innerHTML = "";
    if (!listings.length) {
      hostelListingsBody.innerHTML = `
        <tr>
          <td colspan="5" class="small-text">
            No listings yet. Open "Manage Listings" to add your hostel/PG properties.
          </td>
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
        <td>${createStatusPill(property.status)}</td>
      `;
      hostelListingsBody.appendChild(row);
    });
  };

  const renderLateEntryAlerts = (lateEntries = []) => {
    if (!hostelLateEntriesList) return;
    if (!lateEntries.length) {
      hostelLateEntriesList.innerHTML = `<div class="empty-state">No late entries in the last 7 days.</div>`;
      return;
    }

    hostelLateEntriesList.innerHTML = lateEntries
      .map(
        (entry) => `
          <article class="late-alert-item">
            <strong>${entry.studentName} (${entry.studentCode})</strong>
            <p>${entry.propertyTitle} • Room ${entry.roomNumber} • ${new Date(entry.date).toLocaleDateString("en-IN")}</p>
            <p>${entry.note || "No note provided."}</p>
          </article>
        `
      )
      .join("");
  };

  const loadPropertyOptions = async () => {
    const response = await fetch(`${API_BASE_URL}/properties/my-listings`, {
      headers: authHeaders(),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Failed to load properties.");

    const listings = data.properties || [];
    const options = listings
      .map(
        (property) =>
          `<option value="${property._id}">${property.title} - ${property.city}</option>`
      )
      .join("");

    if (propertySelect) {
      propertySelect.innerHTML = options || '<option value="">No properties found</option>';
    }
    if (messPropertySelect) {
      messPropertySelect.innerHTML = options || '<option value="">No properties found</option>';
    }
    renderHostelListings(listings);
  };

  const loadStudents = async () => {
    const response = await fetch(`${API_BASE_URL}/hostel/students`, {
      headers: authHeaders(),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Failed to load students.");

    const students = data.students || [];
    studentsBody.innerHTML = "";

    if (!students.length) {
      studentsBody.innerHTML = `
        <tr>
          <td colspan="5" class="small-text">No hostel students added yet.</td>
        </tr>
      `;
    } else {
      students.forEach((record) => {
        const studentCode = record.studentId?.studentCode || record.studentId?._id || "N/A";
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${record.studentId?.name || "N/A"}<br /><span class="small-text">${studentCode}</span></td>
          <td>${record.studentId?.email || "N/A"}</td>
          <td>${record.roomNumber}</td>
          <td>${record.propertyId?.title || "N/A"}</td>
          <td>${createStatusPill(record.feeStatus)}</td>
        `;
        studentsBody.appendChild(row);
      });
    }

    hostelStudentCount.textContent = students.length;
    hostelPresentCount.textContent = data.attendanceSummary?.present || 0;
    hostelAbsentCount.textContent = data.attendanceSummary?.absent || 0;
    renderLateEntryAlerts(data.lateEntries || []);
  };

  const loadOutpassRequests = async () => {
    const response = await fetch(`${API_BASE_URL}/hostel/outpass`, {
      headers: authHeaders(),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Failed to load outpass requests.");

    const requests = data.requests || [];
    const pendingCount = requests.filter((item) => item.status === "pending").length;
    hostelPendingOutpass.textContent = pendingCount;

    outpassBody.innerHTML = "";
    if (!requests.length) {
      outpassBody.innerHTML = `
        <tr>
          <td colspan="5" class="small-text">No outpass requests.</td>
        </tr>
      `;
      return;
    }

    requests.forEach((request) => {
      const studentCode = request.studentId?.studentCode || request.studentId?._id || "";
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${request.studentId?.name || "N/A"}${studentCode ? `<br /><span class="small-text">${studentCode}</span>` : ""}</td>
        <td>${request.reason}</td>
        <td>${request.parentApproval ? "Approved" : "Pending"}</td>
        <td>${createStatusPill(request.status)}</td>
        <td>
          <div class="inline-actions">
            <button class="btn success" data-action="approve" data-id="${request._id}">Approve</button>
            <button class="btn danger" data-action="reject" data-id="${request._id}">Reject</button>
          </div>
        </td>
      `;
      outpassBody.appendChild(row);
    });
  };

  const loadMessSchedule = async () => {
    const response = await fetch(`${API_BASE_URL}/hostel/mess`, {
      headers: authHeaders(),
    });
    const data = await response.json();
    if (!response.ok) return;

    const mess = (data.mess || [])[0];
    if (!mess) return;

    if (messPropertySelect) {
      messPropertySelect.value = mess.propertyId?._id || "";
    }
    document.getElementById("messTimings").value = mess.timings || "";
    document.getElementById("messRules").value = mess.rules || "";
    document.getElementById("messWeeklyMenu").value = (mess.weeklyMenu || [])
      .map((item) => `${item.day}|${item.breakfast}|${item.lunch}|${item.dinner}`)
      .join("\n");
  };

  const loadMessFeedbackSummary = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/hostel/mess-feedback/summary`, {
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Feedback summary failed.");

      if (hostelMessFeedbackUp) hostelMessFeedbackUp.textContent = data.today?.up || 0;
      if (hostelMessFeedbackDown) hostelMessFeedbackDown.textContent = data.today?.down || 0;
      if (hostelMessFeedbackTotal) hostelMessFeedbackTotal.textContent = data.weekly?.total || 0;
      if (hostelMessFeedbackMeta) {
        hostelMessFeedbackMeta.textContent = `Weekly 👍 ${data.weekly?.up || 0} | Weekly 👎 ${
          data.weekly?.down || 0
        }`;
      }
    } catch (error) {
      if (hostelMessFeedbackMeta) {
        hostelMessFeedbackMeta.textContent = "Unable to load feedback summary.";
      }
    }
  };

  const refreshAll = async () => {
    if (!token) {
      window.location.href = "./login.html";
      return;
    }

    await Promise.all([loadPropertyOptions(), loadStudents(), loadOutpassRequests()]);
    await Promise.all([loadMessSchedule(), loadMessFeedbackSummary()]);
  };

  addStudentForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/hostel/students/add`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          studentId: document.getElementById("hostelStudentId").value.trim(),
          propertyId: propertySelect.value,
          roomNumber: document.getElementById("hostelRoomNumber").value.trim(),
          feeStatus: document.getElementById("hostelFeeStatus").value,
          messPlan: document.getElementById("hostelMessPlan").value.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to add student.");
      showMessage(data.message, "success");
      addStudentForm.reset();
      refreshAll();
    } catch (error) {
      showMessage(error.message);
    }
  });

  attendanceForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/hostel/attendance/mark`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          studentId: document.getElementById("attendanceStudentId").value.trim(),
          status: document.getElementById("attendanceStatus").value,
          date: document.getElementById("attendanceDate").value,
          note: document.getElementById("attendanceNote").value.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to mark attendance.");
      showMessage(data.message, "success");
      attendanceForm.reset();
      refreshAll();
    } catch (error) {
      showMessage(error.message);
    }
  });

  messForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/hostel/mess`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          propertyId: messPropertySelect.value,
          weeklyMenu: document.getElementById("messWeeklyMenu").value,
          rules: document.getElementById("messRules").value.trim(),
          timings: document.getElementById("messTimings").value.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to save mess schedule.");
      showMessage(data.message, "success");
      refreshAll();
    } catch (error) {
      showMessage(error.message);
    }
  });

  hostelBroadcastForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = document.getElementById("hostelBroadcastMessage").value.trim();
    if (!message) {
      showMessage("Broadcast message cannot be empty.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/hostel/broadcast`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ message }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Broadcast failed.");

      showMessage(data.message, "success");
      if (hostelBroadcastResult) {
        hostelBroadcastResult.textContent = `Sent to ${data.recipients?.students || 0} students and ${
          data.recipients?.parents || 0
        } parents.`;
      }
      hostelBroadcastForm.reset();
    } catch (error) {
      showMessage(error.message);
    }
  });

  outpassBody?.addEventListener("click", async (event) => {
    const action = event.target.dataset.action;
    const id = event.target.dataset.id;
    if (!action || !id) return;

    const endpoint =
      action === "approve"
        ? `${API_BASE_URL}/hostel/outpass/${id}/approve`
        : `${API_BASE_URL}/hostel/outpass/${id}/reject`;

    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed outpass action.");
      showMessage(data.message, "success");
      refreshAll();
    } catch (error) {
      showMessage(error.message);
    }
  });

  hostelMessFeedbackRefreshBtn?.addEventListener("click", loadMessFeedbackSummary);

  refreshAll();
})();
