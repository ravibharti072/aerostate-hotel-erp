import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  Download,
  Search,
  Filter,
  Layers,
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  SlidersHorizontal,
  User,
  Tag,
  Hash,
  List,
  LayoutGrid,
  Clock,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader, StatCard, ModuleWriternHeader } from "@components";
import "./inventoryReports.css";

const categories = [
  "Housekeeping",
  "Linens & Bedding",
  "Toiletries",
  "F&B Supplies",
  "Maintenance",
];

export default function InventoryReports() {
  const { user } = useAuth();

  const [items, setItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState("list"); // "list" | "cards"

  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function normalizeList(data, key) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data)) return data.data;
    return [];
  }

  function getLoggedInHotelId() {
    return user?.hotel_id || user?.hotel?.id || user?.hotelId || items[0]?.hotel_id || 1;
  }

  function getItem(itemId) {
    return items.find((i) => Number(i.id) === Number(itemId));
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return "Just now";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "Recently";
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Recently";
    }
  }

  async function fetchData() {
    try {
      setLoading(true);
      setError("");
      const hotelId = getLoggedInHotelId();
      const params = hotelId ? { hotel_id: hotelId } : {};

      const [itemsRes, txRes] = await Promise.all([
        api.get("/inventory/items", { params }).catch(() => ({ data: [] })),
        api.get("/inventory/stock-transactions", { params }).catch(() => ({ data: [] })),
      ]);

      setItems(normalizeList(itemsRes.data, "items"));
      setTransactions(normalizeList(txRes.data, "transactions"));
    } catch (err) {
      console.error("Fetch reports error:", err);
      setError("Failed to generate inventory reports.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const stats = useMemo(() => {
    let inVal = 0;
    let outVal = 0;
    let inQty = 0;
    let outQty = 0;

    transactions.forEach((tx) => {
      const item = getItem(tx.item_id);
      const price = Number(item?.unit_price || item?.average_cost || 0);
      const qty = Number(tx.quantity || 0);

      if (tx.transaction_type === "receive") {
        inQty += qty;
        inVal += price * qty;
      } else if (tx.transaction_type === "issue" || tx.transaction_type === "adjust") {
        outQty += qty;
        outVal += price * qty;
      }
    });

    return {
      total: transactions.length,
      inQty,
      outQty,
      inVal,
      outVal,
    };
  }, [transactions, items]);

  const filteredTransactions = useMemo(() => {
    const search = searchText.toLowerCase();
    return transactions.filter((tx) => {
      const item = getItem(tx.item_id);
      const name = String(item?.name || item?.item_name || "").toLowerCase();
      const sku = String(item?.sku || "").toLowerCase();
      const ref = String(tx.reference || "").toLowerCase();
      const cat = String(item?.category || "").toLowerCase();

      const matchesSearch = !search || name.includes(search) || sku.includes(search) || ref.includes(search);
      const matchesType = typeFilter === "all" || tx.transaction_type === typeFilter;
      const matchesCat = categoryFilter === "all" || cat === categoryFilter.toLowerCase();
      return matchesSearch && matchesType && matchesCat;
    });
  }, [transactions, items, searchText, typeFilter, categoryFilter]);

  function exportCSV() {
    if (filteredTransactions.length === 0) return setError("No entries to export.");
    const headers = ["Log ID", "Item", "SKU", "Category", "Type", "Quantity", "Unit Price", "Total Value", "Reference", "Logged By"];
    const rows = filteredTransactions.map((tx) => {
      const item = getItem(tx.item_id);
      const price = Number(item?.unit_price || item?.average_cost || 0);
      const total = price * Number(tx.quantity || 0);
      return [
        tx.id,
        `"${item?.name || item?.item_name || `Item #${tx.item_id}`}"`,
        `"${item?.sku || ""}"`,
        `"${item?.category || "General"}"`,
        tx.transaction_type.toUpperCase(),
        tx.quantity,
        price.toFixed(2),
        total.toFixed(2),
        `"${tx.reference || ""}"`,
        `"${tx.created_by || "Staff"}"`,
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Inventory_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSuccess("Inventory CSV downloaded successfully.");
    setTimeout(() => setSuccess(""), 3000);
  }

  return (
    <div className="inv-page">
      <PortalHeader
        title="Inventory Reports"
        kicker="INVENTORY • AUDIT LEDGER"
        description="Comprehensive chronological ledger cards for hotel replenishment, dispatches, and valuations."
        icon={FileText}
        backPath="/dashboard"
        rightAction={
          <button className="portal-action-btn" onClick={exportCSV}>
            <Download size={16} /> Export CSV
          </button>
        }
      />

      {error && <div className="inv-error-box">{error}</div>}
      {success && <div className="inv-success-box">{success}</div>}

      <section className="inv-stats-grid">
        <StatCard title="Total Movements" value={stats.total} Icon={Layers} colorTheme="blue" />
        <StatCard title="Inflow Valuation" value={`₹${stats.inVal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} Icon={TrendingUp} colorTheme="green" />
        <StatCard title="Outflow Valuation" value={`₹${stats.outVal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} Icon={TrendingDown} colorTheme="red" />
        <StatCard title="Net Balance Vol" value={stats.inQty - stats.outQty} Icon={IndianRupee} colorTheme="purple" />
      </section>

      <section className="inv-modules-section">
        <ModuleWriternHeader
          title="Audited Movement Ledger"
          description="Chronological stock records of purchases, issues, and reconciliations."
          badgeCount={filteredTransactions.length}
          badgeLabel="records"
        />

        <div className="inv-toolbar-card">
          <div className="inv-search-box">
            <Search size={16} />
            <input
              placeholder="Search report entries..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          <div className="inv-filters-right-group">
            <div className="inv-filter-box">
              <Calendar size={16} />
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="all">All Types</option>
                <option value="receive">Receive</option>
                <option value="issue">Issue</option>
                <option value="adjust">Adjust</option>
              </select>
            </div>
            <div className="inv-filter-box">
              <Filter size={16} />
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c.toLowerCase()}>{c}</option>
                ))}
              </select>
            </div>

            <div className="inv-view-toggle">
              <button
                type="button"
                className={`inv-view-btn ${viewMode === "list" ? "active" : ""}`}
                onClick={() => setViewMode("list")}
                title="Table List View"
              >
                <List size={15} /> List
              </button>
              <button
                type="button"
                className={`inv-view-btn ${viewMode === "cards" ? "active" : ""}`}
                onClick={() => setViewMode("cards")}
                title="Card Grid View"
              >
                <LayoutGrid size={15} /> Cards
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="inv-empty">Generating ledger report...</div>
        ) : filteredTransactions.length === 0 ? (
          <div className="inv-empty">No records found matching your filters.</div>
        ) : viewMode === "list" ? (
          /* TABLE LIST VIEW */
          <div className="inv-table-container">
            <table className="inv-table">
              <thead>
                <tr>
                  <th className="th-id">Log</th>
                  <th className="th-item">Item & SKU</th>
                  <th className="th-category">Category</th>
                  <th className="th-movement">Movement</th>
                  <th className="th-quantity">Quantity</th>
                  <th className="th-valuation">Valuation</th>
                  <th className="th-ref">Reference & Reason</th>
                  <th className="th-author">Logged By</th>
                  <th className="th-date">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx) => {
                  const item = getItem(tx.item_id);
                  const price = Number(item?.unit_price || item?.average_cost || 0);
                  const qty = Number(tx.quantity || 0);
                  const totalVal = price * qty;
                  const isReceive = tx.transaction_type === "receive";
                  const isIssue = tx.transaction_type === "issue";
                  const isAdjust = tx.transaction_type === "adjust";

                  return (
                    <tr key={tx.id} className="inv-table-row">
                      <td className="inv-td-id">
                        <span className="inv-log-id-chip">#{tx.id}</span>
                      </td>

                      <td className="inv-td-item">
                        <div className="inv-item-info">
                          <span className="inv-item-name-text" title={item?.name || item?.item_name || `Item #${tx.item_id}`}>
                            {item?.name || item?.item_name || `Item #${tx.item_id}`}
                          </span>
                          {item?.sku && <span className="inv-sku-chip">{item.sku}</span>}
                        </div>
                      </td>

                      <td className="inv-td-category">
                        <span className="inv-category-pill">
                          <Tag size={11} /> {item?.category || "General"}
                        </span>
                      </td>

                      <td className="inv-td-type">
                        <span className={`inv-type-badge ${tx.transaction_type}`}>
                          {isReceive && <ArrowDownLeft size={12} className="inv-type-icon" />}
                          {isIssue && <ArrowUpRight size={12} className="inv-type-icon" />}
                          {isAdjust && <SlidersHorizontal size={12} className="inv-type-icon" />}
                          <span>{tx.transaction_type.toUpperCase()}</span>
                        </span>
                      </td>

                      <td className="inv-td-qty">
                        <span className={`inv-qty-pill ${tx.transaction_type}`}>
                          {isReceive ? `+${qty}` : isIssue ? `-${qty}` : `±${qty}`} {item?.unit || "Pcs"}
                        </span>
                      </td>

                      <td className="inv-td-val">
                        <div className="inv-val-group">
                          <span className="inv-val-main">
                            ₹{totalVal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="inv-val-sub">
                            @ ₹{price.toFixed(2)}
                          </span>
                        </div>
                      </td>

                      <td className="inv-td-ref">
                        <div className="inv-ref-group">
                          <span className="inv-ref-chip" title="Reference">
                            <Hash size={11} /> {tx.reference || "Internal Log"}
                          </span>
                          <span className="inv-reason-text" title={tx.reason || "Operational Movement"}>
                            {tx.reason || "Operational Movement"}
                          </span>
                        </div>
                      </td>

                      <td className="inv-td-author">
                        <div className="inv-author-cell">
                          <div className="inv-avatar-mini">
                            {(tx.created_by || "S")[0].toUpperCase()}
                          </div>
                          <span>{tx.created_by || "Staff"}</span>
                        </div>
                      </td>

                      <td className="inv-td-date">
                        <span className="inv-date-text">
                          <Clock size={11} /> {formatDateTime(tx.created_at)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* CARD GRID VIEW */
          <div className="inv-cards-grid">
            {filteredTransactions.map((tx) => {
              const item = getItem(tx.item_id);
              const price = Number(item?.unit_price || item?.average_cost || 0);
              const qty = Number(tx.quantity || 0);
              const totalVal = price * qty;
              const isReceive = tx.transaction_type === "receive";
              const isIssue = tx.transaction_type === "issue";
              const isAdjust = tx.transaction_type === "adjust";

              return (
                <div key={tx.id} className={`inv-item-card inv-card-${tx.transaction_type}`}>
                  {/* Header: Type Badge & Category */}
                  <div className="inv-card-header">
                    <div className={`inv-type-badge ${tx.transaction_type}`}>
                      {isReceive && <ArrowDownLeft size={13} className="inv-type-icon" />}
                      {isIssue && <ArrowUpRight size={13} className="inv-type-icon" />}
                      {isAdjust && <SlidersHorizontal size={13} className="inv-type-icon" />}
                      <span>{tx.transaction_type.toUpperCase()}</span>
                    </div>

                    <div className="inv-card-category-tag" title={item?.category || "General"}>
                      <Tag size={11} />
                      <span>{item?.category || "General"}</span>
                    </div>
                  </div>

                  {/* Body: Title, Reference & Reason */}
                  <div className="inv-card-body">
                    <h4 className="inv-card-title" title={item?.name || item?.item_name || `Item #${tx.item_id}`}>
                      {item?.name || item?.item_name || `Item #${tx.item_id}`}
                    </h4>

                    <div className="inv-card-ref-row">
                      <span className="inv-card-ref-badge" title="Reference / PO">
                        <Hash size={11} /> {tx.reference || "Internal Log"}
                      </span>
                      {item?.sku && (
                        <span className="inv-card-sku-badge" title="SKU">
                          {item.sku}
                        </span>
                      )}
                    </div>

                    <p className="inv-card-reason" title={tx.reason || "Operational Movement"}>
                      {tx.reason || "Operational Movement"}
                    </p>
                  </div>

                  {/* Metrics Box */}
                  <div className="inv-card-metrics-box">
                    <div className="inv-metric-col">
                      <span className="inv-metric-label">MOVEMENT</span>
                      <span className={`inv-metric-qty ${tx.transaction_type}`}>
                        {isReceive ? `+${qty}` : isIssue ? `-${qty}` : `±${qty}`} {item?.unit || "Pcs"}
                      </span>
                    </div>

                    <div className="inv-metric-divider" />

                    <div className="inv-metric-col inv-metric-right">
                      <span className="inv-metric-label">VALUATION</span>
                      <span className="inv-metric-val">
                        ₹{totalVal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Footer: User & Log ID */}
                  <div className="inv-card-footer">
                    <div className="inv-card-author" title={`Logged by: ${tx.created_by || "Staff"}`}>
                      <User size={13} className="inv-author-icon" />
                      <span>{tx.created_by || "Staff"}</span>
                    </div>

                    <div className="inv-card-id">
                      <span>Log #{tx.id}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}