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

  

async function renderInventoryPage() {
  content.innerHTML =
    "<div class='inventory-bi-heading'><div><span class='reports-kicker'>WAREHOUSE &amp; STOCK OPERATIONS</span><h2>Inventory Management</h2><p>Monitor product quantities and stock availability</p></div><button class='reports-refresh' id='inventoryRefresh'>↻ Refresh Stock</button></div>" +
    "<section class='grid inventory-bi-kpis'>" +
      "<article class='card stat'><div>Total Items</div><strong id='inventoryTotalItems'>—</strong><small>Total quantity across active products</small></article>" +
      "<article class='card stat'><div>In Stock</div><strong id='inventoryAvailableItems'>—</strong><small>Quantity available</small></article>" +
      "<article class='card stat'><div>Low Stock Alerts</div><strong id='inventoryLowAlerts'>—</strong><small>Products need restocking</small></article>" +
      "<article class='card stat'><div>Out of Stock</div><strong id='inventoryOutAlerts'>—</strong><small>Products with zero quantity</small></article>" +
    "</section>" +
    "<div class='inventory-bi-layout'>" +
      "<section class='card inventory-ledger'><div class='inventory-section-heading'><div><h3>Master Stock Ledger</h3><p>Current stock across active product catalog</p></div><span id='inventoryLedgerCount'>— products</span></div>" +
      "<div class='inventory-ledger-tools'><input id='inventorySearch' type='search' placeholder='Search product or SKU...' aria-label='Search products'><select id='inventoryFilter' aria-label='Filter stock status'><option value='all'>All Stock Status</option><option value='in'>In Stock</option><option value='low'>Low Stock</option><option value='out'>Out of Stock</option></select></div>" +
      "<div class='tablewrap'><table><thead><tr><th>PROD ID</th><th>PRODUCT NAME</th><th>CATEGORY</th><th>STOCK</th><th>STATUS</th></tr></thead><tbody id='inventoryRows'><tr><td colspan='5'>Loading stock ledger...</td></tr></tbody></table></div>" +
      "<p class='inventory-ledger-note'>Stock quantities shown here are read directly from your live products table.</p></section>" +
      "<aside class='inventory-adjust-column'><section class='card inventory-stock-link'><button type='button' id='inventoryStockView'>View Stock-In / Stock-Out</button></section>" +
      "<section class='card inventory-adjust-card'><div class='inventory-section-heading'><div><h3>Quick Stock Adjustment</h3><p>Prepare an inventory movement</p></div></div>" +
      "<form id='inventoryAdjustForm'><label>Target Product<select id='inventoryAdjustProduct' required><option value=''>Select a product</option></select></label>" +
      "<label>Adjustment Operation<select id='inventoryAdjustOperation' required><option value='in'>Stock In (Restock)</option><option value='out'>Stock Out (Remove)</option></select></label>" +
      "<label>Quantity to Adjust<input id='inventoryAdjustQuantity' type='number' min='1' step='1' placeholder='Enter quantity' required></label>" +
      "<label>Reason Code<select id='inventoryAdjustReason' required><option value=''>Select reason</option><option>Purchase / Restock Delivery</option><option>Damage / Expired</option><option>Return to Supplier</option><option>Correction / Physical Count</option><option>Other</option></select></label>" +
      "<label>Reference Number / PO<input id='inventoryAdjustReference' type='text' maxlength='80' placeholder='e.g. PO-2026-102'></label>" +
      "<label>Log Notes<textarea id='inventoryAdjustNotes' rows='3' maxlength='500' placeholder='Describe details about adjustment...'></textarea></label>" +
      "<button class='inventory-adjust-submit' type='submit'>Apply Adjustment</button><p class='inventory-adjust-safety'>Adjustment saving will be enabled after the stock movement ledger and secure database transaction are connected.</p></form></section></aside>" +
    "</div>";

  const refreshButton = document.getElementById("inventoryRefresh");
  const searchInput = document.getElementById("inventorySearch");
  const filterSelect = document.getElementById("inventoryFilter");
  const productSelect = document.getElementById("inventoryAdjustProduct");
  let products = [];

  const stockType = product => {
    const qty = Number(product.stock_quantity || 0);
    return qty <= 0 ? "out" : qty <= 10 ? "low" : "in";
  };
  const statusLabel = type => type === "out" ? "Out of Stock" : type === "low" ? "Low Stock" : "In Stock";

  function drawInventoryRows() {
    const query = searchInput.value.trim().toLowerCase();
    const filter = filterSelect.value;
    const filtered = products.filter(product => {
      const matchesQuery = (product.product_name || "").toLowerCase().includes(query) ||
        (product.product_code || "").toLowerCase().includes(query);
      return matchesQuery && (filter === "all" || stockType(product) === filter);
    });
    document.getElementById("inventoryLedgerCount").textContent = filtered.length + " products";
    document.getElementById("inventoryRows").innerHTML = filtered.length
      ? filtered.map(product => {
          const type = stockType(product);
          const qty = Number(product.stock_quantity || 0);
          return "<tr class='inventory-ledger-row " + type + "'><td>" + safeText(product.product_code || "—") +
            "</td><td><strong>" + safeText(product.product_name || "Unnamed product") + "</strong></td><td>" +
            safeText(product.category || product.unit || "General") + "</td><td><strong>" + qty.toLocaleString("en-PH") +
            " " + safeText(product.unit || "Unit") + "</strong></td><td><span class='inventory-status " + type + "'>" +
            statusLabel(type) + "</span></td></tr>";
        }).join("")
      : "<tr><td colspan='5'>No products match your search.</td></tr>";
  }

  async function loadInventory() {
    refreshButton.disabled = true;
    refreshButton.textContent = "Loading...";
    try {
      products = await fetchDashboardProducts();
      const totalItems = products.reduce((sum, product) => sum + Math.max(0, Number(product.stock_quantity || 0)), 0);
      const availableItems = products.filter(product => stockType(product) === "in")
        .reduce((sum, product) => sum + Number(product.stock_quantity || 0), 0);
      const low = products.filter(product => stockType(product) === "low").length;
      const out = products.filter(product => stockType(product) === "out").length;
      document.getElementById("inventoryTotalItems").textContent = totalItems.toLocaleString("en-PH");
      document.getElementById("inventoryAvailableItems").textContent = availableItems.toLocaleString("en-PH");
      document.getElementById("inventoryLowAlerts").textContent = low.toLocaleString("en-PH") + " items";
      document.getElementById("inventoryOutAlerts").textContent = out.toLocaleString("en-PH") + " items";
      productSelect.innerHTML = "<option value=''>Select a product</option>" + products.map(product =>
        "<option value='" + safeText(product.id) + "'>" + safeText((product.product_code || "SKU") + " — " + (product.product_name || "Product")) + "</option>"
      ).join("");
      drawInventoryRows();
    } catch (error) {
      console.error("Inventory loading error:", error);
      document.getElementById("inventoryRows").innerHTML =
        "<tr><td colspan='5'>Unable to load inventory. Please refresh or check your connection.</td></tr>";
      notify("Unable to load inventory: " + (error.message || "Unknown error"));
    } finally {
      refreshButton.disabled = false;
      refreshButton.textContent = "↻ Refresh Stock";
    }
  }

  searchInput.addEventListener("input", drawInventoryRows);
  filterSelect.addEventListener("change", drawInventoryRows);
  refreshButton.onclick = loadInventory;
  document.getElementById("inventoryStockView").onclick = () =>
    notify("Stock-In / Stock-Out history will be available after the stock movement ledger is connected.");
  document.getElementById("inventoryAdjustForm").addEventListener("submit", event => {
    event.preventDefault();
    const product = products.find(item => item.id === productSelect.value);
    const quantity = Number(document.getElementById("inventoryAdjustQuantity").value);
    const operation = document.getElementById("inventoryAdjustOperation").value;
    if (!product || !Number.isInteger(quantity) || quantity < 1) {
      notify("Select a product and enter a valid whole-number quantity.");
      return;
    }
    if (operation === "out" && quantity > Number(product.stock_quantity || 0)) {
      notify("Cannot stock out more than the current available quantity.");
      return;
    }
    notify("Adjustment form validated. Saving is not enabled yet; stock has not been changed.");
  });
  await loadInventory();
}

document.querySelectorAll(".nav").forEach((nav) => {
    nav.classList.toggle("active", nav.dataset.page === page);
  });

  title.textContent = labels[page];

  if (page === "dashboard") {
    location.hash = "";
    location.reload();
    return;
  }

  if (page === "inventory") {
    location.hash = "inventory";
    document.getElementById("sidebar").classList.remove("open");
    renderInventoryPage();
    return;
  }

  if (page === "reports") {
    location.hash = "reports";
    document.getElementById("sidebar").classList.remove("open");
    renderReportsPage();
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



async function renderReportsPage() {
  content.innerHTML =
    "<div class='reports-heading'><div><span class='reports-kicker'>BUSINESS INTELLIGENCE</span><h2>Reports &amp; Analytics</h2><p>Live performance overview for Farm Supplies &amp; Equipment</p></div><button class='reports-export' id='reportExport'>Export Report ↓</button></div>" +
    "<nav class='reports-tabs'><button class='reports-tab active' data-report-tab='sales'>Sales Reports</button><button class='reports-tab' data-report-tab='inventory'>Inventory Reports</button><button class='reports-tab' data-report-tab='products'>Product Performance</button><button class='reports-tab' data-report-tab='customers'>Customer Insights</button></nav>" +
    "<section class='grid reports-kpis' style='grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:16px'>" +
      "<article class='card stat'><div>Paid Sales <span class='ico green'>₱</span></div><strong id='reportPaidSales'>Loading...</strong><small>Paid, non-cancelled orders</small></article>" +
      "<article class='card stat'><div>Orders <span class='ico blue'>▤</span></div><strong id='reportOrderCount'>—</strong><small>Orders in selected period</small></article>" +
      "<article class='card stat'><div>Average Order Value <span class='ico gold'>↗</span></div><strong id='reportAverageOrder'>—</strong><small>Paid sales per paid order</small></article>" +
      "<article class='card stat reports-top-performer'><div>Top Performer <span class='ico green'>★</span></div><strong id='reportTopProduct'>Loading...</strong><small id='reportTopProductSales'>Highest sales by product</small></article>" +
    "</section>" +
    "<section class='card panel reports-panel' data-report-panel='sales' style='margin-bottom:16px'>" +
      "<div class='panelhead'><div><h3>Monthly Sales Report</h3><p>Paid order totals by month</p></div>" +
      "<select id='reportPeriod'><option value='6'>Last 6 months</option><option value='12'>Last 12 months</option></select></div>" +
      "<div class='reports-sales-chart' id='reportSalesChart'></div><div class='tablewrap'><table><thead><tr><th>MONTH</th><th>ORDERS</th><th>PAID SALES</th></tr></thead><tbody id='reportSalesRows'><tr><td colspan='3'>Loading report...</td></tr></tbody></table></div>" +
    "</section>" +
    "<section class='card panel reports-panel' data-report-panel='inventory'>" +
      "<div class='panelhead'><div><h3>Inventory &amp; Reorder Report</h3><p>Active products with 10 or fewer units</p></div><span class='count' id='reportStockCount'>—</span></div>" +
      "<div class='tablewrap'><table><thead><tr><th>PRODUCT</th><th>SKU</th><th>STOCK</th><th>UNIT</th><th>STOCK VALUE</th></tr></thead><tbody id='reportStockRows'><tr><td colspan='5'>Loading inventory...</td></tr></tbody></table></div>" +
    "</section>" +
    "<section class='card panel reports-panel' data-report-panel='products' hidden><div class='panelhead'><div><h3>Product Performance</h3><p>Top products by current stock value</p></div></div><div class='tablewrap'><table><thead><tr><th>PRODUCT</th><th>SKU</th><th>PRICE</th><th>STOCK</th><th>STOCK VALUE</th></tr></thead><tbody id='reportProductRows'></tbody></table></div></section>" +
    "<section class='card panel reports-panel' data-report-panel='customers' hidden><div class='panelhead'><div><h3>Customer Insights</h3><p>Order activity in the selected period (customer IDs masked)</p></div></div><div class='tablewrap'><table><thead><tr><th>CUSTOMER</th><th>ORDERS</th><th>ORDER TOTAL</th><th>PAID SALES</th></tr></thead><tbody id='reportCustomerRows'></tbody></table></div></section>" +
    "<button class='soft' id='reportRefresh' style='margin-top:14px'>↻ Refresh Reports</button>";

  const period = document.getElementById("reportPeriod");
  const refresh = document.getElementById("reportRefresh");
  const start = new Date(new Date().getFullYear() - 1, 0, 1);

  try {
    const results = await Promise.all([
      fetchDashboardProducts(),
      fetchDashboardOrders(start)
    ]);
    const products = results[0] || [];
    const orders = results[1] || [];
    const paid = orders.filter(order =>
      order.payment_status === "paid" &&
      !["cancelled", "rejected"].includes(order.order_status)
    );
    const paidSalesTotal = paid.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
    document.getElementById("reportPaidSales").textContent = money(paidSalesTotal);
    document.getElementById("reportAverageOrder").textContent =
      money(paid.length ? paidSalesTotal / paid.length : 0);

    const topName = document.getElementById("reportTopProduct");
    const topSales = document.getElementById("reportTopProductSales");
    if (paid.length) {
      const { data: soldItems, error: soldItemsError } = await supabase
        .from("customer_order_items")
        .select("order_id, product_name, quantity, subtotal")
        .in("order_id", paid.map(order => order.id))
        .limit(10000);
      if (soldItemsError) {
        console.warn("Top performer report could not load order items:", soldItemsError);
        topName.textContent = "Unavailable";
        topSales.textContent = "Could not load item sales";
      } else {
        const productSales = {};
        (soldItems || []).forEach(item => {
          const name = item.product_name || "Unnamed product";
          if (!productSales[name]) productSales[name] = { revenue: 0, quantity: 0 };
          productSales[name].revenue += Number(item.subtotal || 0);
          productSales[name].quantity += Number(item.quantity || 0);
        });
        const top = Object.entries(productSales).sort((x, y) => y[1].revenue - x[1].revenue)[0];
        if (top) {
          topName.textContent = top[0];
          topName.title = top[0];
          topSales.textContent = money(top[1].revenue) + " sales · " + top[1].quantity + " sold";
        } else {
          topName.textContent = "No sales yet";
          topSales.textContent = "No item sales recorded";
        }
      }
    } else {
      topName.textContent = "No sales yet";
      topSales.textContent = "No paid orders recorded";
    }

    function drawMonthlyRows() {
      const months = Number(period.value || 6);
      const now = new Date();
      const firstMonth = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
      const relevantOrders = orders.filter(order => new Date(order.created_at) >= firstMonth);
      document.getElementById("reportOrderCount").textContent =
        relevantOrders.length.toLocaleString("en-PH");

      const rows = [];
      const chartData = [];
      for (let offset = months - 1; offset >= 0; offset -= 1) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
        const monthOrders = paid.filter(order => {
          const created = new Date(order.created_at);
          return created >= monthStart && created < monthEnd;
        });
        const total = monthOrders.reduce((sum, order) =>
          sum + Number(order.total_amount || 0), 0);
        chartData.push({ label: monthStart.toLocaleDateString("en-PH", { month: "short" }), total });
        rows.push("<tr><td>" +
          safeText(monthStart.toLocaleDateString("en-PH", { month: "long", year: "numeric" })) +
          "</td><td>" + monthOrders.length.toLocaleString("en-PH") +
          "</td><td>" + safeText(money(total)) + "</td></tr>");
      }
      document.getElementById("reportSalesRows").innerHTML = rows.join("");
      const chartMax = Math.max(1, ...chartData.map(item => item.total));
      document.getElementById("reportSalesChart").innerHTML = chartData.map(item =>
        "<div class='reports-chart-column' title='" + safeText(item.label + ": " + money(item.total)) +
        "'><b>" + safeText(compactPeso(item.total)) + "</b><i style='height:" +
        Math.max(item.total > 0 ? 4 : 0, item.total / chartMax * 100) +
        "%'></i><small>" + safeText(item.label) + "</small></div>").join("");
    }

    const restock = products.filter(product => Number(product.stock_quantity) <= 10)
      .sort((a, b) => Number(a.stock_quantity) - Number(b.stock_quantity));
    document.getElementById("reportStockCount").textContent = restock.length + " products";
    document.getElementById("reportStockRows").innerHTML = restock.length
      ? restock.map(product => {
          const quantity = Number(product.stock_quantity || 0);
          const value = Number(product.price || 0) * quantity;
          return "<tr><td>" + safeText(product.product_name || "Product") +
            "</td><td>" + safeText(product.product_code || "—") +
            "</td><td><span class='" + (quantity === 0 ? "danger" : "warn") +
            "'>" + quantity + "</span></td><td>" +
            safeText(product.unit || "Unit") + "</td><td>" +
            safeText(money(value)) + "</td></tr>";
        }).join("")
      : "<tr><td colspan='5'>No products need restocking.</td></tr>";

    const topProducts = products.slice().sort((x, y) =>
      Number(y.price || 0) * Number(y.stock_quantity || 0) -
      Number(x.price || 0) * Number(x.stock_quantity || 0)).slice(0, 15);
    document.getElementById("reportProductRows").innerHTML = topProducts.map(product =>
      "<tr><td>" + safeText(product.product_name || "Product") + "</td><td>" +
      safeText(product.product_code || "—") + "</td><td>" + safeText(money(product.price)) +
      "</td><td>" + Number(product.stock_quantity || 0) + " " + safeText(product.unit || "") +
      "</td><td>" + safeText(money(Number(product.price || 0) * Number(product.stock_quantity || 0))) +
      "</td></tr>").join("");
    const customerSummary = {};
    orders.forEach(order => {
      const id = order.customer_id || "Unknown";
      if (!customerSummary[id]) customerSummary[id] = { count: 0, total: 0, paid: 0 };
      customerSummary[id].count++;
      customerSummary[id].total += Number(order.total_amount || 0);
      if (order.payment_status === "paid" && !["cancelled", "rejected"].includes(order.order_status))
        customerSummary[id].paid += Number(order.total_amount || 0);
    });
    document.getElementById("reportCustomerRows").innerHTML =
      Object.entries(customerSummary).sort((x, y) => y[1].total - x[1].total).slice(0, 20).map(([id, row]) =>
        "<tr><td>" + safeText(id === "Unknown" ? id : id.slice(0, 8) + "…") +
        "</td><td>" + row.count + "</td><td>" + safeText(money(row.total)) +
        "</td><td>" + safeText(money(row.paid)) + "</td></tr>").join("") ||
      "<tr><td colspan='4'>No customer orders found.</td></tr>";
    document.querySelectorAll("[data-report-tab]").forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll("[data-report-tab]").forEach(item => item.classList.toggle("active", item === tab));
        document.querySelectorAll("[data-report-panel]").forEach(panel => {
          panel.hidden = panel.dataset.reportPanel !== tab.dataset.reportTab;
        });
      };
    });
    const exportButton = document.getElementById("reportExport");
    if (exportButton) exportButton.onclick = () => {
      const rows = [["Month", "Paid Orders", "Paid Sales"]];
      const months = Number(period.value || 6);
      const now = new Date();
      for (let offset = months - 1; offset >= 0; offset--) {
        const from = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        const to = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
        const monthOrders = paid.filter(order => new Date(order.created_at) >= from && new Date(order.created_at) < to);
        rows.push([from.toLocaleDateString("en-PH", {month:"long",year:"numeric"}), monthOrders.length,
          monthOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0).toFixed(2)]);
      }
      const csv = "\uFEFF" + rows.map(row => row.map(value => '"' + String(value).replace(/"/g, '""') + '"' ).join(",")).join("\r\n");
      const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = "farm-supplies-sales-report.csv"; document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    drawMonthlyRows();
    period.onchange = drawMonthlyRows;
    refresh.onclick = () => renderReportsPage();
  } catch (error) {
    console.error("Reports loading error:", error);
    notify("Unable to load reports: " + error.message);
    document.getElementById("reportSalesRows").innerHTML =
      "<tr><td colspan='3'>Report data could not be loaded.</td></tr>";
    document.getElementById("reportStockRows").innerHTML =
      "<tr><td colspan='5'>Inventory data could not be loaded.</td></tr>";
    refresh.onclick = () => renderReportsPage();
  }
}

let dashboardProducts = [];
let dashboardOrders = [];
let dashboardCustomers = [];

async function fetchDashboardProducts() {
  const size = 500;
  let rows = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase.from("products")
      .select("id, product_code, product_name, price, stock_quantity, unit")
      .eq("organization_id", ORG_ID).eq("is_active", true)
      .order("stock_quantity", { ascending: true })
      .range(from, from + size - 1);
    if (error) throw error;
    rows = rows.concat(data || []);
    if (!data || data.length < size) break;
  }
  return rows;
}

async function fetchDashboardOrders(startDate) {
  const size = 500;
  let rows = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase.from("customer_orders")
      .select("id, order_number, customer_id, total_amount, order_status, payment_status, created_at")
      .eq("organization_id", ORG_ID)
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: false })
      .range(from, from + size - 1);
    if (error) throw error;
    rows = rows.concat(data || []);
    if (!data || data.length < size) break;
  }
  return rows;
}

async function loadDashboardData() {
  const previousYearStart = new Date(new Date().getFullYear() - 1, 0, 1);
  const results = await Promise.all([
    fetchDashboardProducts(),
    supabase.from("organization_customers")
      .select("auth_user_id, full_name, business_name")
      .eq("organization_id", ORG_ID),
    fetchDashboardOrders(previousYearStart)
  ]);
  if (results[1].error) throw results[1].error;
  dashboardProducts = results[0] || [];
  dashboardCustomers = results[1].data || [];
  dashboardOrders = results[2] || [];
  renderDashboardSummary();
  renderDashboardSales();
  renderDashboardRecentOrders();
  renderDashboardLowStock();
}

function isDashboardPaidSale(order) {
  return order.payment_status === "paid" &&
    !["cancelled", "rejected"].includes(order.order_status);
}

function renderDashboardSummary() {
  const total = dashboardProducts.length;
  const inStock = dashboardProducts.filter(p => Number(p.stock_quantity) > 10).length;
  const lowStock = dashboardProducts.filter(p =>
    Number(p.stock_quantity) > 0 && Number(p.stock_quantity) <= 10
  ).length;
  const outOfStock = dashboardProducts.filter(p => Number(p.stock_quantity) <= 0).length;
  const inventoryValue = dashboardProducts.reduce((sum, p) =>
    sum + Number(p.price || 0) * Number(p.stock_quantity || 0), 0);

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const todaySales = dashboardOrders.filter(order => {
    const created = new Date(order.created_at);
    return isDashboardPaidSale(order) && created >= start && created < end;
  }).reduce((sum, order) => sum + Number(order.total_amount || 0), 0);

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  setText("totalProductsValue", total.toLocaleString("en-PH"));
  setText("inventoryValueValue", money(inventoryValue));
  setText("todaySalesValue", money(todaySales));
  setText("lowStockValue", lowStock.toLocaleString("en-PH"));
  setText("inventoryTotalValue", total.toLocaleString("en-PH"));
  setText("inventoryInStock", inStock.toLocaleString("en-PH"));
  setText("inventoryLowStock", lowStock.toLocaleString("en-PH"));
  setText("inventoryOutStock", outOfStock.toLocaleString("en-PH"));

  const donut = document.getElementById("inventoryDonut");
  if (donut) {
    if (!total) {
      donut.style.background = "conic-gradient(#e5e1d8 0 100%)";
    } else {
      const a = inStock / total * 100;
      const b = a + lowStock / total * 100;
      donut.style.background = "conic-gradient(#397b55 0 " + a +
        "%,#e6bd59 " + a + "% " + b + "%,#d97970 " + b + "% 100%)";
    }
  }
}

function compactPeso(value) {
  const n = Number(value || 0);
  if (n >= 1000000) return "₱" + (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return "₱" + (n / 1000).toFixed(0) + "k";
  return "₱" + Math.round(n).toLocaleString("en-PH");
}

function dashboardSalesBetween(start, end) {
  return dashboardOrders.filter(order => {
    const created = new Date(order.created_at);
    return isDashboardPaidSale(order) && created >= start && created < end;
  }).reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
}

function renderDashboardSales() {
  const select = document.getElementById("period");
  const bars = document.getElementById("salesBars");
  const axis = document.getElementById("salesAxis");
  if (!select || !bars || !axis) return;

  const now = new Date();
  const key = select.value || "7months";
  let start;
  let previousStart;
  const labels = [];
  const values = [];

  if (key === "30days") {
    start = new Date(now.getTime() - 30 * 86400000);
    previousStart = new Date(now.getTime() - 60 * 86400000);
    const interval = (now.getTime() - start.getTime()) / 5;
    for (let i = 0; i < 5; i++) {
      const a = new Date(start.getTime() + interval * i);
      const b = new Date(start.getTime() + interval * (i + 1));
      labels.push("W" + (i + 1));
      values.push(dashboardSalesBetween(a, b));
    }
  } else if (key === "year") {
    start = new Date(now.getFullYear(), 0, 1);
    previousStart = new Date(now.getFullYear() - 1, 0, 1);
    for (let month = 0; month <= now.getMonth(); month++) {
      const a = new Date(now.getFullYear(), month, 1);
      const b = new Date(now.getFullYear(), month + 1, 1);
      labels.push(a.toLocaleDateString("en-PH", { month: "short" }));
      values.push(dashboardSalesBetween(a, b));
    }
  } else {
    start = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    previousStart = new Date(now.getFullYear(), now.getMonth() - 13, 1);
    for (let i = 0; i < 7; i++) {
      const a = new Date(now.getFullYear(), now.getMonth() - 6 + i, 1);
      const b = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      labels.push(a.toLocaleDateString("en-PH", { month: "short" }));
      values.push(dashboardSalesBetween(a, b));
    }
  }

  const current = dashboardSalesBetween(start, now);
  const previous = dashboardSalesBetween(previousStart, start);
  const max = Math.max(0, ...values);
  let axisMax = 1;
  if (max > 0) {
    const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
    const scaled = max / magnitude;
    axisMax = (scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10) * magnitude;
  }

  axis.innerHTML = [1, .75, .5, .25, 0].map(f =>
    "<span>" + compactPeso(axisMax * f) + "</span>"
  ).join("");
  bars.innerHTML = values.map((value, i) => {
    const height = value / axisMax * 100;
    return "<div title='" + safeText(labels[i]) + ": " + safeText(money(value)) +
      "'><i class='" + (i === values.length - 1 ? "current" : "") +
      "' style='height:" + height + "%'></i><small>" +
      safeText(labels[i]) + "</small></div>";
  }).join("");

  const totalEl = document.getElementById("salesPeriodTotal");
  const compareEl = document.getElementById("salesPeriodCompare");
  if (totalEl) totalEl.textContent = money(current);
  if (compareEl) {
    if (previous === 0 && current === 0) {
      compareEl.textContent = "No paid sales in selected period";
    } else if (previous === 0) {
      compareEl.textContent = "Paid sales recorded this period";
    } else {
      const change = (current - previous) / previous * 100;
      compareEl.textContent = (change >= 0 ? "↗ " : "↘ ") +
        Math.abs(change).toFixed(1) + "% vs. previous period";
    }
  }
}

function renderDashboardRecentOrders() {
  const tbody = document.getElementById("dashboardRecentOrders");
  if (!tbody) return;
  const recent = dashboardOrders.slice(0, 4);
  if (!recent.length) {
    tbody.innerHTML = "<tr><td colspan='5'>No customer orders yet.</td></tr>";
    return;
  }
  tbody.innerHTML = recent.map(order => {
    const customer = dashboardCustomers.find(c => c.auth_user_id === order.customer_id);
    const name = customer ? (customer.business_name || customer.full_name || "Customer") : "Customer";
    const date = order.created_at ? new Date(order.created_at).toLocaleDateString("en-PH", {
      year: "numeric", month: "short", day: "numeric"
    }) : "—";
    return "<tr><td class='ref'>" + safeText(order.order_number || "Order") +
      "</td><td>" + safeText(name) + "</td><td>" + safeText(date) +
      "</td><td>" + safeText(money(order.total_amount)) +
      "</td><td><span class='" + statusClass(order.order_status) + "'>" +
      safeText(statusText(order.order_status)) + "</span></td></tr>";
  }).join("");
}

function renderDashboardLowStock() {
  const container = document.getElementById("dashboardLowStockAlerts");
  const count = document.getElementById("lowStockAlertCount");
  if (!container || !count) return;

  const items = dashboardProducts.filter(p => Number(p.stock_quantity) <= 10)
    .sort((a, b) => Number(a.stock_quantity) - Number(b.stock_quantity));
  const shown = items.slice(0, 3);
  count.textContent = shown.length + " shown · " + items.length + " to restock";

  if (!shown.length) {
    container.innerHTML = "<p style='color:#267449;font-size:11px'>No low-stock products. Inventory looks good.</p>";
    return;
  }
  container.innerHTML = shown.map(p => {
    const quantity = Number(p.stock_quantity || 0);
    const unit = p.unit || "units";
    const cls = quantity <= 4 ? "danger" : "warn";
    return "<div class='alert'><span>🌾</span><div><b>" +
      safeText(p.product_name || "Product") + "</b><small>SKU: " +
      safeText(p.product_code || "—") + " · " + quantity + " " +
      safeText(unit) + " left</small></div><strong class='" + cls +
      "'>" + quantity + "</strong></div>";
  }).join("");
}

async function initializeDashboard() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) return;

    const { data: membership, error: membershipError } = await supabase
      .from("organization_memberships").select("id")
      .eq("organization_id", ORG_ID)
      .eq("user_id", data.session.user.id)
      .eq("status", "active").maybeSingle();

    if (membershipError) {
      console.error("Dashboard membership check error:", membershipError);
      return;
    }
    if (!membership) return;
    await loadDashboardData();
  } catch (error) {
    console.error("Dashboard loading error:", error);
    if (document.getElementById("totalProductsValue")) {
      notify("Dashboard data could not be loaded: " + error.message);
    }
  }
}

document.getElementById("refresh").onclick = async () => {
  const button = document.getElementById("refresh");
  if (!button || button.disabled) return;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Refreshing...";
  try {
    await loadDashboardData();
    notify("Dashboard data refreshed.");
  } catch (error) {
    console.error("Dashboard refresh error:", error);
    notify("Unable to refresh dashboard: " + error.message);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
};


document.getElementById("bell").onclick = () => {
  notify("Notifications will be connected in a later phase.");
};

document.getElementById("period").onchange = renderDashboardSales;

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
  order_number,
  created_at,
  customer_id,
  total_amount,
  payment_status,
  order_status,
  fulfillment_method,
  payment_method,
  delivery_address,
  customer_notes
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
    Customer
  </td>

  <td>
    ${money(getCustomerPaidTotal(customer.id))}
  </td>

  <td>
    ${customerOrders.length ? "Active" : "No Orders"}
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
    const refreshButton = document.getElementById("refreshOrders");

    if (!refreshButton || refreshButton.disabled) return;

    const originalText = refreshButton.textContent;

    refreshButton.disabled = true;
    refreshButton.textContent = "Refreshing...";

    try {
      const refreshed = await fetchOrganizationCustomers();

      if (!refreshed) return;

      if (
        selectedCustomerId &&
        !customers.some(
          (customer) => customer.id === selectedCustomerId
        )
      ) {
        selectedCustomerId = null;
      }

      if (
        selectedOrderId &&
        !orders.some(
          (order) => order.id === selectedOrderId
        )
      ) {
        selectedOrderId = null;
      }

      renderOrderRows();

      if (selectedOrderId) {
        await renderOrderDetails();
      } else {
        const details = document.getElementById("orderDetails");

        if (details) {
          details.textContent =
            "Select an order to view its details.";
        }
      }

      notify("Orders refreshed.");
    } catch (error) {
      console.error("Order refresh error:", error);

      notify(
        "Unable to refresh orders: " +
        (error.message || "Unknown error")
      );
    } finally {
      refreshButton.disabled = false;
      refreshButton.textContent = originalText;
    }
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
   order.created_at
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

 document.getElementById("openOrderManagement").onclick = async () => {
  selectedCustomerId = null;
  selectedOrderId = null;

  await fetchOrganizationCustomers();

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
    return false;
  }

const { data: orderData, error: orderError } =
  await supabase
    .from("customer_orders")
    .select(`
      id,
      order_number,
      created_at,
      customer_id,
      total_amount,
      payment_status,
      order_status,
      fulfillment_method,
      payment_method,
      delivery_address,
      customer_notes
    `)
    .eq("organization_id", ORG_ID)
    .order("created_at", { ascending: false });

  if (orderError) {
    console.error("Order loading error:", orderError);
    notify("Unable to load customer orders: " + orderError.message);
    return false;
  }

 organizationCustomers = customerData || [];

customers = organizationCustomers
  .filter((customer) => customer.auth_user_id)
  .map((customer) => ({
    id: customer.auth_user_id,
    full_name:
      customer.business_name || customer.full_name || "Customer",
    phone: customer.phone,
  }));

orders = orderData || [];

  return true;
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


// Load live dashboard data for signed-in organization members.
initializeDashboard();

supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_IN" && session) {
    setTimeout(() => initializeDashboard(), 0);
  }
});
