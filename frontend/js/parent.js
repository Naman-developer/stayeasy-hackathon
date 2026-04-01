(() => {
  const API_BASE_URL = "http://localhost:5000/api";
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

  const parentLookupForm = document.getElementById("parentLookupForm");
  const parentStudentIdInput = document.getElementById("parentStudentId");
  const parentMessage = document.getElementById("parentMessage");
  const parentChildProfile = document.getElementById("parentChildProfile");
  const parentMessSchedule = document.getElementById("parentMessSchedule");
  const parentAttendanceBody = document.getElementById("parentAttendanceBody");
  const parentOutpassBody = document.getElementById("parentOutpassBody");
  const parentAttendanceCount = document.getElementById("parentAttendanceCount");
  const parentPendingOutpass = document.getElementById("parentPendingOutpass");
  const parentApprovedOutpass = document.getElementById("parentApprovedOutpass");
  const parentLiveStatus = document.getElementById("parentLiveStatus");
  const parentWeeklyAttendancePercent = document.getElementById("parentWeeklyAttendancePercent");
  const parentWeeklyOutpassCount = document.getElementById("parentWeeklyOutpassCount");
  const parentCheckChildBtn = document.getElementById("parentCheckChildBtn");
  const parentReviewForm = document.getElementById("parentReviewForm");
  const parentReviewRating = document.getElementById("parentReviewRating");
  const parentReviewTitle = document.getElementById("parentReviewTitle");
  const parentReviewMessage = document.getElementById("parentReviewMessage");
  const parentReviewsBody = document.getElementById("parentReviewsBody");

  let currentStudentReference = "";

  const showMessage = (text, type = "error") => {
    parentMessage.textContent = text;
    parentMessage.className = `message show ${type}`;
    showToastSafe(text, type === "success" ? "success" : "error");
  };

  const statusPill = (status) =>
    `<span class="status-pill ${status}">${status.replace("_", " ")}</span>`;

  const loadParentWeeklyReport = async (studentId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/parent/report/${encodeURIComponent(studentId)}`, {
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load weekly report.");

      if (parentLiveStatus) {
        parentLiveStatus.textContent = data.liveStatus || "Unknown";
      }
      if (parentWeeklyAttendancePercent) {
        parentWeeklyAttendancePercent.textContent = `${data.weekly?.attendancePercent || 0}%`;
      }
      if (parentWeeklyOutpassCount) {
        parentWeeklyOutpassCount.textContent = data.weekly?.outpassCount || 0;
      }
    } catch (error) {
      if (parentLiveStatus) parentLiveStatus.textContent = "Unknown";
      if (parentWeeklyAttendancePercent) parentWeeklyAttendancePercent.textContent = "0%";
      if (parentWeeklyOutpassCount) parentWeeklyOutpassCount.textContent = "0";
    }
  };

  const loadParentDashboard = async (studentId) => {
    try {
      const encodedStudent = encodeURIComponent(studentId);
      const [childRes, attendanceRes, messRes] = await Promise.all([
        fetch(`${API_BASE_URL}/parent/child/${encodedStudent}`, {
          headers: authHeaders(),
        }),
        fetch(`${API_BASE_URL}/parent/attendance/${encodedStudent}`, {
          headers: authHeaders(),
        }),
        fetch(`${API_BASE_URL}/parent/mess/${encodedStudent}`, {
          headers: authHeaders(),
        }),
      ]);

      const [childData, attendanceData, messData] = await Promise.all([
        childRes.json(),
        attendanceRes.json(),
        messRes.json(),
      ]);

      if (!childRes.ok) throw new Error(childData.message || "Unable to load child data.");
      if (!attendanceRes.ok) throw new Error(attendanceData.message || "Unable to load attendance.");
      if (!messRes.ok) throw new Error(messData.message || "Unable to load mess schedule.");

      const child = childData.child || {};
      const hostelRecord = childData.hostelRecord || {};
      const outpassRequests = childData.outpassRequests || [];
      const attendanceLogs = attendanceData.attendanceLogs || [];
      const mess = messData.mess || null;

      parentChildProfile.innerHTML = `
        <p><strong>${child.name || "N/A"}</strong></p>
        <p>Student ID: ${child.studentCode || child._id || "N/A"}</p>
        <p>Email: ${child.email || "N/A"}</p>
        <p>Phone: ${child.phone || "N/A"}</p>
        <p>City: ${child.city || "N/A"}</p>
        <p>Hostel: ${hostelRecord.propertyId?.title || "N/A"}</p>
        <p>Room: ${hostelRecord.roomNumber || "N/A"}</p>
      `;

      if (mess) {
        parentMessSchedule.innerHTML = `
          <p><strong>${mess.propertyId?.title || "Mess Plan"}</strong></p>
          <p>Timings: ${mess.timings || "N/A"}</p>
          <p>Rules: ${mess.rules || "N/A"}</p>
          <p>Menu:</p>
          <ul>
            ${(mess.weeklyMenu || [])
              .map(
                (item) =>
                  `<li>${item.day}: ${item.breakfast} / ${item.lunch} / ${item.dinner}</li>`
              )
              .join("")}
          </ul>
        `;
      } else {
        parentMessSchedule.textContent = "No mess schedule available.";
      }

      parentAttendanceBody.innerHTML = "";
      if (!attendanceLogs.length) {
        parentAttendanceBody.innerHTML = `
          <tr><td colspan="3" class="small-text">No attendance logs yet.</td></tr>
        `;
      } else {
        attendanceLogs.forEach((log) => {
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${new Date(log.date).toLocaleDateString("en-IN")}</td>
            <td>${statusPill(log.status)}</td>
            <td>${log.note || "-"}</td>
          `;
          parentAttendanceBody.appendChild(row);
        });
      }

      parentOutpassBody.innerHTML = "";
      if (!outpassRequests.length) {
        parentOutpassBody.innerHTML = `
          <tr><td colspan="4" class="small-text">No outpass requests yet.</td></tr>
        `;
      } else {
        outpassRequests.forEach((request) => {
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${request.reason}</td>
            <td>${statusPill(request.status)}</td>
            <td>${request.parentApproval ? "Approved" : "Pending"}</td>
            <td>
              <div class="inline-actions">
                <button class="btn success" data-action="approve" data-id="${request._id}" data-student="${studentId}">Approve</button>
                <button class="btn danger" data-action="reject" data-id="${request._id}" data-student="${studentId}">Reject</button>
              </div>
            </td>
          `;
          parentOutpassBody.appendChild(row);
        });
      }

      parentAttendanceCount.textContent = attendanceLogs.length;
      parentPendingOutpass.textContent = outpassRequests.filter(
        (item) => item.status === "pending"
      ).length;
      parentApprovedOutpass.textContent = outpassRequests.filter(
        (item) => item.parentApproval
      ).length;

      await loadParentWeeklyReport(studentId);
      currentStudentReference = studentId;
      showMessage("Child data loaded successfully.", "success");
    } catch (error) {
      showMessage(error.message);
    }
  };

  const sendQuickCheck = async () => {
    if (!currentStudentReference) {
      showMessage("Load child profile first.");
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/parent/check-child/${encodeURIComponent(currentStudentReference)}`,
        {
          method: "POST",
          headers: authHeaders(),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to send quick check.");
      showMessage(data.message, "success");
    } catch (error) {
      showMessage(error.message);
    }
  };

  const loadParentReviews = async () => {
    if (!parentReviewsBody) return;

    parentReviewsBody.innerHTML =
      "<tr><td colspan='4' class='small-text'>Loading reviews...</td></tr>";
    try {
      const response = await fetch(`${API_BASE_URL}/reviews/my`, {
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load reviews.");

      const reviews = data.reviews || [];
      parentReviewsBody.innerHTML = "";
      if (!reviews.length) {
        parentReviewsBody.innerHTML =
          "<tr><td colspan='4' class='small-text'>No reviews submitted yet.</td></tr>";
        return;
      }

      reviews.forEach((review) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td><span class="feedback-pill">${review.rating}/5</span></td>
          <td>${review.title || "-"}</td>
          <td>${review.message || "-"}</td>
          <td>${new Date(review.createdAt).toLocaleDateString("en-IN")}</td>
        `;
        parentReviewsBody.appendChild(row);
      });
    } catch (error) {
      parentReviewsBody.innerHTML = `<tr><td colspan='4' class='small-text'>${error.message}</td></tr>`;
    }
  };

  parentLookupForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const studentId = parentStudentIdInput.value.trim();
    if (!studentId) {
      showMessage("Please enter student ID/code/email/phone.");
      return;
    }
    showMessage("Loading child data...", "success");
    loadParentDashboard(studentId);
  });

  parentOutpassBody?.addEventListener("click", async (event) => {
    const action = event.target.dataset.action;
    const requestId = event.target.dataset.id;
    const studentId = event.target.dataset.student;
    if (!action || !requestId || !studentId) return;

    const endpoint =
      action === "approve"
        ? `${API_BASE_URL}/parent/outpass/${requestId}/approve`
        : `${API_BASE_URL}/parent/outpass/${requestId}/reject`;

    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to update outpass.");
      }
      showMessage(data.message, "success");
      loadParentDashboard(studentId);
    } catch (error) {
      showMessage(error.message);
    }
  });

  parentCheckChildBtn?.addEventListener("click", sendQuickCheck);

  parentReviewForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const rating = Number(parentReviewRating?.value || 0);
    const title = parentReviewTitle?.value?.trim() || "";
    const message = parentReviewMessage?.value?.trim() || "";

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
      if (!response.ok) throw new Error(data.message || "Unable to submit review.");

      showMessage(data.message, "success");
      parentReviewForm.reset();
      if (parentReviewRating) {
        parentReviewRating.value = "5";
      }
      await loadParentReviews();
    } catch (error) {
      showMessage(error.message);
    }
  });

  const linkedStudentReference = user?.roleDetails?.childReference || "";
  if (linkedStudentReference) {
    parentStudentIdInput.value = linkedStudentReference;
    loadParentDashboard(linkedStudentReference);
  }

  loadParentReviews();
})();
