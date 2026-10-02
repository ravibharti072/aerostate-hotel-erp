from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app import models
from app.database import get_db
from app.dependencies import get_current_user

router = APIRouter(tags=["Maintenance"])


class TechnicianRosterPayload(BaseModel):
    staff_ids: List[int]


# =========================================================================
# 0. MAINTENANCE DASHBOARD AGGREGATION ENDPOINT
# =========================================================================

def _format_age(dt: Optional[datetime]) -> str:
    if not dt:
        return "N/A"
    diff = datetime.utcnow() - dt
    total_seconds = int(diff.total_seconds())
    if total_seconds < 60:
        return f"{max(0, total_seconds)}s ago"
    minutes = total_seconds // 60
    if minutes < 60:
        return f"{minutes}m"
    hours = minutes // 60
    rem_min = minutes % 60
    if hours < 24:
        return f"{hours}h {rem_min}m"
    days = hours // 24
    rem_h = hours % 24
    return f"{days}d {rem_h}h"


@router.get("/maintenance/dashboard/summary")
@router.get("/maintenance/dashboard")
def get_maintenance_dashboard_summary(
    hotel_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    hotel_id = None if hasattr(hotel_id, "default") else hotel_id
    target_hotel_id = hotel_id or current_user.hotel_id
    if not target_hotel_id and current_user.role == "super-admin":
        first_hotel = db.query(models.Hotel.id).first()
        target_hotel_id = first_hotel[0] if first_hotel else 1

    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)

    # 1. Fetch relevant entities for this hotel
    requests_query = db.query(models.MaintenanceRequest)
    rooms_query = db.query(models.Room)
    staff_query = db.query(models.Staff).filter(models.Staff.status == "active")
    work_orders_query = db.query(models.MaintenanceWorkOrder)
    assets_query = db.query(models.MaintenanceAsset)
    pm_query = db.query(models.PreventiveMaintenancePlan).filter(models.PreventiveMaintenancePlan.is_active == True)

    if target_hotel_id:
        requests_query = requests_query.filter(models.MaintenanceRequest.hotel_id == target_hotel_id)
        rooms_query = rooms_query.filter(models.Room.hotel_id == target_hotel_id)
        staff_query = staff_query.filter(models.Staff.hotel_id == target_hotel_id)
        work_orders_query = work_orders_query.filter(models.MaintenanceWorkOrder.hotel_id == target_hotel_id)
        assets_query = assets_query.filter(models.MaintenanceAsset.hotel_id == target_hotel_id)
        pm_query = pm_query.filter(models.PreventiveMaintenancePlan.hotel_id == target_hotel_id)

    all_requests = requests_query.order_by(models.MaintenanceRequest.id.desc()).all()
    all_rooms = rooms_query.all()
    all_staff = staff_query.all()
    all_work_orders = work_orders_query.order_by(models.MaintenanceWorkOrder.id.desc()).all()
    all_assets = assets_query.all()
    all_pm_plans = pm_query.all()

    rooms_map = {r.id: r for r in all_rooms}
    staff_map = {s.id: s for s in all_staff}
    assets_map = {a.id: a for a in all_assets}

    # Fetch active stays for guest names
    active_stays = []
    if target_hotel_id:
        active_stays = db.query(models.Booking).filter(
            models.Booking.hotel_id == target_hotel_id,
            models.Booking.status.in_(["checked-in", "checked_in", "occupied"]),
        ).all()
    guest_ids = [b.guest_id for b in active_stays if b.guest_id]
    guests_map = {
        g.id: g.full_name
        for g in db.query(models.Guest).filter(models.Guest.id.in_(guest_ids)).all()
    } if guest_ids else {}
    room_guest_map = {b.room_id: guests_map.get(b.guest_id) for b in active_stays if b.room_id}

    # Technician identification
    roster_records = (
        db.query(models.MaintenanceTechnicianRoster.staff_id)
        .filter(models.MaintenanceTechnicianRoster.hotel_id == target_hotel_id)
        .all()
    ) if target_hotel_id else []
    assigned_tech_ids = {r[0] for r in roster_records}

    designated_techs = [s for s in all_staff if s.id in assigned_tech_ids]
    if not designated_techs:
        # Fallback to staff in maintenance/engineering/repair roles
        for s in all_staff:
            dept = (s.department or "").lower()
            desig = (s.designation or "").lower()
            if any(k in dept or k in desig for k in ["maint", "eng", "tech", "electric", "plumb", "carpenter", "mechanic", "repair"]):
                designated_techs.append(s)
    if not designated_techs:
        designated_techs = all_staff

    # 2. Compute KPIs
    open_reqs = [r for r in all_requests if (r.status or "open").lower() in ["open", "assigned"]]
    in_prog_reqs = [r for r in all_requests if (r.status or "").lower() in ["in-progress", "in_progress"]]
    pending_parts_reqs = [r for r in all_requests if (r.status or "").lower() == "pending_parts"]
    resolved_reqs = [r for r in all_requests if (r.status or "").lower() in ["completed", "verified", "closed"]]
    active_reqs = [r for r in all_requests if (r.status or "").lower() not in ["completed", "verified", "closed", "cancelled"]]
    critical_reqs = [r for r in active_reqs if (r.priority or "").lower() in ["urgent", "high"] or bool(r.blocks_room)]
    unassigned_reqs = [r for r in active_reqs if not r.assigned_staff_id]
    rooms_in_maint = [r for r in all_rooms if (r.status or "").lower() == "maintenance"]

    # Overdue work orders or overdue requests (> 24 hours active)
    overdue_wos = [
        wo for wo in all_work_orders
        if (wo.status or "").lower() in ["assigned", "in_progress", "pending_parts"]
        and wo.created_at and (now - wo.created_at).total_seconds() > 86400
    ]
    overdue_reqs = [
        r for r in active_reqs
        if r.created_at and (now - r.created_at).total_seconds() > 86400
    ]
    overdue_count = len(overdue_wos) if overdue_wos else len(overdue_reqs)

    # Preventive due (next_due_date within next 24 hours or past due)
    pm_due = [p for p in all_pm_plans if p.next_due_date and p.next_due_date <= now + timedelta(days=1)]

    completed_today = sum(
        1 for r in resolved_reqs
        if (r.completed_date and r.completed_date >= today_start)
        or (r.created_at and r.created_at >= today_start)
    )

    kpis = {
        "open_requests": len(open_reqs),
        "in_progress": len(in_prog_reqs),
        "pending_parts": len(pending_parts_reqs),
        "critical_issues": len(critical_reqs),
        "rooms_under_maintenance": len(rooms_in_maint),
        "unassigned_requests": len(unassigned_reqs),
        "overdue_work_orders": overdue_count,
        "preventive_due": len(pm_due),
        "completed_today": completed_today,
        "total_active": len(active_reqs),
        "total_all_time": len(all_requests),
    }

    # 3. Status Distribution
    status_order = [
        ("open", "Open / Reported"),
        ("assigned", "Assigned"),
        ("in-progress", "In Progress"),
        ("pending_parts", "Waiting for Parts"),
        ("completed", "Completed"),
        ("verified", "Verified"),
        ("closed", "Closed"),
    ]
    total_req_count = len(all_requests)
    status_distribution = []
    for s_code, s_label in status_order:
        cnt = sum(
            1 for r in all_requests
            if (r.status or "open").lower().replace("_", "-") == s_code
            or (s_code == "in-progress" and (r.status or "").lower() in ["in-progress", "in_progress"])
        )
        pct = round((cnt / total_req_count * 100), 1) if total_req_count > 0 else 0.0
        status_distribution.append({
            "status": s_code,
            "label": s_label,
            "count": cnt,
            "percentage": pct,
        })

    # 4. Request Sources Distribution
    source_counts = {}
    for r in all_requests:
        src = r.source or "Direct"
        source_counts[src] = source_counts.get(src, 0) + 1
    source_distribution = [
        {
            "source": src,
            "count": cnt,
            "percentage": round((cnt / total_req_count * 100), 1) if total_req_count > 0 else 0.0,
        }
        for src, cnt in sorted(source_counts.items(), key=lambda x: x[1], reverse=True)
    ]

    # Helper to serialize request
    def serialize_req(r: models.MaintenanceRequest) -> Dict[str, Any]:
        rm = rooms_map.get(r.room_id)
        stf = staff_map.get(r.assigned_staff_id)
        ast = assets_map.get(r.asset_id)
        age_seconds = int((now - r.created_at).total_seconds()) if r.created_at else 0
        return {
            "id": r.id,
            "hotel_id": r.hotel_id,
            "room_id": r.room_id,
            "room_number": rm.room_number if rm else None,
            "room_type": rm.room_type if rm else "Standard",
            "floor": rm.floor if rm else None,
            "guest_name": room_guest_map.get(r.room_id),
            "asset_id": r.asset_id,
            "asset_name": ast.name if ast else None,
            "asset_code": ast.asset_code if ast else None,
            "assigned_staff_id": r.assigned_staff_id,
            "assigned_staff_name": stf.full_name if stf else "Unassigned",
            "category": r.category or "General",
            "source": r.source or "Direct",
            "priority": (r.priority or "normal").lower(),
            "status": (r.status or "open").lower(),
            "blocks_room": bool(r.blocks_room),
            "issue_title": r.issue_title,
            "issue_description": r.issue_description,
            "estimated_cost": float(r.estimated_cost or 0.0),
            "actual_cost": float(r.actual_cost or 0.0),
            "remarks": r.remarks,
            "reported_by": r.reported_by or "Staff",
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "age_formatted": _format_age(r.created_at),
            "age_seconds": age_seconds,
        }

    # 5. Lists
    serialized_active = [serialize_req(r) for r in active_reqs[:20]]
    serialized_critical = [serialize_req(r) for r in critical_reqs[:15]]
    serialized_unassigned = [serialize_req(r) for r in unassigned_reqs[:15]]
    serialized_waiting_parts = [serialize_req(r) for r in pending_parts_reqs[:15]]

    # 6. Work Queue (Prioritized operational tasks)
    work_queue_items = []
    seen_ids = set()
    # Critical unassigned first
    for r in unassigned_reqs:
        if (r.priority or "").lower() in ["urgent", "high"] and r.id not in seen_ids:
            item = serialize_req(r)
            item["queue_reason"] = "Critical Unassigned Request"
            item["suggested_action"] = "Assign Technician"
            work_queue_items.append(item)
            seen_ids.add(r.id)
    # Rooms blocked
    for r in active_reqs:
        if bool(r.blocks_room) and r.id not in seen_ids:
            item = serialize_req(r)
            item["queue_reason"] = "Room Blocked from Inventory"
            item["suggested_action"] = "Accelerate Repair"
            work_queue_items.append(item)
            seen_ids.add(r.id)
    # Waiting for parts
    for r in pending_parts_reqs:
        if r.id not in seen_ids:
            item = serialize_req(r)
            item["queue_reason"] = "Blocked Waiting for Parts"
            item["suggested_action"] = "Request Procurement"
            work_queue_items.append(item)
            seen_ids.add(r.id)
    # In-progress normal
    for r in in_prog_reqs:
        if r.id not in seen_ids:
            item = serialize_req(r)
            item["queue_reason"] = "Active Repair in Progress"
            item["suggested_action"] = "Complete Maintenance"
            work_queue_items.append(item)
            seen_ids.add(r.id)
    # Normal unassigned
    for r in unassigned_reqs:
        if r.id not in seen_ids:
            item = serialize_req(r)
            item["queue_reason"] = "Pending Assignment"
            item["suggested_action"] = "Assign Technician"
            work_queue_items.append(item)
            seen_ids.add(r.id)

    # 7. Rooms Under Maintenance
    rooms_under_maintenance_list = []
    for rm in all_rooms:
        is_maint_status = (rm.status or "").lower() == "maintenance"
        matching_req = next((r for r in active_reqs if r.room_id == rm.id), None)
        if is_maint_status or (matching_req and matching_req.blocks_room):
            tech = staff_map.get(matching_req.assigned_staff_id) if matching_req else None
            rooms_under_maintenance_list.append({
                "room_id": rm.id,
                "room_number": rm.room_number,
                "room_type": rm.room_type or "Deluxe",
                "floor": rm.floor or "1",
                "room_status": rm.status,
                "maintenance_issue": matching_req.issue_title if matching_req else "Room scheduled for maintenance check",
                "maintenance_status": (matching_req.status if matching_req else "scheduled").lower(),
                "priority": (matching_req.priority if matching_req else "normal").lower(),
                "assigned_technician": tech.full_name if tech else "Unassigned",
                "blocks_room": True,
                "started": _format_age(matching_req.created_at) if matching_req else "Recently",
            })

    # 8. Technician Workload
    tech_workload_list = []
    for tech in designated_techs:
        assigned_to_tech = [r for r in active_reqs if r.assigned_staff_id == tech.id]
        active_jobs = len(assigned_to_tech)
        high_pri = sum(1 for r in assigned_to_tech if (r.priority or "").lower() in ["urgent", "high"])
        waiting_parts = sum(1 for r in assigned_to_tech if (r.status or "").lower() == "pending_parts")
        overdue_jobs = sum(1 for r in assigned_to_tech if r.created_at and (now - r.created_at).total_seconds() > 86400)
        
        status_label = "Available"
        if active_jobs > 3:
            status_label = "Heavy Load"
        elif active_jobs > 0:
            status_label = "Active"

        tech_workload_list.append({
            "staff_id": tech.id,
            "full_name": tech.full_name,
            "designation": tech.designation or "Maintenance Technician",
            "department": tech.department or "Maintenance",
            "phone": tech.phone,
            "active_jobs": active_jobs,
            "high_priority": high_pri,
            "waiting_parts": waiting_parts,
            "overdue": overdue_jobs,
            "workload_status": status_label,
        })

    # 9. Preventive Maintenance Due Plans
    pm_due_list = []
    for plan in all_pm_plans:
        is_overdue = bool(plan.next_due_date and plan.next_due_date < now)
        is_due_soon = bool(plan.next_due_date and plan.next_due_date <= now + timedelta(days=7))
        if is_overdue or is_due_soon:
            ast = assets_map.get(plan.asset_id)
            stf = staff_map.get(plan.assigned_staff_id)
            pm_due_list.append({
                "id": plan.id,
                "title": plan.title,
                "asset_id": plan.asset_id,
                "asset_name": ast.name if ast else "General Equipment",
                "category": plan.category,
                "location": plan.location or (ast.location if ast else "Hotel Grounds"),
                "frequency": plan.frequency,
                "next_due_date": plan.next_due_date.isoformat() if plan.next_due_date else None,
                "is_overdue": is_overdue,
                "assigned_staff_name": stf.full_name if stf else "Unassigned",
            })

    # 10. Asset Health
    asset_statuses = {"operational": 0, "degraded": 0, "broken": 0, "under_repair": 0, "disposed": 0}
    for a in all_assets:
        st = (a.status or "operational").lower()
        if st in asset_statuses:
            asset_statuses[st] += 1
        else:
            asset_statuses["operational"] += 1
    
    asset_health = {
        "total": len(all_assets),
        "operational": asset_statuses["operational"],
        "attention_required": asset_statuses["degraded"] + asset_statuses["broken"] + asset_statuses["under_repair"],
        "under_maintenance": asset_statuses["under_repair"],
        "out_of_service": asset_statuses["broken"] + asset_statuses["disposed"],
        "critical_assets": [
            {
                "id": a.id,
                "name": a.name,
                "code": a.asset_code,
                "category": a.category,
                "location": a.location,
                "status": a.status,
            }
            for a in all_assets if (a.status or "").lower() in ["broken", "degraded", "under_repair"]
        ][:6],
    }

    # 11. Alerts (Derived strictly from real conditions)
    alerts = []
    for r in unassigned_reqs:
        if (r.priority or "").lower() in ["urgent", "high"]:
            rm = rooms_map.get(r.room_id)
            r_str = f"Room {rm.room_number}" if rm else "General Facility"
            alerts.append({
                "id": f"alert-unassigned-{r.id}",
                "severity": "critical",
                "title": f"Critical Unassigned Request",
                "message": f"[{r.category}] {r.issue_title} for {r_str} has no technician assigned.",
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "link": f"/maintenance/requests",
            })

    for rm in rooms_in_maint:
        alerts.append({
            "id": f"alert-room-{rm.id}",
            "severity": "warning",
            "title": f"Room Blocked for Maintenance",
            "message": f"Room {rm.room_number} ({rm.room_type}) is currently out of service.",
            "link": f"/rooms",
        })

    for p in pm_due:
        if p.next_due_date and p.next_due_date < now:
            alerts.append({
                "id": f"alert-pm-{p.id}",
                "severity": "warning",
                "title": "Preventive Maintenance Overdue",
                "message": f"Scheduled task '{p.title}' was due on {p.next_due_date.strftime('%Y-%m-%d')}.",
                "link": f"/maintenance/preventive",
            })

    for r in pending_parts_reqs:
        rm = rooms_map.get(r.room_id)
        r_str = f"Room {rm.room_number}" if rm else "Facility"
        alerts.append({
            "id": f"alert-part-{r.id}",
            "severity": "info",
            "title": "Awaiting Spare Parts",
            "message": f"{r.issue_title} ({r_str}) is on hold for replacement parts.",
            "link": f"/maintenance/work-orders",
        })

    # 12. Recent Activity
    recent_activity = []
    for r in all_requests[:8]:
        rm = rooms_map.get(r.room_id)
        recent_activity.append({
            "id": r.id,
            "timestamp": r.created_at.isoformat() if r.created_at else None,
            "time_formatted": _format_age(r.created_at),
            "actor": r.reported_by or "Staff",
            "action": f"Reported issue: {r.issue_title}",
            "room_number": rm.room_number if rm else "N/A",
            "status": r.status or "open",
            "priority": r.priority or "normal",
        })

    return {
        "hotel_id": target_hotel_id,
        "kpis": kpis,
        "status_distribution": status_distribution,
        "source_distribution": source_distribution,
        "active_requests": serialized_active,
        "critical_issues": serialized_critical,
        "work_queue": work_queue_items[:15],
        "rooms_under_maintenance": rooms_under_maintenance_list,
        "technician_workload": tech_workload_list,
        "unassigned_requests": serialized_unassigned,
        "waiting_for_parts": serialized_waiting_parts,
        "preventive_maintenance_due": pm_due_list,
        "asset_health": asset_health,
        "alerts": alerts,
        "recent_activity": recent_activity,
    }


# =========================================================================
# 1. MAINTENANCE REQUESTS ENDPOINTS
# =========================================================================

@router.get("/maintenance-requests/")
@router.get("/maintenance-requests")
def list_maintenance_requests_overview(
    hotel_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    hotel_id = None if hasattr(hotel_id, "default") else hotel_id
    status = None if hasattr(status, "default") else status
    priority = None if hasattr(priority, "default") else priority
    category = None if hasattr(category, "default") else category
    source = None if hasattr(source, "default") else source

    target_hotel_id = hotel_id or current_user.hotel_id

    query = db.query(models.MaintenanceRequest)
    if target_hotel_id:
        query = query.filter(models.MaintenanceRequest.hotel_id == target_hotel_id)
        rooms_map = {r.id: r for r in db.query(models.Room).filter(models.Room.hotel_id == target_hotel_id).all()}
        staff_map = {s.id: s for s in db.query(models.Staff).filter(models.Staff.hotel_id == target_hotel_id).all()}
        assets_map = {a.id: a for a in db.query(models.MaintenanceAsset).filter(models.MaintenanceAsset.hotel_id == target_hotel_id).all()}

        active_stays = db.query(models.Booking).filter(
            models.Booking.hotel_id == target_hotel_id,
            models.Booking.status.in_(["checked-in", "checked_in", "occupied"]),
        ).all()
    else:
        # Super-admin with unspecified hotel: query across all hotels
        rooms_map = {r.id: r for r in db.query(models.Room).all()}
        staff_map = {s.id: s for s in db.query(models.Staff).all()}
        assets_map = {a.id: a for a in db.query(models.MaintenanceAsset).all()}

        active_stays = db.query(models.Booking).filter(
            models.Booking.status.in_(["checked-in", "checked_in", "occupied"]),
        ).all()

    if status and status != "all":
        query = query.filter(models.MaintenanceRequest.status == status)
    if priority and priority != "all":
        query = query.filter(models.MaintenanceRequest.priority == priority)
    if category and category != "all":
        query = query.filter(models.MaintenanceRequest.category == category)
    if source and source != "all":
        query = query.filter(models.MaintenanceRequest.source == source)

    records = query.order_by(models.MaintenanceRequest.id.desc()).all()

    guest_ids = [b.guest_id for b in active_stays if b.guest_id]
    guests_map = {
        g.id: g.full_name
        for g in db.query(models.Guest).filter(models.Guest.id.in_(guest_ids)).all()
    } if guest_ids else {}
    room_guest_map = {b.room_id: guests_map.get(b.guest_id) for b in active_stays if b.room_id}

    items = []
    total = len(records)
    open_count = 0
    in_prog_count = 0
    parts_count = 0
    resolved_count = 0

    for r in records:
        st = (r.status or "open").lower()
        if st in ["open", "assigned"]:
            open_count += 1
        elif st in ["in-progress", "in_progress"]:
            in_prog_count += 1
        elif st == "pending_parts":
            parts_count += 1
        elif st in ["completed", "verified", "closed"]:
            resolved_count += 1

        room = rooms_map.get(r.room_id)
        staff = staff_map.get(r.assigned_staff_id)
        asset = assets_map.get(r.asset_id)

        items.append({
            "id": r.id,
            "hotel_id": r.hotel_id,
            "room_id": r.room_id,
            "room_number": room.room_number if room else None,
            "guest_name": room_guest_map.get(r.room_id),
            "asset_id": r.asset_id,
            "asset_name": asset.name if asset else None,
            "asset_code": asset.asset_code if asset else None,
            "assigned_staff_id": r.assigned_staff_id,
            "assigned_staff_name": staff.full_name if staff else (r.reported_by or "Unassigned"),
            "category": r.category or "General",
            "source": r.source or "Direct",
            "priority": r.priority or "normal",
            "status": r.status or "open",
            "blocks_room": bool(r.blocks_room),
            "issue_title": r.issue_title,
            "issue_description": r.issue_description,
            "estimated_cost": float(r.estimated_cost or 0.0),
            "actual_cost": float(r.actual_cost or 0.0),
            "remarks": r.remarks,
            "reported_by": r.reported_by,
            "created_at": r.created_at,
        })

    return {
        "total": total,
        "open": open_count,
        "in_progress": in_prog_count,
        "pending_parts": parts_count,
        "resolved": resolved_count,
        "requests": items,
    }


@router.post("/maintenance-requests/")
@router.post("/maintenance-requests")
def create_maintenance_request(
    data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    hotel_id = data.get("hotel_id") or current_user.hotel_id
    if not hotel_id and current_user.role == "super-admin":
        first_hotel = db.query(models.Hotel.id).first()
        hotel_id = first_hotel[0] if first_hotel else 1

    room_id = data.get("room_id")
    blocks_room = bool(data.get("blocks_room", False))

    if room_id and blocks_room:
        room = db.query(models.Room).filter(models.Room.id == room_id).first()
        if room:
            room.status = "maintenance"

    new_req = models.MaintenanceRequest(
        hotel_id=hotel_id,
        room_id=room_id,
        asset_id=data.get("asset_id"),
        assigned_staff_id=data.get("assigned_staff_id"),
        category=data.get("category", "General"),
        source=data.get("source", "Direct"),
        priority=data.get("priority", "normal"),
        status=data.get("status", "open"),
        blocks_room=blocks_room,
        issue_title=data.get("issue_title"),
        issue_description=data.get("issue_description"),
        estimated_cost=float(data.get("estimated_cost") or 0.0),
        actual_cost=float(data.get("actual_cost") or 0.0),
        remarks=data.get("remarks"),
        reported_by=current_user.full_name or current_user.username,
        created_by_user_id=current_user.id,
        created_at=datetime.utcnow(),
    )

    db.add(new_req)
    db.commit()
    db.refresh(new_req)
    return {"message": "Request created successfully", "id": new_req.id}


@router.put("/maintenance-requests/{request_id}")
def update_maintenance_request(
    request_id: int,
    data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    req = db.query(models.MaintenanceRequest).filter(
        models.MaintenanceRequest.id == request_id
    ).first()

    if not req:
        raise HTTPException(status_code=404, detail="Maintenance request not found")

    if current_user.role != "super-admin" and req.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    for field in [
        "room_id", "asset_id", "assigned_staff_id", "category",
        "source", "priority", "status", "blocks_room", "issue_title",
        "issue_description", "estimated_cost", "actual_cost", "remarks"
    ]:
        if field in data:
            setattr(req, field, data[field])

    # If blocks_room is set to True, set room status to maintenance
    if req.room_id and req.blocks_room and req.status not in ["completed", "verified", "closed", "cancelled"]:
        room = db.query(models.Room).filter(models.Room.id == req.room_id).first()
        if room:
            room.status = "maintenance"

    # Revert room status to dirty (ready for housekeeping turnover) when work completes
    if req.room_id and req.status in ["completed", "verified", "closed", "cancelled"]:
        other_blocking = db.query(models.MaintenanceRequest).filter(
            models.MaintenanceRequest.room_id == req.room_id,
            models.MaintenanceRequest.id != req.id,
            models.MaintenanceRequest.blocks_room == True,
            models.MaintenanceRequest.status.in_(["open", "assigned", "in-progress", "pending_parts"]),
        ).first()
        if not other_blocking:
            room = db.query(models.Room).filter(models.Room.id == req.room_id).first()
            if room and room.status == "maintenance":
                room.status = "dirty"

    db.commit()
    return {"message": "Request updated successfully", "id": req.id}


@router.delete("/maintenance-requests/{request_id}")
def delete_maintenance_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    req = db.query(models.MaintenanceRequest).filter(
        models.MaintenanceRequest.id == request_id
    ).first()

    if not req:
        raise HTTPException(status_code=404, detail="Maintenance request not found")

    if current_user.role not in ["super-admin", "hotel-admin"] and current_user.role_level != "department_head":
        raise HTTPException(
            status_code=403,
            detail="Only hotel admins or department heads can delete maintenance requests."
        )

    if current_user.role != "super-admin" and req.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    # If this request was blocking room, check whether to release room status
    if req.room_id and req.blocks_room:
        other_blocking = db.query(models.MaintenanceRequest).filter(
            models.MaintenanceRequest.room_id == req.room_id,
            models.MaintenanceRequest.id != req.id,
            models.MaintenanceRequest.blocks_room == True,
            models.MaintenanceRequest.status.in_(["open", "assigned", "in-progress", "pending_parts"]),
        ).first()
        if not other_blocking:
            room = db.query(models.Room).filter(models.Room.id == req.room_id).first()
            if room and room.status == "maintenance":
                room.status = "dirty"

    db.delete(req)
    db.commit()
    return {"message": "Request deleted successfully"}


# =========================================================================
# 2. TECHNICIAN ROSTER & SELECTION
# =========================================================================

@router.get("/maintenance/technician-roster")
def get_technician_roster(
    hotel_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    hotel_id = None if hasattr(hotel_id, "default") else hotel_id
    target_hotel_id = hotel_id or current_user.hotel_id
    if not target_hotel_id and current_user.role == "super-admin":
        first_hotel = db.query(models.Hotel.id).first()
        target_hotel_id = first_hotel[0] if first_hotel else 1

    candidates = (
        db.query(models.Staff)
        .filter(
            models.Staff.hotel_id == target_hotel_id,
            models.Staff.status == "active",
        )
        .filter(
            or_(
                models.Staff.department.ilike("%maint%"),
                models.Staff.department.ilike("%eng%"),
                models.Staff.designation.ilike("%maint%"),
                models.Staff.designation.ilike("%tech%"),
                models.Staff.designation.ilike("%electric%"),
                models.Staff.designation.ilike("%plumb%"),
                models.Staff.designation.ilike("%carpenter%"),
                models.Staff.designation.ilike("%mechanic%"),
                models.Staff.designation.ilike("%repair%"),
            )
        )
        .order_by(models.Staff.full_name.asc())
        .all()
    )

    if not candidates:
        # Fallback to all active staff in the hotel
        candidates = (
            db.query(models.Staff)
            .filter(
                models.Staff.hotel_id == target_hotel_id,
                models.Staff.status == "active",
            )
            .order_by(models.Staff.full_name.asc())
            .all()
        )

    roster_records = (
        db.query(models.MaintenanceTechnicianRoster.staff_id)
        .filter(models.MaintenanceTechnicianRoster.hotel_id == target_hotel_id)
        .all()
    )
    assigned_ids = {r[0] for r in roster_records}

    if not assigned_ids:
        assigned_ids = {s.id for s in candidates}

    return [
        {
            "id": staff.id,
            "full_name": staff.full_name,
            "department": staff.department,
            "designation": staff.designation,
            "is_assigned": staff.id in assigned_ids,
        }
        for staff in candidates
    ]


@router.post("/maintenance/technician-roster")
def save_technician_roster(
    payload: TechnicianRosterPayload,
    hotel_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    hotel_id = None if hasattr(hotel_id, "default") else hotel_id
    target_hotel_id = hotel_id or current_user.hotel_id
    if not target_hotel_id and current_user.role == "super-admin":
        first_hotel = db.query(models.Hotel.id).first()
        target_hotel_id = first_hotel[0] if first_hotel else 1

    if current_user.role not in ["super-admin", "hotel-admin"] and current_user.role_level != "department_head":
        raise HTTPException(
            status_code=403,
            detail="Only hotel admins or department heads can update the technician roster."
        )

    db.query(models.MaintenanceTechnicianRoster).filter(
        models.MaintenanceTechnicianRoster.hotel_id == target_hotel_id
    ).delete(synchronize_session=False)

    for sid in set(payload.staff_ids):
        db.add(
            models.MaintenanceTechnicianRoster(
                hotel_id=target_hotel_id,
                staff_id=sid,
                created_at=datetime.utcnow(),
            )
        )
    db.commit()
    return {"message": "Technician assignment roster saved successfully", "count": len(payload.staff_ids)}


@router.get("/maintenance/technicians")
def get_designated_technicians(
    hotel_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    hotel_id = None if hasattr(hotel_id, "default") else hotel_id
    target_hotel_id = hotel_id or current_user.hotel_id
    if not target_hotel_id and current_user.role == "super-admin":
        first_hotel = db.query(models.Hotel.id).first()
        target_hotel_id = first_hotel[0] if first_hotel else 1

    roster_records = (
        db.query(models.MaintenanceTechnicianRoster.staff_id)
        .filter(models.MaintenanceTechnicianRoster.hotel_id == target_hotel_id)
        .all()
    )
    assigned_ids = [r[0] for r in roster_records]

    query = db.query(models.Staff).filter(
        models.Staff.hotel_id == target_hotel_id,
        models.Staff.status == "active",
    )

    if assigned_ids:
        query = query.filter(models.Staff.id.in_(assigned_ids))
    else:
        candidates = query.filter(
            or_(
                models.Staff.department.ilike("%maint%"),
                models.Staff.department.ilike("%eng%"),
                models.Staff.designation.ilike("%maint%"),
                models.Staff.designation.ilike("%tech%"),
                models.Staff.designation.ilike("%electric%"),
                models.Staff.designation.ilike("%plumb%"),
                models.Staff.designation.ilike("%carpenter%"),
                models.Staff.designation.ilike("%mechanic%"),
                models.Staff.designation.ilike("%repair%"),
            )
        ).all()
        if candidates:
            return [
                {
                    "id": s.id,
                    "full_name": s.full_name,
                    "department": s.department,
                    "designation": s.designation,
                }
                for s in candidates
            ]
        # Otherwise query all active staff
        query = db.query(models.Staff).filter(
            models.Staff.hotel_id == target_hotel_id,
            models.Staff.status == "active",
        )

    staff_list = query.order_by(models.Staff.full_name.asc()).all()
    return [
        {
            "id": s.id,
            "full_name": s.full_name,
            "department": s.department,
            "designation": s.designation,
        }
        for s in staff_list
    ]


# =========================================================================
# 3. ASSETS ENDPOINTS
# =========================================================================

@router.get("/maintenance-assets/")
@router.get("/maintenance-assets")
def get_maintenance_assets(
    hotel_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    hotel_id = None if hasattr(hotel_id, "default") else hotel_id
    target_hotel_id = hotel_id or current_user.hotel_id

    query = db.query(models.MaintenanceAsset)
    if target_hotel_id:
        query = query.filter(models.MaintenanceAsset.hotel_id == target_hotel_id)
    assets = query.order_by(models.MaintenanceAsset.name.asc()).all()

    return [
        {
            "id": a.id,
            "hotel_id": a.hotel_id,
            "name": a.name,
            "asset_code": a.asset_code,
            "category": a.category,
            "status": a.status,
        }
        for a in assets
    ]