"use strict";

const cfg = window.TPG_CONFIG;
const seed = window.TPG_SEED_MENU || [];
const $ = (selector) => document.querySelector(selector);

let client = null;
let rawItems = [];
let items = [];
let categoryRows = [];
let activeCategory = "all";
let currentLanguage = localStorage.getItem("tpg_language") || cfg.DEFAULT_LANGUAGE || "lo";

const TEXT = {
  lo: {
    all: "ທັງໝົດ",
    search: "ຄົ້ນຫາຊື່ອາຫານ...",
    items: "ລາຍການ",
    available: "ມີຂາຍ",
    empty: "ບໍ່ພົບເມນູ",
    fallback: "ກຳລັງໃຊ້ຂໍ້ມູນສຳຮອງ ເນື່ອງຈາກຍັງໂຫຼດຖານຂໍ້ມູນອອນລາຍບໍ່ໄດ້",
    demo: "ໂໝດຕົວຢ່າງ: ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ Supabase",
    bookingSending: "ກຳລັງສົ່ງ...",
    bookingSaved: "ບັນທຶກການຈອງແລ້ວ ແລະ ກຳລັງເປີດ WhatsApp",
    bookingWhatsApp: "ກຳລັງເປີດ WhatsApp",
    connectionError: "ເຊື່ອມຕໍ່ຖານຂໍ້ມູນບໍ່ສຳເລັດ"
  },
  th: {
    all: "ทั้งหมด",
    search: "ค้นหาชื่ออาหาร...",
    items: "รายการ",
    available: "มีขาย",
    empty: "ไม่พบเมนู",
    fallback: "กำลังใช้ข้อมูลสำรอง เพราะยังโหลดฐานข้อมูลออนไลน์ไม่ได้",
    demo: "โหมดตัวอย่าง: ยังไม่ได้ตั้งค่า Supabase",
    bookingSending: "กำลังส่ง...",
    bookingSaved: "บันทึกการจองแล้ว และกำลังเปิด WhatsApp",
    bookingWhatsApp: "กำลังเปิด WhatsApp",
    connectionError: "เชื่อมต่อฐานข้อมูลไม่สำเร็จ"
  },
  en: {
    all: "All",
    search: "Search menu...",
    items: "items",
    available: "Available",
    empty: "No menu items found",
    fallback: "Using backup menu because the online database could not be loaded",
    demo: "Demo mode: Supabase is not configured",
    bookingSending: "Sending...",
    bookingSaved: "Reservation saved. Opening WhatsApp",
    bookingWhatsApp: "Opening WhatsApp",
    connectionError: "Could not connect to the database"
  }
};

function t(key) {
  return TEXT[currentLanguage]?.[key] || TEXT.lo[key] || key;
}

function isConfigured() {
  return Boolean(
    cfg &&
    typeof cfg.SUPABASE_URL === "string" &&
    cfg.SUPABASE_URL.startsWith("https://") &&
    typeof cfg.SUPABASE_ANON_KEY === "string" &&
    cfg.SUPABASE_ANON_KEY.startsWith("sb_publishable_")
  );
}

function safeText(value) {
  return String(value ?? "").replace(/[<>&"]/g, "");
}

function placeholder(label = "Tum Pa Guay") {
  const safe = safeText(label);
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="750">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#173e2a"/>
          <stop offset="1" stop-color="#d8ad56"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <text x="50%" y="48%" text-anchor="middle" fill="white"
            font-family="Arial,sans-serif" font-size="50" font-weight="700">${safe}</text>
      <text x="50%" y="58%" text-anchor="middle" fill="#f3ddb0"
            font-family="Arial,sans-serif" font-size="23">Image coming soon</text>
    </svg>`
  );
}

function showBanner(message, type = "warning") {
  const el = $("#connectionBanner");
  if (!el) return;
  el.textContent = message;
  el.dataset.type = type;
  el.hidden = false;
}

function hideBanner() {
  const el = $("#connectionBanner");
  if (el) el.hidden = true;
}

function localizedValue(row, base) {
  if (!row) return "";
  const preferred = row[`${base}_${currentLanguage}`];
  return preferred || row[`${base}_lo`] || row[`${base}_th`] || row[`${base}_en`] || "";
}

function categoryName(category) {
  if (!category) return "";
  return localizedValue(category, "name") || category.name_lo || "";
}

function normalizeDatabaseItem(row) {
  const category = row.category || row.categories || null;
  return {
    id: row.id,
    name: localizedValue(row, "name") || row.name || "",
    name_lo: row.name_lo || row.name || "",
    name_th: row.name_th || "",
    name_en: row.name_en || "",
    category: categoryName(category) || row.category || "",
    category_id: row.category_id || category?.id || "",
    categoryRow: category,
    price: Number(row.price || 0),
    variants: Array.isArray(row.variants) ? row.variants : [],
    image_url: row.image_url || "",
    available: row.available !== false,
    featured: Boolean(row.featured),
    sort_order: Number(row.sort_order || 999)
  };
}

function normalizeSeedItem(row) {
  return {
    ...row,
    name: row.name || row.name_lo || "",
    name_lo: row.name || row.name_lo || "",
    category: row.category || "",
    price: Number(row.price || 0),
    variants: Array.isArray(row.variants) ? row.variants : [],
    available: row.available !== false,
    image_url: row.image_url || ""
  };
}

async function loadDatabaseData() {
  const menuQuery = client
    .from("menu_items")
    .select(`
      id,
      category_id,
      name_lo,
      name_th,
      name_en,
      price,
      variants,
      image_url,
      available,
      featured,
      sort_order,
      category:categories (
        id,
        slug,
        name_lo,
        name_th,
        name_en,
        sort_order,
        active
      )
    `)
    .order("sort_order", { ascending: true });

  const categoriesQuery = client
    .from("categories")
    .select("id,slug,name_lo,name_th,name_en,sort_order,active")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  const [menuResult, categoriesResult] = await Promise.all([menuQuery, categoriesQuery]);

  if (menuResult.error) throw menuResult.error;
  if (categoriesResult.error) throw categoriesResult.error;

  rawItems = menuResult.data || [];
  categoryRows = categoriesResult.data || [];
  items = rawItems.map(normalizeDatabaseItem);
}

async function loadMenu() {
  try {
    if (!isConfigured()) {
      items = seed.map(normalizeSeedItem);
      categoryRows = [];
      showBanner(t("demo"));
    } else {
      client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
      await loadDatabaseData();
      hideBanner();
    }
  } catch (error) {
    console.error("Supabase menu load failed:", error);
    items = seed.map(normalizeSeedItem);
    categoryRows = [];
    showBanner(`${t("fallback")} (${error.message || t("connectionError")})`);
  }

  applyLanguage();
  renderTabs();
  renderMenu();
}

function availableItems() {
  return items.filter((item) => item.available !== false);
}

function getCategoryLabels() {
  if (categoryRows.length) {
    return categoryRows.map((row) => ({
      id: row.id,
      label: categoryName(row),
      row
    }));
  }

  const labels = [...new Set(availableItems().map((item) => item.category).filter(Boolean))];
  return labels.map((label) => ({ id: label, label, row: null }));
}

function itemMatchesCategory(item, categoryId) {
  if (categoryId === "all") return true;
  return item.category_id === categoryId || item.category === categoryId;
}

function renderTabs() {
  const wrap = $("#categoryTabs");
  if (!wrap) return;
  wrap.innerHTML = "";

  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.textContent = `${t("all")} (${availableItems().length})`;
  allButton.className = activeCategory === "all" ? "active" : "";
  allButton.onclick = () => {
    activeCategory = "all";
    renderTabs();
    renderMenu();
  };
  wrap.appendChild(allButton);

  for (const category of getCategoryLabels()) {
    const count = availableItems().filter((item) => itemMatchesCategory(item, category.id)).length;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${category.label} (${count})`;
    button.className = activeCategory === category.id ? "active" : "";
    button.onclick = () => {
      activeCategory = category.id;
      renderTabs();
      renderMenu();
    };
    wrap.appendChild(button);
  }
}

function renderMenu() {
  const search = ($("#menuSearch")?.value || "").trim().toLocaleLowerCase();
  const shown = availableItems().filter((item) => {
    const categoryMatch = itemMatchesCategory(item, activeCategory);
    const searchable = [
      item.name,
      item.name_lo,
      item.name_th,
      item.name_en,
      item.category,
      ...(item.variants || [])
    ].join(" ").toLocaleLowerCase();

    return categoryMatch && searchable.includes(search);
  });

  if ($("#menuCount")) $("#menuCount").textContent = availableItems().length;
  if ($("#resultCount")) $("#resultCount").textContent = `${shown.length} ${t("items")}`;

  const grid = $("#menuGrid");
  const empty = $("#emptyMenu");
  if (!grid || !empty) return;

  grid.innerHTML = "";
  empty.hidden = shown.length > 0;
  empty.textContent = t("empty");

  shown.forEach((item) => {
    const card = document.createElement("article");
    card.className = "menu-card";

    const variantText = (item.variants || []).join(" / ");
    card.innerHTML = `
      <button type="button" class="menu-photo" aria-label="${safeText(item.name)}">
        <span class="badge">${safeText(item.category)}</span>
        <img alt="${safeText(item.name)}" loading="lazy">
      </button>
      <div class="menu-content">
        <h3>${safeText(item.name)}</h3>
        <div class="menu-variants">${safeText(variantText)}</div>
        <div class="menu-meta">
          <span class="price">${item.price.toLocaleString("en-US")} ກີບ</span>
          <span class="status">${t("available")}</span>
        </div>
      </div>
    `;

    const image = card.querySelector("img");
    image.onerror = () => {
      image.onerror = null;
      image.src = placeholder(item.name);
    };
    image.src = item.image_url || placeholder(item.name);

    card.querySelector(".menu-photo").onclick = () => openLightbox(image.src, item.name);
    grid.appendChild(card);
  });
}

function openLightbox(src, caption) {
  const lightbox = $("#lightbox");
  if (!lightbox) return;

  $("#lightboxImage").src = src;
  $("#lightboxCaption").textContent = caption;
  lightbox.hidden = false;
  lightbox.setAttribute("aria-hidden", "false");
  document.body.classList.add("lightbox-open");
}

function closeLightbox() {
  const lightbox = $("#lightbox");
  if (!lightbox) return;

  lightbox.hidden = true;
  lightbox.setAttribute("aria-hidden", "true");
  document.body.classList.remove("lightbox-open");
}

function applyLanguage() {
  document.documentElement.lang = currentLanguage;
  localStorage.setItem("tpg_language", currentLanguage);

  document.querySelectorAll(".language [data-lang]").forEach((button) => {
    button.classList.toggle("active", button.dataset.lang === currentLanguage);
  });

  const search = $("#menuSearch");
  if (search) search.placeholder = t("search");

  // Re-normalize names after a language change.
  if (rawItems.length) items = rawItems.map(normalizeDatabaseItem);
}

async function submitBooking(event) {
  event.preventDefault();

  const status = $("#bookingStatus");
  if (status) status.textContent = t("bookingSending");

  const booking = {
    customer_name: $("#bookName").value.trim(),
    phone: $("#bookPhone").value.trim(),
    booking_date: $("#bookDate").value,
    booking_time: $("#bookTime").value,
    guest_count: Number($("#bookGuests").value),
    note: $("#bookNote").value.trim(),
    status: "new",
    source: "website"
  };

  let saved = false;
  if (client) {
    const { error } = await client.from("reservations").insert(booking);
    if (error) {
      console.error("Reservation save failed:", error);
    } else {
      saved = true;
    }
  }

  const message = `ສະບາຍດີ ຮ້ານຕຳປ່າກ້ວຍ
ຂໍຈອງໂຕະ
ຊື່: ${booking.customer_name}
ເບີໂທ: ${booking.phone}
ວັນທີ: ${booking.booking_date}
ເວລາ: ${booking.booking_time}
ຈຳນວນ: ${booking.guest_count} ຄົນ
ໝາຍເຫດ: ${booking.note || "-"}`;

  if (status) status.textContent = saved ? t("bookingSaved") : t("bookingWhatsApp");
  window.open(
    `https://wa.me/${cfg.RESTAURANT.whatsappIntl || cfg.RESTAURANT.phoneIntl}?text=${encodeURIComponent(message)}`,
    "_blank",
    "noopener"
  );
}

function bindEvents() {
  $("#menuSearch")?.addEventListener("input", renderMenu);

  $("#navToggle")?.addEventListener("click", () => {
    $("#navLinks")?.classList.toggle("open");
  });

  document.querySelectorAll("#navLinks a").forEach((link) => {
    link.addEventListener("click", () => $("#navLinks")?.classList.remove("open"));
  });

  document.querySelectorAll(".language [data-lang]").forEach((button) => {
    button.addEventListener("click", () => {
      currentLanguage = button.dataset.lang;
      applyLanguage();
      renderTabs();
      renderMenu();
    });
  });

  $("#lightboxClose")?.addEventListener("click", (event) => {
    event.stopPropagation();
    closeLightbox();
  });

  $("#lightbox")?.addEventListener("click", (event) => {
    if (event.target.id === "lightbox") closeLightbox();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeLightbox();
  });

  $("#bookingForm")?.addEventListener("submit", submitBooking);

  window.addEventListener("scroll", () => {
    $("#header")?.classList.toggle("scrolled", window.scrollY > 30);
  });

  window.addEventListener("load", () => {
    setTimeout(() => $("#siteLoader")?.classList.add("hide"), 450);
  });
}

function initializeRevealAnimations() {
  if (!("IntersectionObserver" in window)) {
    document.querySelectorAll(".reveal").forEach((element) => element.classList.add("visible"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("visible");
    });
  }, { threshold: 0.12 });

  document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
}

function initializeLocation() {
  const restaurant = cfg?.RESTAURANT || {};
  const mapsUrl = restaurant.mapsUrl || "";
  const address = restaurant.addressLao || "Tum Pa Guay Restaurant, Vientiane";
  const embedUrl = `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;

  ["#heroMapLink", "#mapDirectionLink", "#contactMapLink"].forEach((selector) => {
    const link = $(selector);
    if (link) {
      link.href = mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    }
  });

  const frame = $("#mapFrame");
  if (frame) frame.src = embedUrl;
}

function initialize() {
  if ($("#addressText")) $("#addressText").textContent = cfg.RESTAURANT.addressLao;
  initializeLocation();
  bindEvents();
  initializeRevealAnimations();
  loadMenu();
}

initialize();
