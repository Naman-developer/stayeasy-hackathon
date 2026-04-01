const API_BASE_URL = "http://localhost:5000/api";

const token = localStorage.getItem("stayeasy_token");

const bookingForm = document.getElementById("bookingForm");
const bookingPropertyBox = document.getElementById("bookingPropertyBox");
const bookingMessage = document.getElementById("bookingMessage");
const paymentBox = document.getElementById("paymentBox");
const bookingSummary = document.getElementById("bookingSummary");
const payNowBtn = document.getElementById("payNowBtn");
const paymentSuccessCard = document.getElementById("paymentSuccessCard");
const paymentSuccessText = document.getElementById("paymentSuccessText");

const paymentMethodSelect = document.getElementById("paymentMethod");
const paymentMethodHint = document.getElementById("paymentMethodHint");

const upiQrPanel = document.getElementById("upiQrPanel");
const upiQrCanvas = document.getElementById("upiQrCanvas");
const upiQrImage = document.getElementById("upiQrImage");
const upiIdText = document.getElementById("upiIdText");
const utrInput = document.getElementById("utrInput");
const confirmUpiBtn = document.getElementById("confirmUpiBtn");

const cardPanel = document.getElementById("cardPanel");
const cardHolderName = document.getElementById("cardHolderName");
const cardNumber = document.getElementById("cardNumber");
const cardExpiry = document.getElementById("cardExpiry");
const cardCvv = document.getElementById("cardCvv");
const confirmCardBtn = document.getElementById("confirmCardBtn");

const netbankingPanel = document.getElementById("netbankingPanel");
const bankName = document.getElementById("bankName");
const bankAccountHolder = document.getElementById("bankAccountHolder");
const bankRef = document.getElementById("bankRef");
const confirmNetbankingBtn = document.getElementById("confirmNetbankingBtn");

const walletPanel = document.getElementById("walletPanel");
const walletProvider = document.getElementById("walletProvider");
const walletMobile = document.getElementById("walletMobile");
const walletTxnId = document.getElementById("walletTxnId");
const confirmWalletBtn = document.getElementById("confirmWalletBtn");

let selectedProperty = null;
let currentBooking = null;
let paymentInProgress = false;
let pendingMethodOrder = null;
let qrLibraryLoadPromise = null;

const fallbackImage =
  "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80";

const PAYMENT_METHOD_HINTS = {
  upi_qr: "Scan QR and enter UTR after payment. Booking confirms only then.",
  card: "Fill card details and confirm. No real card charge in mock mode.",
  netbanking: "Select bank and enter bank reference to confirm payment.",
  wallet: "Choose wallet and enter wallet transaction ID to confirm.",
};

const QR_SCRIPT_FALLBACK_URLS = [
  "https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js",
  "https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js",
];

const formatPrice = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });

const showToastSafe = (message, type = "info") => {
  if (window.showToast) {
    window.showToast(message, type);
  }
};

const showMessage = (text, type = "error") => {
  bookingMessage.textContent = text;
  bookingMessage.className = `message-box show ${type}`;
};

const clearMessage = () => {
  bookingMessage.textContent = "";
  bookingMessage.className = "message-box";
};

const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
});

const getStoredUser = () => {
  const raw = localStorage.getItem("stayeasy_user");
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
};

const ensureAuth = () => {
  if (!token) {
    showMessage("Please login first to continue booking.");
    setTimeout(() => {
      window.location.href = "./login.html";
    }, 800);
    return false;
  }
  return true;
};

const getPropertyId = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get("propertyId");
};

const getSelectedPaymentMethod = () => paymentMethodSelect?.value || "upi_qr";

const loadExternalScript = (src) =>
  new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve(true);
        return;
      }
      existing.addEventListener(
        "load",
        () => {
          existing.dataset.loaded = "true";
          resolve(true);
        },
        { once: true }
      );
      existing.addEventListener("error", () => reject(new Error(`Failed: ${src}`)), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve(true);
      },
      { once: true }
    );
    script.addEventListener("error", () => reject(new Error(`Failed: ${src}`)), {
      once: true,
    });
    document.head.appendChild(script);
  });

const ensureQrLibrary = async () => {
  if (window.QRCode?.toCanvas) return true;

  if (!qrLibraryLoadPromise) {
    qrLibraryLoadPromise = (async () => {
      for (const src of QR_SCRIPT_FALLBACK_URLS) {
        try {
          await loadExternalScript(src);
          if (window.QRCode?.toCanvas) return true;
        } catch (error) {
          // try next
        }
      }
      return false;
    })();
  }

  return qrLibraryLoadPromise;
};

const showCanvasQr = () => {
  if (upiQrCanvas) upiQrCanvas.style.display = "block";
  if (upiQrImage) upiQrImage.style.display = "none";
};

const showImageQr = () => {
  if (upiQrCanvas) upiQrCanvas.style.display = "none";
  if (upiQrImage) upiQrImage.style.display = "block";
};

const drawQrFallbackMessage = () => {
  if (!upiQrCanvas?.getContext) return;
  const ctx = upiQrCanvas.getContext("2d");
  ctx.clearRect(0, 0, upiQrCanvas.width, upiQrCanvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, upiQrCanvas.width, upiQrCanvas.height);
  ctx.strokeStyle = "#d7e2fb";
  ctx.strokeRect(0, 0, upiQrCanvas.width, upiQrCanvas.height);
  ctx.fillStyle = "#102243";
  ctx.font = "bold 14px Poppins, sans-serif";
  ctx.fillText("QR Unavailable", 35, 80);
  ctx.font = "12px Poppins, sans-serif";
  ctx.fillStyle = "#617190";
  ctx.fillText("Use UPI ID below", 40, 102);
};

const loadQrImageFromApi = (upiUri) =>
  new Promise((resolve) => {
    if (!upiQrImage) {
      resolve(false);
      return;
    }

    upiQrImage.onload = () => resolve(true);
    upiQrImage.onerror = () => resolve(false);
    upiQrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
      upiUri
    )}`;
  });

const updatePaymentHint = () => {
  if (!paymentMethodHint) return;
  const method = getSelectedPaymentMethod();
  paymentMethodHint.textContent = PAYMENT_METHOD_HINTS[method] || PAYMENT_METHOD_HINTS.upi_qr;
};

const hideAllPaymentPanels = () => {
  pendingMethodOrder = null;

  [upiQrPanel, cardPanel, netbankingPanel, walletPanel].forEach((panel) => {
    panel?.classList.remove("show");
  });

  if (utrInput) utrInput.value = "";
  if (cardHolderName) cardHolderName.value = "";
  if (cardNumber) cardNumber.value = "";
  if (cardExpiry) cardExpiry.value = "";
  if (cardCvv) cardCvv.value = "";
  if (bankName) bankName.value = "";
  if (bankAccountHolder) bankAccountHolder.value = "";
  if (bankRef) bankRef.value = "";
  if (walletProvider) walletProvider.value = "";
  if (walletMobile) walletMobile.value = "";
  if (walletTxnId) walletTxnId.value = "";

  if (upiIdText) upiIdText.textContent = "";

  if (upiQrCanvas?.getContext) {
    const ctx = upiQrCanvas.getContext("2d");
    ctx.clearRect(0, 0, upiQrCanvas.width, upiQrCanvas.height);
  }
  if (upiQrImage) {
    upiQrImage.style.display = "none";
    upiQrImage.removeAttribute("src");
  }
  showCanvasQr();
};

const renderUpiQr = async (upiData = {}) => {
  if (!upiQrPanel || !upiQrCanvas) return;

  const upiUri = upiData?.upiUri || `upi://pay?am=${currentBooking?.amount || 0}&cu=INR`;
  let rendered = false;

  const qrReady = await ensureQrLibrary();
  if (qrReady && window.QRCode?.toCanvas) {
    try {
      await window.QRCode.toCanvas(upiQrCanvas, upiUri, {
        width: 180,
        margin: 2,
        color: {
          dark: "#12284a",
          light: "#ffffff",
        },
      });
      showCanvasQr();
      rendered = true;
    } catch (error) {
      rendered = false;
    }
  }

  if (!rendered) {
    const imageLoaded = await loadQrImageFromApi(upiUri);
    if (imageLoaded) {
      showImageQr();
      rendered = true;
    }
  }

  if (!rendered) {
    showCanvasQr();
    drawQrFallbackMessage();
  }

  if (upiIdText) {
    const upiId = upiData?.upiId || "stayeasy.demo@upi";
    upiIdText.textContent = `UPI ID: ${upiId}`;
  }
};

const renderProperty = (property) => {
  bookingPropertyBox.innerHTML = `
    <img
      loading="lazy"
      decoding="async"
      src="${property.images?.[0] || fallbackImage}"
      alt="${property.title}"
      style="width:100%; height:220px; object-fit:cover; border-radius:12px;"
    />
    <h3 style="margin:0.7rem 0 0.2rem">${property.title}</h3>
    <p class="muted-text">${property.city} - ${property.propertyType.toUpperCase()}</p>
    <p style="font-weight:700; margin-top:0.45rem">${formatPrice(property.price)} / ${
    property.priceType
  }</p>
    <p class="muted-text" style="margin-top:0.45rem">${property.address}</p>
  `;
};

const loadProperty = async () => {
  const propertyId = getPropertyId();
  if (!propertyId) {
    bookingPropertyBox.innerHTML = "<div class='empty-block'>Property ID missing.</div>";
    bookingForm.style.display = "none";
    return;
  }

  bookingPropertyBox.innerHTML = `
    <div class="loading-inline"><span class="loading-spinner"></span> Loading selected property...</div>
  `;

  try {
    const response = await fetch(`${API_BASE_URL}/properties/${propertyId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Unable to load property.");
    }

    selectedProperty = data.property;
    renderProperty(selectedProperty);
  } catch (error) {
    bookingPropertyBox.innerHTML = `<div class="empty-block">${error.message}</div>`;
    bookingForm.style.display = "none";
    showToastSafe(error.message, "error");
  }
};

const createBooking = async (event) => {
  event.preventDefault();
  clearMessage();

  if (!ensureAuth() || !selectedProperty) return;

  const checkInDate = document.getElementById("checkInDate").value;
  const checkOutDate = document.getElementById("checkOutDate").value;

  if (!checkInDate || !checkOutDate) {
    showMessage("Please select check-in and check-out dates.");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/bookings`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        propertyId: selectedProperty._id,
        checkInDate,
        checkOutDate,
        amount: selectedProperty.price,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Booking failed.");
    }

    currentBooking = data.booking;
    paymentBox.style.display = "block";
    hideAllPaymentPanels();

    if (paymentSuccessCard) {
      paymentSuccessCard.classList.remove("show");
    }

    bookingSummary.textContent = `Booking ${currentBooking._id
      .slice(-6)
      .toUpperCase()} created. Amount: ${formatPrice(currentBooking.amount)}.`;

    showMessage("Booking created. Complete payment to confirm.", "success");
    showToastSafe("Booking created successfully.", "success");
  } catch (error) {
    showMessage(error.message);
    showToastSafe(error.message, "error");
  }
};

const verifyPaymentOnServer = async ({
  bookingId,
  orderId,
  paymentId,
  razorpaySignature,
  paymentMethod,
  utrId,
  cardLast4,
  cardHolder,
  bankRefId,
  walletRefId,
}) => {
  const verifyResponse = await fetch(`${API_BASE_URL}/payments/verify`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      bookingId,
      orderId,
      paymentId,
      razorpaySignature: razorpaySignature || "",
      paymentMethod: paymentMethod || "",
      utrId: utrId || "",
      cardLast4: cardLast4 || "",
      cardHolder: cardHolder || "",
      bankRef: bankRefId || "",
      walletRef: walletRefId || "",
    }),
  });

  const verifyData = await verifyResponse.json();
  if (!verifyResponse.ok) {
    throw new Error(verifyData.message || "Payment verification failed.");
  }

  return verifyData;
};

const finalizePaymentUi = (verifyData) => {
  currentBooking = verifyData.booking;
  hideAllPaymentPanels();

  bookingSummary.textContent = `Booking confirmed. Payment status: ${verifyData.booking.paymentStatus.toUpperCase()}.`;
  showMessage("Payment successful. Booking confirmed.", "success");
  showToastSafe("Payment successful.", "success");

  if (paymentSuccessCard && paymentSuccessText) {
    paymentSuccessCard.classList.add("show");
    paymentSuccessText.textContent = `Booking ${currentBooking._id
      .slice(-6)
      .toUpperCase()} is confirmed. Paid ${formatPrice(currentBooking.amount)}.`;
  }
};

const runRazorpayPayment = async (orderData, method) => {
  if (!window.Razorpay) {
    throw new Error("Razorpay SDK not loaded. Check internet and try again.");
  }

  const storedUser = getStoredUser();

  return new Promise((resolve, reject) => {
    const razorpay = new window.Razorpay({
      key: orderData.keyId,
      amount: orderData.order.amountInPaise,
      currency: orderData.order.currency || "INR",
      name: "StayEasy",
      description: `Booking ${currentBooking._id.slice(-6).toUpperCase()}`,
      order_id: orderData.order.orderId,
      prefill: {
        name: storedUser?.name || "",
        email: storedUser?.email || "",
        contact: storedUser?.phone || "",
      },
      theme: {
        color: "#295ef7",
      },
      handler: async (response) => {
        try {
          const verifyData = await verifyPaymentOnServer({
            bookingId: currentBooking._id,
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
            paymentMethod: method,
          });

          finalizePaymentUi(verifyData);
          resolve();
        } catch (error) {
          reject(error);
        }
      },
      modal: {
        ondismiss: () => reject(new Error("Payment cancelled by user.")),
      },
    });

    razorpay.on("payment.failed", (failedEvent) => {
      const description = failedEvent?.error?.description || "Payment failed.";
      reject(new Error(description));
    });

    razorpay.open();
  });
};

const openMethodPanel = async (orderData, method) => {
  pendingMethodOrder = { orderData, method };

  [upiQrPanel, cardPanel, netbankingPanel, walletPanel].forEach((panel) => {
    panel?.classList.remove("show");
  });

  if (method === "upi_qr") {
    upiQrPanel?.classList.add("show");
    await renderUpiQr(orderData.upiData || {});
    showMessage("QR generated. Scan and pay, then enter UTR to confirm booking.", "success");
    return;
  }

  if (method === "card") {
    cardPanel?.classList.add("show");
    showMessage("Enter card details and click confirm payment.", "success");
    return;
  }

  if (method === "netbanking") {
    netbankingPanel?.classList.add("show");
    showMessage("Enter net banking details and click confirm payment.", "success");
    return;
  }

  if (method === "wallet") {
    walletPanel?.classList.add("show");
    showMessage("Enter wallet details and click confirm payment.", "success");
  }
};

const completePayment = async () => {
  clearMessage();

  if (paymentInProgress) return;

  if (!ensureAuth() || !currentBooking) {
    showMessage("Create booking first.");
    return;
  }

  if (currentBooking.paymentStatus === "paid") {
    showMessage("This booking is already paid.", "success");
    return;
  }

  const selectedMethod = getSelectedPaymentMethod();

  try {
    paymentInProgress = true;
    payNowBtn.disabled = true;
    payNowBtn.textContent = "Processing...";

    const orderResponse = await fetch(`${API_BASE_URL}/payments/create-order`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        bookingId: currentBooking._id,
        paymentMethod: selectedMethod,
      }),
    });
    const orderData = await orderResponse.json();

    if (!orderResponse.ok) {
      throw new Error(orderData.message || "Unable to create payment order.");
    }

    if (orderData.gateway === "razorpay") {
      await runRazorpayPayment(orderData, selectedMethod);
      return;
    }

    await openMethodPanel(orderData, selectedMethod);
  } catch (error) {
    showMessage(error.message);
    showToastSafe(error.message, "error");
  } finally {
    paymentInProgress = false;
    payNowBtn.disabled = false;
    payNowBtn.textContent = "Pay Now";
  }
};

const confirmUpiPayment = async () => {
  clearMessage();

  if (!pendingMethodOrder || pendingMethodOrder.method !== "upi_qr" || !currentBooking) {
    showMessage("Please click Pay Now first to generate UPI QR.");
    return;
  }

  const utrId = String(utrInput?.value || "")
    .trim()
    .toUpperCase();

  if (!utrId) {
    showMessage("Enter UTR/transaction ID after scanning and paying.");
    return;
  }

  try {
    confirmUpiBtn.disabled = true;
    confirmUpiBtn.textContent = "Confirming...";

    const verifyData = await verifyPaymentOnServer({
      bookingId: currentBooking._id,
      orderId: pendingMethodOrder.orderData.order.orderId,
      paymentMethod: "upi_qr",
      utrId,
    });

    finalizePaymentUi(verifyData);
  } catch (error) {
    showMessage(error.message);
    showToastSafe(error.message, "error");
  } finally {
    confirmUpiBtn.disabled = false;
    confirmUpiBtn.textContent = "I Have Paid - Confirm Booking";
  }
};

const confirmCardPayment = async () => {
  clearMessage();

  if (!pendingMethodOrder || pendingMethodOrder.method !== "card" || !currentBooking) {
    showMessage("Please click Pay Now first for card payment.");
    return;
  }

  const holder = String(cardHolderName?.value || "").trim();
  const numberDigits = String(cardNumber?.value || "").replace(/\D/g, "");
  const expiry = String(cardExpiry?.value || "").trim();
  const cvv = String(cardCvv?.value || "").trim();

  if (holder.length < 2) {
    showMessage("Enter valid card holder name.");
    return;
  }
  if (!/^\d{16}$/.test(numberDigits)) {
    showMessage("Card number must be 16 digits.");
    return;
  }
  if (!/^\d{2}\/\d{2}$/.test(expiry)) {
    showMessage("Expiry format should be MM/YY.");
    return;
  }

  const [monthText, yearText] = expiry.split("/");
  const month = Number(monthText);
  const year = Number(`20${yearText}`);
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  if (month < 1 || month > 12) {
    showMessage("Expiry month must be between 01 and 12.");
    return;
  }
  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    showMessage("Card expiry is in the past.");
    return;
  }
  if (!/^\d{3,4}$/.test(cvv)) {
    showMessage("CVV must be 3 or 4 digits.");
    return;
  }

  const last4 = numberDigits.slice(-4);

  try {
    confirmCardBtn.disabled = true;
    confirmCardBtn.textContent = "Confirming...";

    const verifyData = await verifyPaymentOnServer({
      bookingId: currentBooking._id,
      orderId: pendingMethodOrder.orderData.order.orderId,
      paymentMethod: "card",
      paymentId: `CARD${last4}${Date.now()}`,
      cardLast4: last4,
      cardHolder: holder,
    });

    finalizePaymentUi(verifyData);
  } catch (error) {
    showMessage(error.message);
    showToastSafe(error.message, "error");
  } finally {
    confirmCardBtn.disabled = false;
    confirmCardBtn.textContent = "Confirm Card Payment";
  }
};

const confirmNetbankingPayment = async () => {
  clearMessage();

  if (!pendingMethodOrder || pendingMethodOrder.method !== "netbanking" || !currentBooking) {
    showMessage("Please click Pay Now first for net banking.");
    return;
  }

  const bank = String(bankName?.value || "").trim();
  const accountHolder = String(bankAccountHolder?.value || "").trim();
  const ref = String(bankRef?.value || "")
    .trim()
    .toUpperCase();

  if (!bank) {
    showMessage("Please select a bank.");
    return;
  }
  if (accountHolder.length < 2) {
    showMessage("Enter valid account holder name.");
    return;
  }
  if (!/^[A-Z0-9]{6,30}$/.test(ref)) {
    showMessage("Bank transaction ref must be 6-30 letters/numbers.");
    return;
  }

  try {
    confirmNetbankingBtn.disabled = true;
    confirmNetbankingBtn.textContent = "Confirming...";

    const verifyData = await verifyPaymentOnServer({
      bookingId: currentBooking._id,
      orderId: pendingMethodOrder.orderData.order.orderId,
      paymentMethod: "netbanking",
      paymentId: ref,
      bankRefId: ref,
    });

    finalizePaymentUi(verifyData);
  } catch (error) {
    showMessage(error.message);
    showToastSafe(error.message, "error");
  } finally {
    confirmNetbankingBtn.disabled = false;
    confirmNetbankingBtn.textContent = "Confirm Net Banking Payment";
  }
};

const confirmWalletPayment = async () => {
  clearMessage();

  if (!pendingMethodOrder || pendingMethodOrder.method !== "wallet" || !currentBooking) {
    showMessage("Please click Pay Now first for wallet payment.");
    return;
  }

  const provider = String(walletProvider?.value || "").trim();
  const mobile = String(walletMobile?.value || "").trim();
  const txn = String(walletTxnId?.value || "")
    .trim()
    .toUpperCase();

  if (!provider) {
    showMessage("Please choose a wallet provider.");
    return;
  }
  if (!/^[6-9]\d{9}$/.test(mobile)) {
    showMessage("Enter valid 10-digit wallet mobile number.");
    return;
  }
  if (!/^[A-Z0-9]{6,30}$/.test(txn)) {
    showMessage("Wallet transaction ID must be 6-30 letters/numbers.");
    return;
  }

  try {
    confirmWalletBtn.disabled = true;
    confirmWalletBtn.textContent = "Confirming...";

    const verifyData = await verifyPaymentOnServer({
      bookingId: currentBooking._id,
      orderId: pendingMethodOrder.orderData.order.orderId,
      paymentMethod: "wallet",
      paymentId: txn,
      walletRefId: txn,
    });

    finalizePaymentUi(verifyData);
  } catch (error) {
    showMessage(error.message);
    showToastSafe(error.message, "error");
  } finally {
    confirmWalletBtn.disabled = false;
    confirmWalletBtn.textContent = "Confirm Wallet Payment";
  }
};

const onPaymentMethodChange = () => {
  updatePaymentHint();
  hideAllPaymentPanels();
};

bookingForm.addEventListener("submit", createBooking);
payNowBtn.addEventListener("click", completePayment);
paymentMethodSelect?.addEventListener("change", onPaymentMethodChange);
confirmUpiBtn?.addEventListener("click", confirmUpiPayment);
confirmCardBtn?.addEventListener("click", confirmCardPayment);
confirmNetbankingBtn?.addEventListener("click", confirmNetbankingPayment);
confirmWalletBtn?.addEventListener("click", confirmWalletPayment);

updatePaymentHint();
hideAllPaymentPanels();
loadProperty();
