const API_BASE_URL = "https://stayeasy-hackathon-production.up.railway.app/api";

const ROLE_REDIRECT_MAP = {
  student: "./student-dashboard.html",
  tenant: "./tenant-dashboard.html",
  owner: "./owner-dashboard.html",
  flat_owner: "./owner-dashboard.html",
  pg_owner: "./owner-dashboard.html",
  hostel_owner: "./hostel-dashboard.html",
  parent: "./parent-dashboard.html",
  worker: "./worker-dashboard.html",
  admin: "./admin-dashboard.html",
};

const signupForm = document.getElementById("signupForm");
const loginForm = document.getElementById("loginForm");
const roleSelect = document.getElementById("roleSelect");
const roleSpecificFields = document.getElementById("roleSpecificFields");
const formMessage = document.getElementById("formMessage");

const showToastSafe = (message, type = "info") => {
  if (window.showToast) {
    window.showToast(message, type);
  }
};

const showMessage = (message, type = "error") => {
  if (!formMessage) return;
  formMessage.textContent = message;
  formMessage.className = `message ${type}`;
  showToastSafe(message, type === "success" ? "success" : "error");
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

const saveAuthSession = ({ token, user }) => {
  localStorage.setItem("stayeasy_token", token);
  localStorage.setItem("stayeasy_user", JSON.stringify(user));
};

const redirectByRole = (role) => {
  window.location.href = ROLE_REDIRECT_MAP[role] || "./login.html";
};

const redirectIfAlreadyLoggedIn = () => {
  const token = localStorage.getItem("stayeasy_token");
  const user = getStoredUser();

  if (token && user?.role) {
    redirectByRole(user.role);
  }
};

const roleFieldTemplates = {
  owner: `
    <label>
      Property Basic Info
      <textarea name="propertyInfo" placeholder="Type of property and rough capacity"></textarea>
    </label>
  `,
  flat_owner: `
    <label>
      Flat Listing Info
      <textarea name="propertyInfo" placeholder="Flat type, location highlights, and capacity"></textarea>
    </label>
  `,
  pg_owner: `
    <label>
      PG Listing Info
      <textarea name="propertyInfo" placeholder="PG type, meal details, and occupancy"></textarea>
    </label>
  `,
  hostel_owner: `
    <label>
      Hostel/Business Name
      <input name="businessName" type="text" placeholder="Hostel or company name" />
    </label>
  `,
  parent: `
    <label>
      Child / Student Reference
      <input name="childReference" type="text" placeholder="Student name or ID reference" />
    </label>
  `,
  worker: `
    <label>
      Service Category
      <select name="serviceCategory">
        <option value="">Select service</option>
        <option value="maid">Maid</option>
        <option value="sweeper">Sweeper</option>
        <option value="chef">Chef</option>
        <option value="cleaner">Cleaner</option>
        <option value="electrician">Electrician</option>
        <option value="plumber">Plumber</option>
      </select>
    </label>
  `,
  student: `
    <label>
      Accommodation Preference
      <input name="preference" type="text" placeholder="Ex: Near coaching center, quiet area" />
    </label>
  `,
  tenant: `
    <label>
      Accommodation Preference
      <input name="preference" type="text" placeholder="Ex: 1BHK, near office, under budget" />
    </label>
  `,
};

const renderRoleSpecificFields = (role) => {
  if (!roleSpecificFields) return;
  roleSpecificFields.innerHTML = roleFieldTemplates[role] || "";
};

if (roleSelect) {
  roleSelect.addEventListener("change", (event) => {
    renderRoleSpecificFields(event.target.value);
  });
}

if (signupForm) {
  redirectIfAlreadyLoggedIn();

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showMessage("");
    const submitBtn = signupForm.querySelector("button[type='submit']");
    const originalBtnText = submitBtn?.textContent || "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Creating...";
    }

    const formData = new FormData(signupForm);

    const password = formData.get("password");
    const confirmPassword = formData.get("confirmPassword");

    if (password !== confirmPassword) {
      showMessage("Password and confirm password do not match.");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
      return;
    }

    const payload = {
      name: formData.get("name")?.trim(),
      email: formData.get("email")?.trim(),
      phone: formData.get("phone")?.trim(),
      city: formData.get("city")?.trim(),
      role: formData.get("role"),
      password,
      confirmPassword,
      roleDetails: {
        businessName: formData.get("businessName")?.trim() || "",
        propertyInfo: formData.get("propertyInfo")?.trim() || "",
        childReference: formData.get("childReference")?.trim() || "",
        serviceCategory: formData.get("serviceCategory") || "",
        preference: formData.get("preference")?.trim() || "",
      },
    };

    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        showMessage(data.message || "Signup failed.");
        return;
      }

      const studentCodeNote = data?.user?.studentCode
        ? ` Your Student ID is ${data.user.studentCode}.`
        : "";
      showMessage(`Signup successful.${studentCodeNote} Redirecting to login...`, "success");
      setTimeout(() => {
        window.location.href = "./login.html";
      }, 900);
    } catch (error) {
      showMessage("Unable to connect to backend. Please check server.");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    }
  });
}

if (loginForm) {
  redirectIfAlreadyLoggedIn();

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showMessage("");
    const submitBtn = loginForm.querySelector("button[type='submit']");
    const originalBtnText = submitBtn?.textContent || "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Logging in...";
    }

    const formData = new FormData(loginForm);
    const identifier = formData.get("identifier")?.trim();
    const password = formData.get("password");

    const payload = { identifier, password };

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        showMessage(data.message || "Login failed.");
        return;
      }

      saveAuthSession({ token: data.token, user: data.user });
      showMessage("Login successful. Redirecting...", "success");
      setTimeout(() => {
        redirectByRole(data.user.role);
      }, 500);
    } catch (error) {
      showMessage("Unable to connect to backend. Please check server.");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    }
  });
}

