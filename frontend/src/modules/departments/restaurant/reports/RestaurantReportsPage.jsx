import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  ClipboardList,
  Download,
  IndianRupee,
  PieChart,
  ReceiptText,
  Search,
  ShoppingBag,
  TrendingUp,
  Utensils,
  Wallet,
  X,
} from "lucide-react";
import api from "../../../../api/api";
import { useAuth } from "../../../../context/AuthContext";
import PortalHeader from "../../../../components/PortalHeader";
import StatCard from "../../../../components/StatCard"; 
import ModuleWriternHeader from "../../../../components/ModuleWriternHeader";
import "./restaurantReports.css";

export default function RestaurantReportsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);

  const [searchText, setSearchText] = useState("");
  const [orderTypeFilter, setOrderTypeFilter] = useState("all");
  const [billingFilter, setBillingFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function normalizeList(data, key) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.data?.[key])) return data.data[key];
    if (Array.isArray(data?.result)) return data.result;
    if (Array.isArray(data?.results)) return data.results;
    return [];
  }

  function getApiErrorMessage(err, fallbackMessage) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          const field = Array.isArray(item.loc) ? item.loc.join(".") : "";
          return `${field}: ${item.msg}`;
        })
        .join(" | ");
    }
    if (detail && typeof detail === "object") return JSON.stringify(detail);
    if (err.message) return err.message;
    return fallbackMessage;
  }

  function getLoggedInHotelId() {
    return user?.hotel_id || user?.hotel?.id || user?.hotelId || user?.hotel?.hotel_id || 1;
  }

  function filterByHotel(list) {
    const hotelId = getLoggedInHotelId();
    if (!hotelId) return list;
    const filteredList = list.filter((item) => {
      if (!item.hotel_id) return true;
      return Number(item.hotel_id) === Number(hotelId);
    });
    if (filteredList.length === 0 && list.length > 0) return list;
    return filteredList;
  }

  function getOrderStatus(order) {
    return order.order_status || order.status || "pending";
  }

  function getOrderType(order) {
    return order.order_type || order.type || "dine-in";
  }

  function getBillingType(order) {
    if (getOrderType(order) === "room-service") return "transfer_to_booking";
    if (order.billing_type) return order.billing_type;
    if (order.payment_status === "paid") return "paid_at_restaurant";
    if (order.payment_status === "bill-to-room") return "transfer_to_booking";
    return "pending_billing";
  }

  function getPaymentStatus(order) {
    const status = order.payment_status || "unpaid";
    if (status === "bill-to-room") return "unpaid";
    if (status === "pending") return "unpaid";
    return status;
  }

  function getOrderAmount(order) {
    return Number(order.total_amount || order.order_total || order.amount || 0);
  }

  function getOrderTax(order) {
    return Number(order.tax_amount || order.gst_amount || 0);
  }

  function getOrderDate(order) {
    return order.created_at || order.createdAt || order.date || null;
  }

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function getOrderItems(order) {
    if (Array.isArray(order.items)) return order.items;
    return [];
  }

  function getMenuItemById(itemId) {
    return menuItems.find((item) => Number(item.id) === Number(itemId));
  }

  function getItemName(item) {
    if (item?.item_name) return item.item_name;
    if (item?.name) return item.name;
    const menuItem = getMenuItemById(item?.menu_item_id);
    if (menuItem?.name) return menuItem.name;
    return `Item #${item?.menu_item_id || "-"}`;
  }

  function getItemAmount(item) {
    if (item?.total) return Number(item.total);
    if (item?.total_amount) return Number(item.total_amount);
    if (item?.amount) return Number(item.amount);
    const menuItem = getMenuItemById(item?.menu_item_id);
    const price = Number(item?.price || menuItem?.price || 0);
    const quantity = Number(item?.quantity || item?.qty || 1);
    return price * quantity;
  }

  function getItemsText(order) {
    const items = getOrderItems(order);
    if (items.length === 0) return "-";
    return items
      .map((item) => {
        const quantity = Number(item.quantity || item.qty || 1);
        return `${getItemName(item)} x ${quantity}`;
      })
      .join(", ");
  }

  function getBillingLabel(type) {
    if (type === "paid_at_restaurant") return "Paid at Restaurant";
    if (type === "transfer_to_booking") return "Transfer to Booking";
    if (type === "pending_billing") return "Pending Billing";
    return type || "-";
  }

  function getTypeLabel(type) {
    if (type === "room-service") return "Room Service";
    if (type === "dine-in") return "Dine-In";
    return type || "-";
  }

  async function fetchData() {
    try {
      setLoading(true);
      setError("");

      const [ordersResponse, menuResponse] = await Promise.all([
        api.get("/restaurant/orders").catch(() => ({ data: [] })),
        api.get("/restaurant/menu-items").catch(() => ({ data: [] })),
      ]);

      setOrders(filterByHotel(normalizeList(ordersResponse.data, "orders")));
      setMenuItems(filterByHotel(normalizeList(menuResponse.data, "menu_items")));
    } catch (err) {
      console.error("Fetch restaurant reports error:", err);
      setError(getApiErrorMessage(err, "Failed to load restaurant reports."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const filteredOrders = useMemo(() => {
    const search = searchText.toLowerCase();

    return orders.filter((order) => {
      const status = String(getOrderStatus(order)).toLowerCase();
      const orderType = getOrderType(order);
      const billingType = getBillingType(order);
      const paymentStatus = getPaymentStatus(order);
      
      const orderDate = getOrderDate(order);
      const orderDateStr = orderDate ? new Date(orderDate).toISOString().split("T")[0] : "";

      const rowText = [order.id, orderType, billingType, paymentStatus, status, getItemsText(order)].join(" ").toLowerCase();

      const matchesSearch = !search || rowText.includes(search);
      const matchesType = orderTypeFilter === "all" || orderType === orderTypeFilter;
      const matchesBilling = billingFilter === "all" || billingType === billingFilter;
      const matchesPayment = paymentFilter === "all" || paymentStatus === paymentFilter;
      const matchesStatus = statusFilter === "all" || status === statusFilter;

      let matchesFromDate = true;
      let matchesToDate = true;

      if (dateFrom && orderDateStr) {
        matchesFromDate = orderDateStr >= dateFrom;
      }

      if (dateTo && orderDateStr) {
        matchesToDate = orderDateStr <= dateTo;
      }

      return matchesSearch && matchesType && matchesBilling && matchesPayment && matchesStatus && matchesFromDate && matchesToDate;
    });
  }, [orders, menuItems, searchText, orderTypeFilter, billingFilter, paymentFilter, statusFilter, dateFrom, dateTo]);

  const reportStats = useMemo(() => {
    const validOrders = filteredOrders.filter((order) => String(getOrderStatus(order)).toLowerCase() !== "cancelled");
    const dineInOrders = validOrders.filter((order) => getOrderType(order) === "dine-in");
    const roomServiceOrders = validOrders.filter((order) => getOrderType(order) === "room-service");
    const paidAtRestaurantOrders = validOrders.filter((order) => getBillingType(order) === "paid_at_restaurant" && getPaymentStatus(order) === "paid");
    const transferToBookingOrders = validOrders.filter((order) => getBillingType(order) === "transfer_to_booking");
    const pendingBillingOrders = validOrders.filter((order) => getBillingType(order) === "pending_billing");

    const totalSales = validOrders.reduce((sum, order) => sum + getOrderAmount(order), 0);
    const totalTax = validOrders.reduce((sum, order) => sum + getOrderTax(order), 0);

    return {
      totalOrders: validOrders.length,
      totalSales,
      totalTax,
      dineInCount: dineInOrders.length,
      dineInAmount: dineInOrders.reduce((sum, order) => sum + getOrderAmount(order), 0),
      roomServiceCount: roomServiceOrders.length,
      roomServiceAmount: roomServiceOrders.reduce((sum, order) => sum + getOrderAmount(order), 0),
      paidAtRestaurantAmount: paidAtRestaurantOrders.reduce((sum, order) => sum + getOrderAmount(order), 0),
      transferToBookingAmount: transferToBookingOrders.reduce((sum, order) => sum + getOrderAmount(order), 0),
      pendingBillingAmount: pendingBillingOrders.reduce((sum, order) => sum + getOrderAmount(order), 0),
    };
  }, [filteredOrders]);

  // Daily Sales Bar Chart Data Calculation (Robust YYYY-MM-DD grouping)
  const dailySalesData = useMemo(() => {
    let start, end;
    const validOrders = filteredOrders.filter(order => String(getOrderStatus(order)).toLowerCase() !== "cancelled");

    const getLocalDateKey = (dateObj) => {
      const d = new Date(dateObj);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    if (dateFrom && dateTo) {
      start = new Date(dateFrom);
      end = new Date(dateTo);
    } else if (dateFrom) {
      start = new Date(dateFrom);
      end = new Date();
    } else if (dateTo) {
      end = new Date(dateTo);
      start = new Date(end);
      start.setDate(start.getDate() - 6);
    } else {
      if (validOrders.length > 0) {
        const timestamps = validOrders.map(o => {
          const d = new Date(getOrderDate(o) || Date.now());
          d.setHours(0,0,0,0);
          return d.getTime();
        });
        start = new Date(Math.min(...timestamps));
        end = new Date(Math.max(...timestamps));
        
        const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        if (diffDays < 6) {
           start = new Date(end);
           start.setDate(start.getDate() - 6);
        }
      } else {
        end = new Date();
        start = new Date();
        start.setDate(start.getDate() - 6);
      }
    }

    if (start > end) {
      const temp = start;
      start = end;
      end = temp;
    }

    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 90) {
      start = new Date(end);
      start.setDate(start.getDate() - 89);
    }

    const amountMap = {};
    validOrders.forEach((order) => {
      const orderDate = getOrderDate(order);
      if (!orderDate) return;
      const dStr = getLocalDateKey(orderDate);
      amountMap[dStr] = (amountMap[dStr] || 0) + getOrderAmount(order);
    });

    const entries = [];
    let curr = new Date(start);
    curr.setHours(0, 0, 0, 0);
    const last = new Date(end);
    last.setHours(0, 0, 0, 0);

    while (curr <= last) {
      const dStr = getLocalDateKey(curr);
      const displayDate = curr.toLocaleDateString("en-IN", { day: '2-digit', month: 'short' });
      entries.push({
        date: displayDate,
        amount: amountMap[dStr] || 0
      });
      curr.setDate(curr.getDate() + 1);
    }

    const maxAmount = Math.max(...entries.map(e => e.amount), 1);
    return { entries, maxAmount };
  }, [filteredOrders, dateFrom, dateTo]);

  const itemPerformance = useMemo(() => {
    const itemMap = {};
    filteredOrders.forEach((order) => {
      if (String(getOrderStatus(order)).toLowerCase() === "cancelled") return;
      getOrderItems(order).forEach((item) => {
        const name = getItemName(item);
        const quantity = Number(item.quantity || item.qty || 1);
        const amount = getItemAmount(item);
        if (!itemMap[name]) {
          itemMap[name] = { name, quantity: 0, amount: 0, orders: 0 };
        }
        itemMap[name].quantity += quantity;
        itemMap[name].amount += amount;
        itemMap[name].orders += 1;
      });
    });
    return Object.values(itemMap).sort((a, b) => b.amount - a.amount);
  }, [filteredOrders, menuItems]);

  const statusSummary = useMemo(() => {
    const summary = {};
    const validOrders = filteredOrders.filter(o => String(getOrderStatus(o)).toLowerCase() !== "cancelled");
    const totalValidAmt = validOrders.reduce((sum, o) => sum + getOrderAmount(o), 1);

    filteredOrders.forEach((order) => {
      const status = getOrderStatus(order);
      if (!summary[status]) {
        summary[status] = { label: status, count: 0, amount: 0 };
      }
      summary[status].count += 1;
      summary[status].amount += getOrderAmount(order);
    });
    return Object.values(summary).map(item => ({
      ...item,
      percentage: Math.round((item.amount / totalValidAmt) * 100)
    }));
  }, [filteredOrders]);

  const billingSummary = useMemo(() => {
    const summary = {};
    const validOrders = filteredOrders.filter(o => String(getOrderStatus(o)).toLowerCase() !== "cancelled");
    const totalValidAmt = validOrders.reduce((sum, o) => sum + getOrderAmount(o), 1);

    filteredOrders.forEach((order) => {
      const billing = getBillingType(order);
      if (!summary[billing]) {
        summary[billing] = { label: getBillingLabel(billing), count: 0, amount: 0 };
      }
      summary[billing].count += 1;
      summary[billing].amount += getOrderAmount(order);
    });
    return Object.values(summary).map(item => ({
      ...item,
      percentage: Math.round((item.amount / totalValidAmt) * 100)
    }));
  }, [filteredOrders]);

  function exportCsv() {
    const headers = ["Order ID", "Date", "Order Type", "Status", "Billing Type", "Payment Status", "Items", "Total"];
    const rows = filteredOrders.map((order) => [
      order.id,
      formatDate(getOrderDate(order)),
      getTypeLabel(getOrderType(order)),
      getOrderStatus(order),
      getBillingLabel(getBillingType(order)),
      getPaymentStatus(order),
      `"${getItemsText(order)}"`,
      getOrderAmount(order).toFixed(2),
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `restaurant-report-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="restaurant-reports-page">
      {/* SHARED UNIFIED PORTAL HEADER WITH EXPORT ACTION */}
      <PortalHeader 
        title="Restaurant Reports"
        kicker="RESTAURANT ANALYTICS"
        description="Track restaurant sales, dine-in orders, room service billing, item performance, and payment summaries."
        icon={BarChart3}
        backPath="/restaurant"
        rightAction={
          <button className="reports-export-btn" onClick={exportCsv} disabled={filteredOrders.length === 0}>
            <Download size={16} /> Export CSV
          </button>
        }
      />

      {error && <div className="reports-error-box">{error}</div>}

      {/* --- REUSABLE STATS GRID --- */}
      <section className="reports-stats-grid">
        <StatCard
          title="Total Sales"
          value={`₹${reportStats.totalSales.toFixed(2)}`}
          Icon={IndianRupee}
          colorTheme="blue"
        />
        <StatCard
          title="Dine-In Sales"
          value={`₹${reportStats.dineInAmount.toFixed(2)}`}
          Icon={Utensils}
          colorTheme="green"
        />
        <StatCard
          title="Room Service Sales"
          value={`₹${reportStats.roomServiceAmount.toFixed(2)}`}
          Icon={ReceiptText}
          colorTheme="orange"
        />
        <StatCard
          title="Paid at Restaurant"
          value={`₹${reportStats.paidAtRestaurantAmount.toFixed(2)}`}
          Icon={Wallet}
          colorTheme="purple"
        />
      </section>

      {/* --- MODULE SECTION --- */}
      <section className="reports-modules-section">
        {/* REUSABLE WRITERN HEADER */}
        <ModuleWriternHeader 
          title="Analytics & Trends"
          description="Filter, review, and evaluate financial metrics and performance metrics."
          badgeCount={filteredOrders.length}
          badgeLabel="records"
        />

        {/* TOOLBAR FILTERS */}
        <div className="reports-toolbar-card">
          <div className="reports-search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search order, item, status..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          <div className="reports-filters-right-group">
            <select value={orderTypeFilter} onChange={(e) => setOrderTypeFilter(e.target.value)}>
              <option value="all">All Order Types</option>
              <option value="dine-in">Dine-In</option>
              <option value="room-service">Room Service</option>
            </select>

            <select value={billingFilter} onChange={(e) => setBillingFilter(e.target.value)}>
              <option value="all">All Billing</option>
              <option value="pending_billing">Pending Billing</option>
              <option value="paid_at_restaurant">Paid at Restaurant</option>
              <option value="transfer_to_booking">Transfer to Booking</option>
            </select>

            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="preparing">Preparing</option>
              <option value="served">Served</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <div className="reports-date-filter">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="From Date" autoComplete="off" />
              <span>to</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="To Date" autoComplete="off" />
              {(dateFrom || dateTo) && (
                <button
                  type="button"
                  className="reports-clear-dates-btn"
                  onClick={() => { setDateFrom(""); setDateTo(""); }}
                  title="Clear Date Filters"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* --- VISUAL CHARTS SECTION --- */}
      <div className="reports-charts-container">
        <section className="reports-chart-card bar-chart-card">
          <div className="reports-section-title">
            <div className="reports-section-icon"><TrendingUp size={18} /></div>
            <div>
              <h3>Daily Sales Trend</h3>
              <p>Visual bar chart of sales performance across dates.</p>
            </div>
          </div>
          {dailySalesData.entries.length === 0 ? (
            <div className="reports-empty-small">No sales data available for chart.</div>
          ) : (
            <div className="chart-bar-container">
              {dailySalesData.entries.map((item) => {
                const heightPercent = item.amount > 0 ? Math.max(Math.round((item.amount / dailySalesData.maxAmount) * 100), 12) : 0;
                return (
                  <div className="chart-bar-column" key={item.date}>
                    {item.amount > 0 && <span className="bar-tooltip">₹{item.amount.toFixed(0)}</span>}
                    <div className="chart-bar-fill" style={{ height: `${heightPercent}%` }}></div>
                    <span className="chart-bar-label">{item.date}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* 3 MAIN ANALYTICS REPORTS SECTION */}
      <div className="reports-summary-grid-3">
        {/* 1. ITEM PERFORMANCE */}
        <section className="reports-summary-card">
          <div className="reports-section-title">
            <div className="reports-section-icon"><BarChart3 size={18} /></div>
            <div>
              <h3>Item Performance</h3>
              <p>Best selling items by amount & quantity.</p>
            </div>
          </div>
          {itemPerformance.length === 0 ? (
            <div className="reports-empty-small">No item data found.</div>
          ) : (
            <div className="reports-table-scroll">
              <table className="reports-mini-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Orders</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {itemPerformance.slice(0, 8).map((item) => (
                    <tr key={item.name}>
                      <td><strong>{item.name}</strong></td>
                      <td>{item.quantity}</td>
                      <td>{item.orders}</td>
                      <td>₹{item.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 2. BILLING SUMMARY */}
        <section className="reports-summary-card">
          <div className="reports-section-title">
            <div className="reports-section-icon"><PieChart size={18} /></div>
            <div>
              <h3>Billing Summary</h3>
              <p>Restaurant billing type breakdown.</p>
            </div>
          </div>
          {billingSummary.length === 0 ? (
            <div className="reports-empty-small">No billing data found.</div>
          ) : (
            <div className="reports-proportional-list">
              {billingSummary.map((item) => (
                <div className="prop-row" key={item.label}>
                  <div className="prop-info">
                    <strong>{item.label}</strong>
                    <span>{item.count} orders (₹{item.amount.toFixed(2)})</span>
                  </div>
                  <div className="prop-bar-bg">
                    <div className="prop-bar-fill" style={{ width: `${item.percentage}%` }}></div>
                  </div>
                  <b className="prop-val">{item.percentage}%</b>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 3. STATUS SUMMARY */}
        <section className="reports-summary-card">
          <div className="reports-section-title">
            <div className="reports-section-icon"><ClipboardList size={18} /></div>
            <div>
              <h3>Status Summary</h3>
              <p>Kitchen & fulfillment status breakdown.</p>
            </div>
          </div>
          {statusSummary.length === 0 ? (
            <div className="reports-empty-small">No status data found.</div>
          ) : (
            <div className="reports-proportional-list">
              {statusSummary.map((item) => (
                <div className="prop-row" key={item.label}>
                  <div className="prop-info">
                    <strong>{item.label.toUpperCase()}</strong>
                    <span>{item.count} orders (₹{item.amount.toFixed(2)})</span>
                  </div>
                  <div className="prop-bar-bg">
                    <div className="prop-bar-fill status-fill" style={{ width: `${item.percentage}%` }}></div>
                  </div>
                  <b className="prop-val">{item.percentage}%</b>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}