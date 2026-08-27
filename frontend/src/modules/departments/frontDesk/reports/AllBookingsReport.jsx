import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Filter, CalendarCheck, Trash2, Edit, X, Calendar } from "lucide-react";
import api from "../../../../api/api";
import { useAuth } from "../../../../context/AuthContext";
import "./allBookingsReport.css";

export default function AllBookingsReport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [guests, setGuests] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState(""); // Date filter state

  // Soft delete / Edit Modal states
  const [deleteModalBooking, setDeleteModalBooking] = useState(null);
  const [deleteReason, setDeleteReason] = useState("");
  
  const [editModalBooking, setEditModalBooking] = useState(null);
  const [editFormData, setEditFormData] = useState({ total_amount: "", status: "confirmed" });

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [bRes, gRes, rRes] = await Promise.all([
          api.get("/bookings"),
          api.get("/guests"),
          api.get("/rooms")
        ]);
        const hotelId = user?.hotel_id || user?.hotel?.id;
        
        const rawBookings = (bRes.data.bookings || bRes.data).filter(b => !hotelId || Number(b.hotel_id) === Number(hotelId));
        const formatted = rawBookings.map(b => ({
          ...b,
          isSoftDeleted: b.isSoftDeleted || false,
          deleteReason: b.deleteReason || "",
          isEdited: b.isEdited || false,
          created_at: b.created_at || new Date().toISOString(),
        }));

        setBookings(formatted);
        setGuests(gRes.data.guests || gRes.data);
        setRooms(rRes.data.rooms || rRes.data);
      } catch (err) {
        console.error("Error loading bookings report:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  const getGuestName = (id) => guests.find(g => Number(g.id) === Number(id))?.full_name || "-";
  const getRoomNum = (id) => rooms.find(r => Number(r.id) === Number(id))?.room_number || "-";

  const handleSoftDeleteSubmit = (e) => {
    e.preventDefault();
    if (!deleteReason.trim()) return;

    setBookings(prev => prev.map(b => {
      if (b.id === deleteModalBooking.id) {
        return {
          ...b,
          isSoftDeleted: true,
          deleteReason: deleteReason.trim(),
          status: "cancelled"
        };
      }
      return b;
    }));

    setDeleteModalBooking(null);
    setDeleteReason("");
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    setBookings(prev => prev.map(b => {
      if (b.id === editModalBooking.id) {
        return {
          ...b,
          total_amount: Number(editFormData.total_amount),
          status: editFormData.status,
          isEdited: true,
        };
      }
      return b;
    }));

    setEditModalBooking(null);
  };

  const filtered = useMemo(() => {
    return bookings.filter(b => {
      const matchesSearch = !searchText || 
        getGuestName(b.guest_id).toLowerCase().includes(searchText.toLowerCase()) || 
        String(b.id).includes(searchText);
      const matchesStatus = statusFilter === "all" || String(b.status).toLowerCase() === statusFilter;
      
      let matchesDate = true;
      if (selectedDate) {
        const entryDate = b.created_at ? b.created_at.split("T")[0] : "";
        matchesDate = entryDate === selectedDate;
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [bookings, searchText, statusFilter, selectedDate, guests]);

  return (
    <div className="abr-page">
      <header className="abr-header-card">
        <div className="abr-header-left">
          <button className="abr-back-btn" onClick={() => navigate("/reports/front-desk")}>
            <ArrowLeft size={16} /> <span>Back</span>
          </button>
          <div className="abr-header-icon-box">
            <CalendarCheck size={26} />
          </div>
          <div>
            <span className="abr-kicker">ANALYTICS & LOGS</span>
            <h1>All Bookings Report</h1>
          </div>
        </div>
      </header>

      <div className="abr-toolbar-card">
        <div className="abr-search-box">
          <Search size={16}/>
          <input placeholder="Search bookings..." value={searchText} onChange={e => setSearchText(e.target.value)}/>
        </div>

        {/* Right-aligned filters group (Date picker next to status filter) */}
        <div className="abr-filters-right-group">
          <div className="abr-filter-box">
            <Calendar size={16}/>
            <input 
              type="date" 
              value={selectedDate} 
              onChange={e => setSelectedDate(e.target.value)}
              style={{ border: "none", background: "transparent", outline: "none", color: "#0f172a", fontSize: "13px", fontWeight: 500, cursor: "pointer" }}
            />
            {selectedDate && (
              <button 
                onClick={() => setSelectedDate("")} 
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "#ef4444", fontWeight: 600, marginLeft: "4px" }}
              >
                Clear
              </button>
            )}
          </div>

          <div className="abr-filter-box">
            <Filter size={16}/>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="confirmed">Confirmed</option>
              <option value="checked-in">Checked-In</option>
              <option value="checked-out">Checked-Out</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      <div className="abr-table-card">
        {loading ? (
          <div className="abr-empty">Loading bookings report...</div>
        ) : filtered.length === 0 ? (
          <div className="abr-empty">No bookings found for the selected criteria.</div>
        ) : (
          <div className="abr-table-scroll">
            <table className="abr-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Entry Date & Time</th>
                  <th>Guest Name</th>
                  <th>Room</th>
                  <th>Check-In</th>
                  <th>Check-Out</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => {
                  let rowHighlightClass = "";
                  if (b.isSoftDeleted) rowHighlightClass = "abr-row-deleted";
                  else if (b.isEdited) rowHighlightClass = "abr-row-edited";

                  return (
                    <tr key={b.id} className={rowHighlightClass}>
                      <td><span className="abr-id-tag">#{b.id}</span></td>
                      <td style={{ color: "#475569", fontSize: "12px" }}>
                        {b.created_at ? new Date(b.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : "-"}
                      </td>
                      <td>
                        <strong>{getGuestName(b.guest_id)}</strong>
                        {b.isSoftDeleted && <div className="abr-reason-text">Reason: {b.deleteReason}</div>}
                      </td>
                      <td>Room {getRoomNum(b.room_id)}</td>
                      <td>{b.checkin_date ? new Date(b.checkin_date).toLocaleDateString() : "-"}</td>
                      <td>{b.checkout_date ? new Date(b.checkout_date).toLocaleDateString() : "-"}</td>
                      <td>₹{Number(b.total_amount || 0).toFixed(2)}</td>
                      <td>
                        <span className={`abr-pill ${b.status}`}>{b.status}</span>
                        {b.isEdited && <span className="abr-badge-edited">Edited</span>}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="abr-action-btns">
                          <button 
                            className="abr-action-btn edit" 
                            title="Edit Entry"
                            onClick={() => {
                              setEditModalBooking(b);
                              setEditFormData({ total_amount: b.total_amount, status: b.status });
                            }}
                          >
                            <Edit size={14} />
                          </button>
                          <button 
                            className="abr-action-btn delete" 
                            title="Request Deletion / Soft Delete"
                            onClick={() => {
                              setDeleteModalBooking(b);
                              setDeleteReason("");
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SOFT DELETE MODAL */}
      {deleteModalBooking && (
        <div className="abr-modal-backdrop">
          <div className="abr-modal">
            <div className="abr-modal-header">
              <h3>Reason for Deletion Request</h3>
              <button onClick={() => setDeleteModalBooking(null)}><X size={18}/></button>
            </div>
            <form onSubmit={handleSoftDeleteSubmit}>
              <p>This entry for <strong>{getGuestName(deleteModalBooking.guest_id)}</strong> will be preserved but flagged and highlighted with your reason.</p>
              <textarea 
                rows="3" 
                placeholder="Enter detailed reason here..." 
                value={deleteReason} 
                onChange={(e) => setDeleteReason(e.target.value)}
                required
              />
              <div className="abr-modal-actions">
                <button type="button" className="abr-btn-secondary" onClick={() => setDeleteModalBooking(null)}>Cancel</button>
                <button type="submit" className="abr-btn-danger">Flag & Keep Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editModalBooking && (
        <div className="abr-modal-backdrop">
          <div className="abr-modal">
            <div className="abr-modal-header">
              <h3>Edit Booking Entry</h3>
              <button onClick={() => setEditModalBooking(null)}><X size={18}/></button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="abr-form-group">
                <label>Total Amount (₹)</label>
                <input 
                  type="number" 
                  value={editFormData.total_amount} 
                  onChange={(e) => setEditFormData({...editFormData, total_amount: e.target.value})}
                  required 
                />
              </div>
              <div className="abr-form-group">
                <label>Status</label>
                <select 
                  value={editFormData.status} 
                  onChange={(e) => setEditFormData({...editFormData, status: e.target.value})}
                >
                  <option value="confirmed">Confirmed</option>
                  <option value="checked-in">Checked-In</option>
                  <option value="checked-out">Checked-Out</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="abr-modal-actions">
                <button type="button" className="abr-btn-secondary" onClick={() => setEditModalBooking(null)}>Cancel</button>
                <button type="submit" className="abr-btn-primary">Save Changes & Highlight</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}