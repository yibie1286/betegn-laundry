/* Betegn Laundry Management System - Frontend JS */

const API = '';
let currentUser = null;
let currentStatusOrderId = null;
let currentPayOrderId = null;
let useLocalStorage = false;

window.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  setDefaultDates();
  generateOrderId();
  setupNavigation();
  setupItemListeners();
  document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarBackdrop').classList.toggle('active');
  });
  document.getElementById('sidebarBackdrop').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarBackdrop').classList.remove('active');
  });
  await checkSession();
});

// ===== SESSION =====
async function checkSession() {
  try {
    const token = localStorage.getItem('bl_token');
    if (!token) { showLogin(); return; }
    const res = await fetch(API + '/api/me', { headers: { 'Authorization': 'Bearer ' + token } });
    if (res.ok) { currentUser = await res.json(); showApp(); }
    else { localStorage.removeItem('bl_token'); showLogin(); }
  } catch {
    useLocalStorage = true;
    const saved = localStorage.getItem('bl_user');
    if (saved) { currentUser = JSON.parse(saved); showApp(); }
    else showLogin();
  }
}

function showLogin() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

function showApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('userBadge').textContent = currentUser ? currentUser.role + ' — ' + currentUser.username : '';
  loadDashboard();
}

async function doLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const errEl = document.getElementById('loginError');
  errEl.style.display = 'none';

  if (useLocalStorage) {
    if (username === 'admin' && password === 'admin123') {
      currentUser = { username: 'admin', role: 'admin' };
      localStorage.setItem('bl_user', JSON.stringify(currentUser));
      showApp();
    } else { errEl.textContent = 'Invalid credentials'; errEl.style.display = 'block'; }
    return;
  }

  try {
    const res = await fetch(API + '/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok) {
      currentUser = data.user;
      localStorage.setItem('bl_token', data.token);
      showApp();
    } else { errEl.textContent = data.error || 'Login failed'; errEl.style.display = 'block'; }
  } catch {
    errEl.textContent = 'Cannot connect to server. Using offline mode.';
    errEl.style.display = 'block';
    useLocalStorage = true;
  }
}

async function doLogout() {
  const token = localStorage.getItem('bl_token');
  if (!useLocalStorage && token) {
    try { await fetch(API + '/api/logout', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } }); } catch {}
  }
  localStorage.removeItem('bl_token');
  localStorage.removeItem('bl_user');
  currentUser = null;
  showLogin();
}

// ===== NAVIGATION =====
function setupNavigation() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const section = link.dataset.section;
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      document.getElementById(section).classList.add('active');
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebarBackdrop').classList.remove('active');
      if (section === 'dashboard') loadDashboard();
      if (section === 'orders')    loadOrders();
      if (section === 'payments')  loadPayments();
      if (section === 'customers') loadCustomers();
      if (section === 'reports')   loadReport();
    });
  });
}

// ===== TOAST =====
function showToast(msg, type) {
  type = type || 'info';
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(function() { t.className = 'toast'; }, 3000);
}

// ===== API HELPER =====
async function apiFetch(url, options) {
  options = options || {};
  const token = localStorage.getItem('bl_token');
  const res = await fetch(API + url, Object.assign({
    headers: Object.assign(
      { 'Content-Type': 'application/json' },
      token ? { 'Authorization': 'Bearer ' + token } : {}
    )
  }, options));
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ===== LOCAL STORAGE =====
function lsGet(key) { return JSON.parse(localStorage.getItem(key) || '[]'); }
function lsSet(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
function lsGetOrders() { return lsGet('bl_orders'); }
function lsSaveOrders(orders) { lsSet('bl_orders', orders); }

// ===== DASHBOARD =====
async function loadDashboard() {
  if (useLocalStorage) { loadDashboardLocal(); return; }
  try {
    const d = await apiFetch('/api/dashboard');
    document.getElementById('totalCustomers').textContent  = d.total_customers;
    document.getElementById('totalClothes').textContent    = d.total_clothes;
    document.getElementById('completedOrders').textContent = d.delivered;
    document.getElementById('pendingOrders').textContent   = d.pending;
    document.getElementById('dailyIncome').textContent     = Number(d.daily_income).toLocaleString() + ' ETB';
    const orders = await apiFetch('/api/orders');
    renderRecentTable(orders.slice(0, 8));
    showNotifications(d);
  } catch (err) { showToast('Dashboard load failed: ' + err.message, 'error'); }
}

function loadDashboardLocal() {
  const orders = lsGetOrders();
  const today = new Date().toISOString().split('T')[0];
  const customers = orders.map(function(o) { return o.phone; }).filter(function(v, i, a) { return a.indexOf(v) === i; });
  const totalClothes = orders.reduce(function(s, o) { return s + (o.items || []).reduce(function(a, i) { return a + Number(i.quantity); }, 0); }, 0);
  document.getElementById('totalCustomers').textContent  = customers.length;
  document.getElementById('totalClothes').textContent    = totalClothes;
  document.getElementById('completedOrders').textContent = orders.filter(function(o) { return o.status === 'Delivered'; }).length;
  document.getElementById('pendingOrders').textContent   = orders.filter(function(o) { return o.status !== 'Delivered'; }).length;
  document.getElementById('dailyIncome').textContent     = orders.filter(function(o) { return o.order_date === today; }).reduce(function(s, o) { return s + Number(o.paid_amount || 0); }, 0).toLocaleString() + ' ETB';
  renderRecentTable(orders.slice(-8).reverse());
}

function renderRecentTable(orders) {
  const tbody = document.getElementById('recentTableBody');
  if (!orders.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No orders yet</td></tr>'; return; }
  tbody.innerHTML = orders.map(function(o) {
    return '<tr>' +
      '<td data-label="Order ID"><strong>' + o.order_id + '</strong></td>' +
      '<td data-label="Customer">' + (o.customer_name || o.custName || '') + '</td>' +
      '<td data-label="Phone">' + (o.phone || '') + '</td>' +
      '<td data-label="Items">' + (o.item_count || (o.items ? o.items.length : 0)) + '</td>' +
      '<td data-label="Total">' + Number(o.total_amount || o.grandTotal || 0).toLocaleString() + ' ETB</td>' +
      '<td data-label="Status">' + statusBadge(o.status) + '</td>' +
      '</tr>';
  }).join('');
}

function showNotifications(d) {
  var msgs = [];
  if (d.overdue > 0) msgs.push('Warning: ' + d.overdue + ' order(s) are overdue for delivery.');
  if (d.unpaid  > 0) msgs.push('Info: ' + d.unpaid + ' order(s) have unpaid balances.');
  var bar = document.getElementById('notifBar');
  if (msgs.length) { bar.innerHTML = msgs.join(' | '); bar.style.display = 'flex'; }
  else bar.style.display = 'none';
}

// ===== NEW ORDER FORM =====
function setDefaultDates() {
  var today = new Date().toISOString().split('T')[0];
  var delivery = new Date(); delivery.setDate(delivery.getDate() + 3);
  var el1 = document.getElementById('dateReceived');
  var el2 = document.getElementById('deliveryDate');
  if (el1) el1.value = today;
  if (el2) el2.value = delivery.toISOString().split('T')[0];
}

function generateOrderId() {
  var d = new Date();
  var ymd = d.getFullYear() + '' + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');
  var rand = Math.floor(1000 + Math.random() * 9000);
  var el = document.getElementById('orderId');
  if (el) el.value = 'BL-' + ymd + '-' + rand;
}

function setupItemListeners() {
  document.getElementById('itemsBody').addEventListener('input', function(e) {
    var row = e.target.closest('.item-row');
    if (row) { calcRowTotal(row); updateTotals(); }
  });
}

function calcRowTotal(row) {
  var qty   = parseFloat(row.querySelector('.item-qty').value)   || 0;
  var price = parseFloat(row.querySelector('.item-price').value) || 0;
  row.querySelector('.item-total').textContent = (qty * price).toLocaleString();
}

function addItemRow() {
  var row = document.createElement('tr');
  row.className = 'item-row';
  row.innerHTML = '<td><select class="item-type"><option value="">Select item</option><option>Shirt</option><option>Trouser</option><option>Suit</option><option>Blanket</option><option>Curtain</option><option>Other</option></select></td>' +
    '<td><input type="number" class="item-qty" min="1" value="1"/></td>' +
    '<td><input type="number" class="item-price" min="0" placeholder="0"/></td>' +
    '<td><span class="item-total">0</span></td>' +
    '<td><button class="btn-remove" onclick="removeRow(this)">x</button></td>';
  document.getElementById('itemsBody').appendChild(row);
}

function removeRow(btn) {
  var rows = document.querySelectorAll('.item-row');
  if (rows.length > 1) { btn.closest('.item-row').remove(); updateTotals(); }
}

function updateTotals() {
  var subtotal = 0;
  document.querySelectorAll('.item-row').forEach(function(row) {
    var qty   = parseFloat(row.querySelector('.item-qty').value)   || 0;
    var price = parseFloat(row.querySelector('.item-price').value) || 0;
    subtotal += qty * price;
    row.querySelector('.item-total').textContent = (qty * price).toLocaleString();
  });
  var disc  = parseFloat(document.getElementById('discountPct').value) || 0;
  var total = subtotal - (subtotal * disc / 100);
  var paid  = parseFloat(document.getElementById('paidAmount').value) || 0;
  var bal   = total - paid;
  document.getElementById('subtotalDisplay').textContent  = subtotal.toLocaleString() + ' ETB';
  document.getElementById('grandTotal').textContent       = total.toLocaleString() + ' ETB';
  document.getElementById('remainingBalance').textContent = Math.max(0, bal).toLocaleString() + ' ETB';
}

async function saveOrder() {
  var name  = document.getElementById('custName').value.trim();
  var phone = document.getElementById('custPhone').value.trim();
  if (!name || !phone) { showToast('Customer name and phone are required', 'error'); return; }

  var items = [];
  var valid = true;
  document.querySelectorAll('.item-row').forEach(function(row) {
    var type  = row.querySelector('.item-type').value;
    var qty   = parseInt(row.querySelector('.item-qty').value);
    var price = parseFloat(row.querySelector('.item-price').value);
    if (!type || !qty || !price) { valid = false; return; }
    items.push({ cloth_type: type, quantity: qty, unit_price: price });
  });

  if (!valid || !items.length) { showToast('Please fill all item fields', 'error'); return; }

  var payload = {
    customer_name:    name,
    phone:            phone,
    address:          document.getElementById('custAddress').value.trim(),
    order_date:       document.getElementById('dateReceived').value,
    delivery_date:    document.getElementById('deliveryDate').value,
    items:            items,
    paid_amount:      parseFloat(document.getElementById('paidAmount').value) || 0,
    payment_method:   document.getElementById('paymentMethod').value,
    discount_percent: parseFloat(document.getElementById('discountPct').value) || 0,
    notes:            document.getElementById('orderNotes').value.trim()
  };

  if (useLocalStorage) { saveOrderLocal(payload); return; }

  try {
    var data = await apiFetch('/api/orders', { method: 'POST', body: JSON.stringify(payload) });
    showToast('Order ' + data.order_id + ' saved successfully', 'success');
    resetForm();
    navigateTo('orders');
  } catch (err) { showToast('Save failed: ' + err.message, 'error'); }
}

function saveOrderLocal(payload) {
  var orders = lsGetOrders();
  var orderId = document.getElementById('orderId').value;
  var subtotal = payload.items.reduce(function(s, i) { return s + i.quantity * i.unit_price; }, 0);
  var disc_amt = subtotal * payload.discount_percent / 100;
  var total = subtotal - disc_amt;
  var order = Object.assign({}, payload, {
    order_id: orderId, subtotal: subtotal, total_amount: total,
    balance: total - payload.paid_amount, status: 'Received',
    created_at: new Date().toISOString()
  });
  orders.unshift(order);
  lsSaveOrders(orders);
  showToast('Order ' + orderId + ' saved (offline mode)', 'success');
  resetForm();
  navigateTo('orders');
}

function resetForm() {
  document.getElementById('custName').value = '';
  document.getElementById('custPhone').value = '';
  document.getElementById('custAddress').value = '';
  document.getElementById('paidAmount').value = '';
  document.getElementById('discountPct').value = '0';
  document.getElementById('orderNotes').value = '';
  document.getElementById('itemsBody').innerHTML = '';
  addItemRow();
  setDefaultDates();
  generateOrderId();
  updateTotals();
}

// ===== ORDERS =====
async function loadOrders() {
  if (useLocalStorage) { renderOrdersTable(lsGetOrders()); return; }
  try {
    var orders = await apiFetch('/api/orders');
    var filter = document.getElementById('statusFilter').value;
    renderOrdersTable(filter ? orders.filter(function(o) { return o.status === filter; }) : orders);
  } catch (err) { showToast('Failed to load orders: ' + err.message, 'error'); }
}

function renderOrdersTable(orders) {
  var tbody = document.getElementById('ordersTableBody');
  if (!orders.length) { tbody.innerHTML = '<tr><td colspan="10" class="empty-state">No orders found</td></tr>'; return; }
  tbody.innerHTML = orders.map(function(o) {
    var total = Number(o.total_amount || o.grandTotal || 0);
    var paid  = Number(o.paid_amount || 0);
    var bal   = Number(o.balance || Math.max(0, total - paid));
    var overdue = o.delivery_date && new Date(o.delivery_date) < new Date() && o.status !== 'Delivered';
    return '<tr>' +
      '<td data-label="Order ID"><strong>' + o.order_id + '</strong></td>' +
      '<td data-label="Customer">' + (o.customer_name || '') + '</td>' +
      '<td data-label="Phone">' + (o.phone || '') + '</td>' +
      '<td data-label="Items">' + (o.item_count || (o.items ? o.items.length : '-')) + '</td>' +
      '<td data-label="Total">' + total.toLocaleString() + ' ETB</td>' +
      '<td data-label="Paid">' + paid.toLocaleString() + ' ETB</td>' +
      '<td data-label="Balance" style="color:' + (bal > 0 ? 'var(--danger)' : 'var(--success)') + '">' + bal.toLocaleString() + ' ETB</td>' +
      '<td data-label="Delivery" style="color:' + (overdue ? 'var(--danger)' : '') + '">' + (o.delivery_date || '-') + '</td>' +
      '<td data-label="Status">' + statusBadge(o.status) + '</td>' +
      '<td data-label="Actions"><div class="action-btns">' +
        '<button class="btn btn-sm btn-outline" onclick="openStatusModal(\'' + o.order_id + '\')">Edit</button>' +
        '<button class="btn btn-sm btn-primary" onclick="openReceipt(\'' + o.order_id + '\')">Receipt</button>' +
        '<button class="btn btn-sm btn-danger" onclick="deleteOrder(\'' + o.order_id + '\')">Delete</button>' +
      '</div></td>' +
      '</tr>';
  }).join('');
}

async function deleteOrder(id) {
  if (!confirm('Delete order ' + id + '? This cannot be undone.')) return;
  if (useLocalStorage) {
    lsSaveOrders(lsGetOrders().filter(function(o) { return o.order_id !== id; }));
    loadOrders(); showToast('Order deleted', 'info'); return;
  }
  try {
    await apiFetch('/api/orders/' + id, { method: 'DELETE' });
    showToast('Order deleted', 'info'); loadOrders();
  } catch (err) { showToast('Delete failed: ' + err.message, 'error'); }
}

// ===== STATUS MODAL =====
function openStatusModal(orderId) {
  currentStatusOrderId = orderId;
  document.getElementById('statusOrderId').textContent = 'Order: ' + orderId;
  document.getElementById('statusModal').classList.add('open');
}

async function setStatus(status) {
  if (!currentStatusOrderId) return;
  if (useLocalStorage) {
    var orders = lsGetOrders();
    var o = orders.find(function(x) { return x.order_id === currentStatusOrderId; });
    if (o) { o.status = status; lsSaveOrders(orders); }
    closeModal('statusModal'); loadOrders();
    if (status === 'Ready' && o) simulateSMS(o.phone || '', o.customer_name || '');
    return;
  }
  try {
    await apiFetch('/api/orders/' + currentStatusOrderId + '/status', { method: 'PATCH', body: JSON.stringify({ status: status }) });
    closeModal('statusModal'); loadOrders();
    showToast('Status updated to ' + status, 'success');
    if (status === 'Ready') {
      var orders = await apiFetch('/api/orders');
      var o = orders.find(function(x) { return x.order_id === currentStatusOrderId; });
      if (o) simulateSMS(o.phone, o.customer_name);
    }
  } catch (err) { showToast('Update failed: ' + err.message, 'error'); }
}

function simulateSMS(phone, name) {
  showToast('SMS sent to ' + phone + ': "' + name + ', your laundry is ready at Betegn Laundry!"', 'success');
}

// ===== PAYMENTS =====
async function loadPayments() {
  if (useLocalStorage) { renderPaymentsTable(lsGetOrders()); return; }
  try {
    var orders = await apiFetch('/api/orders');
    renderPaymentsTable(orders);
  } catch (err) { showToast('Failed to load payments: ' + err.message, 'error'); }
}

function renderPaymentsTable(orders) {
  var tbody = document.getElementById('paymentsTableBody');
  if (!orders.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No payment records</td></tr>'; return; }
  tbody.innerHTML = orders.map(function(o) {
    var total = Number(o.total_amount || o.grandTotal || 0);
    var paid  = Number(o.paid_amount || 0);
    var bal   = Number(o.balance || Math.max(0, total - paid));
    var payStatus = bal <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
    return '<tr>' +
      '<td data-label="Order ID"><strong>' + o.order_id + '</strong></td>' +
      '<td data-label="Customer">' + (o.customer_name || '') + '</td>' +
      '<td data-label="Total">' + total.toLocaleString() + ' ETB</td>' +
      '<td data-label="Paid">' + paid.toLocaleString() + ' ETB</td>' +
      '<td data-label="Balance" style="color:' + (bal > 0 ? 'var(--danger)' : 'var(--success)') + '">' + bal.toLocaleString() + ' ETB</td>' +
      '<td data-label="Status">' + payBadge(payStatus) + '</td>' +
      '<td data-label="Action">' + (bal > 0 ? '<button class="btn btn-sm btn-success" onclick="openPayModal(\'' + o.order_id + '\',' + total + ',' + paid + ',' + bal + ')">Pay</button>' : '<span style="color:var(--success)">Paid</span>') + '</td>' +
      '</tr>';
  }).join('');
}

function openPayModal(orderId, total, paid, balance) {
  currentPayOrderId = orderId;
  document.getElementById('payModalOrderId').textContent = 'Order: ' + orderId;
  document.getElementById('payModalInfo').innerHTML =
    '<div style="background:#f8fafc;border-radius:8px;padding:.75rem;font-size:.88rem">' +
    '<div style="display:flex;justify-content:space-between"><span>Total:</span><strong>' + Number(total).toLocaleString() + ' ETB</strong></div>' +
    '<div style="display:flex;justify-content:space-between"><span>Paid:</span><strong>' + Number(paid).toLocaleString() + ' ETB</strong></div>' +
    '<div style="display:flex;justify-content:space-between;color:var(--danger)"><span>Balance:</span><strong>' + Number(balance).toLocaleString() + ' ETB</strong></div>' +
    '</div>';
  document.getElementById('payModalAmount').value = balance;
  document.getElementById('paymentModal').classList.add('open');
}

async function submitPayment() {
  var amount = parseFloat(document.getElementById('payModalAmount').value);
  var method = document.getElementById('payModalMethod').value;
  if (!amount || amount <= 0) { showToast('Enter a valid amount', 'error'); return; }

  if (useLocalStorage) {
    var orders = lsGetOrders();
    var o = orders.find(function(x) { return x.order_id === currentPayOrderId; });
    if (o) {
      o.paid_amount = (Number(o.paid_amount) || 0) + amount;
      o.balance = Math.max(0, (Number(o.total_amount) || 0) - o.paid_amount);
      lsSaveOrders(orders);
    }
    closeModal('paymentModal'); loadPayments();
    showToast('Payment of ' + amount.toLocaleString() + ' ETB recorded', 'success');
    return;
  }

  try {
    await apiFetch('/api/payments', { method: 'POST', body: JSON.stringify({ order_id: currentPayOrderId, payment_amount: amount, payment_method: method }) });
    closeModal('paymentModal'); loadPayments();
    showToast('Payment of ' + amount.toLocaleString() + ' ETB recorded', 'success');
  } catch (err) { showToast('Payment failed: ' + err.message, 'error'); }
}

// ===== CUSTOMERS =====
async function loadCustomers() {
  if (useLocalStorage) {
    var orders = lsGetOrders();
    var map = {};
    orders.forEach(function(o) {
      var key = o.phone;
      if (!map[key]) map[key] = { customer_name: o.customer_name, phone: o.phone, address: o.address || '', registration_date: o.order_date, total_orders: 0, total_paid: 0, customer_id: key };
      map[key].total_orders++;
      map[key].total_paid += Number(o.paid_amount || 0);
    });
    renderCustomersTable(Object.values(map));
    return;
  }
  try {
    var customers = await apiFetch('/api/customers');
    renderCustomersTable(customers);
  } catch (err) { showToast('Failed to load customers: ' + err.message, 'error'); }
}

function renderCustomersTable(customers) {
  var tbody = document.getElementById('customersTableBody');
  if (!customers.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No customers yet</td></tr>'; return; }
  tbody.innerHTML = customers.map(function(c) {
    return '<tr>' +
      '<td data-label="Name"><strong>' + c.customer_name + '</strong></td>' +
      '<td data-label="Phone">' + c.phone + '</td>' +
      '<td data-label="Address">' + (c.address || '-') + '</td>' +
      '<td data-label="Registered">' + (c.registration_date || '-') + '</td>' +
      '<td data-label="Orders">' + c.total_orders + '</td>' +
      '<td data-label="Total Paid">' + Number(c.total_paid).toLocaleString() + ' ETB</td>' +
      '<td data-label="Action"><button class="btn btn-sm btn-outline" onclick="openHistory(\'' + c.customer_id + '\')">History</button></td>' +
      '</tr>';
  }).join('');
}

async function openHistory(customerId) {
  var modal = document.getElementById('historyModal');
  var content = document.getElementById('historyContent');
  content.innerHTML = '<p style="text-align:center;padding:1rem">Loading...</p>';
  modal.classList.add('open');

  if (useLocalStorage) {
    var orders = lsGetOrders().filter(function(o) { return o.phone === customerId; });
    content.innerHTML = renderHistoryHTML({ customer: { customer_name: orders[0] ? orders[0].customer_name : '', phone: customerId }, orders: orders });
    return;
  }

  try {
    var data = await apiFetch('/api/customers/' + customerId + '/history');
    content.innerHTML = renderHistoryHTML(data);
  } catch (err) { content.innerHTML = '<p class="empty-state">Failed to load history: ' + err.message + '</p>'; }
}

function renderHistoryHTML(data) {
  var c = data.customer;
  var orders = data.orders || [];
  var rows = orders.length ? orders.map(function(o) {
    return '<tr>' +
      '<td>' + o.order_id + '</td>' +
      '<td>' + (o.order_date || '') + '</td>' +
      '<td>' + (o.items_summary || (o.items ? o.items.map(function(i) { return i.quantity + 'x ' + i.cloth_type; }).join(', ') : '-')) + '</td>' +
      '<td>' + Number(o.total_amount || o.grandTotal || 0).toLocaleString() + ' ETB</td>' +
      '<td>' + Number(o.paid_amount || 0).toLocaleString() + ' ETB</td>' +
      '<td>' + Number(o.balance || 0).toLocaleString() + ' ETB</td>' +
      '<td>' + statusBadge(o.status) + '</td>' +
      '</tr>';
  }).join('') : '<tr><td colspan="7" class="empty-state">No orders</td></tr>';

  return '<div style="margin-bottom:1rem;padding:.75rem;background:#f8fafc;border-radius:8px"><strong>' + c.customer_name + '</strong> | ' + c.phone + '</div>' +
    '<div class="table-wrapper"><table>' +
    '<thead><tr><th>Order ID</th><th>Date</th><th>Items</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table></div>';
}

// ===== REPORTS =====
function loadReport() {
  var monthInput = document.getElementById('reportMonth');
  if (!monthInput.value) {
    var now = new Date();
    monthInput.value = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
  }
  var parts = monthInput.value.split('-');
  var year = parts[0]; var month = parts[1];

  if (useLocalStorage) { loadReportLocal(year, month); return; }

  apiFetch('/api/reports/monthly?year=' + year + '&month=' + month)
    .then(function(data) { renderReport(data); })
    .catch(function(err) { showToast('Report failed: ' + err.message, 'error'); });
}

function loadReportLocal(year, month) {
  var orders = lsGetOrders().filter(function(o) {
    if (!o.order_date) return false;
    var d = new Date(o.order_date);
    return d.getFullYear() == year && (d.getMonth()+1) == month;
  });
  var summary = {
    total_orders: orders.length,
    total_revenue: orders.reduce(function(s, o) { return s + Number(o.total_amount || 0); }, 0),
    total_collected: orders.reduce(function(s, o) { return s + Number(o.paid_amount || 0); }, 0),
    total_outstanding: orders.reduce(function(s, o) { return s + Number(o.balance || 0); }, 0),
    delivered: orders.filter(function(o) { return o.status === 'Delivered'; }).length,
    pending: orders.filter(function(o) { return o.status !== 'Delivered'; }).length
  };
  renderReport({ summary: summary, daily: [], top_customers: [], items_breakdown: [], year: year, month: month });
}

function renderReport(data) {
  var s = data.summary;
  document.getElementById('reportStats').innerHTML =
    '<div class="stat-card blue"><div class="stat-icon">📋</div><div class="stat-info"><h3>' + s.total_orders + '</h3><p>Total Orders</p></div></div>' +
    '<div class="stat-card green"><div class="stat-icon">💰</div><div class="stat-info"><h3>' + Number(s.total_revenue).toLocaleString() + ' ETB</h3><p>Total Revenue</p></div></div>' +
    '<div class="stat-card teal"><div class="stat-icon">✅</div><div class="stat-info"><h3>' + Number(s.total_collected).toLocaleString() + ' ETB</h3><p>Collected</p></div></div>' +
    '<div class="stat-card orange"><div class="stat-icon">⏳</div><div class="stat-info"><h3>' + Number(s.total_outstanding).toLocaleString() + ' ETB</h3><p>Outstanding</p></div></div>' +
    '<div class="stat-card purple"><div class="stat-icon">🚚</div><div class="stat-info"><h3>' + s.delivered + '</h3><p>Delivered</p></div></div>';

  var topBody = document.getElementById('topCustomersBody');
  topBody.innerHTML = (data.top_customers || []).length
    ? data.top_customers.map(function(c) { return '<tr><td>' + c.customer_name + '</td><td>' + c.phone + '</td><td>' + c.orders + '</td><td>' + Number(c.total_spent).toLocaleString() + '</td></tr>'; }).join('')
    : '<tr><td colspan="4" class="empty-state">No data</td></tr>';

  var itemsBody = document.getElementById('itemsBreakdownBody');
  itemsBody.innerHTML = (data.items_breakdown || []).length
    ? data.items_breakdown.map(function(i) { return '<tr><td>' + i.cloth_type + '</td><td>' + i.total_qty + '</td><td>' + Number(i.total_revenue).toLocaleString() + '</td></tr>'; }).join('')
    : '<tr><td colspan="3" class="empty-state">No data</td></tr>';
}

async function exportReportExcel() {
  var monthInput = document.getElementById('reportMonth').value;
  if (!monthInput) { showToast('Select a month first', 'error'); return; }
  var parts = monthInput.split('-'); var year = parts[0]; var month = parts[1];

  var orders = [];
  if (useLocalStorage) {
    orders = lsGetOrders().filter(function(o) {
      if (!o.order_date) return false;
      var d = new Date(o.order_date);
      return d.getFullYear() == year && (d.getMonth()+1) == month;
    });
  } else {
    try {
      var all = await apiFetch('/api/orders');
      orders = all.filter(function(o) {
        if (!o.order_date) return false;
        var d = new Date(o.order_date);
        return d.getFullYear() == year && (d.getMonth()+1) == month;
      });
    } catch (err) { showToast('Export failed: ' + err.message, 'error'); return; }
  }

  var rows = [['Order ID','Customer','Phone','Order Date','Delivery Date','Total (ETB)','Paid (ETB)','Balance (ETB)','Status']];
  orders.forEach(function(o) {
    rows.push([o.order_id, o.customer_name || '', o.phone || '', o.order_date || '', o.delivery_date || '',
      Number(o.total_amount || 0).toFixed(2), Number(o.paid_amount || 0).toFixed(2), Number(o.balance || 0).toFixed(2), o.status || '']);
  });

  var csv = rows.map(function(r) { return r.map(function(v) { return '"' + v + '"'; }).join(','); }).join('\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'betegn_laundry_report_' + monthInput + '.csv';
  a.click();
  showToast('Exported ' + orders.length + ' orders', 'success');
}

// ===== SEARCH =====
async function performSearch() {
  var q = document.getElementById('searchInput').value.trim();
  if (!q) { showToast('Enter a search term', 'error'); return; }

  if (useLocalStorage) {
    var ql = q.toLowerCase();
    var results = lsGetOrders().filter(function(o) {
      return (o.customer_name || '').toLowerCase().indexOf(ql) > -1 ||
             (o.phone || '').indexOf(ql) > -1 ||
             (o.order_id || '').toLowerCase().indexOf(ql) > -1;
    });
    renderSearchResults(results);
    return;
  }

  try {
    var results = await apiFetch('/api/orders/search/' + encodeURIComponent(q));
    renderSearchResults(results);
  } catch (err) { showToast('Search failed: ' + err.message, 'error'); }
}

function renderSearchResults(results) {
  var tbody = document.getElementById('searchResults');
  if (!results.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No results found</td></tr>'; return; }
  tbody.innerHTML = results.map(function(o) {
    var total = Number(o.total_amount || o.grandTotal || 0);
    var bal   = Number(o.balance || 0);
    return '<tr>' +
      '<td data-label="Order ID"><strong>' + o.order_id + '</strong></td>' +
      '<td data-label="Customer">' + (o.customer_name || '') + '</td>' +
      '<td data-label="Phone">' + (o.phone || '') + '</td>' +
      '<td data-label="Total">' + total.toLocaleString() + ' ETB</td>' +
      '<td data-label="Balance" style="color:' + (bal > 0 ? 'var(--danger)' : 'var(--success)') + '">' + bal.toLocaleString() + ' ETB</td>' +
      '<td data-label="Status">' + statusBadge(o.status) + '</td>' +
      '<td data-label="Actions"><div class="action-btns">' +
        '<button class="btn btn-sm btn-outline" onclick="openStatusModal(\'' + o.order_id + '\')">Edit</button>' +
        '<button class="btn btn-sm btn-primary" onclick="openReceipt(\'' + o.order_id + '\')">Receipt</button>' +
      '</div></td>' +
      '</tr>';
  }).join('');
}

// ===== RECEIPT =====
async function openReceipt(orderId) {
  var order;
  if (useLocalStorage) {
    order = lsGetOrders().find(function(o) { return o.order_id === orderId; });
    if (order) renderReceiptContent(Object.assign({}, order, { items: order.items || [] }));
  } else {
    try {
      order = await apiFetch('/api/orders/' + orderId);
      renderReceiptContent(order);
    } catch (err) { showToast('Failed to load receipt: ' + err.message, 'error'); return; }
  }
  document.getElementById('receiptModal').classList.add('open');
}

function renderReceiptContent(o) {
  var items = o.items || [];
  var total = Number(o.total_amount || o.grandTotal || 0);
  var paid  = Number(o.paid_amount || 0);
  var bal   = Number(o.balance || Math.max(0, total - paid));
  var payStatus = bal <= 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID';

  var itemRows = items.map(function(i) {
    return '<div class="receipt-row"><span>' + i.cloth_type + ' x' + i.quantity + '</span><span>' + Number(i.line_total || i.quantity * i.unit_price).toLocaleString() + ' ETB</span></div>';
  }).join('');

  document.getElementById('receiptBody').innerHTML =
    '<div class="receipt-row"><span>Order ID:</span><span>' + o.order_id + '</span></div>' +
    '<div class="receipt-row"><span>Date:</span><span>' + (o.order_date || new Date().toLocaleDateString()) + '</span></div>' +
    '<div class="receipt-row"><span>Customer:</span><span>' + (o.customer_name || '') + '</span></div>' +
    '<div class="receipt-row"><span>Phone:</span><span>' + (o.phone || '') + '</span></div>' +
    (o.delivery_date ? '<div class="receipt-row"><span>Delivery:</span><span>' + o.delivery_date + '</span></div>' : '') +
    '<hr/><div style="margin:.5rem 0;font-weight:600;font-size:.85rem">ITEMS:</div>' +
    itemRows +
    '<div class="receipt-row total"><span>TOTAL:</span><span>' + total.toLocaleString() + ' ETB</span></div>' +
    '<div class="receipt-row"><span>Paid:</span><span>' + paid.toLocaleString() + ' ETB</span></div>' +
    '<div class="receipt-row"><span>Balance:</span><span>' + bal.toLocaleString() + ' ETB</span></div>' +
    '<div class="receipt-row"><span>Status:</span><span>' + (o.status || 'Received') + '</span></div>' +
    '<div class="receipt-row"><span>Payment:</span><span>' + payStatus + '</span></div>';
}

function printReceipt() { window.print(); }

// ===== MODALS =====
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ===== HELPERS =====
function statusBadge(status) {
  var map = { Received:'received', Washing:'washing', Ironing:'ironing', Ready:'ready', Delivered:'delivered' };
  var cls = map[status] || 'received';
  return '<span class="badge badge-' + cls + '">' + (status || 'Received') + '</span>';
}

function payBadge(status) {
  return '<span class="badge badge-' + status + '">' + status.charAt(0).toUpperCase() + status.slice(1) + '</span>';
}

function navigateTo(section) {
  document.querySelectorAll('.nav-link').forEach(function(l) {
    l.classList.toggle('active', l.dataset.section === section);
  });
  document.querySelectorAll('.section').forEach(function(s) {
    s.classList.toggle('active', s.id === section);
  });
  if (section === 'orders') loadOrders();
}
