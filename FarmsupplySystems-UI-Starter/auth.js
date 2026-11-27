
import { supabase } from "./supabase-config.js";

// ==========================================
// ELEMENTS
// ==========================================

const authScreen = document.getElementById("authScreen");
const app = document.querySelector(".app");
const customerScreen = document.getElementById("customerScreen");

const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginSubmit = document.getElementById("loginSubmit");
const authMessage = document.getElementById("authMessage");
const forgotPassword = document.getElementById("forgotPassword");
const customerSignupFields = document.getElementById("customerSignupFields");
const customerSignupFullName = document.getElementById("customerSignupFullName");
const authModeToggle = document.getElementById("authModeToggle");
let authMode = "login";

const loginTitle = document.getElementById("loginTitle");
const loginDescription = document.getElementById("loginDescription");
const loginFooter = document.getElementById("loginFooter");

const customerName = document.getElementById("customerName");
const customerProducts = document.getElementById("customerProducts");
const customerSignOut = document.getElementById("customerSignOut");
const customerSearch = document.getElementById("customerProductSearch");
const customerSort = document.getElementById("customerProductSort");
const customerProductCount = document.getElementById("customerProductCount");
let selectedCustomerCategory = "all";

const ORGANIZATION_ID = "4e762e56-2d6c-468d-a50b-6c009e700064";

let currentCustomer = null;
let availableProducts = [];
let customerCart = new Map();
let favoriteProductIds = new Set();
let showFavoritesOnly = false;
let recentlyViewedProductIds = [];
let comparedProductIds = [];

// ==========================================
// SCREEN MANAGEMENT
// ==========================================

function showLogin() {
  authScreen.style.display = "grid";
  app.style.display = "none";

  if (customerScreen) {
    customerScreen.style.display = "none";
  }
}

function showDashboard(user, profile) {
  authScreen.style.display = "none";
  app.style.display = "flex";

  if (customerScreen) {
    customerScreen.style.display = "none";
  }

  const name =
    profile.full_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.display_name ||
    user.email?.split("@")[0] ||
    "Account";

  const roleLabels = {
    super_admin: "Super Admin",
    organization_admin: "Organization Admin",
    staff: "Staff"
  };

  const roleName = roleLabels[profile.role];

  const userDetails = {
    sidebarUserName: name,
    headerUserName: name,
    sidebarUserRole: roleName,
    headerUserRole: roleName,
    sidebarAvatar: name.substring(0, 2).toUpperCase(),
    headerAvatar: name.substring(0, 2).toUpperCase(),
    organizationCardRole: roleName
  };

  Object.entries(userDetails).forEach(([id, value]) => {
    const element = document.getElementById(id);

    if (element) {
      element.textContent = value;
    }
  });
}

function showCustomer(profile) {
  currentCustomer = profile;

  authScreen.style.display = "none";
  app.style.display = "none";
  customerScreen.style.display = "block";

  customerName.textContent = profile.full_name || "Customer";
  const displayName = profile.full_name || "Customer";
  const sidebarName = document.getElementById("customerSidebarName");
  const avatar = document.getElementById("customerAvatar");
  if (sidebarName) sidebarName.textContent = displayName;
  if (avatar) avatar.textContent = displayName.substring(0, 2).toUpperCase();

  createCartElements();
createOrderHistoryElements();
createCustomerAccountElements();

loadCustomerProducts();
loadCustomerOrderHistory();

renderCart();
}

function showMessage(message, success = false) {
  authMessage.textContent = message;
  authMessage.style.color = success ? "#2d8a50" : "#c0392b";
}

function setAuthMode(mode) {
  authMode = mode === "signup" ? "signup" : "login";
  const isSignup = authMode === "signup";

  loginTitle.textContent = isSignup ? "Create your customer account" : "Welcome back";
  loginDescription.textContent = isSignup
    ? "Create an account to shop farm supplies and manage your orders."
    : "Sign in to access your account.";
  loginSubmit.textContent = isSignup ? "Create account" : "Sign in";
  loginPassword.autocomplete = isSignup ? "new-password" : "current-password";
  loginPassword.minLength = isSignup ? 8 : 0;
  customerSignupFields.hidden = !isSignup;
  customerSignupFullName.required = isSignup;
  forgotPassword.hidden = isSignup;
  authModeToggle.textContent = isSignup
    ? "Already have an account? Sign in"
    : "New customer? Create an account";
  loginFooter.textContent = isSignup
    ? "Customer accounts are for shopping and order history."
    : "Secure access for S.T.P.B account holders.";
  showMessage("");
}

authModeToggle.addEventListener("click", () => {
  setAuthMode(authMode === "login" ? "signup" : "login");
});
setAuthMode("login");

// ==========================================
// VALIDATE ADMINISTRATOR ACCOUNT
// ==========================================

async function loadAdminProfile(user) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!profile) {
    return null;
  }

  if (!profile.is_active) {
    throw new Error(
      "Your administrator account is inactive. Please contact the system administrator."
    );
  }

  const allowedRoles = [
    "super_admin",
    "organization_admin",
    "staff"
  ];

  if (!allowedRoles.includes(profile.role)) {
    throw new Error(
      "Your administrator account has an invalid role."
    );
  }

  return profile;
}

// ==========================================
// VALIDATE CUSTOMER ACCOUNT
// ==========================================

async function loadCustomerProfile(user) {
  const { data: profile, error } = await supabase
    .from("customer_profiles")
    .select("id, full_name, phone, delivery_address")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return profile;
}

// ==========================================
// ROUTE AUTHENTICATED USER
// ==========================================

async function loadUserAndOpenScreen(user, preferredMode = null) {
  try {
    if (preferredMode === "customer") {
      const customerProfile = await loadCustomerProfile(user);

      if (!customerProfile) {
        throw new Error("No customer profile was found for this account.");
      }

      showCustomer(customerProfile);
      return true;
    }

    if (preferredMode === "admin") {
      const adminProfile = await loadAdminProfile(user);

      if (!adminProfile) {
        throw new Error("No administrator profile was found for this account.");
      }

      showDashboard(user, adminProfile);
      return true;
    }

    const adminProfile = await loadAdminProfile(user);

    if (adminProfile) {
      showDashboard(user, adminProfile);
      return true;
    }

    const customerProfile = await loadCustomerProfile(user);

    if (customerProfile) {
      showCustomer(customerProfile);
      return true;
    }

    throw new Error(
      "No authorized administrator or customer profile was found for this account."
    );

  } catch (error) {
    await supabase.auth.signOut();
    showLogin();
    showMessage(error.message);
    return false;
  }
}

// ==========================================
// LOGIN
// ==========================================

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  const isSignup = authMode === "signup";
  const fullName = customerSignupFullName.value.trim();

  if (isSignup && fullName.length < 2) {
    showMessage("Please enter your full name.");
    customerSignupFullName.focus();
    return;
  }

  if (isSignup && password.length < 8) {
    showMessage("Use a password with at least 8 characters.");
    loginPassword.focus();
    return;
  }

  loginSubmit.disabled = true;
  loginSubmit.textContent = isSignup ? "Creating account..." : "Signing in...";
  showMessage("");

  try {
    if (isSignup) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            account_type: "customer"
          },
          emailRedirectTo: window.location.origin
        }
      });

      if (error) throw error;

      if (data.session && data.user) {
        const success = await loadUserAndOpenScreen(data.user, "customer");
        if (success) loginForm.reset();
      } else {
        loginForm.reset();
        setAuthMode("login");
        showMessage(
          "Your account was created. Check your email to confirm your address, then sign in.",
          true
        );
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      const success = await loadUserAndOpenScreen(data.user);
      if (success) loginForm.reset();
    }
  } catch (error) {
    showMessage(error.message || "Unable to complete your request. Please try again.");
  } finally {
    loginSubmit.disabled = false;
    loginSubmit.textContent = authMode === "signup" ? "Create account" : "Sign in";
  }
});
// ==========================================
// CUSTOMER PRODUCT BROWSING
// ==========================================

async function loadCustomerFavorites() {
  if (!currentCustomer) {
    favoriteProductIds = new Set();
    return;
  }

  const { data, error } = await supabase
    .from("customer_favorites")
    .select("product_id")
    .eq("customer_id", currentCustomer.id);

  if (error) {
    console.error("Saved favorites loading error:", error);
    favoriteProductIds = new Set();
    return;
  }

  favoriteProductIds = new Set((data || []).map(row => row.product_id));
}

async function toggleCustomerFavorite(productId, button) {
  if (!currentCustomer || button.disabled) return;

  const wasSaved = favoriteProductIds.has(productId);
  button.disabled = true;

  try {
    let result;

    if (wasSaved) {
      result = await supabase
        .from("customer_favorites")
        .delete()
        .eq("customer_id", currentCustomer.id)
        .eq("product_id", productId);
    } else {
      result = await supabase
        .from("customer_favorites")
        .insert({
          customer_id: currentCustomer.id,
          product_id: productId
        });
    }

    if (result.error) throw result.error;

    if (wasSaved) {
      favoriteProductIds.delete(productId);
    } else {
      favoriteProductIds.add(productId);
    }

    updateCustomerFavoriteButton(button, productId);
    applyCustomerProductView();
  } catch (error) {
    console.error("Saved favorite update error:", error);
    if (customerProductCount) {
      customerProductCount.textContent = "Could not update saved favorites. Please try again.";
    }
  } finally {
    button.disabled = false;
  }
}

function updateCustomerFavoriteButton(button, productId) {
  const isSaved = favoriteProductIds.has(productId);
  button.classList.toggle("is-saved", isSaved);
  button.setAttribute("aria-pressed", String(isSaved));
  button.setAttribute("aria-label", isSaved ? "Remove from saved favorites" : "Save to favorites");
  button.title = isSaved ? "Remove from saved favorites" : "Save to favorites";
  button.textContent = isSaved ? "♥" : "♡";
}

async function loadCustomerProducts() {
  customerProducts.textContent = "Loading products...";

  const { data: products, error } = await supabase
    .from("products")
    .select(
      "id, product_name, description, category, price, stock_quantity, unit, image_url"
    )
    .eq("organization_id", ORGANIZATION_ID)
    .eq("is_active", true)
    .order("product_name");

  if (error) {
    customerProducts.textContent =
      "Unable to load products. Please try again later.";
    console.error("Product loading error:", error);
    return;
  }

  availableProducts = products || [];
  try {
    const savedRecent = localStorage.getItem("stpb_recent_products_" + currentCustomer.id);
    recentlyViewedProductIds = savedRecent ? JSON.parse(savedRecent) : [];
    if (!Array.isArray(recentlyViewedProductIds)) recentlyViewedProductIds = [];
  } catch {
    recentlyViewedProductIds = [];
  }
  recentlyViewedProductIds = recentlyViewedProductIds
    .filter(id => availableProducts.some(product => String(product.id) === String(id)))
    .slice(0, 5);
  await loadCustomerFavorites();
  customerProducts.replaceChildren();

  if (availableProducts.length === 0) {
    customerProducts.textContent = "No products are currently available.";
    renderCart();
    return;
  }

  const grid = document.createElement("div");
  grid.className = "shop-product-grid";

  availableProducts.forEach((product) => {
    const card = document.createElement("article");
    card.className = "shop-product-card";
    card.dataset.productId = product.id;

    const media = document.createElement("div");
    media.className = "shop-product-media";

    if (product.image_url) {
      const image = document.createElement("img");
      image.className = "shop-product-image";
      image.src = product.image_url;
      image.alt = product.product_name;
      image.loading = "lazy";
      image.addEventListener("error", () => {
        image.remove();
        media.classList.add("shop-product-media-fallback");
      }, { once: true });
      media.appendChild(image);
    } else {
      media.classList.add("shop-product-media-fallback");
      const fallback = document.createElement("span");
      fallback.textContent = "Farm essentials";
      media.appendChild(fallback);
    }

    const favoriteButton = document.createElement("button");
    favoriteButton.type = "button";
    favoriteButton.className = "shop-favorite-button";
    favoriteButton.dataset.favoriteProductId = product.id;
    favoriteButton.addEventListener("click", () =>
      toggleCustomerFavorite(product.id, favoriteButton)
    );
    updateCustomerFavoriteButton(favoriteButton, product.id);
    media.appendChild(favoriteButton);

    const category = document.createElement("span");
    category.className = "shop-product-category";
    category.textContent = product.category || "Farm supply";

    const name = document.createElement("h3");
    name.className = "shop-product-name";
    name.textContent = product.product_name;

    const description = document.createElement("p");
    description.className = "shop-product-description";
    description.textContent =
      product.description || "No description available.";

    const price = document.createElement("strong");
    price.className = "shop-product-price";
    price.textContent = formatMoney(product.price);

    const stock = document.createElement("p");
    stock.className = "shop-product-stock";
    stock.textContent =
      "Available stock: " +
      product.stock_quantity +
      " " +
      (product.unit || "piece");

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.textContent =
      Number(product.stock_quantity) > 0
        ? "Add to Cart"
        : "Out of Stock";

    addButton.className = "shop-add-button";
    addButton.disabled = Number(product.stock_quantity) <= 0;
    addButton.addEventListener("click", () => addToCart(product.id));

    const quickViewButton = document.createElement("button");
    quickViewButton.type = "button";
    quickViewButton.className = "shop-quick-view-button";
    quickViewButton.textContent = "Quick view";
    quickViewButton.addEventListener("click", event => {
      event.stopPropagation();
      openCustomerProductQuickView(product);
    });

    const compareButton = document.createElement("button");
    compareButton.type = "button";
    compareButton.className = "shop-compare-product-button";
    compareButton.dataset.compareProductId = product.id;
    compareButton.addEventListener("click", event => {
      event.stopPropagation();
      toggleCustomerProductComparison(product.id);
    });
    updateCustomerCompareCardButton(compareButton, product.id);

    card.append(media, category, name, description, price, stock, addButton, quickViewButton, compareButton);
    card.addEventListener("click", () => recordRecentlyViewedProduct(product.id));
    grid.appendChild(card);
  });

  customerProducts.appendChild(grid);
  applyCustomerProductSort();
  renderRecentlyViewedProducts();
  renderCustomerCompareTray();
  applyCustomerProductView();
  renderCart();
}

function closeCustomerProductQuickView() {
  const modal = document.getElementById("customerProductQuickView");
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
}

function openCustomerProductQuickView(product) {
  if (!product) return;
  recordRecentlyViewedProduct(product.id);

  let modal = document.getElementById("customerProductQuickView");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "customerProductQuickView";
    modal.className = "shop-quick-view-overlay";
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <section class="shop-quick-view-dialog" role="dialog" aria-modal="true" aria-labelledby="shopQuickViewTitle" tabindex="-1">
        <button type="button" class="shop-quick-view-close" aria-label="Close product details">×</button>
        <div class="shop-quick-view-content">
          <div class="shop-quick-view-media"></div>
          <div class="shop-quick-view-info">
            <span class="shop-quick-view-category"></span>
            <h2 id="shopQuickViewTitle"></h2>
            <p class="shop-quick-view-description"></p>
            <strong class="shop-quick-view-price"></strong>
            <p class="shop-quick-view-stock"></p>
            <div class="shop-quick-view-quantity">
              <button type="button" class="shop-quick-view-minus" aria-label="Decrease quantity">−</button>
              <output class="shop-quick-view-qty" aria-live="polite">1</output>
              <button type="button" class="shop-quick-view-plus" aria-label="Increase quantity">+</button>
            </div>
            <button type="button" class="shop-quick-view-add shop-add-button">Add to Cart</button>
          </div>
        </div>
      </section>
    `;
    document.body.appendChild(modal);
    modal.querySelector(".shop-quick-view-close").addEventListener("click", closeCustomerProductQuickView);
    modal.addEventListener("click", event => {
      if (event.target === modal) closeCustomerProductQuickView();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !modal.hidden) closeCustomerProductQuickView();
    });
  }

  const dialog = modal.querySelector(".shop-quick-view-dialog");
  const media = modal.querySelector(".shop-quick-view-media");
  media.replaceChildren();
  if (product.image_url) {
    const image = document.createElement("img");
    image.src = product.image_url;
    image.alt = product.product_name;
    image.addEventListener("error", () => {
      image.remove();
      media.textContent = "Farm supply";
    }, { once: true });
    media.appendChild(image);
  } else {
    media.textContent = "Farm supply";
  }

  modal.querySelector(".shop-quick-view-category").textContent = product.category || "Farm supply";
  modal.querySelector(".shop-quick-view-info h2").textContent = product.product_name;
  modal.querySelector(".shop-quick-view-description").textContent = product.description || "No description available.";
  modal.querySelector(".shop-quick-view-price").textContent = formatMoney(product.price);
  const stock = Math.max(0, Number(product.stock_quantity) || 0);
  modal.querySelector(".shop-quick-view-stock").textContent = "Available stock: " + stock + " " + (product.unit || "piece");
  const quantityOutput = modal.querySelector(".shop-quick-view-qty");
  const minus = modal.querySelector(".shop-quick-view-minus");
  const plus = modal.querySelector(".shop-quick-view-plus");
  const add = modal.querySelector(".shop-quick-view-add");
  let quantity = 1;
  const updateQuantity = () => {
    quantityOutput.textContent = String(quantity);
    minus.disabled = quantity <= 1;
    plus.disabled = quantity >= stock;
    add.disabled = stock <= 0;
    add.textContent = stock > 0 ? "Add " + quantity + " to Cart" : "Out of Stock";
  };
  minus.onclick = () => { quantity = Math.max(1, quantity - 1); updateQuantity(); };
  plus.onclick = () => { quantity = Math.min(stock, quantity + 1); updateQuantity(); };
  add.onclick = () => {
    const existing = customerCart.get(product.id);
    const inCart = existing ? existing.quantity : 0;
    if (inCart + quantity > stock) {
      alert("Your cart quantity plus this amount exceeds available stock.");
      return;
    }
    customerCart.set(product.id, { product, quantity: inCart + quantity });
    renderCart();
    closeCustomerProductQuickView();
  };
  updateQuantity();
  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  dialog.focus();
}

function recordRecentlyViewedProduct(productId) {
  if (!currentCustomer || !productId) return;
  recentlyViewedProductIds = [
    String(productId),
    ...recentlyViewedProductIds.filter(id => String(id) !== String(productId))
  ].slice(0, 5);

  try {
    localStorage.setItem(
      "stpb_recent_products_" + currentCustomer.id,
      JSON.stringify(recentlyViewedProductIds)
    );
  } catch (error) {
    console.warn("Recently viewed products could not be saved:", error);
  }

  renderRecentlyViewedProducts();
}

function renderRecentlyViewedProducts() {
  if (!customerProducts) return;
  const grid = customerProducts.querySelector(".shop-product-grid");
  if (!grid) return;

  let section = document.getElementById("customerRecentlyViewed");
  if (!section) {
    section = document.createElement("section");
    section.id = "customerRecentlyViewed";
    section.className = "shop-recently-viewed";
    const heading = document.createElement("h3");
    heading.textContent = "Recently viewed";
    const list = document.createElement("div");
    list.className = "shop-recently-viewed-list";
    section.append(heading, list);
    customerProducts.insertBefore(section, grid);
  }

  const list = section.querySelector(".shop-recently-viewed-list");
  list.replaceChildren();
  const recentProducts = recentlyViewedProductIds
    .map(id => availableProducts.find(product => String(product.id) === String(id)))
    .filter(Boolean);

  section.hidden = recentProducts.length === 0;
  recentProducts.forEach(product => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "shop-recently-viewed-item";
    const name = document.createElement("span");
    name.textContent = product.product_name;
    const price = document.createElement("strong");
    price.textContent = formatMoney(product.price);
    button.append(name, price);
    button.addEventListener("click", () => {
      showFavoritesOnly = false;
      if (customerSearch) customerSearch.value = "";
      selectedCustomerCategory = "all";
      document.querySelectorAll("[data-shop-filter]").forEach(filter => {
        filter.classList.toggle("active", filter.dataset.shopFilter === "all");
      });
      document.querySelectorAll("[data-customer-view]").forEach(link => {
        link.classList.toggle("active", link.dataset.customerView === "shop");
      });
      const heading = document.querySelector(".shop-products-heading h2");
      if (heading) heading.textContent = "Available products";
      applyCustomerProductView();
      const card = Array.from(grid.children).find(item =>
        String(item.dataset.productId) === String(product.id)
      );
      card?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    list.appendChild(button);
  });
}

function customerOrderStatusLabel(status) {
  const labels = {
    pending: "Awaiting Review",
    approved: "Approved",
    ready_for_pickup: "Ready for Pickup",
    completed: "Completed",
    cancelled: "Cancelled",
    rejected: "Not Approved"
  };
  const key = String(status || "pending").toLowerCase();
  return labels[key] || key.replace(/[_-]+/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

function customerPaymentStatusLabel(status) {
  const labels = {
    pending: "Pending",
    unpaid: "Unpaid",
    paid: "Paid",
    refunded: "Refunded",
    partially_refunded: "Partially Refunded",
    failed: "Failed"
  };
  const key = String(status || "pending").toLowerCase();
  return labels[key] || key.replace(/[_-]+/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

function createCustomerOrderMeta(label, value) {
  const item = document.createElement("div");
  item.className = "customer-order-meta";
  const caption = document.createElement("span");
  caption.textContent = label;
  const detail = document.createElement("strong");
  detail.textContent = value;
  item.append(caption, detail);
  return item;
}

function addPreviousOrderToCart(orderItems) {
  let added = 0;
  let skipped = 0;
  let adjusted = 0;

  (orderItems || []).forEach(orderItem => {
    const name = String(orderItem.product_name || '').trim().toLowerCase();
    const product = availableProducts.find(item =>
      String(item.product_name || '').trim().toLowerCase() === name
    );

    if (!product || Number(product.stock_quantity) <= 0) {
      skipped += 1;
      return;
    }

    const existing = customerCart.get(product.id);
    const currentQuantity = existing ? existing.quantity : 0;
    const requestedQuantity = Math.max(1, Number(orderItem.quantity) || 1);
    const availableQuantity = Math.max(0, Number(product.stock_quantity) - currentQuantity);
    const quantityToAdd = Math.min(requestedQuantity, availableQuantity);

    if (quantityToAdd <= 0) {
      skipped += 1;
      return;
    }

    customerCart.set(product.id, { product, quantity: currentQuantity + quantityToAdd });
    added += 1;
    if (quantityToAdd < requestedQuantity) adjusted += 1;
  });

  renderCart();
  document.getElementById('customerCartPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const messages = [];
  if (added) messages.push(added + ' product(s) added to your cart.');
  if (adjusted) messages.push(adjusted + ' product quantity(ies) reduced to available stock.');
  if (skipped) messages.push(skipped + ' product(s) skipped because unavailable or already at the stock limit.');
  if (!messages.length) messages.push('No products from this order could be added. Please check current stock.');
  alert(messages.join('\n'));
}

function applyCustomerOrderFilters() {
  const container = document.getElementById("customerOrderHistoryList");
  if (!container) return;
  const query = (document.getElementById("customerOrderSearch").value || "").trim().toLowerCase();
  const status = document.getElementById("customerOrderStatusFilter").value;
  const fulfillment = document.getElementById("customerOrderFulfillmentFilter").value;
  const cards = Array.from(container.querySelectorAll(".customer-order-card"));
  let visible = 0;
  cards.forEach(card => {
    const matchNumber = !query || (card.dataset.orderNumber || "").toLowerCase().includes(query);
    const matchStatus = status === "all" || card.dataset.orderStatus === status;
    const matchFulfillment = fulfillment === "all" || card.dataset.fulfillment === fulfillment;
    const show = matchNumber && matchStatus && matchFulfillment;
    card.hidden = !show;
    card.style.display = show ? "" : "none";
    if (show) visible++;
  });
  const count = document.getElementById("customerOrderFilterCount");
  if (count) count.textContent = cards.length ? "Showing " + visible + " of " + cards.length + " order(s)" : "";
  let empty = container.querySelector(".customer-order-filter-empty");
  if (cards.length && visible === 0) {
    if (!empty) {
      empty = document.createElement("p");
      empty.className = "customer-order-empty customer-order-filter-empty";
      empty.textContent = "No orders match your search or filters.";
      container.appendChild(empty);
    }
    empty.hidden = false;
  } else if (empty) empty.hidden = true;
}

async function loadCustomerOrderHistory() {
  const container = document.getElementById("customerOrderHistoryList");
  if (!container || !currentCustomer) return;

  container.textContent = "Loading your orders...";

  try {
    const { data: orders, error } = await supabase
      .from("customer_orders")
      .select(`
        id,
        order_number,
        fulfillment_method,
        payment_method,
        subtotal,
        total_amount,
        order_status,
        payment_status,
        delivery_address,
        customer_notes,
        created_at
      `)
      .eq("customer_id", currentCustomer.id)
      .eq("organization_id", ORGANIZATION_ID)
      .order("created_at", { ascending: false });

    if (error) throw error;

    container.replaceChildren();

    if (!orders || orders.length === 0) {
      const empty = document.createElement("p");
      empty.className = "customer-order-empty";
      empty.textContent = "You have not placed any orders yet.";
      container.appendChild(empty);
      return;
    }

    const orderIds = orders.map(order => order.id);
    const { data: orderItems, error: itemsError } = await supabase
      .from("customer_order_items")
      .select(`
        order_id,
        product_name,
        quantity,
        unit_price,
        subtotal
      `)
      .in("order_id", orderIds);

    if (itemsError) throw itemsError;

    const itemsByOrder = new Map();
    (orderItems || []).forEach(item => {
      if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
      itemsByOrder.get(item.order_id).push(item);
    });

    orders.forEach(order => {
      const card = document.createElement("article");
      card.className = "customer-order-card";
      card.dataset.orderNumber = String(order.order_number || order.id);
      card.dataset.orderStatus = String(order.order_status || "pending").toLowerCase();
      card.dataset.fulfillment = String(order.fulfillment_method || "delivery").toLowerCase();

      const header = document.createElement("div");
      header.className = "customer-order-card-header";

      const identity = document.createElement("div");
      identity.className = "customer-order-identity";
      const heading = document.createElement("h3");
      heading.textContent = order.order_number || order.id;
      const date = document.createElement("p");
      date.textContent = new Date(order.created_at).toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short"
      });
      identity.append(heading, date);

      const status = document.createElement("span");
      const statusKey = String(order.order_status || "pending").toLowerCase();
      status.className = "customer-order-status customer-order-status-" +
        statusKey.replace(/[^a-z0-9_-]/g, "");
      status.textContent = customerOrderStatusLabel(statusKey);
      header.append(identity, status);

      const metadata = document.createElement("div");
      metadata.className = "customer-order-meta-grid";
      metadata.append(
        createCustomerOrderMeta(
          "Fulfillment",
          order.fulfillment_method === "pickup" ? "Pickup" : "Delivery"
        ),
        createCustomerOrderMeta(
          "Payment",
          order.payment_method === "pay_upon_pickup" ? "Pay upon Pickup" : "Cash on Delivery"
        ),
        createCustomerOrderMeta(
          "Payment Status",
          customerPaymentStatusLabel(order.payment_status)
        )
      );

      const itemsSection = document.createElement("div");
      itemsSection.className = "customer-order-items-section";
      const itemsTitle = document.createElement("strong");
      itemsTitle.textContent = "Items in this order";
      const itemList = document.createElement("ul");
      itemList.className = "customer-order-items";

      (itemsByOrder.get(order.id) || []).forEach(item => {
        const listItem = document.createElement("li");
        const itemName = document.createElement("span");
        itemName.textContent = `${item.product_name} × ${item.quantity}`;
        const itemSubtotal = document.createElement("strong");
        itemSubtotal.textContent = formatMoney(item.subtotal);
        listItem.append(itemName, itemSubtotal);
        itemList.appendChild(listItem);
      });

      itemsSection.append(itemsTitle, itemList);

      const footer = document.createElement("div");
      footer.className = "customer-order-card-footer";
      const totalLabel = document.createElement("span");
      totalLabel.textContent = "Order total";
      const total = document.createElement("strong");
      total.textContent = formatMoney(order.total_amount);
      footer.append(totalLabel, total);

      const detailsButton = document.createElement('button');
      detailsButton.type = 'button';
      detailsButton.className = 'customer-order-details-toggle';
      detailsButton.textContent = 'View details';
      detailsButton.setAttribute('aria-expanded', 'false');

      const detailsPanel = document.createElement('section');
      detailsPanel.className = 'customer-order-details-panel';
      detailsPanel.hidden = true;
      detailsPanel.setAttribute('aria-label', 'Full order details');

      const detailGrid = document.createElement('div');
      detailGrid.className = 'customer-order-details-grid';
      detailGrid.append(
        createCustomerOrderMeta('Order reference', order.id),
        createCustomerOrderMeta('Subtotal', formatMoney(order.subtotal))
      );

      if (order.fulfillment_method === 'delivery' && order.delivery_address) {
        detailGrid.append(createCustomerOrderMeta('Delivery address', order.delivery_address));
      }
      if (order.customer_notes) {
        detailGrid.append(createCustomerOrderMeta('Order notes', order.customer_notes));
      }

      const detailItemsTitle = document.createElement('h4');
      detailItemsTitle.className = 'customer-order-details-title';
      detailItemsTitle.textContent = 'Item price breakdown';
      const detailItems = document.createElement('ul');
      detailItems.className = 'customer-order-details-items';

      (itemsByOrder.get(order.id) || []).forEach(item => {
        const detailItem = document.createElement('li');
        const detailName = document.createElement('span');
        detailName.textContent = item.product_name + ' · ' + item.quantity + ' × ' + formatMoney(item.unit_price);
        const detailSubtotal = document.createElement('strong');
        detailSubtotal.textContent = formatMoney(item.subtotal);
        detailItem.append(detailName, detailSubtotal);
        detailItems.appendChild(detailItem);
      });

      detailsPanel.append(detailGrid, detailItemsTitle, detailItems);
      detailsButton.addEventListener('click', () => {
        const isOpen = !detailsPanel.hidden;
        detailsPanel.hidden = isOpen;
        detailsButton.textContent = isOpen ? 'View details' : 'Hide details';
        detailsButton.setAttribute('aria-expanded', String(!isOpen));
      });

      const buyAgainButton = document.createElement('button');
      buyAgainButton.type = 'button';
      buyAgainButton.className = 'customer-order-buy-again';
      buyAgainButton.textContent = 'Buy Again';
      buyAgainButton.addEventListener('click', () => {
        addPreviousOrderToCart(itemsByOrder.get(order.id) || []);
      });

      card.append(header, metadata, itemsSection, footer, detailsButton, detailsPanel, buyAgainButton);
      container.appendChild(card);
    });
    applyCustomerOrderFilters();
  } catch (error) {
    console.error("Order history error:", error);
    container.textContent = "Unable to load your order history. Please try again.";
  }
}

// ==========================================
// CUSTOMER PRODUCT SEARCH, CATEGORY & SORT
// ==========================================

function updateCustomerCompareCardButton(button, productId) {
  const isSelected = comparedProductIds.some(id => String(id) === String(productId));
  button.textContent = isSelected ? "Selected for compare" : "Compare";
  button.classList.toggle("is-selected", isSelected);
  button.setAttribute("aria-pressed", String(isSelected));
}

function toggleCustomerProductComparison(productId) {
  const existingIndex = comparedProductIds.findIndex(id => String(id) === String(productId));
  if (existingIndex >= 0) {
    comparedProductIds.splice(existingIndex, 1);
  } else {
    if (comparedProductIds.length >= 3) {
      const status = document.getElementById("customerCompareStatus");
      if (status) status.textContent = "You can compare up to 3 products at a time. Remove one to add another.";
      return;
    }
    comparedProductIds.push(String(productId));
  }

  document.querySelectorAll("[data-compare-product-id]").forEach(button => {
    updateCustomerCompareCardButton(button, button.dataset.compareProductId);
  });
  renderCustomerCompareTray();
}

function renderCustomerCompareTray() {
  const grid = customerProducts?.querySelector(".shop-product-grid");
  if (!grid) return;

  let tray = document.getElementById("customerCompareTray");
  if (!tray) {
    tray = document.createElement("section");
    tray.id = "customerCompareTray";
    tray.className = "shop-compare-tray";
    tray.innerHTML = `
      <div class="shop-compare-tray-copy">
        <strong>Compare products</strong>
        <p class="shop-compare-tray-count"></p>
        <div class="shop-compare-selected-list"></div>
        <p id="customerCompareStatus" class="shop-compare-status" role="status" aria-live="polite"></p>
      </div>
      <div class="shop-compare-tray-actions">
        <button type="button" class="shop-compare-clear">Clear</button>
        <button type="button" class="shop-compare-open shop-add-button">Compare selected</button>
      </div>
    `;
    tray.querySelector(".shop-compare-clear").addEventListener("click", clearCustomerProductComparison);
    tray.querySelector(".shop-compare-open").addEventListener("click", openCustomerProductComparison);
  }

  tray.hidden = comparedProductIds.length === 0;
  tray.querySelector(".shop-compare-tray-count").textContent =
    comparedProductIds.length + " of 3 products selected";
  const selectedList = tray.querySelector(".shop-compare-selected-list");
  selectedList.replaceChildren();
  comparedProductIds.forEach(id => {
    const product = availableProducts.find(item => String(item.id) === String(id));
    if (!product) return;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "shop-compare-chip";
    chip.textContent = product.product_name + " ×";
    chip.setAttribute("aria-label", "Remove " + product.product_name + " from comparison");
    chip.addEventListener("click", () => toggleCustomerProductComparison(product.id));
    selectedList.appendChild(chip);
  });
  if (comparedProductIds.length < 2) {
    tray.querySelector(".shop-compare-open").disabled = true;
    const status = tray.querySelector(".shop-compare-status");
    if (status && !status.textContent) status.textContent = "Select at least 2 products to compare.";
  } else {
    tray.querySelector(".shop-compare-open").disabled = false;
    const status = tray.querySelector(".shop-compare-status");
    if (status) status.textContent = "";
  }
  customerProducts.insertBefore(tray, grid);
}

function clearCustomerProductComparison() {
  comparedProductIds = [];
  document.querySelectorAll("[data-compare-product-id]").forEach(button => {
    updateCustomerCompareCardButton(button, button.dataset.compareProductId);
  });
  renderCustomerCompareTray();
}

function closeCustomerProductComparison() {
  const modal = document.getElementById("customerProductComparisonModal");
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
}

function openCustomerProductComparison() {
  const products = comparedProductIds
    .map(id => availableProducts.find(product => String(product.id) === String(id)))
    .filter(Boolean);
  if (products.length < 2) return;

  let modal = document.getElementById("customerProductComparisonModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "customerProductComparisonModal";
    modal.className = "shop-compare-modal-overlay";
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <section class="shop-compare-modal" role="dialog" aria-modal="true" aria-labelledby="customerCompareTitle" tabindex="-1">
        <header class="shop-compare-modal-header">
          <div><p>PRODUCT COMPARISON</p><h2 id="customerCompareTitle">Compare farm supplies</h2></div>
          <button type="button" class="shop-compare-modal-close" aria-label="Close comparison">×</button>
        </header>
        <div class="shop-compare-table-wrap"><table class="shop-compare-table"></table></div>
      </section>
    `;
    document.body.appendChild(modal);
    modal.querySelector(".shop-compare-modal-close").addEventListener("click", closeCustomerProductComparison);
    modal.addEventListener("click", event => {
      if (event.target === modal) closeCustomerProductComparison();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !modal.hidden) closeCustomerProductComparison();
    });
  }

  const table = modal.querySelector(".shop-compare-table");
  table.replaceChildren();
  const header = document.createElement("tr");
  const firstHeader = document.createElement("th");
  firstHeader.scope = "col";
  firstHeader.textContent = "Product details";
  header.appendChild(firstHeader);
  products.forEach(product => {
    const cell = document.createElement("th");
    cell.scope = "col";
    const name = document.createElement("strong");
    name.textContent = product.product_name;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "shop-compare-remove";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      toggleCustomerProductComparison(product.id);
      if (comparedProductIds.length < 2) closeCustomerProductComparison();
      else openCustomerProductComparison();
    });
    cell.append(name, remove);
    header.appendChild(cell);
  });
  const thead = document.createElement("thead");
  thead.appendChild(header);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  const rows = [
    ["Category", product => product.category || "Farm supply"],
    ["Price", product => formatMoney(product.price)],
    ["Available stock", product => (Math.max(0, Number(product.stock_quantity) || 0)) + " " + (product.unit || "piece")],
    ["Description", product => product.description || "No description available."]
  ];
  rows.forEach(([label, valueFor]) => {
    const row = document.createElement("tr");
    const labelCell = document.createElement("th");
    labelCell.scope = "row";
    labelCell.textContent = label;
    row.appendChild(labelCell);
    products.forEach(product => {
      const cell = document.createElement("td");
      cell.textContent = valueFor(product);
      row.appendChild(cell);
    });
    tbody.appendChild(row);
  });
  table.appendChild(tbody);

  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  modal.querySelector(".shop-compare-modal").focus();
}

function normalizeCustomerProductCategory(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\\s+/g, " ");

  // Product records use singular category names (Feed, Hay, Fertilizer)
  // while the storefront offers broader, sometimes plural, filter labels.
  return normalized.endsWith("s") ? normalized.slice(0, -1) : normalized;
}

function matchesCustomerProductCategory(product, selectedCategory) {
  if (selectedCategory === "all") return true;

  const category = normalizeCustomerProductCategory(product.category);
  const name = String(product.product_name || "").toLowerCase();

  const matchesAnimalFeed =
    ["feed", "feeding", "hay", "supplement"].includes(category) ||
    /\\b(feed|feeder|hay|grain mix|mineral supplement)\\b/i.test(name);

  const matchesSeeds =
    ["drill", "planter"].includes(category) ||
    /\\b(seed|seeder|planter|grain drill)\\b/i.test(name);

  const matchesFertilizers =
    category === "fertilizer" ||
    /\\bfertili[sz]er\\b/i.test(name);

  // The current catalog stores crop-protection products as Chemicals.
  const matchesSprayers =
    ["chemical", "sprayer"].includes(category) ||
    /\\b(spray|sprayer|herbicide|insecticide|pesticide)\\b/i.test(name);

  const matchesIrrigation =
    ["irrigation", "pump"].includes(category) ||
    /\\b(irrigation|sprinkler|drip irrigation|water pump)\\b/i.test(name);

  switch (selectedCategory) {
    case "Animal feed":
      return matchesAnimalFeed;
    case "Seeds":
      return matchesSeeds;
    case "Fertilizers":
      return matchesFertilizers;
    case "Sprayers":
      return matchesSprayers;
    case "Irrigation":
      return matchesIrrigation;
    case "Farm tools":
      // Keep the category groups exclusive so a product appears in one
      // relevant filter instead of being duplicated across categories.
      return !(
        matchesAnimalFeed ||
        matchesSeeds ||
        matchesFertilizers ||
        matchesSprayers ||
        matchesIrrigation
      );
    default:
      return category === normalizeCustomerProductCategory(selectedCategory);
  }
}

function applyCustomerProductView() {
  const query = (customerSearch?.value || "").trim().toLowerCase();
  const grid = customerProducts.querySelector(".shop-product-grid");
  if (!grid) return;

  const cards = Array.from(grid.querySelectorAll(".shop-product-card"));
  let visible = 0;
  let visibleOutOfStock = 0;

  cards.forEach(card => {
    const product = availableProducts.find(item =>
      String(item.id) === String(card.dataset.productId)
    );
    if (!product) return;

    const matchesCategory = matchesCustomerProductCategory(
      product,
      selectedCustomerCategory
    );
    const haystack = [product.product_name, product.description, product.category]
      .filter(Boolean).join(" ").toLowerCase();
    const matchesSearch = !query || haystack.includes(query);
    const matchesFavorites = !showFavoritesOnly || favoriteProductIds.has(product.id);
    const shouldShowCard = matchesCategory && matchesSearch && matchesFavorites;

    card.hidden = !shouldShowCard;
    card.style.display = shouldShowCard ? "flex" : "none";

    if (shouldShowCard) {
      visible++;
      const stock = Number(product.stock_quantity);
      if (!Number.isFinite(stock) || stock <= 0) visibleOutOfStock++;
    }
  });

  const stockGroupHeading = grid.querySelector(".shop-out-of-stock-divider");
  if (stockGroupHeading) {
    stockGroupHeading.hidden = visibleOutOfStock === 0;
    stockGroupHeading.textContent =
      "Out of stock · " + visibleOutOfStock +
      (visibleOutOfStock === 1 ? " product" : " products");
  }

  if (customerProductCount) {
    customerProductCount.textContent = showFavoritesOnly
      ? `${visible} saved product${visible === 1 ? "" : "s"}`
      : `${visible} product${visible === 1 ? "" : "s"} available`;
  }

  let emptyState = customerProducts.querySelector(".shop-product-empty");
  if (visible === 0) {
    if (!emptyState) {
      emptyState = document.createElement("p");
      emptyState.className = "shop-product-empty";
      customerProducts.appendChild(emptyState);
    }
    emptyState.textContent = showFavoritesOnly
      ? "You have no saved favorites yet. Select the heart on a product to save it here."
      : "No products match your current search or category.";
  } else if (emptyState) {
    emptyState.remove();
  }
}
function setCustomerProductMode(mode) {
  showFavoritesOnly = mode === "favorites";

  // Favorites should show every saved item regardless of the shop's prior filters.
  if (showFavoritesOnly) {
    if (customerSearch) customerSearch.value = "";
    selectedCustomerCategory = "all";
    document.querySelectorAll("[data-shop-filter]").forEach(button => {
      button.classList.toggle("active", button.dataset.shopFilter === "all");
    });
  }

  document.querySelectorAll("[data-customer-view]").forEach(link => {
    link.classList.toggle("active", link.dataset.customerView === mode);
  });

  const heading = document.querySelector(".shop-products-heading h2");
  if (heading) heading.textContent = showFavoritesOnly ? "Saved favorites" : "Available products";

  applyCustomerProductView();
}

document.querySelectorAll("[data-customer-view]").forEach(link => {
  link.addEventListener("click", () => {
    setCustomerProductMode(link.dataset.customerView);
  });
});

function setCustomerCategory(category) {
  selectedCustomerCategory = category || "all";
  document.querySelectorAll("[data-shop-filter]").forEach(button => {
    button.classList.toggle("active", button.dataset.shopFilter === selectedCustomerCategory);
  });
  applyCustomerProductView();
}

document.querySelectorAll("[data-shop-filter]").forEach(button => {
  button.addEventListener("click", () => setCustomerCategory(button.dataset.shopFilter));
});
document.querySelectorAll("[data-shop-category]").forEach(button => {
  button.addEventListener("click", () => {
    setCustomerCategory(button.dataset.shopCategory);
    document.getElementById("shopCategories")?.scrollIntoView({ behavior: "smooth" });
  });
});
customerSearch?.addEventListener("input", applyCustomerProductView);
document.getElementById("customerAccountButton")?.addEventListener("click", () => {
  document.getElementById("customerAccountProfile")?.scrollIntoView({ behavior: "smooth", block: "start" });
});
function applyCustomerProductSort() {
  const grid = customerProducts.querySelector(".shop-product-grid");
  if (!grid) return;

  const sortValue = customerSort?.value || "recommended";
  let products = [...availableProducts];
  const stockOf = product => {
    const value = Number(product.stock_quantity);
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  };
  const nameOf = product => String(product.product_name || "");
  const byName = (a, b) => nameOf(a).localeCompare(nameOf(b));

  if (sortValue === "price-low") {
    products.sort((a, b) => Number(a.price) - Number(b.price) || byName(a, b));
  } else if (sortValue === "price-high") {
    products.sort((a, b) => Number(b.price) - Number(a.price) || byName(a, b));
  } else if (sortValue === "name") {
    products.sort(byName);
  } else if (sortValue === "stock-available") {
    const inStock = products
      .filter(product => stockOf(product) > 0)
      .sort((a, b) => stockOf(b) - stockOf(a) || byName(a, b));
    const outOfStock = products
      .filter(product => stockOf(product) <= 0)
      .sort(byName);

    // Build the grid in document order, with a dedicated out-of-stock
    // divider between available products and zero-stock products.
    products = [...inStock, ...outOfStock];

    const cardsByProductId = new Map(
      Array.from(grid.querySelectorAll(".shop-product-card")).map(card => [
        String(card.dataset.productId),
        card
      ])
    );
    const fragment = document.createDocumentFragment();

    inStock.forEach(product => {
      const card = cardsByProductId.get(String(product.id));
      if (card) {
        card.style.removeProperty("order");
        fragment.appendChild(card);
      }
    });

    if (outOfStock.length > 0) {
      const divider = document.createElement("div");
      divider.className = "shop-out-of-stock-divider";
      divider.setAttribute("role", "heading");
      divider.setAttribute("aria-level", "3");
      divider.textContent = "Out of stock · " + outOfStock.length +
        (outOfStock.length === 1 ? " product" : " products");
      fragment.appendChild(divider);
    }

    outOfStock.forEach(product => {
      const card = cardsByProductId.get(String(product.id));
      if (card) {
        card.style.removeProperty("order");
        fragment.appendChild(card);
      }
    });

    grid.replaceChildren(fragment);
    return;
  }

  // For all other sort modes, render the sorted product cards in the
  // exact DOM order rather than relying on CSS order values.
  const cardsByProductId = new Map(
    Array.from(grid.querySelectorAll(".shop-product-card")).map(card => [
      String(card.dataset.productId),
      card
    ])
  );
  const fragment = document.createDocumentFragment();

  products.forEach(product => {
    const card = cardsByProductId.get(String(product.id));
    if (card) {
      card.style.removeProperty("order");
      fragment.appendChild(card);
    }
  });

  grid.replaceChildren(fragment);
}
customerSort?.addEventListener("change", () => {
  applyCustomerProductSort();
  applyCustomerProductView();
});

// ==========================================
// CUSTOMER ORDER HISTORY
// ==========================================

// ==========================================
// CUSTOMER ACCOUNT PROFILE
// ==========================================

function createCustomerAccountElements() {
  if (document.getElementById("customerAccountProfile")) return;

  const section = document.createElement("section");
  section.id = "customerAccountProfile";
  section.className = "customer-account-profile";
  section.innerHTML = `
    <div class="customer-account-profile-heading">
      <div>
        <p class="customer-account-profile-eyebrow">YOUR ACCOUNT</p>
        <h2>My Account</h2>
        <p>Keep your contact details up to date for your farm orders.</p>
      </div>
    </div>
    <form id="customerAccountProfileForm" class="customer-account-profile-form">
      <div class="customer-account-profile-field">
        <label for="customerProfileEmail">Email address</label>
        <input id="customerProfileEmail" type="email" autocomplete="email" disabled>
        <small>Your email is managed by your sign-in account.</small>
      </div>
      <div class="customer-account-profile-field">
        <label for="customerProfileFullName">Full name</label>
        <input id="customerProfileFullName" type="text" maxlength="100" autocomplete="name" required>
      </div>
      <div class="customer-account-profile-field">
        <label for="customerProfilePhone">Contact number</label>
        <input id="customerProfilePhone" type="tel" maxlength="30" autocomplete="tel" placeholder="Enter your contact number">
      </div>
      <div class="customer-account-profile-field customer-account-profile-address-field">
        <label for="customerProfileDeliveryAddress">Saved delivery address</label>
        <textarea id="customerProfileDeliveryAddress" rows="3" maxlength="500" autocomplete="street-address" placeholder="House or unit, street, barangay, city, province"></textarea>
        <small>This address will be filled in automatically for delivery checkout. You can edit it before placing an order.</small>
      </div>
      <div class="customer-account-profile-actions">
        <p id="customerAccountProfileMessage" role="status" aria-live="polite"></p>
        <button type="submit" id="saveCustomerAccountProfile" class="customer-account-profile-save">Save changes</button>
      </div>
    </form>
  `;

  const mount = document.getElementById("customerOrderHistoryMount");
  const history = document.getElementById("customerOrderHistory");
  if (mount) mount.insertBefore(section, history || null);
  else customerProducts.parentElement.appendChild(section);

  const form = document.getElementById("customerAccountProfileForm");
  const emailInput = document.getElementById("customerProfileEmail");
  const nameInput = document.getElementById("customerProfileFullName");
  const phoneInput = document.getElementById("customerProfilePhone");
  const addressInput = document.getElementById("customerProfileDeliveryAddress");
  const message = document.getElementById("customerAccountProfileMessage");
  const saveButton = document.getElementById("saveCustomerAccountProfile");

  nameInput.value = currentCustomer?.full_name || "";
  phoneInput.value = currentCustomer?.phone || "";
  addressInput.value = currentCustomer?.delivery_address || "";

  supabase.auth.getUser().then(({ data, error }) => {
    if (!error && emailInput) emailInput.value = data.user?.email || "";
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!currentCustomer) return;

    const fullName = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const deliveryAddress = addressInput.value.trim();
    if (!fullName) {
      message.textContent = "Please enter your full name.";
      return;
    }

    saveButton.disabled = true;
    message.textContent = "Saving your profile...";

    try {
      const { data, error } = await supabase
        .from("customer_profiles")
        .update({
          full_name: fullName,
          phone: phone || null,
          delivery_address: deliveryAddress || null,
          updated_at: new Date().toISOString()
        })
        .eq("id", currentCustomer.id)
        .select("id, full_name, phone, delivery_address")
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Your profile could not be updated. Please sign in again and retry.");

      currentCustomer = { ...currentCustomer, ...data };
      customerName.textContent = data.full_name || "Customer";
      const sidebarName = document.getElementById("customerSidebarName");
      const avatar = document.getElementById("customerAvatar");
      if (sidebarName) sidebarName.textContent = data.full_name || "Customer";
      if (avatar) avatar.textContent = (data.full_name || "Customer").substring(0, 2).toUpperCase();
      message.textContent = "Your profile has been saved.";
    } catch (error) {
      console.error("Customer profile update error:", error);
      message.textContent = error.message || "Unable to save your profile. Please try again.";
    } finally {
      saveButton.disabled = false;
    }
  });
}

function createOrderHistoryElements() {
  if (document.getElementById("customerOrderHistory")) {
    return;
  }

  const section = document.createElement("section");
  section.id = "customerOrderHistory";

  section.style.background = "#ffffff";
  section.style.padding = "20px";
  section.style.border = "1px solid #e5e9e5";
  section.style.borderRadius = "12px";
  section.style.margin = "20px 0";

  section.innerHTML = `
    <div style="
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:12px;
      flex-wrap:wrap;
    ">
      <h2 style="margin:0;color:#1b4332">
        My Order History
      </h2>

      <button
        type="button"
        id="refreshCustomerOrders"
        class="cart-action-button"
      >
        Refresh
      </button>
    </div>

    <div class="customer-order-history-tools" aria-label="Search and filter orders">
      <label class="customer-order-history-search"><span>Search order number</span><input id="customerOrderSearch" type="search" placeholder="Enter order number..." autocomplete="off"></label>
      <label><span>Order status</span><select id="customerOrderStatusFilter"><option value="all">All statuses</option><option value="pending">Awaiting Review</option><option value="approved">Approved</option><option value="ready_for_pickup">Ready for Pickup</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="rejected">Not Approved</option></select></label>
      <label><span>Fulfillment</span><select id="customerOrderFulfillmentFilter"><option value="all">Delivery & Pickup</option><option value="delivery">Delivery</option><option value="pickup">Pickup</option></select></label>
      <button type="button" id="resetCustomerOrderFilters" class="customer-order-filter-reset">Reset filters</button>
      <p id="customerOrderFilterCount" class="customer-order-filter-count" aria-live="polite"></p>
    </div>
    <div id="customerOrderHistoryList" style="margin-top:15px">Loading your orders...</div>
  `;

  const historyMount = document.getElementById("customerOrderHistoryMount");
  (historyMount || customerProducts.parentElement).appendChild(section);

  document.getElementById("refreshCustomerOrders").addEventListener("click", loadCustomerOrderHistory);
  const search = document.getElementById("customerOrderSearch");
  const statusFilter = document.getElementById("customerOrderStatusFilter");
  const fulfillmentFilter = document.getElementById("customerOrderFulfillmentFilter");
  search.addEventListener("input", applyCustomerOrderFilters);
  statusFilter.addEventListener("change", applyCustomerOrderFilters);
  fulfillmentFilter.addEventListener("change", applyCustomerOrderFilters);
  document.getElementById("resetCustomerOrderFilters").addEventListener("click", () => {
    search.value = "";
    statusFilter.value = "all";
    fulfillmentFilter.value = "all";
    applyCustomerOrderFilters();
  });
}

// ==========================================
// SHOPPING CART
// ==========================================

function formatMoney(amount) {
  return "₱" + Number(amount || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function createCartElements() {
  if (document.getElementById("customerCartPanel")) return;

  const panel = document.createElement("section");
  panel.id = "customerCartPanel";
  panel.className = "cart-panel shop-cart-card";

  panel.innerHTML = `
    <div class="shop-cart-heading">
      <div>
        <span class="shop-cart-icon" aria-hidden="true">▣</span>
        <div>
          <h2>Your farm cart</h2>
          <small id="customerCartCount">0 items</small>
        </div>
      </div>
    </div>
    <div class="shop-cart-items" id="customerCartItems" aria-live="polite"></div>
    <div class="shop-cart-summary">
      <div><span>Subtotal</span><strong id="customerCartTotal">₱0.00</strong></div>
      <p>Delivery or pickup details are confirmed at checkout.</p>
    </div>
    <button type="button" class="cart-action-button shop-checkout-button"
      id="customerCheckoutButton" disabled>
      <span>Continue to checkout</span><span aria-hidden="true">→</span>
    </button>
    <p class="shop-cart-secure">✓ Secure order processing</p>
  `;

  const cartMount = document.getElementById("customerCartMount");
  (cartMount || customerProducts.parentElement).appendChild(panel);

  document.getElementById("customerCheckoutButton")
    .addEventListener("click", openCheckout);

  const modal = document.createElement("div");
  modal.id = "customerCheckoutModal";
  modal.className = "checkout-overlay";

  modal.innerHTML = `
    <section class="checkout-box" role="dialog" aria-modal="true"
      aria-labelledby="checkoutTitle" tabindex="-1">
      <div class="checkout-header">
        <div>
          <span class="checkout-eyebrow">ORDER REVIEW</span>
          <h2 id="checkoutTitle">Complete your order</h2>
          <p>Confirm your items and choose how you would like to receive them.</p>
        </div>
        <button type="button" class="checkout-close" id="closeCheckout"
          aria-label="Close checkout">×</button>
      </div>

      <div class="checkout-order-summary">
        <div class="checkout-summary-heading">
          <strong>Order summary</strong>
          <span id="checkoutItemCount">0 items</span>
        </div>
        <div id="checkoutSummary" class="checkout-summary-items"></div>
        <div class="checkout-summary-total">
          <span>Subtotal</span>
          <strong id="checkoutTotal">₱0.00</strong>
        </div>
      </div>

      <div class="checkout-section">
        <h3>Delivery or pickup</h3>
        <label for="checkoutFulfillment">Fulfillment method</label>
        <select id="checkoutFulfillment" class="checkout-input">
          <option value="delivery">Delivery</option>
          <option value="pickup">Pickup</option>
        </select>

        <label for="checkoutPayment">Payment method</label>
        <input id="checkoutPayment" class="checkout-input"
          value="Cash on Delivery" readonly aria-readonly="true">
        <p class="checkout-field-note" id="checkoutPaymentNote">
          Payment will be collected when your order is delivered.
        </p>

        <div class="checkout-address-group">
          <label id="checkoutAddressLabel" for="checkoutAddress">Delivery address</label>
          <textarea id="checkoutAddress" class="checkout-input"
            rows="3" placeholder="Enter your complete delivery address"
            autocomplete="street-address"></textarea>
        </div>

        <label for="checkoutNotes">Order notes <span>(optional)</span></label>
        <textarea id="checkoutNotes" class="checkout-input checkout-notes"
          rows="2" placeholder="Any instructions for your order?"></textarea>
      </div>

      <p id="checkoutMessage" class="checkout-message" role="alert"
        aria-live="polite"></p>

      <div class="checkout-actions">
        <button type="button" id="cancelCheckout" class="checkout-back-button">
          Back to cart
        </button>
        <button type="button" class="cart-action-button checkout-place-button"
          id="placeCustomerOrder">
          Place order <span aria-hidden="true">→</span>
        </button>
      </div>
      <p class="checkout-footnote">Your order will be submitted securely for processing.</p>
    </section>
  `;

  document.body.appendChild(modal);

  document.getElementById("cancelCheckout")
    .addEventListener("click", closeCheckout);

  document.getElementById("closeCheckout")
    .addEventListener("click", closeCheckout);

  document.getElementById("placeCustomerOrder")
    .addEventListener("click", submitCustomerOrder);

  document.getElementById("checkoutFulfillment")
    .addEventListener("change", updateCheckoutFields);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeCheckout();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("open")) {
      closeCheckout();
    }
  });
}

function getCartTotal() {
  let total = 0;

  customerCart.forEach(({ product, quantity }) => {
    total += Number(product.price) * quantity;
  });

  return total;
}

function addToCart(productId) {
  const product = availableProducts.find(
    item => item.id === productId
  );

  if (!product) return;

  const existing = customerCart.get(productId);
  const quantity = existing ? existing.quantity : 0;

  if (quantity >= Number(product.stock_quantity)) {
    alert("You cannot add more than the available stock.");
    return;
  }

  customerCart.set(productId, {
    product,
    quantity: quantity + 1
  });

  renderCart();
}

function changeCartQuantity(productId, change) {
  const item = customerCart.get(productId);
  if (!item) return;

  const newQuantity = item.quantity + change;

  if (newQuantity <= 0) {
    customerCart.delete(productId);
  } else if (newQuantity > Number(item.product.stock_quantity)) {
    alert("Requested quantity exceeds available stock.");
    return;
  } else {
    item.quantity = newQuantity;
  }

  renderCart();
}

function removeFromCart(productId) {
  customerCart.delete(productId);
  renderCart();
}

function renderCart() {
  const panel = document.getElementById("customerCartPanel");
  if (!panel) return;

  const count = Array.from(customerCart.values())
    .reduce((sum, item) => sum + item.quantity, 0);

  const cartHeading = document.getElementById("customerCartCount");
  if (cartHeading) {
    cartHeading.textContent = `${count} ${count === 1 ? "item" : "items"}`;
  }

  const totalElement = document.getElementById("customerCartTotal");
  if (totalElement) totalElement.textContent = formatMoney(getCartTotal());

  const container = document.getElementById("customerCartItems");
  const checkoutButton = document.getElementById("customerCheckoutButton");
  if (!container || !checkoutButton) return;

  container.replaceChildren();

  if (customerCart.size === 0) {
    const empty = document.createElement("div");
    empty.className = "shop-cart-empty";

    const emptyIcon = document.createElement("span");
    emptyIcon.className = "shop-cart-empty-icon";
    emptyIcon.setAttribute("aria-hidden", "true");
    emptyIcon.textContent = "🛒";

    const emptyTitle = document.createElement("strong");
    emptyTitle.textContent = "Your cart is empty";

    const emptyMessage = document.createElement("p");
    emptyMessage.textContent = "Browse farm supplies and add the items you need.";

    const browseButton = document.createElement("button");
    browseButton.type = "button";
    browseButton.className = "shop-cart-browse";
    browseButton.textContent = "Browse products";
    browseButton.addEventListener("click", () => {
      document.getElementById("customerProducts")?.scrollIntoView({ behavior: "smooth" });
    });

    empty.append(emptyIcon, emptyTitle, emptyMessage, browseButton);
    container.appendChild(empty);
    checkoutButton.disabled = true;
    return;
  }

  checkoutButton.disabled = false;

  customerCart.forEach(({ product, quantity }) => {
    const line = document.createElement("article");
    line.className = "shop-cart-line";

    const top = document.createElement("div");
    top.className = "shop-cart-line-top";

    const thumb = document.createElement("div");
    thumb.className = "shop-cart-thumb";

    if (product.image_url) {
      const image = document.createElement("img");
      image.src = product.image_url;
      image.alt = "";
      image.loading = "lazy";
      image.addEventListener("error", () => {
        image.remove();
        thumb.classList.add("shop-cart-thumb-fallback");
      }, { once: true });
      thumb.appendChild(image);
    } else {
      thumb.classList.add("shop-cart-thumb-fallback");
      thumb.textContent = "🌱";
    }

    const details = document.createElement("div");
    details.className = "shop-cart-line-details";

    const name = document.createElement("h3");
    name.textContent = product.product_name;

    const unitPrice = document.createElement("p");
    unitPrice.textContent = `${formatMoney(product.price)} each`;

    details.append(name, unitPrice);

    const lineTotal = document.createElement("strong");
    lineTotal.className = "shop-cart-line-total";
    lineTotal.textContent = formatMoney(Number(product.price) * quantity);

    top.append(thumb, details, lineTotal);

    const bottom = document.createElement("div");
    bottom.className = "shop-cart-line-bottom";

    const quantityLabel = document.createElement("span");
    quantityLabel.className = "shop-cart-quantity-label";
    quantityLabel.textContent = "Quantity";

    const controls = document.createElement("div");
    controls.className = "shop-cart-quantity-controls";

    const minus = document.createElement("button");
    minus.type = "button";
    minus.className = "cart-qty-button";
    minus.textContent = "−";
    minus.setAttribute("aria-label", `Decrease ${product.product_name} quantity`);
    minus.addEventListener("click", () => changeCartQuantity(product.id, -1));

    const qty = document.createElement("span");
    qty.className = "shop-cart-quantity";
    qty.textContent = String(quantity);
    qty.setAttribute("aria-label", `Quantity ${quantity}`);

    const plus = document.createElement("button");
    plus.type = "button";
    plus.className = "cart-qty-button";
    plus.textContent = "+";
    plus.disabled = quantity >= Number(product.stock_quantity);
    plus.setAttribute("aria-label", `Increase ${product.product_name} quantity`);
    plus.addEventListener("click", () => changeCartQuantity(product.id, 1));

    controls.append(minus, qty, plus);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "shop-cart-remove";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => removeFromCart(product.id));

    bottom.append(quantityLabel, controls, remove);
    line.append(top, bottom);
    container.appendChild(line);
  });
}

// ==========================================
// CHECKOUT
// ==========================================

function renderCheckoutSummary() {
  const summary = document.getElementById("checkoutSummary");
  const countElement = document.getElementById("checkoutItemCount");
  const totalElement = document.getElementById("checkoutTotal");
  if (!summary || !countElement || !totalElement) return;

  summary.replaceChildren();

  let itemCount = 0;
  customerCart.forEach(({ product, quantity }) => {
    itemCount += quantity;

    const row = document.createElement("div");
    row.className = "checkout-summary-row";

    const itemName = document.createElement("span");
    itemName.textContent = `${product.product_name} × ${quantity}`;

    const itemTotal = document.createElement("strong");
    itemTotal.textContent = formatMoney(Number(product.price) * quantity);

    row.append(itemName, itemTotal);
    summary.appendChild(row);
  });

  countElement.textContent = `${itemCount} ${itemCount === 1 ? "item" : "items"}`;
  totalElement.textContent = formatMoney(getCartTotal());
}

function openCheckout() {
  if (customerCart.size === 0) return;

  renderCheckoutSummary();
  document.getElementById("checkoutMessage").textContent = "";
  document.getElementById("checkoutFulfillment").value = "delivery";
  document.getElementById("checkoutAddress").value =
    currentCustomer?.delivery_address || "";
  document.getElementById("checkoutNotes").value = "";

  updateCheckoutFields();

  const modal = document.getElementById("customerCheckoutModal");
  modal.classList.add("open");
  modal.querySelector(".checkout-box")?.focus();
}

function closeCheckout() {
  document.getElementById("customerCheckoutModal")
    .classList.remove("open");
  document.getElementById("customerCheckoutButton")?.focus();
}

function updateCheckoutFields() {
  const fulfillment =
    document.getElementById("checkoutFulfillment").value;

  const address = document.getElementById("checkoutAddress");
  const label = document.getElementById("checkoutAddressLabel");
  const payment = document.getElementById("checkoutPayment");

  const addressGroup = document.querySelector(".checkout-address-group");
  const paymentNote = document.getElementById("checkoutPaymentNote");

  if (fulfillment === "pickup") {
    if (addressGroup) addressGroup.style.display = "none";
    label.style.display = "none";
    address.style.display = "none";
    address.required = false;
    payment.value = "Pay upon Pickup";
    if (paymentNote) {
      paymentNote.textContent = "Payment will be collected when you pick up your order.";
    }
  } else {
    if (addressGroup) addressGroup.style.display = "block";
    label.style.display = "block";
    address.style.display = "block";
    address.required = true;
    payment.value = "Cash on Delivery";
    if (paymentNote) {
      paymentNote.textContent = "Payment will be collected when your order is delivered.";
    }
  }
}

async function submitCustomerOrder() {
  if (customerCart.size === 0) return;

  const button = document.getElementById("placeCustomerOrder");
  const message = document.getElementById("checkoutMessage");

  const fulfillment =
    document.getElementById("checkoutFulfillment").value;

  const address =
    document.getElementById("checkoutAddress").value.trim();

  const notes =
    document.getElementById("checkoutNotes").value.trim();

 const paymentMethod =
  fulfillment === "pickup"
    ? "pay_upon_pickup"
    : "cash_on_delivery";

  if (fulfillment === "delivery" && !address) {
    message.textContent = "Please enter your delivery address.";
    return;
  }

  const items = Array.from(customerCart.values()).map(
    ({ product, quantity }) => ({
      product_id: product.id,
      quantity
    })
  );

  button.disabled = true;
  button.textContent = "Placing Order...";

  try {
    const { data, error } = await supabase.rpc(
      "place_customer_order",
      {
        p_items: items,
        p_fulfillment_method: fulfillment,
        p_payment_method: paymentMethod,
        p_delivery_address:
          fulfillment === "delivery" ? address : null,
        p_customer_notes: notes || null
      }
    );

    if (error) throw error;

    customerCart.clear();
    renderCart();
    closeCheckout();

    alert(
      "Your order was successfully placed. Reference: " +
      (typeof data === "string" ? data : JSON.stringify(data)) +
      ". Payment status: Unpaid."
    );

   await loadCustomerProducts();
await loadCustomerOrderHistory();

  } catch (error) {
    console.error("Order placement error:", error);
    message.textContent = error.message ||
      "Unable to place your order. Please try again.";
  } finally {
    button.disabled = false;
    button.textContent = "Place Order";
  }
}

// ==========================================
// CHECK EXISTING SESSION
// ==========================================

async function checkSession() {
  showLogin();

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    showMessage(error.message);
    return;
  }

  if (data.session) {
    await loadUserAndOpenScreen(data.session.user);
  } else {
    showLogin();
  }
}

// ==========================================
// LOGOUT
// ==========================================

async function signOutUser(button) {
  button.disabled = true;

  const { error } = await supabase.auth.signOut();

  button.disabled = false;

  if (error) {
    showMessage(error.message);
  } else {
    customerCart.clear();
    currentCustomer = null;
  }
}

const signOutButton = document.getElementById("signOutButton");

if (signOutButton) {
  signOutButton.addEventListener("click", () => {
    signOutUser(signOutButton);
  });
}

if (customerSignOut) {
  customerSignOut.addEventListener("click", () => {
    signOutUser(customerSignOut);
  });
}

// ==========================================
// MONITOR AUTHENTICATION CHANGES
// ==========================================

supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    customerCart.clear();
    currentCustomer = null;

    showLogin();
    loginForm.reset();
    setAuthMode("login");
    showMessage("You have been signed out.");
  }
});

// ==========================================
// FORGOT PASSWORD
// ==========================================

forgotPassword.addEventListener("click", async () => {
  const email = loginEmail.value.trim();

  if (!email) {
    showMessage("Please enter your email address first.");
    loginEmail.focus();
    return;
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin
  });

  if (error) {
    showMessage(error.message);
  } else {
    showMessage(
      "Password reset instructions sent to your email.",
      true
    );
  }
});

// ==========================================
// START AUTHENTICATION
// ==========================================

checkSession();
