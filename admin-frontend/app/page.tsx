"use client";

import React, { useState, useEffect } from "react";

const DOMAINS = [
  "TECHNICAL",
  "MANAGEMENT",
  "DESIGN",
  "EDITORIAL",
  "MEDIA",
  "FINANCE",
];

export default function AdminPortalPrototype() {
  const [baseUrl, setBaseUrl] = useState(
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/admin"
);
  const [token, setToken] = useState("");
  const [adminUser, setAdminUser] = useState<any>(null);
  const [apiLog, setApiLog] = useState("API Console Ready...");
  const [activeTab, setActiveTab] = useState<"applicants" | "slots" | "root" | "forms">("applicants");

  // 1. Auth State
  const [email, setEmail] = useState("musshi68@gmail.com");
  const [password, setPassword] = useState("");

  // 2. Root Admin: Assign Domain Head State
  const [dhEmail, setDhEmail] = useState("");
  const [dhName, setDhName] = useState("");
  const [dhDomain, setDhDomain] = useState("TECHNICAL");

  // 3. Applicants & Review State
  const [applicants, setApplicants] = useState<any[]>([]);
  const [domainFilter, setDomainFilter] = useState("ALL");
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [selectedApplicant, setSelectedApplicant] = useState<any | null>(null);

  // Review Form State
  const [selectedAppId, setSelectedAppId] = useState("");
  const [marks, setMarks] = useState<number>(8);
  const [comments, setComments] = useState("");
  const [stageDecision, setStageDecision] = useState("SHORTLISTED");
  const [sendMailToggle, setSendMailToggle] = useState(true);
  const [meetingLinkInput, setMeetingLinkInput] = useState("https://meet.google.com/tam-vit-interview");

  // 4. Slots & Schedule State (Multi-Day 10-Min Intervals)
  const [slotStart, setSlotStart] = useState("2026-11-01T20:00");
  const [slotEnd, setSlotEnd] = useState("2026-11-02T00:30");
  const [slotMeetLink, setSlotMeetLink] = useState("https://meet.google.com/abc-defg-hij");
  const [slotDomain, setSlotDomain] = useState("TECHNICAL");
  const [scheduleAdminId, setScheduleAdminId] = useState("");
  const [scheduleList, setScheduleList] = useState<any[]>([]);

  // Helper to decode JWT payload so we know adminId, role, and domain automatically
  const decodeJwt = (jwtToken: string) => {
    try {
      const payload = JSON.parse(atob(jwtToken.split(".")[1]));
      return payload;
    } catch {
      return null;
    }
  };

  // Universal API Caller
  const apiRequest = async (path: string, method = "GET", body?: any) => {
    setApiLog(`Sending ${method} ${baseUrl}${path}...`);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body && method !== "GET" ? JSON.stringify(body) : undefined,
      });

      const data = await res.json().catch(() => ({}));
      setApiLog(
        `Status: ${res.status} ${res.statusText} (${method} ${path})\n\n` +
          JSON.stringify(data, null, 2)
      );
      return { ok: res.ok, status: res.status, data };
    } catch (err: any) {
      setApiLog(`Network Error: ${err.message}\nCheck that backend is running on port 5000.`);
      return { ok: false, status: 0, data: null };
    }
  };

  // Auth Handlers
  const handleSetup = async () => {
    await apiRequest("/setup", "POST", { email, password });
  };

  const handleLogin = async () => {
    const res = await apiRequest("/login", "POST", { email, password });
    if (res.ok && res.data?.token) {
      const jwt = res.data.token;
      setToken(jwt);
      const decoded = decodeJwt(jwt);
      const userObj = {
        ...(res.data.admin || res.data.user || {}),
        ...(decoded || {}),
        email: res.data.admin?.email || decoded?.email || email,
        role: res.data.admin?.role || decoded?.role || "DOMAIN_HEAD",
        domain: res.data.admin?.domain || decoded?.domain || "",
      };
      setAdminUser(userObj);
      
      if (userObj.id || userObj.adminId || decoded?.id) {
        setScheduleAdminId(userObj.id || userObj.adminId || decoded?.id);
      }
      if (userObj.domain) {
        setSlotDomain(userObj.domain);
        setDomainFilter(userObj.domain);
      }
    }
  };

  // Fetch All Applicants (Enforcing Domain Head restrictions)
  const loadApplicants = async () => {
    let queryDomain = domainFilter;
    if (adminUser?.role === "DOMAIN_HEAD" && adminUser?.domain) {
      queryDomain = adminUser.domain;
    }

    const query = queryDomain && queryDomain !== "ALL" ? `?domain=${queryDomain}` : "";
    const res = await apiRequest(`/applicants${query}`, "GET");
    if (res.ok) {
      const list = Array.isArray(res.data)
        ? res.data
        : res.data?.applicants || res.data?.data || [];
      setApplicants(list);
    }
  };

  // Fetch Single Applicant Full Profile + Domain Responses
  const openReviewModal = async (candidateOrAppId: string, defaultAppId?: string) => {
    const res = await apiRequest(`/applicants/${candidateOrAppId}`, "GET");
    if (res.ok) {
      const detail = res.data?.applicant || res.data?.data || res.data;
      setSelectedApplicant(detail);
      const firstApp = detail?.applications?.[0] || detail;
      setSelectedAppId(defaultAppId || firstApp?.id || candidateOrAppId);
      setComments(firstApp?.review1Comments || firstApp?.comments || "");
      setMarks(firstApp?.review1Marks ?? firstApp?.marks ?? 8);
      setStageDecision(firstApp?.stage || "SHORTLISTED");
    }
  };

  // Submit Grade, Review Comments & Email Trigger
  const submitReview = async () => {
    if (!selectedAppId) {
      alert("Please enter or select an Application ID to review.");
      return;
    }
    const payload = {
      stage: stageDecision,
      status: stageDecision,
      marks: Number(marks),
      score: Number(marks),
      review1Marks: Number(marks),
      comments,
      reviewComments: comments,
      review1Comments: comments,
      review1Passed: stageDecision === "SHORTLISTED" || stageDecision === "SELECTED",
      sendEmail: sendMailToggle,
      notifyCandidate: sendMailToggle,
      meetingLink: meetingLinkInput,
    };
    await apiRequest(`/applicants/${selectedAppId}/review`, "PUT", payload);
    loadApplicants();
  };

  // Root Admin: Assign Domain Head
  const handleAssignDomainHead = async () => {
    const emailArray = dhEmail.split(",").map((email) => email.trim()).filter(Boolean);

    await apiRequest("/domain-heads", "POST", {
      emails: emailArray, 
      domain: dhDomain,
      role: "DOMAIN_HEAD",
    });
    
    setDhEmail("");
    setDhName("");
  };

  // Generate 10-Minute Exclusive Slots Range (Multi-Day)
  const handleCreateSlot = async () => {
    const adminIdToUse = adminUser?.id || scheduleAdminId;
    if (!adminIdToUse) {
      alert("Admin ID is missing. Please check your login details.");
      return;
    }

    const startIso = new Date(slotStart).toISOString();
    const endIso = new Date(slotEnd).toISOString();

    const payload = {
      interviewerId: adminIdToUse,
      domain: slotDomain,
      meetingLink: slotMeetLink,
      startTime: startIso,
      endTime: endIso,
    };

    const res = await apiRequest("/slots", "POST", payload);
    if (res.ok) {
      alert("10-minute exclusive interview slots generated successfully!");
      handleFetchAllSlots(); // Automatically load and show generated slots
    }
  };

  // Fetch All Slots (Including unbooked/available ones for verification)
  const handleFetchAllSlots = async () => {
    const adminIdToUse = adminUser?.id || scheduleAdminId;
    if (!adminIdToUse) {
      alert("Enter your Admin ID first.");
      return;
    }
    const res = await apiRequest(`/schedule/${adminIdToUse}?all=true`, "GET");
    if (res.ok) {
      const rawSlots = Array.isArray(res.data)
        ? res.data
        : res.data?.schedule || res.data?.slots || res.data?.data || [];
      const sorted = [...rawSlots].sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
      setScheduleList(sorted);
    }
  };

  // Fetch Booked Schedule Only
  const handleFetchBookedSchedule = async () => {
    const adminIdToUse = adminUser?.id || scheduleAdminId;
    if (!adminIdToUse) {
      alert("Enter your Admin ID first.");
      return;
    }
    const res = await apiRequest(`/schedule/${adminIdToUse}`, "GET");
    if (res.ok) {
      const rawSlots = Array.isArray(res.data)
        ? res.data
        : res.data?.schedule || res.data?.slots || res.data?.data || [];
      const sorted = [...rawSlots].sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
      setScheduleList(sorted);
    }
  };

  useEffect(() => {
    if (token) {
      loadApplicants();
    }
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Bar */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              TAM-VIT Recruitment Admin Portal
            </h1>
            <p className="text-xs text-slate-500 font-mono mt-1">
              API Base: {baseUrl}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {token ? (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-800">
                    {adminUser?.email || email}
                  </p>
                  <p className="text-xs font-mono text-indigo-600">
                    Role: {adminUser?.role || "ADMIN"} | Domain:{" "}
                    {adminUser?.domain || "ALL (ROOT)"}
                  </p>
                </div>
                <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-full">
                  Active JWT
                </span>
                <button
                  onClick={() => {
                    setToken("");
                    setAdminUser(null);
                    setApplicants([]);
                    setScheduleList([]);
                  }}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded"
                >
                  Logout
                </button>
              </div>
            ) : (
              <span className="bg-rose-100 text-rose-700 text-xs font-bold px-3 py-1.5 rounded-full">
                Not Logged In
              </span>
            )}
          </div>
        </div>

        {/* Auth Card (Always visible when logged out) */}
        {!token && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-lg font-bold text-slate-800">
              1. Admin & Domain Head Authentication
            </h2>
            <p className="text-sm text-slate-600">
              If your email was just whitelisted by the Root Admin (or seeded in Prisma Studio),
              click <b>Create Password (/setup)</b> first, then click <b>Login (/login)</b>.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="email"
                placeholder="Admin Email (e.g. musshi68@gmail.com)"
                className="border border-slate-300 p-2.5 rounded-lg"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                type="password"
                placeholder="Password"
                className="border border-slate-300 p-2.5 rounded-lg"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleLogin}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm"
              >
                Login (POST /login)
              </button>
              <button
                onClick={handleSetup}
                className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm"
              >
                Create First-Time Password (POST /setup)
              </button>
            </div>
          </div>
        )}

        {/* Navigation Tabs (Visible when logged in) */}
        {token && (
          <div className="flex flex-wrap gap-2 border-b border-slate-300 pb-2">
            <button
              onClick={() => setActiveTab("applicants")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                activeTab === "applicants"
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-700 hover:bg-slate-200"
              }`}
            >
              Candidates & Reviews ({applicants.length})
            </button>
            <button
              onClick={() => setActiveTab("slots")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                activeTab === "slots"
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-700 hover:bg-slate-200"
              }`}
            >
              Interview Slots & Ascending Schedule
            </button>

            {adminUser?.role === "ROOT_ADMIN" && (
              <button
                onClick={() => setActiveTab("root")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                  activeTab === "root"
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-indigo-700 hover:bg-indigo-50"
                }`}
              >
                Root Admin: Assign Domain Heads
              </button>
            )}
          </div>
        )}

        {/* TAB 1: CANDIDATES LIST & EXPANDABLE REVIEW */}
        {token && activeTab === "applicants" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold">Submitted Candidates</h2>
                <button
                  onClick={loadApplicants}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded"
                >
                  Refresh List
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Filter Domain:</span>
                <select
                  value={
                    adminUser?.role === "DOMAIN_HEAD"
                      ? adminUser?.domain
                      : domainFilter
                  }
                  disabled={adminUser?.role === "DOMAIN_HEAD"}
                  onChange={(e) => setDomainFilter(e.target.value)}
                  className="border p-1.5 rounded text-xs font-semibold bg-slate-50"
                >
                  {adminUser?.role === "ROOT_ADMIN" && <option value="ALL">ALL DOMAINS</option>}
                  {DOMAINS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                {adminUser?.role === "ROOT_ADMIN" && (
                  <button
                    onClick={loadApplicants}
                    className="text-xs bg-slate-200 px-2 py-1 rounded hover:bg-slate-300"
                  >
                    Apply
                  </button>
                )}
              </div>

              {applicants.length === 0 ? (
                <p className="text-sm text-slate-500 py-8 text-center">
                  No applicants found for this domain yet.
                </p>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {applicants.map((item: any, idx: number) => {
                    const rowId = item.id || item._id || String(idx);
                    const candidateName =
                      item.name || item.user?.name || "Unnamed Candidate";
                    const candidateEmail =
                      item.email || item.user?.email || "No email";
                    const candidateDomain =
                      item.domain ||
                      item.applications?.map((a: any) => a.domain).join(", ") ||
                      "N/A";
                    const candidateStage =
                      item.stage ||
                      item.applications?.[0]?.stage ||
                      "APPLIED";
                    const isExpanded = expandedRowId === rowId;

                    return (
                      <div
                        key={rowId}
                        className="border border-slate-200 rounded-lg overflow-hidden transition-all"
                      >
                        <div
                          onClick={() =>
                            setExpandedRowId(isExpanded ? null : rowId)
                          }
                          className="p-3 bg-slate-50 hover:bg-slate-100 cursor-pointer flex justify-between items-center"
                        >
                          <div>
                            <p className="font-semibold text-sm text-slate-800">
                              {candidateName}
                            </p>
                            <p className="text-xs text-slate-500">{candidateEmail}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 block">
                              {candidateDomain}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {candidateStage}
                            </span>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="p-3 bg-white border-t border-slate-200 text-xs space-y-2">
                            <p>
                              <b>Record ID:</b>{" "}
                              <span className="font-mono">{rowId}</span>
                            </p>
                            {item.regNo || item.user?.regNo ? (
                              <p>
                                <b>Reg No:</b> {item.regNo || item.user?.regNo}
                              </p>
                            ) : null}
                            <button
                              onClick={() =>
                                openReviewModal(
                                  item.userId || item.user?.id || rowId,
                                  item.applicationId || item.id
                                )
                              }
                              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-1.5 rounded mt-1"
                            >
                              Review Candidate Profile & Answers →
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="lg:col-span-7 bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-5">
              <h2 className="text-lg font-bold border-b pb-2">
                Candidate Review & Evaluation Panel
              </h2>

              {!selectedApplicant ? (
                <p className="text-sm text-slate-500 py-12 text-center">
                  Click on any candidate on the left, then click <b>Review</b> to load
                  their profile, domain responses, and grading controls.
                </p>
              ) : (
                <div className="space-y-5">
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 grid grid-cols-2 gap-2 text-sm">
                    <p>
                      <b>Name:</b>{" "}
                      {selectedApplicant.name ||
                        selectedApplicant.user?.name ||
                        "N/A"}
                    </p>
                    <p>
                      <b>Email:</b>{" "}
                      {selectedApplicant.email ||
                        selectedApplicant.user?.email ||
                        "N/A"}
                    </p>
                    <p>
                      <b>Reg No:</b>{" "}
                      {selectedApplicant.regNo ||
                        selectedApplicant.user?.regNo ||
                        "N/A"}
                    </p>
                    <p>
                      <b>Phone:</b>{" "}
                      {selectedApplicant.phone ||
                        selectedApplicant.user?.phone ||
                        "N/A"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-slate-700 uppercase">
                      Submitted Domain Responses
                    </h3>
                    <div className="max-h-56 overflow-y-auto bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-xs whitespace-pre-wrap">
                      {JSON.stringify(
                        selectedApplicant.answers ||
                          selectedApplicant.applications ||
                          selectedApplicant,
                        null,
                        2
                      )}
                    </div>
                  </div>

                  <div className="border-t pt-4 space-y-4">
                    <h3 className="text-sm font-bold text-slate-700 uppercase">
                      Grade & Shortlist Decision
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold mb-1">
                          Application ID
                        </label>
                        <input
                          type="text"
                          value={selectedAppId}
                          onChange={(e) => setSelectedAppId(e.target.value)}
                          className="w-full border p-2 rounded text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">
                          Grade / Marks (0 - 10)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={marks}
                          onChange={(e) => setMarks(Number(e.target.value))}
                          className="w-full border p-2 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">
                          Stage Decision
                        </label>
                        <select
                          value={stageDecision}
                          onChange={(e) => setStageDecision(e.target.value)}
                          className="w-full border p-2 rounded text-sm font-semibold"
                        >
                          <option value="SHORTLISTED">SHORTLISTED (Round 1 Pass)</option>
                          <option value="INTERVIEW">INTERVIEW</option>
                          <option value="SELECTED">SELECTED (Final Offer)</option>
                          <option value="REJECTED">REJECTED</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        Admin Review Comments (Saved for Interview Slot View)
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Write evaluation notes about this candidate's answers..."
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        className="w-full border p-2.5 rounded text-sm"
                      />
                    </div>

                    <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-lg flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-indigo-900">
                        <input
                          type="checkbox"
                          checked={sendMailToggle}
                          onChange={(e) => setSendMailToggle(e.target.checked)}
                          className="w-4 h-4"
                        />
                        Send Automated Email Notification to Candidate
                      </label>
                      <input
                        type="text"
                        placeholder="Optional Meeting Link for Email"
                        value={meetingLinkInput}
                        onChange={(e) => setMeetingLinkInput(e.target.value)}
                        className="border p-1.5 rounded text-xs flex-1 min-w-[220px]"
                      />
                    </div>

                    <button
                      onClick={submitReview}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg"
                    >
                      Save Review & Trigger Status Update (PUT /applicants/:id/review)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: MULTI-DAY 10-MIN SLOT GENERATOR & SCHEDULE */}
        {token && activeTab === "slots" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <h2 className="text-lg font-bold border-b pb-2">
                Generate 10-Min Interview Slots (Multi-Day)
              </h2>
              <div>
                <label className="block text-xs font-semibold mb-1">Domain</label>
                <select
                  value={slotDomain}
                  disabled={adminUser?.role === "DOMAIN_HEAD"}
                  onChange={(e) => setSlotDomain(e.target.value)}
                  className="w-full border p-2 rounded text-sm bg-slate-50"
                >
                  {DOMAINS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Start Date & Time</label>
                  <input
                    type="datetime-local"
                    value={slotStart}
                    onChange={(e) => setSlotStart(e.target.value)}
                    className="w-full border p-2 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">End Date & Time</label>
                  <input
                    type="datetime-local"
                    value={slotEnd}
                    onChange={(e) => setSlotEnd(e.target.value)}
                    className="w-full border p-2 rounded text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Meeting Link</label>
                <input
                  type="text"
                  value={slotMeetLink}
                  onChange={(e) => setSlotMeetLink(e.target.value)}
                  className="w-full border p-2 rounded text-xs"
                />
              </div>
              <button
                onClick={handleCreateSlot}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg text-sm"
              >
                Generate 10-Min Slots (POST /slots)
              </button>
            </div>

            <div className="lg:col-span-7 bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-2 border-b pb-2">
                <h2 className="text-lg font-bold">
                  Interview Schedule (Ascending Time)
                </h2>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Admin ID"
                    value={scheduleAdminId}
                    onChange={(e) => setScheduleAdminId(e.target.value)}
                    className="border p-1.5 rounded text-xs font-mono w-28"
                  />
                  <button
                    onClick={handleFetchAllSlots}
                    className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-2.5 py-1.5 rounded"
                  >
                    Load All Slots
                  </button>
                  <button
                    onClick={handleFetchBookedSchedule}
                    className="bg-slate-600 hover:bg-slate-700 text-white text-xs font-semibold px-2.5 py-1.5 rounded"
                  >
                    Booked Only
                  </button>
                </div>
              </div>

              {scheduleList.length === 0 ? (
                <p className="text-sm text-slate-500 py-10 text-center">
                  No slots loaded yet. Click <b>Load All Slots</b>.
                </p>
              ) : (
                <div className="space-y-3 max-h-[450px] overflow-y-auto">
                  {scheduleList.map((slot: any, i: number) => (
                    <div
                      key={slot.id || i}
                      className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-1 text-xs"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-800">
                          {new Date(slot.startTime).toLocaleString()} → {new Date(slot.endTime).toLocaleTimeString()}
                        </span>
                        <span className="font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded">
                          {slot.domain}
                        </span>
                      </div>
                      <p className="text-blue-600 font-mono">Meet: {slot.meetingLink || "N/A"}</p>
                      <div className="text-xs bg-white p-2 rounded border mt-1">
                        <p className="font-semibold text-slate-700">
                          Status: {slot.bookedCount > 0 ? "🟢 Booked" : "⚪ Available (Empty)"}
                        </p>
                        {slot.bookings && slot.bookings.length > 0 && (
                          <pre className="mt-1 font-mono text-[11px] whitespace-pre-wrap text-slate-600">
                            {JSON.stringify(slot.bookings, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: ROOT ADMIN - ASSIGN DOMAIN HEADS */}
        {token && adminUser?.role === "ROOT_ADMIN" && activeTab === "root" && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 max-w-xl space-y-4">
            <h2 className="text-lg font-bold text-indigo-900 border-b pb-2">
              Root Admin: Whitelist & Assign Domain Heads (6 Domains)
            </h2>
            <p className="text-xs text-slate-600">
              Assigning a Domain Head here adds their email and domain to MongoDB with a blank
              password. When they log in, they will use <b>POST /setup</b> to set their password
              and will automatically be restricted to candidates in their assigned domain.
            </p>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Domain Head Name (Optional)"
                value={dhName}
                onChange={(e) => setDhName(e.target.value)}
                className="w-full border p-2.5 rounded-lg text-sm"
              />
              <input
                type="text"
                placeholder="Comma-separated emails (e.g. a@vit.ac.in, b@vit.ac.in)"
                value={dhEmail}
                onChange={(e) => setDhEmail(e.target.value)}
                className="w-full border p-2.5 rounded-lg text-sm"
              />
              <select
                value={dhDomain}
                onChange={(e) => setDhDomain(e.target.value)}
                className="w-full border p-2.5 rounded-lg text-sm font-semibold"
              >
                {DOMAINS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAssignDomainHead}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg text-sm"
              >
                Whitelist Domain Heads (POST /domain-heads)
              </button>
            </div>
          </div>
        )}

        {/* Live API Inspector Console */}
        <div className="bg-slate-900 text-emerald-400 p-4 rounded-xl shadow-inner font-mono text-xs h-64 overflow-y-auto whitespace-pre-wrap">
          {apiLog}
        </div>
      </div>
    </div>
  );
}