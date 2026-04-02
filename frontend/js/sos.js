(() => {
  const API_BASE_URL = localStorage.getItem("stayeasy_api_base_url") || "https://stayeasy-hackathon-production.up.railway.app/api";
  const token = localStorage.getItem("stayeasy_token");
  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem("stayeasy_user") || "{}");
    } catch (error) {
      return {};
    }
  })();

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  });

  const showToastSafe = (message, type = "info") => {
    if (window.showToast) {
      window.showToast(message, type);
    }
  };

  const studentMessage = document.getElementById("studentMessage");
  const sosButton = document.getElementById("sosButton");
  const callParentBtn = document.getElementById("callParentBtn");
  const callHostelBtn = document.getElementById("callHostelBtn");
  const recommendationForm = document.getElementById("studentRecommendationForm");
  const recommendationsGrid = document.getElementById("studentRecommendationsGrid");
  const studentMessBox = document.getElementById("studentMessBox");
  const studentMessUpBtn = document.getElementById("studentMessUpBtn");
  const studentMessDownBtn = document.getElementById("studentMessDownBtn");
  const studentMessFeedbackStatus = document.getElementById("studentMessFeedbackStatus");
  const studentOutpassForm = document.getElementById("studentOutpassForm");
  const studentOutpassBody = document.getElementById("studentOutpassBody");
  const studentAttendanceBody = document.getElementById("studentAttendanceBody");
  const studentBookingsBody = document.getElementById("studentBookingsBody");
  const studentComplaintForm = document.getElementById("studentComplaintForm");
  const studentComplaintsBody = document.getElementById("studentComplaintsBody");
  const studentReviewForm = document.getElementById("studentReviewForm");
  const studentReviewRating = document.getElementById("studentReviewRating");
  const studentReviewTitle = document.getElementById("studentReviewTitle");
  const studentReviewMessage = document.getElementById("studentReviewMessage");
  const studentReviewsBody = document.getElementById("studentReviewsBody");

  const studentAttendanceCount = document.getElementById("studentAttendanceCount");
  const studentPendingOutpass = document.getElementById("studentPendingOutpass");
  const studentBookingCount = document.getElementById("studentBookingCount");
  const studentOpenComplaints = document.getElementById("studentOpenComplaints");
  const studentCodeValue = document.getElementById("studentCodeValue");
  const studentSafetyScore = document.getElementById("studentSafetyScore");
  const studentSafetyHint = document.getElementById("studentSafetyHint");

  const studentRentTotal = document.getElementById("studentRentTotal");
  const studentRoommates = document.getElementById("studentRoommates");
  const studentRentShare = document.getElementById("studentRentShare");
  const studentRentCalcBtn = document.getElementById("studentRentCalcBtn");

  const studentDealBudget = document.getElementById("studentDealBudget");
  const studentDealExpectedRent = document.getElementById("studentDealExpectedRent");
  const studentDealResult = document.getElementById("studentDealResult");
  const studentDealCheckBtn = document.getElementById("studentDealCheckBtn");

  const checklistElectricity = document.getElementById("checklistElectricity");
  const checklistWater = document.getElementById("checklistWater");
  const checklistAgreement = document.getElementById("checklistAgreement");
  const studentChecklistSaveBtn = document.getElementById("studentChecklistSaveBtn");
  const studentChecklistStatus = document.getElementById("studentChecklistStatus");

  const showMessage = (text, type = "error") => {
    if (!studentMessage) return;
    studentMessage.textContent = text;
    studentMessage.className = `message show ${type}`;
    showToastSafe(text, type === "success" ? "success" : "error");
  };

  const statusPill = (status) =>
    `<span class="status-pill ${status}">${status.replace("_", " ")}</span>`;

  const formatPrice = (value) =>
    Number(value || 0).toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    });

  const loadStudentInsights = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/hostel/student-insights`, {
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load safety insights.");

      if (studentSafetyScore) {
        studentSafetyScore.textContent = `${data.safetyScore || 0}/100`;
      }
      if (studentSafetyHint) {
        const penalties = data.penalties || {};
        studentSafetyHint.textContent = `Late ${penalties.lateCount || 0}, Absent ${
          penalties.absentCount || 0
        }, Complaints ${penalties.activeComplaints || 0}`;
      }
    } catch (error) {
      if (studentSafetyHint) {
        studentSafetyHint.textContent = "Safety insights unavailable.";
      }
    }
  };

  const loadMoveInChecklist = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/student/checklist`, {
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Checklist fetch failed.");

      if (checklistElectricity) checklistElectricity.checked = Boolean(data.checklist?.electricity);
      if (checklistWater) checklistWater.checked = Boolean(data.checklist?.water);
      if (checklistAgreement) checklistAgreement.checked = Boolean(data.checklist?.agreement);

      if (studentChecklistStatus) {
        const doneCount = [
          data.checklist?.electricity,
          data.checklist?.water,
          data.checklist?.agreement,
        ].filter(Boolean).length;
        studentChecklistStatus.textContent = `Checklist completed: ${doneCount}/3`;
      }
    } catch (error) {
      if (studentChecklistStatus) {
        studentChecklistStatus.textContent = "Unable to load checklist.";
      }
    }
  };

  const saveMoveInChecklist = async () => {
    try {
      if (studentChecklistSaveBtn) {
        studentChecklistSaveBtn.disabled = true;
      }
      const response = await fetch(`${API_BASE_URL}/student/checklist`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          electricity: checklistElectricity?.checked || false,
          water: checklistWater?.checked || false,
          agreement: checklistAgreement?.checked || false,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Checklist save failed.");

      const doneCount = [
        checklistElectricity?.checked,
        checklistWater?.checked,
        checklistAgreement?.checked,
      ].filter(Boolean).length;
      if (studentChecklistStatus) {
        studentChecklistStatus.textContent = `Checklist completed: ${doneCount}/3`;
      }
      showMessage("Move-in checklist saved.", "success");
    } catch (error) {
      showMessage(error.message);
    } finally {
      if (studentChecklistSaveBtn) {
        studentChecklistSaveBtn.disabled = false;
      }
    }
  };

  const calculateRentSplit = () => {
    const total = Number(studentRentTotal?.value || 0);
    const roommates = Number(studentRoommates?.value || 1);
    if (!studentRentShare) return;

    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(roommates) || roommates <= 0) {
      studentRentShare.textContent = "Enter valid rent and roommate count.";
      return;
    }

    const share = Math.round(total / roommates);
    studentRentShare.textContent = `Each person share: Rs ${share.toLocaleString("en-IN")}`;
  };

  const calculateDealIndicator = () => {
    const budget = Number(studentDealBudget?.value || 0);
    const expectedRent = Number(studentDealExpectedRent?.value || 0);
    if (!studentDealResult) return;

    if (!budget || !expectedRent) {
      studentDealResult.textContent = "Enter both budget and expected rent.";
      return;
    }

    if (expectedRent <= budget) {
      studentDealResult.textContent = "Good deal: rent is within your budget.";
      return;
    }
    if (expectedRent <= budget * 1.15) {
      studentDealResult.textContent = "Fair deal: slightly above budget.";
      return;
    }
    studentDealResult.textContent = "High deal: significantly above your budget.";
  };

  const runQuickEmergencyAction = async (actionType) => {
    try {
      const response = await fetch(`${API_BASE_URL}/sos/quick-action`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ actionType }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Quick emergency action failed.");
      showMessage(data.message, "success");
    } catch (error) {
      showMessage(error.message);
    }
  };

  const submitMessFeedback = async (vote) => {
    try {
      const response = await fetch(`${API_BASE_URL}/hostel/mess-feedback`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ vote }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to save mess feedback.");
      if (studentMessFeedbackStatus) {
        studentMessFeedbackStatus.textContent = `Today's feedback saved: ${
          vote === "up" ? "👍 Positive" : "👎 Negative"
        }.`;
      }
      showMessage(data.message, "success");
    } catch (error) {
      showMessage(error.message);
    }
  };

  const loadRecommendations = async (event) => {
    if (event) event.preventDefault();
    if (!token) return;

    const city = document.getElementById("recommendCity").value.trim();
    const type = document.getElementById("recommendType").value;
    const budget = document.getElementById("recommendBudget").value.trim();

    try {
      const params = new URLSearchParams();
      if (city) params.set("city", city);
      if (type) params.set("type", type);
      if (budget) params.set("budget", budget);

      const response = await fetch(`${API_BASE_URL}/recommendations?${params.toString()}`, {
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed recommendations.");

      recommendationsGrid.innerHTML = "";
      if (!(data.recommendations || []).length) {
        recommendationsGrid.innerHTML = "<p class='small-text'>No recommendations found.</p>";
        return;
      }

      data.recommendations.forEach((property) => {
        const card = document.createElement("article");
        card.className = "card";
        card.innerHTML = `
          <h3>${property.title}</h3>
          <p class="small-text">${property.city} - ${property.propertyType.toUpperCase()}</p>
          <p>${formatPrice(property.price)} / ${property.priceType}</p>
          <p class="small-text">AI Score: ${property.aiScore}</p>
          <p class="small-text">Rating: ${property.rating} (${property.totalReviews} reviews)</p>
          <a class="btn ghost" style="text-decoration:none; display:inline-block; margin-top:0.5rem" href="./property-details.html?id=${property._id}">
            View
          </a>
        `;
        recommendationsGrid.appendChild(card);
      });
    } catch (error) {
      showMessage(error.message);
    }
  };

  const loadMessSchedule = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/hostel/mess`, {
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok || !data.mess) {
        studentMessBox.textContent = "No mess schedule available.";
        return;
      }

      const mess = data.mess;
      studentMessBox.innerHTML = `
        <p><strong>${mess.propertyId?.title || "Hostel Mess Plan"}</strong></p>
        <p>Timings: ${mess.timings || "N/A"}</p>
        <p>Rules: ${mess.rules || "N/A"}</p>
        <ul>
          ${(mess.weeklyMenu || [])
            .map(
              (item) =>
                `<li>${item.day}: ${item.breakfast} / ${item.lunch} / ${item.dinner}</li>`
            )
            .join("")}
        </ul>
      `;
    } catch (error) {
      studentMessBox.textContent = "Unable to load mess schedule.";
    }
  };

  const loadAttendance = async () => {
    try {
      const attendanceIdentifier = user.studentCode || user._id;
      const response = await fetch(
        `${API_BASE_URL}/hostel/attendance/${encodeURIComponent(attendanceIdentifier)}`,
        {
          headers: authHeaders(),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Attendance load failed.");

      const logs = data.attendanceLogs || [];
      studentAttendanceBody.innerHTML = "";
      if (!logs.length) {
        studentAttendanceBody.innerHTML =
          "<tr><td colspan='3' class='small-text'>No attendance logs yet.</td></tr>";
      } else {
        logs.forEach((log) => {
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${new Date(log.date).toLocaleDateString("en-IN")}</td>
            <td>${statusPill(log.status)}</td>
            <td>${log.note || "-"}</td>
          `;
          studentAttendanceBody.appendChild(row);
        });
      }

      studentAttendanceCount.textContent = logs.length;
    } catch (error) {
      showMessage(error.message);
    }
  };

  const loadOutpassRequests = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/hostel/outpass`, {
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Outpass load failed.");

      const requests = data.requests || [];
      studentOutpassBody.innerHTML = "";
      if (!requests.length) {
        studentOutpassBody.innerHTML =
          "<tr><td colspan='3' class='small-text'>No outpass requests.</td></tr>";
      } else {
        requests.forEach((request) => {
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${request.reason}</td>
            <td>${statusPill(request.status)}</td>
            <td>${request.parentApproval ? "Approved" : "Pending"}</td>
          `;
          studentOutpassBody.appendChild(row);
        });
      }
      studentPendingOutpass.textContent = requests.filter(
        (item) => item.status === "pending"
      ).length;
    } catch (error) {
      showMessage(error.message);
    }
  };

  const loadBookings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/bookings/my-bookings`, {
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Booking load failed.");

      const bookings = data.bookings || [];
      studentBookingsBody.innerHTML = "";
      if (!bookings.length) {
        studentBookingsBody.innerHTML =
          "<tr><td colspan='4' class='small-text'>No bookings yet.</td></tr>";
      } else {
        bookings.forEach((booking) => {
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${booking.propertyId?.title || "N/A"}</td>
            <td>${formatPrice(booking.amount)}</td>
            <td>${statusPill(booking.status)}</td>
            <td>${statusPill(booking.paymentStatus)}</td>
          `;
          studentBookingsBody.appendChild(row);
        });
      }
      studentBookingCount.textContent = bookings.length;
    } catch (error) {
      showMessage(error.message);
    }
  };

  const loadComplaints = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/complaints/my`, {
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Complaint load failed.");

      const complaints = data.complaints || [];
      studentComplaintsBody.innerHTML = "";
      if (!complaints.length) {
        studentComplaintsBody.innerHTML =
          "<tr><td colspan='4' class='small-text'>No complaints yet.</td></tr>";
      } else {
        complaints.forEach((complaint) => {
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${complaint.category}</td>
            <td>${complaint.message}</td>
            <td>${statusPill(complaint.status)}</td>
            <td>${complaint.response || "-"}</td>
          `;
          studentComplaintsBody.appendChild(row);
        });
      }

      studentOpenComplaints.textContent = complaints.filter((item) =>
        ["open", "in_progress", "escalated"].includes(item.status)
      ).length;
    } catch (error) {
      showMessage(error.message);
    }
  };

  const loadStudentReviews = async () => {
    if (!studentReviewsBody) return;

    try {
      const response = await fetch(`${API_BASE_URL}/reviews/my`, {
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Review load failed.");

      const reviews = data.reviews || [];
      studentReviewsBody.innerHTML = "";
      if (!reviews.length) {
        studentReviewsBody.innerHTML =
          "<tr><td colspan='4' class='small-text'>No reviews submitted yet.</td></tr>";
        return;
      }

      reviews.forEach((review) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td><span class="feedback-pill">${review.rating}/5</span></td>
          <td>${review.title || "-"}</td>
          <td>${review.message}</td>
          <td>${new Date(review.createdAt).toLocaleDateString("en-IN")}</td>
        `;
        studentReviewsBody.appendChild(row);
      });
    } catch (error) {
      studentReviewsBody.innerHTML = `<tr><td colspan='4' class='small-text'>${error.message}</td></tr>`;
    }
  };

  const refreshAll = async () => {
    if (!token || !user?._id) {
      window.location.href = "./login.html";
      return;
    }

    if (studentCodeValue) {
      studentCodeValue.textContent = user.studentCode || user._id || "Not assigned";
    }

    calculateRentSplit();
    calculateDealIndicator();

    await Promise.all([
      loadStudentInsights(),
      loadMoveInChecklist(),
      loadMessSchedule(),
      loadAttendance(),
      loadOutpassRequests(),
      loadBookings(),
      loadComplaints(),
      loadStudentReviews(),
      loadRecommendations(),
    ]);
  };

  studentOutpassForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/hostel/outpass`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          reason: document.getElementById("outpassReason").value.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Outpass submit failed.");
      showMessage(data.message, "success");
      studentOutpassForm.reset();
      loadOutpassRequests();
      loadStudentInsights();
    } catch (error) {
      showMessage(error.message);
    }
  });

  studentComplaintForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/complaints`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          category: document.getElementById("complaintCategory").value.trim() || "general",
          message: document.getElementById("complaintMessage").value.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Complaint submit failed.");
      showMessage(data.message, "success");
      studentComplaintForm.reset();
      loadComplaints();
      loadStudentInsights();
    } catch (error) {
      showMessage(error.message);
    }
  });

  studentReviewForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const rating = Number(studentReviewRating?.value || 0);
    const title = studentReviewTitle?.value?.trim() || "";
    const message = studentReviewMessage?.value?.trim() || "";

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
      if (!response.ok) throw new Error(data.message || "Review submit failed.");

      showMessage(data.message, "success");
      studentReviewForm.reset();
      if (studentReviewRating) {
        studentReviewRating.value = "5";
      }
      await loadStudentReviews();
    } catch (error) {
      showMessage(error.message);
    }
  });

  recommendationForm?.addEventListener("submit", loadRecommendations);
  callParentBtn?.addEventListener("click", () => runQuickEmergencyAction("call_parent"));
  callHostelBtn?.addEventListener("click", () => runQuickEmergencyAction("call_hostel"));

  sosButton?.addEventListener("click", () => {
    if (!navigator.geolocation) {
      showMessage("Geolocation is not supported in this browser.");
      return;
    }

    showMessage("Fetching location and sending SOS...", "success");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const response = await fetch(`${API_BASE_URL}/sos`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || "SOS failed.");

          window.alert("SOS sent successfully. Emergency contacts notified.");
          showMessage(data.message, "success");
          loadStudentInsights();
        } catch (error) {
          showMessage(error.message);
        }
      },
      () => {
        showMessage("Unable to fetch location for SOS.");
      }
    );
  });

  studentRentCalcBtn?.addEventListener("click", calculateRentSplit);
  studentDealCheckBtn?.addEventListener("click", calculateDealIndicator);
  studentRentTotal?.addEventListener("input", calculateRentSplit);
  studentRoommates?.addEventListener("input", calculateRentSplit);
  studentDealBudget?.addEventListener("input", calculateDealIndicator);
  studentDealExpectedRent?.addEventListener("input", calculateDealIndicator);
  studentChecklistSaveBtn?.addEventListener("click", saveMoveInChecklist);
  studentMessUpBtn?.addEventListener("click", () => submitMessFeedback("up"));
  studentMessDownBtn?.addEventListener("click", () => submitMessFeedback("down"));

  refreshAll();
})();

