import re

filepath = 'frontend/src/modules/housekeeping/dashboard/HousekeepingDashboard.jsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove Priority & Timing <th>
content = content.replace(
    '                  <th style={{ minWidth: "150px" }}>Priority & Timing</th>\n',
    ''
)

# 2. Update Actions <th> width
content = content.replace(
    '<th style={{ minWidth: "190px", textAlign: "right" }}>Actions</th>',
    '<th style={{ minWidth: "280px", textAlign: "right" }}>Actions</th>'
)

# 3. Fix colSpan="5" -> colSpan="4" (2 occurrences in empty state rows)
content = content.replace('colSpan="5"', 'colSpan="4"', 2)

# 4. Remove the entire Priority & Timing <td> block (the 4th column cell)
# It starts with: {/* 4. Priority & Timing */}  and ends with </td>
priority_td_pattern = r'\s*\{/\* 4\. Priority & Timing \*/\}\s*<td>.*?</td>\s*\n'
content = re.sub(priority_td_pattern, '\n', content, count=1, flags=re.DOTALL)

# 5. Replace the old actions column content with new (Delete -> Assign, add quick-assign)
# Find the actions <td> block and replace it
old_actions = '''                        {/* 5. Actions (Inspection: Pass/Fail; Completed: Delete; Archived: Restore; Live: Assign/Clean/Issue) */}
                        <td>
                          <div className={styles["row-actions-group"]}>
                            {isAwaitingInspection ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleInspectPass(item)}
                                  className={`${styles["action-pill-btn"]} ${styles["clean"]}`}
                                  style={{
                                    background: "#059669",
                                    color: "#ffffff",
                                    borderColor: "#059669",
                                    fontWeight: 700,
                                    boxShadow: "0 1px 2px rgba(5, 150, 105, 0.2)",
                                    padding: "5px 12px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "5px",
                                  }}
                                  title="Pass inspection: Mark clean & available"
                                >
                                  <Check size={12} />
                                  Pass
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFailConfirmItem(item);
                                    setFailReasonText("");
                                  }}
                                  className={`${styles["action-pill-btn"]} ${styles["issue"]}`}
                                  style={{
                                    background: "#dc2626",
                                    color: "#ffffff",
                                    borderColor: "#dc2626",
                                    fontWeight: 700,
                                    boxShadow: "0 1px 2px rgba(220, 38, 38, 0.2)",
                                    padding: "5px 12px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "5px",
                                  }}
                                  title="Fail inspection: Return room to Dirty / Departed"
                                >
                                  <X size={12} />
                                  Fail
                                </button>
                              </>
                            ) : isArchived ? (
                              <button
                                type="button"
                                onClick={() => handleRestoreTask(item)}
                                className={styles["action-pill-btn"]}
                                style={{
                                  background: "#f0fdf4",
                                  color: "#166534",
                                  border: "1px solid #bbf7d0",
                                  fontWeight: 700,
                                  padding: "5px 12px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                }}
                                title="Restore record back to Completed section"
                              >
                                <RotateCw size={11} />
                                Restore
                              </button>
                            ) : isInspected ? (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmItem(item)}
                                className={`${styles["action-pill-btn"]} ${styles["issue"]}`}
                                style={{
                                  background: "#fee2e2",
                                  color: "#b91c1c",
                                  borderColor: "#fca5a5",
                                  fontWeight: 700,
                                  padding: "5px 12px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                }}
                                title="Delete entry (safely soft-deleted to separate section next to Maintenance Blocked)"
                              >
                                <Trash2 size={12} />
                                Delete
                              </button>
                            ) : (
                              <>
                                {!isCleaning && activeTab !== "in-cleaning" && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAssignModal(item)}
                                    className={`${styles["action-pill-btn"]} ${styles["assign"]}`}
                                    title="Assign cleaning task to staff"
                                  >
                                    <Users size={11} />
                                    Assign
                                  </button>
                                )}

                                {isDirty && (
                                  <button
                                    type="button"
                                    onClick={() => handleMarkClean(item)}
                                    className={`${styles["action-pill-btn"]} ${styles["approve"]}`}
                                    title="Mark basic turnover completed"
                                  >
                                    Mark Clean
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleOpenReportModal(item)}
                                  className={`${styles["action-pill-btn"]} ${styles["issue"]}`}
                                  title="Report room maintenance issue"
                                >
                                  <Wrench size={11} />
                                  Issue
                                </button>
                              </>
                            )}
                          </div>
                        </td>'''

new_actions = '''                        {/* 5. Actions */}
                        <td>
                          <div className={styles["row-actions-group"]} style={{ justifyContent: "flex-end" }}>
                            {isAwaitingInspection ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleInspectPass(item)}
                                  className={`${styles["action-pill-btn"]} ${styles["clean"]}`}
                                  style={{
                                    background: "#059669", color: "#ffffff", borderColor: "#059669",
                                    fontWeight: 700, boxShadow: "0 1px 2px rgba(5, 150, 105, 0.2)",
                                    padding: "5px 12px", display: "inline-flex", alignItems: "center", gap: "5px",
                                  }}
                                  title="Pass inspection: Mark clean & available"
                                >
                                  <Check size={12} /> Pass
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setFailConfirmItem(item); setFailReasonText(""); }}
                                  className={`${styles["action-pill-btn"]} ${styles["issue"]}`}
                                  style={{
                                    background: "#dc2626", color: "#ffffff", borderColor: "#dc2626",
                                    fontWeight: 700, boxShadow: "0 1px 2px rgba(220, 38, 38, 0.2)",
                                    padding: "5px 12px", display: "inline-flex", alignItems: "center", gap: "5px",
                                  }}
                                  title="Fail inspection: Return room to Dirty / Departed"
                                >
                                  <X size={12} /> Fail
                                </button>
                              </>
                            ) : isArchived ? (
                              <button
                                type="button"
                                onClick={() => handleRestoreTask(item)}
                                className={styles["action-pill-btn"]}
                                style={{
                                  background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0",
                                  fontWeight: 700, padding: "5px 12px", display: "inline-flex", alignItems: "center", gap: "5px",
                                }}
                                title="Restore record back to Completed section"
                              >
                                <RotateCw size={11} /> Restore
                              </button>
                            ) : (
                              <>
                                {/* Quick-Assign inline: collapsed button or expanded dropdown */}
                                {quickAssignItemId !== item.id ? (
                                  <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                                    {/* Auto-assign for dirty rooms to previously assigned staff */}
                                    {isDirty && (
                                      <button
                                        type="button"
                                        onClick={() => handleAutoAssignDirty(item)}
                                        disabled={quickAssigning}
                                        style={{
                                          fontSize: "12px", padding: "5px 11px", borderRadius: "6px",
                                          border: "1px solid #1d4ed8", background: "#2563eb",
                                          color: "#fff", fontWeight: 700, cursor: "pointer",
                                          display: "inline-flex", alignItems: "center", gap: "5px",
                                        }}
                                        title="Auto-assign to previously assigned staff"
                                      >
                                        <UserCheck size={12} /> Auto Assign
                                      </button>
                                    )}
                                    {/* Manual assign — opens inline staff dropdown */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setQuickAssignItemId(item.id);
                                        setQuickAssignStaffId(
                                          item.assignedStaffId ? String(item.assignedStaffId) :
                                          staffList[0]?.id ? String(staffList[0].id) : ""
                                        );
                                      }}
                                      className={`${styles["action-pill-btn"]} ${styles["assign"]}`}
                                      title="Assign to a housekeeping staff member"
                                    >
                                      <Users size={11} /> Assign
                                    </button>
                                    {/* Report Issue — only for non-inspected rooms */}
                                    {!isInspected && (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenReportModal(item)}
                                        className={`${styles["action-pill-btn"]} ${styles["issue"]}`}
                                        title="Report room maintenance issue"
                                      >
                                        <Wrench size={11} /> Issue
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  /* Inline staff picker */
                                  <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                                    <select
                                      value={quickAssignStaffId}
                                      onChange={(e) => setQuickAssignStaffId(e.target.value)}
                                      style={{
                                        fontSize: "12px", padding: "5px 8px", borderRadius: "6px",
                                        border: "1px solid #bfdbfe", background: "#eff6ff",
                                        color: "#1d4ed8", fontWeight: 600, cursor: "pointer", minWidth: "140px",
                                      }}
                                    >
                                      <option value="">-- Select Staff --</option>
                                      {staffList.map((s) => (
                                        <option key={s.id} value={s.id}>{s.full_name}</option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => handleQuickAssign(item, quickAssignStaffId)}
                                      disabled={!quickAssignStaffId || quickAssigning}
                                      style={{
                                        fontSize: "12px", padding: "5px 11px", borderRadius: "6px",
                                        border: "1px solid #059669", background: "#059669",
                                        color: "#fff", fontWeight: 700, cursor: "pointer",
                                        display: "inline-flex", alignItems: "center", gap: "4px",
                                      }}
                                    >
                                      <Check size={12} /> {quickAssigning ? "…" : "OK"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setQuickAssignItemId(null); setQuickAssignStaffId(""); }}
                                      style={{
                                        fontSize: "12px", padding: "5px 8px", borderRadius: "6px",
                                        border: "1px solid #e2e8f0", background: "#f8fafc",
                                        color: "#64748b", fontWeight: 600, cursor: "pointer",
                                      }}
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </td>'''

if old_actions in content:
    content = content.replace(old_actions, new_actions, 1)
    print("Actions replacement done")
else:
    print("Actions block NOT found - checking partial match")
    if 'isInspected ? (' in content and 'Delete' in content:
        print("Found Delete in isInspected block - manual fix needed")
    # Try to find key string
    idx = content.find('setDeleteConfirmItem(item)')
    print(f"setDeleteConfirmItem found at: {idx}")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("File saved.")
