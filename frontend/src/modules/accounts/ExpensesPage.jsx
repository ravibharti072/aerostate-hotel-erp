import React, { useEffect, useState, useMemo } from "react";
import {
  Receipt,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  DollarSign,
  TrendingDown,
  Trash2,
  Edit,
  X,
  Building,
  CreditCard,
  FileText,
  Calendar,
  Filter,
} from "lucide-react";
import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader } from "@components";
import "./expenses.css";

const EXPENSE_CATEGORIES = [
  "Utilities (Power, Water, Gas)",
  "Kitchen & Food Supplies",
  "Housekeeping & Linens",
  "Maintenance & Repairs",
  "Staff Welfare & Meals",
  "Fuel & Generator",
  "Office & Stationery",
  "Marketing & Advertising",
  "Taxes, Permits & Licenses",
  "General Operations",
];

const PAYMENT_METHODS = [
  "Cash",
  "Bank Transfer",
  "UPI",
  "Credit Card",
  "Cheque",
];

const emptyExpenseForm = {
  expense_title: "",
  expense_category: "Utilities (Power, Water, Gas)",
  amount: "",
  vendor_id: "",
  payment_method: "Cash",
  payment_status: "paid",
  expense_date: new Date().toISOString().slice(0, 10),
  paid_by: "",
  remarks: "",
};

export default function ExpensesPage() {
  const { user } = useAuth();
  const hotelId =
    user?.hotel_id || user?.hotel?.id || user?.hotelId || user?.hotel?.hotel_id;

  const [expenses, setExpenses] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Filters & search
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [methodFilter, setMethodFilter] = useState("ALL");

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [formData, setFormData] = useState(emptyExpenseForm);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchExpensesAndVendors = async () => {
    if (!hotelId) return;
    setLoading(true);
    try {
      const [expRes, vRes] = await Promise.all([
        api.get(`/expenses?hotel_id=${hotelId}`).catch(() => ({ data: [] })),
        api.get(`/vendors?hotel_id=${hotelId}`).catch(() => ({ data: [] })),
      ]);
      setExpenses(expRes.data || []);
      setVendors(vRes.data || []);
    } catch (err) {
      console.error("Error loading expenses:", err);
      showToast("Failed to load expenses data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpensesAndVendors();
  }, [hotelId]);

  const handleOpenAdd = () => {
    setEditingExpense(null);
    setFormData({
      ...emptyExpenseForm,
      paid_by: user?.username || "Admin",
      expense_date: new Date().toISOString().slice(0, 10),
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (exp) => {
    setEditingExpense(exp);
    setFormData({
      expense_title: exp.expense_title || "",
      expense_category: exp.expense_category || "Utilities (Power, Water, Gas)",
      amount: exp.amount || "",
      vendor_id: exp.vendor_id || "",
      payment_method: exp.payment_method || "Cash",
      payment_status: exp.payment_status || "paid",
      expense_date: exp.expense_date
        ? new Date(exp.expense_date).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      paid_by: exp.paid_by || "",
      remarks: exp.remarks || "",
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.expense_title.trim() || !formData.amount || Number(formData.amount) <= 0) {
      showToast("Please provide a valid expense title and amount", "error");
      return;
    }

    try {
      const payload = {
        hotel_id: Number(hotelId),
        vendor_id: formData.vendor_id ? Number(formData.vendor_id) : null,
        expense_title: formData.expense_title.trim(),
        expense_category: formData.expense_category,
        amount: Number(formData.amount),
        payment_method: formData.payment_method,
        payment_status: formData.payment_status,
        expense_date: formData.expense_date
          ? new Date(formData.expense_date).toISOString()
          : new Date().toISOString(),
        paid_by: formData.paid_by || user?.username || "Admin",
        remarks: formData.remarks,
      };

      if (editingExpense) {
        await api.put(`/expenses/${editingExpense.id}`, payload);
        showToast("Expense updated successfully");
      } else {
        await api.post("/expenses", payload);
        showToast("Expense recorded successfully");
      }

      setIsModalOpen(false);
      fetchExpensesAndVendors();
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to save expense";
      showToast(msg, "error");
    }
  };

  const handleDelete = async (expId) => {
    if (!window.confirm("Are you sure you want to delete this expense record?")) return;
    try {
      await api.delete(`/expenses/${expId}`);
      showToast("Expense record deleted");
      fetchExpensesAndVendors();
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to delete expense";
      showToast(msg, "error");
    }
  };

  // Stats
  const stats = useMemo(() => {
    const totalAmount = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const paidAmount = expenses
      .filter((e) => e.payment_status?.toLowerCase() === "paid")
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const pendingAmount = expenses
      .filter((e) => e.payment_status?.toLowerCase() === "pending")
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const totalCount = expenses.length;

    return { totalAmount, paidAmount, pendingAmount, totalCount };
  }, [expenses]);

  // Filtered list
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const vendorName = vendors.find((v) => v.id === e.vendor_id)?.vendor_name || "";
      const matchesSearch =
        !searchQuery ||
        e.expense_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.paid_by?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.remarks?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vendorName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        categoryFilter === "ALL" || e.expense_category === categoryFilter;

      const matchesStatus =
        statusFilter === "ALL" || e.payment_status?.toLowerCase() === statusFilter.toLowerCase();

      const matchesMethod =
        methodFilter === "ALL" || e.payment_method?.toLowerCase() === methodFilter.toLowerCase();

      return matchesSearch && matchesCategory && matchesStatus && matchesMethod;
    });
  }, [expenses, vendors, searchQuery, categoryFilter, statusFilter, methodFilter]);

  return (
    <div className="expenses-page">
      {toast && (
        <div className={`exp-toast ${toast.type}`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <PortalHeader
        title="Operational Expenses"
        subtitle="Track, categorize, and control hotel operating expenditures and vendor payables"
        icon={Receipt}
      />

      {/* Stats Grid */}
      <div className="exp-stats-grid">
        <div className="exp-stat-card">
          <div className="exp-stat-icon teal">
            <DollarSign size={24} />
          </div>
          <div className="exp-stat-info">
            <h4>Total Operational Outflow</h4>
            <div className="stat-value">₹{stats.totalAmount.toLocaleString("en-IN")}</div>
          </div>
        </div>

        <div className="exp-stat-card">
          <div className="exp-stat-icon emerald">
            <CheckCircle2 size={24} />
          </div>
          <div className="exp-stat-info">
            <h4>Disbursed / Paid</h4>
            <div className="stat-value">₹{stats.paidAmount.toLocaleString("en-IN")}</div>
          </div>
        </div>

        <div className="exp-stat-card">
          <div className="exp-stat-icon amber">
            <Clock size={24} />
          </div>
          <div className="exp-stat-info">
            <h4>Pending Liabilities</h4>
            <div className="stat-value">₹{stats.pendingAmount.toLocaleString("en-IN")}</div>
          </div>
        </div>

        <div className="exp-stat-card">
          <div className="exp-stat-icon indigo">
            <FileText size={24} />
          </div>
          <div className="exp-stat-info">
            <h4>Total Expenses Logged</h4>
            <div className="stat-value">{stats.totalCount}</div>
          </div>
        </div>
      </div>

      {/* Filter and Action Bar */}
      <div className="exp-controls-bar">
        <div className="exp-search-group">
          <div className="exp-search-box">
            <Search size={16} />
            <input
              type="text"
              className="exp-search-input"
              placeholder="Search expenses, vendor, paid by..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="exp-filter-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="ALL">All Categories</option>
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            className="exp-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
          </select>

          <select
            className="exp-filter-select"
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
          >
            <option value="ALL">All Payment Methods</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <button className="exp-primary-btn" onClick={handleOpenAdd}>
          <Plus size={16} />
          Record Expense
        </button>
      </div>

      {/* Main Table */}
      <div className="exp-table-card">
        {filteredExpenses.length === 0 ? (
          <div className="exp-empty">
            <Receipt size={48} />
            <h4>No Expense Records Found</h4>
            <p>Record your hotel's daily operational expenses to maintain financial hygiene.</p>
          </div>
        ) : (
          <table className="exp-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Expense Title</th>
                <th>Category</th>
                <th>Vendor / Payee</th>
                <th>Amount</th>
                <th>Payment Method</th>
                <th>Paid By</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((exp) => {
                const vendor = vendors.find((v) => v.id === exp.vendor_id);
                return (
                  <tr key={exp.id}>
                    <td>
                      {exp.expense_date
                        ? new Date(exp.expense_date).toLocaleDateString()
                        : "—"}
                    </td>
                    <td>
                      <strong>{exp.expense_title}</strong>
                      {exp.remarks && (
                        <div style={{ fontSize: "11px", color: "#64748b" }}>
                          {exp.remarks}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="exp-category-pill">{exp.expense_category}</span>
                    </td>
                    <td>{vendor ? vendor.vendor_name : "Direct / General"}</td>
                    <td>
                      <strong>₹{Number(exp.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
                    </td>
                    <td>{exp.payment_method || "Cash"}</td>
                    <td>{exp.paid_by || "—"}</td>
                    <td>
                      <span className={`exp-badge ${exp.payment_status?.toLowerCase()}`}>
                        {exp.payment_status}
                      </span>
                    </td>
                    <td>
                      <div className="exp-actions">
                        <button
                          className="exp-action-btn"
                          title="Edit Expense"
                          onClick={() => handleOpenEdit(exp)}
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          className="exp-action-btn delete"
                          title="Delete Expense"
                          onClick={() => handleDelete(exp.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ADD / EDIT MODAL */}
      {isModalOpen && (
        <div className="exp-modal-overlay">
          <div className="exp-modal">
            <div className="exp-modal-header">
              <h3>{editingExpense ? "Edit Expense" : "Record New Expense"}</h3>
              <button
                className="exp-modal-close"
                onClick={() => setIsModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="exp-modal-body">
                <div className="exp-form-grid">
                  <div className="exp-form-group exp-form-full">
                    <label>Expense Title / Description *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Monthly Electricity Bill - BSES"
                      value={formData.expense_title}
                      onChange={(e) =>
                        setFormData({ ...formData, expense_title: e.target.value })
                      }
                    />
                  </div>

                  <div className="exp-form-group">
                    <label>Category *</label>
                    <select
                      value={formData.expense_category}
                      onChange={(e) =>
                        setFormData({ ...formData, expense_category: e.target.value })
                      }
                    >
                      {EXPENSE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="exp-form-group">
                    <label>Amount (₹) *</label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData({ ...formData, amount: e.target.value })
                      }
                    />
                  </div>

                  <div className="exp-form-group">
                    <label>Expense Date</label>
                    <input
                      type="date"
                      value={formData.expense_date}
                      onChange={(e) =>
                        setFormData({ ...formData, expense_date: e.target.value })
                      }
                    />
                  </div>

                  <div className="exp-form-group">
                    <label>Associated Vendor (Optional)</label>
                    <select
                      value={formData.vendor_id}
                      onChange={(e) =>
                        setFormData({ ...formData, vendor_id: e.target.value })
                      }
                    >
                      <option value="">-- No Vendor / Direct --</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.vendor_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="exp-form-group">
                    <label>Payment Method</label>
                    <select
                      value={formData.payment_method}
                      onChange={(e) =>
                        setFormData({ ...formData, payment_method: e.target.value })
                      }
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="exp-form-group">
                    <label>Payment Status</label>
                    <select
                      value={formData.payment_status}
                      onChange={(e) =>
                        setFormData({ ...formData, payment_status: e.target.value })
                      }
                    >
                      <option value="paid">Paid</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>

                  <div className="exp-form-group">
                    <label>Disbursed / Paid By</label>
                    <input
                      type="text"
                      placeholder="e.g. Accounts Manager"
                      value={formData.paid_by}
                      onChange={(e) =>
                        setFormData({ ...formData, paid_by: e.target.value })
                      }
                    />
                  </div>

                  <div className="exp-form-group exp-form-full">
                    <label>Remarks / Invoice Reference</label>
                    <textarea
                      rows={2}
                      placeholder="Optional notes or invoice number..."
                      value={formData.remarks}
                      onChange={(e) =>
                        setFormData({ ...formData, remarks: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="exp-modal-footer">
                <button
                  type="button"
                  className="exp-secondary-btn"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="exp-primary-btn">
                  {editingExpense ? "Save Changes" : "Record Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
