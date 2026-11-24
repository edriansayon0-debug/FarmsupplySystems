
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

const adminLoginTab = document.getElementById("adminLoginTab");
const customerLoginTab = document.getElementById("customerLoginTab");
const loginTitle = document.getElementById("loginTitle");
const loginDescription = document.getElementById("loginDescription");
const loginFooter = document.getElementById("loginFooter");

const customerName = document.getElementById("customerName");
const customerProducts = document.getElementById("customerProducts");
const customerSignOut = document.getElementById("customerSignOut");

const ORGANIZATION_ID = "4e762e56-2d6c-468d-a50b-6c009e700064";

let loginMode = "admin";
let currentCustomer = null;
let availableProducts = [];
let customerCart = new Map();

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

  createCartElements();
createOrderHistoryElements();

loadCustomerProducts();
loadCustomerOrderHistory();

renderCart();
}

function showMessage(message, success = false) {
  authMessage.textContent = message;
  authMessage.style.color = success ? "#2d8a50" : "#c0392b";
}

// ==========================================
// LOGIN MODE
// ==========================================

function setLoginMode(mode) {
  loginMode = mode;

  showMessage("");

  if (mode === "admin") {
    loginTitle.textContent = "Welcome back";
    loginDescription.textContent =
      "Sign in to your administrator account.";

    loginFooter.textContent =
      "Access is limited to authorized S.T.P.B personnel.";

    adminLoginTab.style.background = "#1b4332";
    adminLoginTab.style.color = "#ffffff";

    customerLoginTab.style.background = "#e8eee9";
    customerLoginTab.style.color = "#1b4332";
  } else {
    loginTitle.textContent = "Welcome, Customer";
    loginDescription.textContent =
      "Sign in to browse our farm supplies and equipment.";

    loginFooter.textContent =
      "Customer access for S.T.P.B Farm Supplies & Equipment.";

    customerLoginTab.style.background = "#1b4332";
    customerLoginTab.style.color = "#ffffff";

    adminLoginTab.style.background = "#e8eee9";
    adminLoginTab.style.color = "#1b4332";
  }
}

adminLoginTab.addEventListener("click", () => {
  setLoginMode("admin");
});

customerLoginTab.addEventListener("click", () => {
  setLoginMode("customer");
});

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
    .select("id, full_name, phone")
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

  loginSubmit.disabled = true;
  loginSubmit.textContent = "Signing in...";

  showMessage("");

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw error;
    }

    const success = await loadUserAndOpenScreen(data.user, loginMode);

    if (success) {
      loginForm.reset();
    }

  } catch (error) {
    showMessage(error.message);

  } finally {
    loginSubmit.disabled = false;
    loginSubmit.textContent = "Sign in";
  }
});

// ==========================================
// CUSTOMER PRODUCT BROWSING
// ==========================================

async function loadCustomerProducts() {
  customerProducts.textContent = "Loading products...";

  const { data: products, error } = await supabase
    .from("products")
    .select(
      "id, product_name, description, price, stock_quantity, unit, image_url"
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
  customerProducts.replaceChildren();

  if (availableProducts.length === 0) {
    customerProducts.textContent = "No products are currently available.";
    renderCart();
    return;
  }

  const grid = document.createElement("div");

  grid.style.display = "grid";
  grid.style.gridTemplateColumns =
    "repeat(auto-fit, minmax(220px, 1fr))";
  grid.style.gap = "18px";

  availableProducts.forEach((product) => {
    const card = document.createElement("article");

    card.style.background = "#ffffff";
    card.style.padding = "20px";
    card.style.borderRadius = "12px";
    card.style.border = "1px solid #e5e9e5";

    const name = document.createElement("h3");
    name.textContent = product.product_name;

    const description = document.createElement("p");
    description.textContent =
      product.description || "No description available.";

    const price = document.createElement("strong");
    price.textContent = formatMoney(product.price);
    price.style.color = "#1b4332";

    const stock = document.createElement("p");
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

    addButton.disabled = Number(product.stock_quantity) <= 0;
    addButton.addEventListener("click", () => addToCart(product.id));

    card.append(name, description, price, stock, addButton);
    grid.appendChild(card);
  });

  customerProducts.appendChild(grid);
  renderCart();
}

async function loadCustomerOrderHistory() {
  const container = document.getElementById(
    "customerOrderHistoryList"
  );

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
        created_at
      `)
      .eq("customer_id", currentCustomer.id)
      .eq("organization_id", ORGANIZATION_ID)
      .order("created_at", { ascending: false });

    if (error) throw error;

    container.replaceChildren();

    if (!orders || orders.length === 0) {
      container.textContent = "You have not placed any orders yet.";
      return;
    }

    const orderIds = orders.map(order => order.id);

    const { data: orderItems, error: itemsError } =
      await supabase
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
      if (!itemsByOrder.has(item.order_id)) {
        itemsByOrder.set(item.order_id, []);
      }

      itemsByOrder.get(item.order_id).push(item);
    });

    orders.forEach(order => {
      const card = document.createElement("article");

      card.style.border = "1px solid #e5e9e5";
      card.style.borderRadius = "10px";
      card.style.padding = "15px";
      card.style.marginBottom = "15px";

      const heading = document.createElement("h3");
      heading.textContent =
        order.order_number || order.id;

      heading.style.color = "#1b4332";
      heading.style.marginTop = "0";

      const date = document.createElement("p");
      date.textContent =
        "Date: " +
        new Date(order.created_at).toLocaleString("en-PH");

      const fulfillment = document.createElement("p");
      fulfillment.textContent =
        "Fulfillment: " +
        (order.fulfillment_method === "pickup"
          ? "Pay upon Pickup"
          : "Delivery");

      const payment = document.createElement("p");
      payment.textContent =
        "Payment: " +
        (order.payment_method === "pay_upon_pickup"
          ? "Pay upon Pickup"
          : "Cash on Delivery");

      const status = document.createElement("p");
      status.textContent =
        "Order Status: " + order.order_status;

      const paymentStatus = document.createElement("p");
      paymentStatus.textContent =
        "Payment Status: " + order.payment_status;

      const itemsTitle = document.createElement("strong");
      itemsTitle.textContent = "Ordered Products";

      const itemList = document.createElement("ul");

      const items = itemsByOrder.get(order.id) || [];

      items.forEach(item => {
        const listItem = document.createElement("li");

        listItem.textContent =
          `${item.product_name} × ${item.quantity} — ` +
          formatMoney(item.subtotal);

        itemList.appendChild(listItem);
      });

      const total = document.createElement("h3");
      total.textContent =
        "Total: " + formatMoney(order.total_amount);

      total.style.color = "#1b4332";

      card.append(
        heading,
        date,
        fulfillment,
        payment,
        status,
        paymentStatus,
        itemsTitle,
        itemList,
        total
      );

      container.appendChild(card);
    });

  } catch (error) {
    console.error("Order history error:", error);

    container.textContent =
      "Unable to load your order history. Please try again.";
  }
}

// ==========================================
// CUSTOMER ORDER HISTORY
// ==========================================

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

    <div id="customerOrderHistoryList" style="margin-top:15px">
      Loading your orders...
    </div>
  `;

  customerProducts.parentElement.insertBefore(
    section,
    customerProducts
  );

  document.getElementById("refreshCustomerOrders")
    .addEventListener("click", loadCustomerOrderHistory);
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
  if (document.getElementById("customerCartToolbar")) return;

  const style = document.createElement("style");
  style.textContent = `
    .cart-action-button {
      background: #1b4332;
      color: white;
      border: 0;
      padding: 10px 15px;
      border-radius: 8px;
      cursor: pointer;
    }
    .cart-panel {
      display: none;
      background: white;
      padding: 20px;
      border: 1px solid #ddd;
      border-radius: 12px;
      margin: 15px 0;
    }
    .cart-panel.open { display: block; }
    .cart-line {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid #eee;
    }
    .cart-qty-button {
      padding: 5px 10px;
      cursor: pointer;
    }
    .checkout-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: #0008;
      z-index: 9999;
      align-items: center;
      justify-content: center;
      padding: 15px;
    }
    .checkout-overlay.open { display: flex; }
    .checkout-box {
      background: white;
      padding: 24px;
      border-radius: 12px;
      width: min(100%, 500px);
      max-height: 90vh;
      overflow: auto;
    }
    .checkout-input {
      width: 100%;
      box-sizing: border-box;
      padding: 10px;
      margin: 5px 0 12px;
    }
  `;
  document.head.appendChild(style);

  const toolbar = document.createElement("div");
  toolbar.id = "customerCartToolbar";
  toolbar.style.textAlign = "right";
  toolbar.style.margin = "20px 0";

  const cartButton = document.createElement("button");
  cartButton.type = "button";
  cartButton.className = "cart-action-button";
  cartButton.id = "toggleCustomerCart";
  cartButton.textContent = "Shopping Cart (0)";

  cartButton.addEventListener("click", () => {
    document.getElementById("customerCartPanel")
      .classList.toggle("open");
  });

  toolbar.appendChild(cartButton);
  customerProducts.parentElement.insertBefore(toolbar, customerProducts);

  const panel = document.createElement("section");
  panel.id = "customerCartPanel";
  panel.className = "cart-panel";

  panel.innerHTML = `
    <h2>Your Shopping Cart</h2>
    <div id="customerCartItems"></div>
    <h3>Total: <span id="customerCartTotal">₱0.00</span></h3>
    <button type="button" class="cart-action-button"
      id="customerCheckoutButton">
      Proceed to Checkout
    </button>
  `;

  toolbar.insertAdjacentElement("afterend", panel);

  document.getElementById("customerCheckoutButton")
    .addEventListener("click", openCheckout);

  const modal = document.createElement("div");
  modal.id = "customerCheckoutModal";
  modal.className = "checkout-overlay";

  modal.innerHTML = `
    <div class="checkout-box">
      <h2>Checkout</h2>
      <p id="checkoutSummary"></p>

      <label>Fulfillment Method</label>
      <select id="checkoutFulfillment" class="checkout-input">
        <option value="delivery">Delivery</option>
        <option value="pickup">Pay upon Pickup</option>
      </select>

      <label>Payment Method</label>
      <input id="checkoutPayment" class="checkout-input"
        value="Cash on Delivery" readonly>

      <label id="checkoutAddressLabel">Delivery Address</label>
      <textarea id="checkoutAddress" class="checkout-input"
        rows="3" placeholder="Enter your complete address"></textarea>

      <label>Order Notes (Optional)</label>
      <textarea id="checkoutNotes" class="checkout-input"
        rows="2"></textarea>

      <p id="checkoutMessage"></p>

      <button type="button" id="cancelCheckout">
        Back to Cart
      </button>

      <button type="button" class="cart-action-button"
        id="placeCustomerOrder">
        Place Order
      </button>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("cancelCheckout")
    .addEventListener("click", closeCheckout);

  document.getElementById("placeCustomerOrder")
    .addEventListener("click", submitCustomerOrder);

  document.getElementById("checkoutFulfillment")
    .addEventListener("change", updateCheckoutFields);
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

  document.getElementById("toggleCustomerCart").textContent =
    `Shopping Cart (${count})`;

  document.getElementById("customerCartTotal").textContent =
    formatMoney(getCartTotal());

  const container = document.getElementById("customerCartItems");
  container.replaceChildren();

  if (customerCart.size === 0) {
    container.textContent = "Your cart is empty.";
    document.getElementById("customerCheckoutButton").disabled = true;
    return;
  }

  document.getElementById("customerCheckoutButton").disabled = false;

  customerCart.forEach(({ product, quantity }) => {
    const line = document.createElement("div");
    line.className = "cart-line";

    const info = document.createElement("div");
    info.textContent =
      `${product.product_name} — ${formatMoney(product.price)} each`;

    const controls = document.createElement("div");

    const minus = document.createElement("button");
    minus.className = "cart-qty-button";
    minus.textContent = "−";
    minus.addEventListener("click", () =>
      changeCartQuantity(product.id, -1)
    );

    const qty = document.createElement("span");
    qty.textContent = ` ${quantity} `;

    const plus = document.createElement("button");
    plus.className = "cart-qty-button";
    plus.textContent = "+";
    plus.disabled = quantity >= Number(product.stock_quantity);
    plus.addEventListener("click", () =>
      changeCartQuantity(product.id, 1)
    );

    const subtotal = document.createElement("strong");
    subtotal.textContent =
      ` ${formatMoney(Number(product.price) * quantity)} `;

    const remove = document.createElement("button");
    remove.textContent = "Remove";
    remove.addEventListener("click", () =>
      removeFromCart(product.id)
    );

    controls.append(minus, qty, plus, subtotal, remove);
    line.append(info, controls);
    container.appendChild(line);
  });
}

// ==========================================
// CHECKOUT
// ==========================================

function openCheckout() {
  if (customerCart.size === 0) return;

  const summary = Array.from(customerCart.values())
    .map(({ product, quantity }) =>
      `${product.product_name} × ${quantity}`
    )
    .join(", ");

  document.getElementById("checkoutSummary").textContent =
    `${summary} | Total: ${formatMoney(getCartTotal())}`;

  document.getElementById("checkoutMessage").textContent = "";
  document.getElementById("checkoutFulfillment").value = "delivery";
  document.getElementById("checkoutAddress").value = "";
  document.getElementById("checkoutNotes").value = "";

  updateCheckoutFields();

  document.getElementById("customerCheckoutModal")
    .classList.add("open");
}

function closeCheckout() {
  document.getElementById("customerCheckoutModal")
    .classList.remove("open");
}

function updateCheckoutFields() {
  const fulfillment =
    document.getElementById("checkoutFulfillment").value;

  const address = document.getElementById("checkoutAddress");
  const label = document.getElementById("checkoutAddressLabel");
  const payment = document.getElementById("checkoutPayment");

  if (fulfillment === "pickup") {
    label.style.display = "none";
    address.style.display = "none";
    address.required = false;
    address.value = "";
    payment.value = "Pay upon Pickup";
  } else {
    label.style.display = "block";
    address.style.display = "block";
    address.required = true;
    payment.value = "Cash on Delivery";
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

setLoginMode("admin");
checkSession();
