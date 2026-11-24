import { supabase } from "./supabase-config.js";

const labels = {
  dashboard: "Organization Profile & Overall Health",
  products: "Product Management",
  customers: "Customer Management",
  transactions: "Transactions & Sales",
  inventory: "Inventory Management",
  reports: "Reports & Analytics",
  users: "User Management",
  settings: "Preferences & System Settings",
};

const ORG_ID = "4e762e56-2d6c-468d-a50b-6c009e700064";

const content = document.getElementById("content");
const title = document.getElementById("title");
const toast = document.getElementById("toast");

let customers = [];
let orders = [];
let selectedCustomerId = null;
let selectedOrderId = null;
let customerSearch = "";

function notify(message) {
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(notify.timer);

  notify.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2300);
}

function money(value) {
  return "₱" + Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function safeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[char];
  });
}

function dateText(value) {
  if (!value) return "—";

  return new Date(value).toLocaleString("en-PH");
}

function statusText(status) {
  const names = {
    pending: "Pending",
    approved: "Approved",
    processing: "Processing",
    ready_for_pickup: "Ready for Pickup",
    out_for_delivery: "Out for Delivery",
    completed: "Completed",
    rejected: "Rejected",
    cancelled: "Cancelled",
    unpaid: "Unpaid",
    paid: "Paid",
  };

  return names[status] || status || "—";
}

function statusClass(status) {
  if (
    ["completed", "paid", "approved", "ready_for_pickup"].includes(status)
  ) {
    return "tag";
  }

  return "pending";
}

/* =========================================
   PAGE NAVIGATION
========================================= */

function navigate(page) {
  if (!labels[page]) return;

  document.querySelectorAll(".nav").forEach((nav) => {
    nav.classList.toggle("active", nav.dataset.page === page);
  });

  title.textContent = labels[page];

  if (page === "dashboard") {
    location.hash = "";
    location.reload();
    return;
  }

  if (page === "customers") {
    location.hash = "customers";

    document.getElementById("sidebar").classList.remove("open");

    loadOrganizationCustomerManagement();
    return;
  }

  content.innerHTML = `
    <section class="card" style="padding:65px 20px;text-align:center">
      <div style="font-size:38px;color:#2d6a4f">♧</div>

      <h2 style="font:700 21px Outfit;color:#1b4332">
        ${labels[page]}
      </h2>

      <p style="color:#85877e;font-size:12px">
        This section is planned for the next development step.
        Database records and actions are not connected yet.
      </p>

      <button class="soft" id="back">
        ← Back to dashboard
      </button>
    </section>
  `;

  document.getElementById("back").onclick = () => {
    location.reload();
  };

  location.hash = page;

  document.getElementById("sidebar").classList.remove("open");
}

document.querySelectorAll(".nav").forEach((nav) => {
  nav.addEventListener("click", () => {
    navigate(nav.dataset.page);
  });
});

document.querySelectorAll("[data-goto]").forEach((button) => {
  button.addEventListener("click", () => {
    navigate(button.dataset.goto);
  });
});

document.getElementById("menu").onclick = () => {
  document.getElementById("sidebar").classList.toggle("open");
};

document.getElementById("refresh").onclick = () => {
  notify("Dashboard preview refreshed.");
};

document.getElementById("bell").onclick = () => {
  notify("Notifications will be connected in a later phase.");
};

document.getElementById("period").onchange = (event) => {
  notify("Selected: " + event.target.value);
};

document.getElementById("search").onkeydown = (event) => {
  if (event.key === "Enter" && event.target.value.trim()) {
    notify("Search will be connected in a later phase.");
  }
};

/* =========================================
   LOAD CUSTOMER AND ORDER DATA
========================================= */

async function loadCustomerAndOrderData() {
  const [customerResult, orderResult] = await Promise.all([
    supabase
      .from("customer_profiles")
      .select("id, full_name, phone")
      .order("full_name", { ascending: true }),

    supabase
      .from("customer_orders")
      .select(`
        id,
        customer_id,
        order_number,
        fulfillment_method,
        payment_method,
        delivery_address,
        customer_notes,
        subtotal,
        total_amount,
        order_status,
        payment_status,
        created_at,
        updated_at
      `)
      .eq("organization_id", ORG_ID)
      .order("created_at", { ascending: false }),
  ]);

  if (customerResult.error) {
    throw customerResult.error;
  }

  if (orderResult.error) {
    throw orderResult.error;
  }

  customers = customerResult.data || [];
  orders = orderResult.data || [];

  // Add customers who have orders but whose profile
  // was not returned by the customer profile query.

  const knownCustomers = new Set(
    customers.map((customer) => customer.id)
  );

  orders.forEach((order) => {
    if (!knownCustomers.has(order.customer_id)) {
      customers.push({
        id: order.customer_id,
        full_name: "Customer",
        phone: null,
      });

      knownCustomers.add(order.customer_id);
    }
  });
}

function getCustomer(customerId) {
  return customers.find((customer) => {
    return customer.id === customerId;
  });
}

function getCustomerOrders(customerId) {
  return orders.filter((order) => {
    return order.customer_id === customerId;
  });
}

function getCustomerPaidTotal(customerId) {
  return getCustomerOrders(customerId)
    .filter((order) => order.payment_status === "paid")
    .reduce((total, order) => {
      return total + Number(order.total_amount || 0);
    }, 0);
}

/* =========================================
   CUSTOMER MANAGEMENT PAGE
========================================= */

function renderCustomerManagement() {
  title.textContent = "Customer Management";

  content.innerHTML = `
    <div class="sectiontitle">
      <div>
        <h2>Customer Accounts & Orders</h2>
        <p>
          Select a customer to view their account and order records.
        </p>
      </div>

      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="soft" id="viewOrderManagement">
          View Order Management
        </button>

        <button class="outline" id="refreshCustomers">
          ↻ Refresh
        </button>
      </div>
    </div>

    <section class="grid"
      style="grid-template-columns:minmax(0,1.6fr) minmax(280px,1fr);align-items:stretch">

      <article class="card panel">
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:15px">
          <input
            id="customerPageSearch"
            placeholder="Search customers..."
            style="max-width:240px;margin:0;padding:9px 11px;border:1px solid #e5e1d8;border-radius:7px;background:#fff;font:12px DM Sans"
          >

          <span class="count" id="customerCount">
            Loading...
          </span>
        </div>

        <div class="tablewrap" style="margin-top:0">
          <table>
            <thead>
              <tr>
               <th>CUSTOMER NAME</th>
               <th>TYPE</th>
               <th>TOTAL SPENT</th>
               <th>STATUS</th>
              </tr>
            </thead>

            <tbody id="customerRows">
              <tr>
                <td colspan="4">Loading customers...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="card panel">
        <div class="panelhead">
          <div>
            <h3>Customer Details</h3>
            <p>Select a customer from the list.</p>
          </div>
        </div>

        <div id="customerDetails" style="margin-top:18px;color:#85877e">
          Choose a customer to see their orders.
        </div>
      </article>
    </section>
  `;

  document.getElementById("viewOrderManagement").onclick = () => {
    selectedOrderId = null;
    renderOrderManagement();
  };

  document.getElementById("refreshCustomers").onclick = async () => {
    await refreshCustomerData();
    renderCustomerManagement();
  };

  const searchInput = document.getElementById("customerPageSearch");

  searchInput.value = customerSearch;

  searchInput.addEventListener("input", () => {
    customerSearch = searchInput.value.trim().toLowerCase();
    renderCustomerRows();
  });

  renderCustomerRows();

  if (selectedCustomerId) {
    renderCustomerDetails();
  }
}

function renderCustomerRows() {
  const tbody = document.getElementById("customerRows");
  const count = document.getElementById("customerCount");

  if (!tbody || !count) return;

  const filteredCustomers = customers.filter((customer) => {
    const name = (customer.full_name || "").toLowerCase();
    const phone = (customer.phone || "").toLowerCase();

    return (
      !customerSearch ||
      name.includes(customerSearch) ||
      phone.includes(customerSearch)
    );
  });

  count.textContent = `${filteredCustomers.length} customers`;

  tbody.replaceChildren();

  if (!filteredCustomers.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4">No matching customers found.</td>
      </tr>
    `;

    return;
  }

  filteredCustomers.forEach((customer) => {
    const customerOrders = getCustomerOrders(customer.id);

    const row = document.createElement("tr");

    row.style.cursor = "pointer";

    if (customer.id === selectedCustomerId) {
      row.style.background = "#e8f5eb";
    }

    row.innerHTML = `
      <td class="ref">
        ${safeText(customer.full_name || "Customer")}
      </td>

      <td>
  ${money(getCustomerPaidTotal(customer.id))}
      </td>

      <td>
        ${customerOrders.length}
      </td>

      <td>
        ${money(getCustomerPaidTotal(customer.id))}
      </td>
    `;

    row.addEventListener("click", () => {
      selectedCustomerId = customer.id;

      renderCustomerRows();
      renderCustomerDetails();
    });

    tbody.appendChild(row);
  });
}

function renderCustomerDetails() {
  const container = document.getElementById("customerDetails");

  if (!container) return;

  const customer = getCustomer(selectedCustomerId);

  if (!customer) {
    container.textContent = "Choose a customer to see their orders.";
    return;
  }

  const customerOrders = getCustomerOrders(customer.id);

  const unpaidTotal = customerOrders
    .filter((order) => {
      return (
        order.payment_status === "unpaid" &&
        !["rejected", "cancelled"].includes(order.order_status)
      );
    })
    .reduce((total, order) => {
      return total + Number(order.total_amount || 0);
    }, 0);

  container.innerHTML = `
    <h2 style="font:700 18px Outfit;color:#1b4332;margin:0 0 6px">
      ${safeText(customer.full_name || "Customer")}
    </h2>

    <p style="color:#85877e;margin:0 0 15px;font-size:12px">
      Customer Account
    </p>

    <div class="meta" style="gap:18px;margin:0 0 18px">
      <div>
        <small>ORDERS</small>
        <b>${customerOrders.length}</b>
      </div>

      <div>
        <small>PAID TOTAL</small>
        <b>${money(getCustomerPaidTotal(customer.id))}</b>
      </div>

      <div>
        <small>UNPAID ORDERS</small>
        <b>${money(unpaidTotal)}</b>
      </div>
    </div>

    <p style="font-size:11px;margin:6px 0">
      <b>Phone:</b>
      ${safeText(customer.phone || "Not provided")}
    </p>

    <hr style="border:0;border-top:1px solid #eee;margin:18px 0">

    <div class="panelhead">
      <div>
        <h3>Recent Orders</h3>
        <p>Customer's Organization A orders</p>
      </div>
    </div>

    <div id="customerRecentOrders" style="margin-top:12px"></div>
  `;

  const recentOrders = document.getElementById("customerRecentOrders");

  if (!customerOrders.length) {
    recentOrders.textContent =
      "This customer has no orders with this organization yet.";

    return;
  }

  customerOrders.slice(0, 5).forEach((order) => {
    const item = document.createElement("div");

    item.style.padding = "11px 0";
    item.style.borderBottom = "1px solid #eee";

    item.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:10px">
        <b class="ref">${safeText(order.order_number)}</b>
        <strong>${money(order.total_amount)}</strong>
      </div>

      <small style="display:block;color:#85877e;margin-top:5px">
        ${dateText(order.created_at)}
        · ${statusText(order.order_status)}
        · ${statusText(order.payment_status)}
      </small>
    `;

    recentOrders.appendChild(item);
  });
}

/* =========================================
   ORDER MANAGEMENT VIEW
========================================= */

function renderOrderManagement() {
  title.textContent = "Order Management";

  content.innerHTML = `
    <div class="sectiontitle">
      <div>
        <h2>Order Management</h2>
        <p>
          Review and manage customer orders for Farm Supplies & Equipment.
        </p>
      </div>

      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="outline" id="backToCustomers">
          ← Back to Customers
        </button>

        <button class="soft" id="refreshOrders">
          ↻ Refresh Orders
        </button>
      </div>
    </div>

    <section class="grid"
      style="grid-template-columns:minmax(0,1.6fr) minmax(280px,1fr);align-items:stretch">

      <article class="card panel">
        <div class="panelhead">
          <div>
            <h3 id="orderListTitle">Customer Orders</h3>
            <p>Click an order to view details.</p>
          </div>

          <span class="count" id="orderCount"></span>
        </div>

        <div class="tablewrap">
          <table>
            <thead>
              <tr>
                <th>ORDER</th>
                <th>CUSTOMER</th>
                <th>DATE</th>
                <th>TOTAL</th>
                <th>STATUS</th>
              </tr>
            </thead>

            <tbody id="orderRows">
              <tr>
                <td colspan="5">Loading orders...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="card panel">
        <div class="panelhead">
          <div>
            <h3>Order Details</h3>
            <p>Selected order and actions</p>
          </div>
        </div>

        <div id="orderDetails" style="margin-top:16px;color:#85877e">
          Select an order to view its details.
        </div>
      </article>
    </section>
  `;

  document.getElementById("backToCustomers").onclick = async () => {
  await loadOrganizationCustomerManagement();
};

  document.getElementById("refreshOrders").onclick = async () => {
    await refreshCustomerData();
    renderOrderManagement();
  };

  renderOrderRows();
}

function renderOrderRows() {
  const tbody = document.getElementById("orderRows");
  const count = document.getElementById("orderCount");

  if (!tbody || !count) return;

  const orderList = selectedCustomerId
    ? orders.filter((order) => {
        return order.customer_id === selectedCustomerId;
      })
    : orders;

  count.textContent = `${orderList.length} orders`;

  const listTitle = document.getElementById("orderListTitle");

  if (listTitle && selectedCustomerId) {
    const customer = getCustomer(selectedCustomerId);

    listTitle.textContent =
      `Orders — ${customer?.full_name || "Customer"}`;
  }

  tbody.replaceChildren();

  if (!orderList.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">No orders found.</td>
      </tr>
    `;

    return;
  }

  orderList.forEach((order) => {
    const customer = getCustomer(order.customer_id);

    const row = document.createElement("tr");

    row.style.cursor = "pointer";

    if (order.id === selectedOrderId) {
      row.style.background = "#e8f5eb";
    }

    row.innerHTML = `
      <td class="ref">
        ${safeText(order.order_number || order.id || "No Order ID")}
      </td>

      <td>
        ${safeText(customer?.full_name || "Customer")}
      </td>

      <td>
    ${
    order.created_at && !isNaN(new Date(order.created_at).getTime())
      ? new Date(order.created_at).toLocaleDateString("en-PH")
      : "Date not available" }
      </td>

      <td>
        ${money(order.total_amount)}
      </td>

      <td>
        <span class="${statusClass(order.order_status)}">
          ${statusText(order.order_status)}
        </span>
      </td>
    `;

    row.addEventListener("click", async () => {
      selectedOrderId = order.id;

      renderOrderRows();
      await renderOrderDetails();
    });

    tbody.appendChild(row);
  });
}

/* =========================================
   ORDER DETAILS AND STATUS ACTIONS
========================================= */

function allowedNextStatuses(order) {
  const statusOptions = {
    pending: ["approved", "rejected", "cancelled"],

    approved: ["processing", "rejected", "cancelled"],

    processing: [
      "ready_for_pickup",
      "out_for_delivery",
      "cancelled",
    ],

    ready_for_pickup: ["completed", "cancelled"],

    out_for_delivery: ["completed"],

    completed: [],
    rejected: [],
    cancelled: [],
  };

  let nextStatuses = statusOptions[order.order_status] || [];

  if (order.fulfillment_method === "pickup") {
    nextStatuses = nextStatuses.filter((status) => {
      return status !== "out_for_delivery";
    });
  } else {
    nextStatuses = nextStatuses.filter((status) => {
      return status !== "ready_for_pickup";
    });
  }

  return nextStatuses;
}

async function renderOrderDetails() {
  const container = document.getElementById("orderDetails");

  if (!container) return;

  const order = orders.find((item) => {
    return item.id === selectedOrderId;
  });

  if (!order) {
    container.textContent = "Select an order to view its details.";
    return;
  }

  const customer = getCustomer(order.customer_id);

  container.textContent = "Loading order items...";

  const { data: items, error } = await supabase
    .from("customer_order_items")
    .select("product_name, quantity, unit_price, subtotal")
    .eq("order_id", order.id);

  if (error) {
    container.textContent =
      "Unable to load order items: " + error.message;

    return;
  }

  const nextStatuses = allowedNextStatuses(order);

  const statusOptions = [
    order.order_status,
    ...nextStatuses,
  ]
    .map((status) => {
      return `
        <option value="${status}">
          ${statusText(status)}
        </option>
      `;
    })
    .join("");

  container.innerHTML = `
    <h2 style="font:700 17px Outfit;color:#1b4332;margin:0 0 5px">
      ${safeText(order.order_number)}
    </h2>

    <p style="font-size:12px;color:#85877e;margin:0 0 15px">
      ${dateText(order.created_at)}
    </p>

    <p style="font-size:11px">
      <b>Customer:</b>
      ${safeText(customer?.full_name || "Customer")}
    </p>

    <p style="font-size:11px">
      <b>Phone:</b>
      ${safeText(customer?.phone || "Not provided")}
    </p>

    <p style="font-size:11px">
      <b>Fulfillment:</b>
      ${order.fulfillment_method === "pickup" ? "Pickup" : "Delivery"}
    </p>

    <p style="font-size:11px">
      <b>Payment:</b>
      ${order.payment_method === "pay_upon_pickup"
        ? "Pay upon Pickup"
        : "Cash on Delivery"}
    </p>

    ${
      order.delivery_address
        ? `
          <p style="font-size:11px">
            <b>Delivery address:</b>
            ${safeText(order.delivery_address)}
          </p>
        `
        : ""
    }

    ${
      order.customer_notes
        ? `
          <p style="font-size:11px">
            <b>Notes:</b>
            ${safeText(order.customer_notes)}
          </p>
        `
        : ""
    }

    <hr style="border:0;border-top:1px solid #eee;margin:16px 0">

    <h3 style="font:700 13px Outfit;margin:0 0 10px">
      Ordered Products
    </h3>

    <div id="orderItemList"></div>

    <h3 style="color:#1b4332">
      Total: ${money(order.total_amount)}
    </h3>

    <p style="font-size:11px">
      <b>Order Status:</b>
      <span class="${statusClass(order.order_status)}">
        ${statusText(order.order_status)}
      </span>
    </p>

    <p style="font-size:11px">
      <b>Payment Status:</b>
      <span class="${statusClass(order.payment_status)}">
        ${statusText(order.payment_status)}
      </span>
    </p>

    ${
      nextStatuses.length
        ? `
          <label style="display:block;font-size:11px;font-weight:bold;margin-top:14px">
            Update Order Status
          </label>

          <select
            id="orderStatusSelect"
            style="width:100%;padding:10px;border:1px solid #ddd;border-radius:7px;margin:8px 0"
          >
            ${statusOptions}
          </select>

          <button class="soft full" id="saveOrderStatus">
            Save Order Status
          </button>
        `
        : `
          <p style="font-size:11px;color:#85877e">
            This order is closed and cannot be changed.
          </p>
        `
    }

    ${
      order.payment_status === "unpaid" &&
      !["rejected", "cancelled"].includes(order.order_status)
        ? `
          <button
            class="outline full"
            id="markOrderPaid"
            style="margin-top:10px"
          >
            Mark as Paid (cash received)
          </button>
        `
        : ""
    }
  `;

  const itemList = document.getElementById("orderItemList");

  if (!items || !items.length) {
    itemList.textContent = "No order items found.";
  } else {
    items.forEach((item) => {
      const line = document.createElement("div");

      line.style.display = "flex";
      line.style.justifyContent = "space-between";
      line.style.gap = "10px";
      line.style.padding = "8px 0";
      line.style.borderBottom = "1px solid #eee";
      line.style.fontSize = "11px";

      line.innerHTML = `
        <span>
          ${safeText(item.product_name)} × ${item.quantity}
          <br>
          <small style="color:#85877e">
            ${money(item.unit_price)} each
          </small>
        </span>

        <b>${money(item.subtotal)}</b>
      `;

      itemList.appendChild(line);
    });
  }

  const saveButton = document.getElementById("saveOrderStatus");

  if (saveButton) {
    saveButton.onclick = async () => {
      const newStatus =
        document.getElementById("orderStatusSelect").value;

      if (["rejected", "cancelled"].includes(newStatus)) {
        const confirmed = confirm(
          `Change this order to ${statusText(newStatus)}? ` +
          "Its ordered stock will be returned to inventory."
        );

        if (!confirmed) return;
      }

      await updateOrder(order, newStatus, null);
    };
  }

  const paidButton = document.getElementById("markOrderPaid");

  if (paidButton) {
    paidButton.onclick = async () => {
      const confirmed = confirm(
        "Confirm that cash has been received for this order?"
      );

      if (!confirmed) return;

      await updateOrder(order, order.order_status, "paid");
    };
  }
}

/* =========================================
   UPDATE ORDER THROUGH SECURE RPC
========================================= */

async function updateOrder(order, newStatus, newPaymentStatus) {
  const saveButton = document.getElementById("saveOrderStatus");
  const paidButton = document.getElementById("markOrderPaid");

  if (saveButton) saveButton.disabled = true;
  if (paidButton) paidButton.disabled = true;

  try {
    const { error } = await supabase.rpc(
      "admin_update_customer_order",
      {
        p_order_id: order.id,
        p_order_status: newStatus,
        p_payment_status: newPaymentStatus,
      }
    );

    if (error) throw error;

    await loadCustomerAndOrderData();

    renderOrderRows();
    await renderOrderDetails();

    notify("Order updated successfully.");
  } catch (error) {
    console.error("Order update error:", error);

    notify("Could not update order: " + error.message);

    if (saveButton) saveButton.disabled = false;
    if (paidButton) paidButton.disabled = false;
  }
}

/* =========================================
   REFRESH AND INITIALIZE CUSTOMER PAGE
========================================= */

async function refreshCustomerData() {
  try {
    await loadCustomerAndOrderData();

    notify("Customer and order data refreshed.");
  } catch (error) {
    console.error("Customer data loading error:", error);

    notify("Unable to load data: " + error.message);
  }
}

async function loadCustomerManagement() {
  try {
    await loadCustomerAndOrderData();

    renderCustomerManagement();
  } catch (error) {
    console.error("Customer management loading error:", error);

    content.innerHTML = `
      <section class="card panel">
        <h2>Unable to load Customer Management</h2>

        <p>${safeText(error.message)}</p>

        <button class="soft" id="retryCustomerLoad">
          Try Again
        </button>
      </section>
    `;

    document.getElementById("retryCustomerLoad").onclick =
      loadCustomerManagement;
  }
}

/* =========================================
   OPEN PAGE FROM URL HASH
========================================= */

if (location.hash && labels[location.hash.slice(1)]) {
  navigate(location.hash.slice(1));
}


/* =========================================
   ORGANIZATION CUSTOMER MANAGEMENT
========================================= */

let organizationCustomers = [];
let selectedOrganizationCustomerId = null;

async function loadOrganizationCustomerManagement() {
  title.textContent = "Customer Management";

  content.innerHTML = `
    <div class="sectiontitle">
      <div>
        <h2>Customer Accounts & Ledgers</h2>
        <p>Manage individual and business customers.</p>
      </div>

      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="soft" id="openOrderManagement">
          View Order Management
        </button>
        <button class="outline" id="refreshOrganizationCustomers">
          ↻ Refresh
        </button>
        <button class="soft" id="addOrganizationCustomer">
          + Add Customer
        </button>
      </div>
    </div>

    <section class="grid"
      style="grid-template-columns:minmax(0,1.6fr) minmax(280px,1fr);align-items:stretch">

      <article class="card panel">
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:15px">
          <input id="organizationCustomerSearch"
            placeholder="Search customers..."
            style="max-width:240px;margin:0;padding:9px 11px;border:1px solid #e5e1d8;border-radius:7px;background:#fff;font:12px DM Sans">

<select id="organizationCustomerTypeFilter"
  style="padding:9px 11px;border:1px solid #e5e1d8;
  border-radius:7px;background:#fff;font:12px DM Sans">

  <option value="all">Type: All</option>
  <option value="individual">Individual</option>
  <option value="business">Business</option>
</select>

          <span class="count" id="organizationCustomerCount">
            Loading...
          </span>
        </div>

        <div class="tablewrap" style="margin-top:0">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>CUSTOMER NAME</th>
                <th>TYPE</th>
                <th>TOTAL SPENT</th>
                <th>STATUS</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="organizationCustomerRows">
              <tr><td colspan="6">Loading customers...</td></tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="card panel">
        <div class="panelhead">
          <div>
            <h3 id="organizationCustomerDetailsTitle">Customer Details</h3>
            <p id="organizationCustomerDetailsSubtitle">
              Select a customer or add a new one.
            </p>
          </div>
        </div>

        <div id="organizationCustomerDetails" style="margin-top:18px">
          <p style="color:#85877e">
            Customer information will appear here.
          </p>
        </div>
      </article>
    </section>
  `;

  document.getElementById("openOrderManagement").onclick = () => {
    selectedCustomerId = null;
    selectedOrderId = null;
    renderOrderManagement();
  };

  document.getElementById("refreshOrganizationCustomers").onclick =
    loadOrganizationCustomerManagement;

  document.getElementById("addOrganizationCustomer").onclick =
    () => showOrganizationCustomerForm(null);

  document.getElementById("organizationCustomerSearch").oninput =
    renderOrganizationCustomerRows;
  
  document.getElementById("organizationCustomerTypeFilter").onchange =
  renderOrganizationCustomerRows;

  await fetchOrganizationCustomers();

  renderOrganizationCustomerRows();

  if (selectedOrganizationCustomerId) {
    renderOrganizationCustomerDetails();
  }
}

function getOrganizationCustomerPaidTotal(customer) {
  if (!customer.auth_user_id) return 0;

  return orders
    .filter((order) => {
      return (
        order.customer_id === customer.auth_user_id &&
        order.payment_status === "paid"
      );
    })
    .reduce((total, order) => {
      return total + Number(order.total_amount || 0);
    }, 0);
}

async function fetchOrganizationCustomers() {
  const { data: customerData, error: customerError } =
    await supabase
      .from("organization_customers")
      .select(`
        id,
        organization_id,
        auth_user_id,
        customer_type,
        full_name,
        business_name,
        email,
        phone,
        address,
        status,
        notes,
        created_at
      `)
      .eq("organization_id", ORG_ID)
      .order("created_at", { ascending: false });

  if (customerError) {
    console.error("Customer loading error:", customerError);
    notify("Unable to load customers: " + customerError.message);
    return;
  }

  const { data: orderData, error: orderError } =
    await supabase
      .from("customer_orders")
      .select(`
        id,
        customer_id,
        total_amount,
        payment_status,
        order_status
      `)
      .eq("organization_id", ORG_ID);

  if (orderError) {
    console.error("Order loading error:", orderError);
    notify("Unable to load customer orders: " + orderError.message);
    return;
  }

  organizationCustomers = customerData || [];
  orders = orderData || [];
}

function renderOrganizationCustomerRows() {
  const tbody = document.getElementById("organizationCustomerRows");
  const count = document.getElementById("organizationCustomerCount");
  const search = document.getElementById("organizationCustomerSearch");

  if (!tbody || !count || !search) return;

const term = search.value.trim().toLowerCase();

const typeFilter = document.getElementById(
  "organizationCustomerTypeFilter"
).value;

const filtered = organizationCustomers.filter((customer) => {
  const matchesSearch = [
    customer.full_name,
    customer.business_name,
    customer.email,
    customer.phone,
    customer.customer_type,
  ].some((value) =>
    String(value || "").toLowerCase().includes(term)
  );

  const matchesType =
    typeFilter === "all" ||
    customer.customer_type === typeFilter;

  return matchesSearch && matchesType;
});

  count.textContent = `${filtered.length} customers`;
  tbody.replaceChildren();

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">No customers found. Click Add Customer to create one.</td>
      </tr>
    `;
    return;
  }

  filtered.forEach((customer) => {
    const row = document.createElement("tr");

    if (customer.id === selectedOrganizationCustomerId) {
      row.style.background = "#e8f5eb";
    }

row.innerHTML = `
  <td class="ref">${safeText(customer.id.slice(0, 8).toUpperCase())}</td>
  <td>${safeText(customer.business_name || customer.full_name)}</td>
  <td>${safeText(customer.customer_type)}</td>
  <td>${money(getOrganizationCustomerPaidTotal(customer))}</td>
  <td>
    <span class="${customer.status === "active" ? "tag" : "pending"}">
      ${safeText(customer.status)}
    </span>
  </td>
  <td>
    <button class="link" data-customer-edit="${safeText(customer.id)}">
      Edit
    </button>
  </td>
`;

    row.style.cursor = "pointer";
    row.addEventListener("click", (event) => {
      if (event.target.closest("[data-customer-edit]")) return;

      selectedOrganizationCustomerId = customer.id;
      renderOrganizationCustomerRows();
      renderOrganizationCustomerDetails();
    });

    tbody.appendChild(row);
  });

  tbody.querySelectorAll("[data-customer-edit]").forEach((button) => {
    button.onclick = (event) => {
      event.stopPropagation();

      const customer = organizationCustomers.find(
        (item) => item.id === button.dataset.customerEdit
      );

      if (customer) showOrganizationCustomerForm(customer);
    };
  });
}

function renderOrganizationCustomerDetails() {
  const container = document.getElementById("organizationCustomerDetails");
  const customer = organizationCustomers.find(
    (item) => item.id === selectedOrganizationCustomerId
  );

  if (!container) return;

  if (!customer) {
    container.textContent = "Select a customer to view details.";
    return;
  }

  document.getElementById("organizationCustomerDetailsTitle").textContent =
    customer.business_name || customer.full_name;

  document.getElementById("organizationCustomerDetailsSubtitle").textContent =
    customer.customer_type === "business"
      ? "Business Account"
      : "Individual Account";

  container.innerHTML = `
    <p><b>Customer Name:</b><br>${safeText(customer.full_name)}</p>
    <p><b>Business Name:</b><br>${safeText(customer.business_name || "—")}</p>
    <p><b>Email:</b><br>${safeText(customer.email || "—")}</p>
    <p><b>Contact Number:</b><br>${safeText(customer.phone || "—")}</p>
    <p><b>Address:</b><br>${safeText(customer.address || "—")}</p>
    <p><b>Status:</b> ${safeText(customer.status)}</p>
    <p><b>Notes:</b><br>${safeText(customer.notes || "—")}</p>
    <p style="font-size:11px;color:#85877e">
      Customer since: ${dateText(customer.created_at)}
    </p>
    <button class="soft full" id="editSelectedOrganizationCustomer">
      Edit Customer
    </button>
  `;

  document.getElementById("editSelectedOrganizationCustomer").onclick =
    () => showOrganizationCustomerForm(customer);
}

function showOrganizationCustomerForm(customer) {
  const container = document.getElementById("organizationCustomerDetails");

  if (!container) return;

  const editing = Boolean(customer);

  document.getElementById("organizationCustomerDetailsTitle").textContent =
    editing ? "Edit Customer" : "Add Customer";

  document.getElementById("organizationCustomerDetailsSubtitle").textContent =
    "Enter customer information.";

  container.innerHTML = `
    <form id="organizationCustomerForm">
      <label class="auth-label">Customer Type</label>
      <select class="auth-input" id="orgCustomerType" required>
        <option value="individual">Individual</option>
        <option value="business">Business</option>
      </select>

      <label class="auth-label">Customer Name</label>
      <input class="auth-input" id="orgCustomerName"
        value="${safeText(customer?.full_name || "")}" required>

      <label class="auth-label">Business Name (if business)</label>
      <input class="auth-input" id="orgCustomerBusiness"
        value="${safeText(customer?.business_name || "")}">

      <label class="auth-label">Email</label>
      <input class="auth-input" id="orgCustomerEmail" type="email"
        value="${safeText(customer?.email || "")}">

      <label class="auth-label">Phone</label>
      <input class="auth-input" id="orgCustomerPhone"
        value="${safeText(customer?.phone || "")}">

      <label class="auth-label">Address</label>
      <textarea class="auth-input" id="orgCustomerAddress" rows="2">${safeText(customer?.address || "")}</textarea>

      <label class="auth-label">Status</label>
      <select class="auth-input" id="orgCustomerStatus">
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>

      <label class="auth-label">Notes</label>
      <textarea class="auth-input" id="orgCustomerNotes" rows="3">${safeText(customer?.notes || "")}</textarea>

      <button class="soft full" type="submit" style="margin-top:12px">
        ${editing ? "Save Changes" : "Create Customer"}
      </button>

      <button class="outline full" type="button" id="cancelOrgCustomerForm"
        style="margin-top:8px">
        Cancel
      </button>

      <p id="orgCustomerFormMessage" class="auth-message" role="status"></p>
    </form>
  `;

  document.getElementById("orgCustomerType").value =
    customer?.customer_type || "individual";

  document.getElementById("orgCustomerStatus").value =
    customer?.status || "active";

  document.getElementById("cancelOrgCustomerForm").onclick = () => {
    if (customer) {
      renderOrganizationCustomerDetails();
    } else {
      document.getElementById("organizationCustomerDetailsTitle").textContent =
        "Customer Details";

      document.getElementById("organizationCustomerDetailsSubtitle").textContent =
        "Select a customer or add a new one.";

      container.innerHTML = `
        <p style="color:#85877e">Customer information will appear here.</p>
      `;
    }
  };

  document.getElementById("organizationCustomerForm").onsubmit =
    async (event) => {
      event.preventDefault();

      const message = document.getElementById("orgCustomerFormMessage");
      const submit = event.target.querySelector('[type="submit"]');

      submit.disabled = true;
      message.textContent = "Saving customer...";

      try {
        const { data: userResult, error: userError } =
          await supabase.auth.getUser();

        if (userError) throw userError;

        const user = userResult.user;

        if (!user) throw new Error("Please sign in again.");

        const customerType =
          document.getElementById("orgCustomerType").value;

        const fullName =
          document.getElementById("orgCustomerName").value.trim();

        const businessName =
          document.getElementById("orgCustomerBusiness").value.trim();

        if (!fullName) {
          throw new Error("Customer name is required.");
        }

        if (customerType === "business" && !businessName) {
          throw new Error("Please enter the business name.");
        }

        const payload = {
          organization_id: ORG_ID,
          customer_type: customerType,
          full_name: fullName,
          business_name: businessName || null,
          email: document.getElementById("orgCustomerEmail").value.trim() || null,
          phone: document.getElementById("orgCustomerPhone").value.trim() || null,
          address: document.getElementById("orgCustomerAddress").value.trim() || null,
          status: document.getElementById("orgCustomerStatus").value,
          notes: document.getElementById("orgCustomerNotes").value.trim() || null,
        };

        let result;

        if (editing) {
          result = await supabase
            .from("organization_customers")
            .update(payload)
            .eq("id", customer.id)
            .eq("organization_id", ORG_ID);
        } else {
          payload.created_by = user.id;

          result = await supabase
            .from("organization_customers")
            .insert(payload);
        }

        if (result.error) throw result.error;

        selectedOrganizationCustomerId = customer?.id || null;

        await fetchOrganizationCustomers();

        if (!editing) {
          const newest = organizationCustomers[0];
          selectedOrganizationCustomerId = newest?.id || null;
        }

        renderOrganizationCustomerRows();

        if (selectedOrganizationCustomerId) {
          renderOrganizationCustomerDetails();
        } else {
          showOrganizationCustomerForm(null);
        }

        notify(editing ? "Customer updated." : "Customer created.");
      } catch (error) {
        console.error("Customer save error:", error);
        message.textContent = error.message || "Could not save customer.";
        submit.disabled = false;
      }
    };
}
