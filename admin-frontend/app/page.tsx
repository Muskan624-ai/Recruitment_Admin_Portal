"use client";

import React, { useState, useEffect } from "react";

const RAW_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:5000";

const API_BASE = RAW_BASE.replace(/\/+$/, "").endsWith("/api/admin")
  ? RAW_BASE.replace(/\/+$/, "")
  : `${RAW_BASE.replace(/\/+$/, "")}/api/admin`;

const DOMAINS = [
  "TECHNICAL",
  "MANAGEMENT",
  "DESIGN",
  "MARKETING",
  "R_AND_D",
  "EDITORIAL",
];

const REVIEW1_ALLOWED_STAGES = [
  "SHORTLISTED",
  "SLOT_CHOOSING",
  "REJECTED",
];

const REVIEW2_ALLOWED_STAGES = [
  "SELECTED",
  "REJECTED",
];

export default function AdminPortal() {
  const [token, setToken] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState<{
    id: string;
    email: string;
    role: string;
    domain?: string;
  } | null>(null);

  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<
    "candidates" | "review2" | "questions" | "slots" | "root"
  >("candidates");

  // 1. Candidates & Review 1 State
  const [filterDomain, setFilterDomain] = useState<string>("TECHNICAL");
  const [candidates, setCandidates] = useState<any[]>([]);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [questionScores, setQuestionScores] = useState<Record<string, number>>(
    {}
  );
  const [reviewComments, setReviewComments] = useState("");
  const [stageDecision, setStageDecision] = useState<string>("SHORTLISTED");

  // 2. Review 2 (Interview Evaluation) State
  const [review2Search, setReview2Search] = useState("");
  const [selectedInterviewApp, setSelectedInterviewApp] = useState<any | null>(null);
  const [review2Marks, setReview2Marks] = useState<number>(0);
  const [review2Comments, setReview2Comments] = useState<string>("");
  const [review2StageDecision, setReview2StageDecision] = useState<string>("SELECTED");

  // 3. Form Questions & Subsections State
  const [questionDomain, setQuestionDomain] = useState<string>("TECHNICAL");
  const [subsectionsList, setSubsectionsList] = useState<any[]>([]);
  const [questionsList, setQuestionsList] = useState<any[]>([]);
  const [newSubsectionName, setNewSubsectionName] = useState("");
  const [selectedSubsectionId, setSelectedSubsectionId] = useState<string>("");
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionMarks, setNewQuestionMarks] = useState<number>(10);
  const [newQuestionOrder, setNewQuestionOrder] = useState<number>(1);

  // 4. Calendly-Style Interview Slots State
  const [slotDomain, setSlotDomain] = useState<string>("TECHNICAL");
  const [slotDate, setSlotDate] = useState<string>("");
  const [slotStartTime, setSlotStartTime] = useState<string>("10:00");
  const [slotEndTime, setSlotEndTime] = useState<string>("11:00");
  const [slotDuration, setSlotDuration] = useState<number>(20);
  const [slotMeetingLink, setSlotMeetingLink] = useState<string>("");
  const [slotsList, setSlotsList] = useState<any[]>([]);

  // 5. Root Admin Whitelist State
  const [assignDomain, setAssignDomain] = useState<string>("TECHNICAL");
  const [assignEmails, setAssignEmails] = useState<string>("");

  const notify = (type: "success" | "error", text: string) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg(null), 6000);
  };

  const parseJwt = (tk: string) => {
    try {
      return JSON.parse(atob(tk.split(".")[1]));
    } catch {
      return {};
    }
  };

  // Restore token & session from localStorage on load
  useEffect(() => {
    const savedToken = localStorage.getItem("admin_token");
    if (savedToken) {
      const decoded = parseJwt(savedToken);
      if (decoded.exp && decoded.exp * 1000 < Date.now()) {
        localStorage.removeItem("admin_token");
      } else {
        setToken(savedToken);
        const userObj = {
          id: decoded.id,
          email: decoded.email,
          role: decoded.role,
          domain: decoded.domain,
        };
        setAdminUser(userObj);
        if (userObj.domain) {
          setFilterDomain(userObj.domain);
          setQuestionDomain(userObj.domain);
          setSlotDomain(userObj.domain);
        }
      }
    }
  }, []);

  // Auth Handler (/login and /setup)
  const handleAuth = async (endpoint: "/login" | "/setup") => {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: authEmail.trim().toLowerCase(),
          password: authPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Authentication failed");

      const decoded = parseJwt(data.token);
      const userObj = {
        id: data.id || data.admin?.id || decoded.id,
        email: data.email || data.admin?.email || decoded.email || authEmail,
        role: data.role || data.admin?.role || decoded.role,
        domain: data.domain || data.admin?.domain || decoded.domain,
      };

      setToken(data.token);
      localStorage.setItem("admin_token", data.token);
      setAdminUser(userObj);

      const defaultDom = userObj.domain || "TECHNICAL";
      setFilterDomain(defaultDom);
      setQuestionDomain(defaultDom);
      setSlotDomain(defaultDom);

      notify(
        "success",
        endpoint === "/setup"
          ? "Password created & logged in successfully!"
          : `Logged in as ${userObj.email}`
      );
    } catch (err: any) {
      notify("error", err.message || "Authentication failed");
    }
  };

  // 1. Fetch Submitted Candidates
  const fetchCandidates = async (dom = filterDomain) => {
    if (!token) return;
    try {
      const query = dom && dom !== "ALL" ? `?domain=${dom}` : "";
      const res = await fetch(`${API_BASE}/applicants${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to fetch applicants");

      const rawList = json.data || json.applicants || [];
      const submittedOnly = rawList.filter((app: any) => Boolean(app.submittedAt));
      setCandidates(submittedOnly);
    } catch (err: any) {
      notify("error", err.message);
    }
  };

  const handleSelectCandidate = async (app: any) => {
    setSelectedApp(app);
    setReviewComments(app.review1Comments || "");
    setStageDecision(
      REVIEW1_ALLOWED_STAGES.includes(app.stage) ? app.stage : "SHORTLISTED"
    );

    let answersList = app.user?.answers || [];

    if (answersList.length === 0 && app.userId && token) {
      try {
        const res = await fetch(`${API_BASE}/applicants/${app.userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (res.ok && json.data?.answers) {
          answersList = json.data.answers;
          setSelectedApp({
            ...app,
            user: { ...app.user, answers: answersList },
          });
        }
      } catch {
        // Ignore fallback error
      }
    }

    const scores: Record<string, number> = {};
    answersList
      .filter(
        (ans: any) => !ans.question?.domain || ans.question.domain === app.domain
      )
      .forEach((ans: any) => {
        scores[ans.id] = ans.marks ?? 0;
      });
    setQuestionScores(scores);
  };

  const handleSelectInterviewCandidate = (app: any) => {
    setSelectedInterviewApp(app);
    setReview2Marks(app.review2Marks ?? 0);
    setReview2Comments(app.review2Comments || "");
    setReview2StageDecision(
      REVIEW2_ALLOWED_STAGES.includes(app.stage) ? app.stage : "SELECTED"
    );
  };

  const totalCalculatedMarks = Object.values(questionScores).reduce(
    (sum, val) => sum + (Number(val) || 0),
    0
  );

  // Review 1: Search candidates and sort by highest Review 1 marks
  const displayedCandidates = [...candidates]
    .filter((app) => {
      const search = candidateSearch.trim().toLowerCase();
      if (!search) return true;
      return (
        app.user?.name?.toLowerCase().includes(search) ||
        app.user?.regNumber?.toLowerCase().includes(search) ||
        app.user?.email?.toLowerCase().includes(search)
      );
    })
    .sort((a, b) => (Number(b.review1Marks) || 0) - (Number(a.review1Marks) || 0));

  // Review 2: Domain Heads ONLY see candidates who booked THEIR specific slots
  // Root Admin sees all interview/slot candidates across the selected domain
  const interviewCandidates = [...candidates]
    .filter((app) => {
      if (adminUser?.role === "ROOT_ADMIN") {
        return (
          ["SLOT_CHOOSING", "INTERVIEW", "SELECTED", "REJECTED"].includes(app.stage) ||
          Boolean(app.booking)
        );
      }
      // Strict per-interviewer isolation for Domain Heads
      return app.booking?.slot?.interviewerId === adminUser?.id;
    })
    .filter((app) => {
      const search = review2Search.trim().toLowerCase();
      if (!search) return true;
      return (
        app.user?.name?.toLowerCase().includes(search) ||
        app.user?.regNumber?.toLowerCase().includes(search) ||
        app.user?.email?.toLowerCase().includes(search)
      );
    })
    .sort((a, b) => {
      // Sort chronologically by their booked interview time first
      const timeA = a.booking?.slot?.startTime
        ? new Date(a.booking.slot.startTime).getTime()
        : Infinity;
      const timeB = b.booking?.slot?.startTime
        ? new Date(b.booking.slot.startTime).getTime()
        : Infinity;
      if (timeA !== timeB) return timeA - timeB;

      return (
        (Number(b.review2Marks) || Number(b.review1Marks) || 0) -
        (Number(a.review2Marks) || Number(a.review1Marks) || 0)
      );
    });

  // Save Review 1 Evaluation
  const handleSaveEvaluation = async () => {
    if (!selectedApp || !token) return;
    try {
      const answerScores = Object.entries(questionScores).map(
        ([answerId, marks]) => ({
          answerId,
          marks: Number(marks) || 0,
        })
      );

      const res = await fetch(
        `${API_BASE}/applicants/${selectedApp.id}/review`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            stage: stageDecision,
            review1Marks: totalCalculatedMarks,
            review1Comments: reviewComments,
            review1Passed:
              stageDecision === "SHORTLISTED" ||
              stageDecision === "SLOT_CHOOSING",
            answerScores,
          }),
        }
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to save evaluation");

      notify("success", "Review 1 marks & stage decision saved!");
      fetchCandidates(filterDomain);
    } catch (err: any) {
      notify("error", err.message);
    }
  };

  // Save Review 2 (Interview) Evaluation
  const handleSaveReview2 = async () => {
    if (!selectedInterviewApp || !token) return;
    try {
      const res = await fetch(
        `${API_BASE}/applicants/${selectedInterviewApp.id}/review`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            stage: review2StageDecision,
            review2Marks: Number(review2Marks) || 0,
            review2Comments: review2Comments,
            review2Passed: review2StageDecision === "SELECTED",
          }),
        }
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to save interview evaluation");

      notify("success", `Interview evaluation saved! Candidate marked as ${review2StageDecision}.`);
      fetchCandidates(filterDomain);
      setSelectedInterviewApp({
        ...selectedInterviewApp,
        stage: review2StageDecision,
        review2Marks: Number(review2Marks) || 0,
        review2Comments,
      });
    } catch (err: any) {
      notify("error", err.message);
    }
  };

  // 3. Fetch Form Questions & Subsections
  const fetchFormQuestions = async (dom = questionDomain) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/form?domain=${dom}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to fetch questions");

      setSubsectionsList(json.data?.subsections || []);
      setQuestionsList(json.data?.questions || []);
    } catch (err: any) {
      notify("error", err.message);
    }
  };

  const handleCreateSubsection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newSubsectionName.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/form/subsection`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newSubsectionName.trim(),
          domain: questionDomain,
          order: subsectionsList.length + 1,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to create subsection");

      setNewSubsectionName("");
      notify("success", "Form subsection created!");
      fetchFormQuestions(questionDomain);
    } catch (err: any) {
      notify("error", err.message);
    }
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newQuestionText.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/form/question`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: newQuestionText.trim(),
          domain: questionDomain,
          subsectionId: selectedSubsectionId || null,
          maxMarks: Number(newQuestionMarks) || 10,
          order: Number(newQuestionOrder) || questionsList.length + 1,
          required: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to create question");

      setNewQuestionText("");
      setNewQuestionOrder((prev) => prev + 1);
      notify("success", "Question & marks added to domain form!");
      fetchFormQuestions(questionDomain);
    } catch (err: any) {
      notify("error", err.message);
    }
  };

  // 4. Fetch Slots
  const fetchSlots = async (dom = slotDomain) => {
    if (!token || !adminUser?.id) return;
    try {
      const targetAdminId =
        adminUser.role === "ROOT_ADMIN" ? "ALL" : adminUser.id;
      const res = await fetch(
        `${API_BASE}/schedule/${targetAdminId}?all=true&domain=${dom}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to fetch slots");
      setSlotsList(json.data || []);
    } catch (err: any) {
      notify("error", err.message);
    }
  };

  const handleCreateSlots = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !slotDate || !slotStartTime || !slotEndTime) {
      notify("error", "Please select a calendar date, start time, and end time.");
      return;
    }

    const startISO = new Date(`${slotDate}T${slotStartTime}:00`).toISOString();
    const endISO = new Date(`${slotDate}T${slotEndTime}:00`).toISOString();

    if (new Date(endISO) <= new Date(startISO)) {
      notify("error", "End time must be after start time.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/slots`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          interviewerId: adminUser?.id,
          domain: slotDomain,
          startTime: startISO,
          endTime: endISO,
          durationMinutes: Number(slotDuration) || 20,
          meetingLink: slotMeetingLink.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to create slots");

      notify("success", json.message || "Interview slots created!");
      fetchSlots(slotDomain);
    } catch (err: any) {
      notify("error", err.message);
    }
  };

  // 5. Root Admin Whitelist
  const handleAssignDomainHeads = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !assignEmails.trim()) return;

    const emailArray = assignEmails
      .split(",")
      .map((em) => em.trim().toLowerCase())
      .filter(Boolean);

    try {
      const res = await fetch(`${API_BASE}/domain-heads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          domain: assignDomain,
          emails: emailArray,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to assign domain heads");

      setAssignEmails("");
      notify("success", json.message || "Domain head(s) whitelisted!");
    } catch (err: any) {
      notify("error", err.message);
    }
  };

  useEffect(() => {
    if (token) {
      fetchCandidates(filterDomain);
    }
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* UN-AUTHENTICATED PROFESSIONAL LOGIN SCREEN */}
        {!token ? (
          <div className="max-w-md mx-auto mt-16 bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
            <h1 className="text-2xl font-bold text-center text-slate-900 mb-6">
              Recruitment Admin Portal
            </h1>
            
            {statusMsg && (
              <div
                className={`p-3 mb-6 rounded-lg text-sm font-medium border text-center ${
                  statusMsg.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-red-50 text-red-800 border-red-200"
                }`}
              >
                {statusMsg.text}
              </div>
            )}

            <div className="space-y-4">
              <input
                type="email"
                placeholder="Admin Email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm"
              />
              <input
                type="password"
                placeholder="Password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm"
              />
            </div>
            
            <div className="flex flex-col gap-3 pt-6">
              <button
                onClick={() => handleAuth("/login")}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition"
              >
                Login
              </button>
              <button
                onClick={() => handleAuth("/setup")}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition"
              >
                Create First-Time Password
              </button>
            </div>
          </div>
        ) : (
          
          /* AUTHENTICATED DASHBOARD SCREEN */
          <>
            {/* Dashboard Top Bar */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  Recruitment Admin & Evaluation Portal
                </h1>
              </div>
              {adminUser && (
                <div className="flex items-center gap-4">
                  <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-200">
                    {adminUser.email} ({adminUser.role}
                    {adminUser.domain ? ` - ${adminUser.domain}` : ""})
                  </span>
                  <button
                    onClick={() => {
                      localStorage.removeItem("admin_token");
                      setToken(null);
                      setAdminUser(null);
                      setSelectedApp(null);
                      setSelectedInterviewApp(null);
                    }}
                    className="text-xs text-red-600 hover:underline font-semibold"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>

            {/* Status Alert for Dashboard */}
            {statusMsg && (
              <div
                className={`p-4 rounded-xl text-sm font-medium border ${
                  statusMsg.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-red-50 text-red-800 border-red-200"
                }`}
              >
                {statusMsg.text}
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
              <button
                onClick={() => {
                  setActiveTab("candidates");
                  fetchCandidates(filterDomain);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                  activeTab === "candidates"
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-700 border border-slate-200"
                }`}
              >
                1. Review 1: Form Grading ({candidates.length})
              </button>

              <button
                onClick={() => {
                  setActiveTab("review2");
                  fetchCandidates(filterDomain);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                  activeTab === "review2"
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-700 border border-slate-200"
                }`}
              >
                2. Review 2: My Interviewees ({interviewCandidates.length})
              </button>

              <button
                onClick={() => {
                  setActiveTab("questions");
                  fetchFormQuestions(questionDomain);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                  activeTab === "questions"
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-700 border border-slate-200"
                }`}
              >
                3. Form Questions & Marks
              </button>

              <button
                onClick={() => {
                  setActiveTab("slots");
                  fetchSlots(slotDomain);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                  activeTab === "slots"
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-700 border border-slate-200"
                }`}
              >
                4. Interview Slots (Calendly Style)
              </button>

              {adminUser?.role === "ROOT_ADMIN" && (
                <button
                  onClick={() => setActiveTab("root")}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                    activeTab === "root"
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-indigo-700 border border-indigo-200"
                  }`}
                >
                  5. Whitelist Domain Heads
                </button>
              )}
            </div>

            {/* TAB 1: REVIEW 1 (FORM EVALUATION) */}
            {activeTab === "candidates" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="font-bold text-base">
                      Submitted Applications
                    </h2>

                    <button
                      onClick={() => fetchCandidates(filterDomain)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
                    >
                      Refresh
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="Search by name, registration number or email..."
                    value={candidateSearch}
                    onChange={(e) => setCandidateSearch(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />

                  {adminUser?.role === "ROOT_ADMIN" && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600">Domain:</span>
                      <select
                        value={filterDomain}
                        onChange={(e) => {
                          setFilterDomain(e.target.value);
                          fetchCandidates(e.target.value);
                        }}
                        className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
                      >
                        <option value="ALL">ALL DOMAINS</option>
                        {DOMAINS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="space-y-2 max-h-[550px] overflow-y-auto">
                    {displayedCandidates.length === 0 ? (
                      <p className="text-xs text-slate-500 py-8 text-center">
                        No submitted applications found.
                      </p>
                    ) : (
                      displayedCandidates.map((app) => (
                        <div
                          key={app.id}
                          onClick={() => handleSelectCandidate(app)}
                          className={`p-3.5 rounded-lg border cursor-pointer transition ${
                            selectedApp?.id === app.id
                              ? "border-blue-600 bg-blue-50/40"
                              : "border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold text-sm">
                                {app.user?.name || "Candidate"}
                              </p>
                              <p className="text-xs text-slate-500">
                                {app.user?.regNumber} • {app.user?.email}
                              </p>
                            </div>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                              {app.stage}
                            </span>
                          </div>
                          <div className="mt-2 flex justify-between items-center text-xs text-slate-500">
                            <span>Domain: {app.domain}</span>
                            {app.review1Marks !== null &&
                              app.review1Marks !== undefined && (
                                <span className="font-semibold text-emerald-700">
                                  Review 1 Marks: {app.review1Marks}
                                </span>
                              )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="lg:col-span-7 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                  <h2 className="font-bold text-base border-b border-slate-200 pb-3 mb-4">
                    Review 1: Candidate Form Evaluation
                  </h2>

                  {!selectedApp ? (
                    <p className="text-xs text-slate-500 py-12 text-center">
                      Select a candidate on the left to grade their responses question-by-question.
                    </p>
                  ) : (
                    <div className="space-y-5">
                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <span className="text-slate-400 block">Candidate Name</span>
                          <span className="font-semibold text-slate-800">
                            {selectedApp.user?.name}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Registration Number</span>
                          <span className="font-semibold text-slate-800">
                            {selectedApp.user?.regNumber}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Phone</span>
                          <span className="font-semibold text-slate-800">
                            {selectedApp.user?.phone || "N/A"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Domain</span>
                          <span className="font-semibold text-indigo-700">
                            {selectedApp.domain}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Current Stage</span>
                          <span className="font-semibold text-slate-800">
                            {selectedApp.stage}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Submitted On</span>
                          <span className="font-semibold text-slate-800">
                            {selectedApp.submittedAt
                              ? new Date(selectedApp.submittedAt).toLocaleDateString()
                              : "Submitted"}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <h3 className="text-sm font-bold text-slate-800">
                            Individual Question Responses & Marks
                          </h3>
                          <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg border border-emerald-200">
                            Total Score: {totalCalculatedMarks} Marks
                          </span>
                        </div>

                        {(selectedApp.user?.answers || []).filter(
                          (ans: any) =>
                            !ans.question?.domain ||
                            ans.question.domain === selectedApp.domain
                        ).length === 0 ? (
                          <p className="text-xs text-slate-500 italic bg-slate-50 p-3 rounded-lg">
                            No answers submitted for this domain yet.
                          </p>
                        ) : (
                          (selectedApp.user?.answers || [])
                            .filter(
                              (ans: any) =>
                                !ans.question?.domain ||
                                ans.question.domain === selectedApp.domain
                            )
                            .map((ans: any, idx: number) => {
                              const maxM = ans.question?.maxMarks || 10;
                              return (
                                <div
                                  key={ans.id || idx}
                                  className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60 space-y-2"
                                >
                                  <div className="flex justify-between items-start gap-4">
                                    <p className="text-xs font-semibold text-slate-800">
                                      Q{idx + 1}. {ans.question?.text || "Question"}
                                    </p>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <label className="text-[11px] text-slate-500">
                                        Marks:
                                      </label>
                                      <input
                                        type="number"
                                        min={0}
                                        max={maxM}
                                        value={questionScores[ans.id] ?? 0}
                                        onChange={(e) =>
                                          setQuestionScores({
                                            ...questionScores,
                                            [ans.id]: Number(e.target.value),
                                          })
                                        }
                                        className="w-16 border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-center bg-white"
                                      />
                                      <span className="text-xs text-slate-500">
                                        / {maxM}
                                      </span>
                                    </div>
                                  </div>
                                  <p className="text-xs text-slate-700 bg-white p-2.5 rounded border border-slate-200 whitespace-pre-wrap">
                                    {ans.text}
                                  </p>
                                </div>
                              );
                            })
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Review 1 Stage Decision
                          </label>
                          <select
                            value={stageDecision}
                            onChange={(e) => setStageDecision(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold"
                          >
                            {REVIEW1_ALLOWED_STAGES.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Select SLOT_CHOOSING to invite the candidate to book an interview slot.
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Review 1 Comments
                          </label>
                          <textarea
                            rows={2}
                            value={reviewComments}
                            onChange={(e) => setReviewComments(e.target.value)}
                            placeholder="Form evaluation feedback..."
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                          />
                        </div>
                      </div>

                      <button
                        onClick={handleSaveEvaluation}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm py-2.5 rounded-lg"
                      >
                        Save Question Marks & Promote Stage
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: REVIEW 2 (MY INTERVIEWEES & FINAL SELECTION) */}
            {activeTab === "review2" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="font-bold text-base">
                      {adminUser?.role === "ROOT_ADMIN"
                        ? "All Interview Candidates"
                        : "My Booked Interviewees"}
                    </h2>
                    <button
                      onClick={() => fetchCandidates(filterDomain)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
                    >
                      Refresh
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="Search your interviewees..."
                    value={review2Search}
                    onChange={(e) => setReview2Search(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />

                  {adminUser?.role === "ROOT_ADMIN" && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600">Domain:</span>
                      <select
                        value={filterDomain}
                        onChange={(e) => {
                          setFilterDomain(e.target.value);
                          fetchCandidates(e.target.value);
                        }}
                        className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
                      >
                        <option value="ALL">ALL DOMAINS</option>
                        {DOMAINS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="space-y-2 max-h-[550px] overflow-y-auto">
                    {interviewCandidates.length === 0 ? (
                      <p className="text-xs text-slate-500 py-8 text-center">
                        {adminUser?.role === "ROOT_ADMIN"
                          ? "No candidates have been moved to SLOT_CHOOSING or INTERVIEW yet."
                          : "No candidates have booked your interview slots yet."}
                      </p>
                    ) : (
                      interviewCandidates.map((app) => (
                        <div
                          key={app.id}
                          onClick={() => handleSelectInterviewCandidate(app)}
                          className={`p-3.5 rounded-lg border cursor-pointer transition ${
                            selectedInterviewApp?.id === app.id
                              ? "border-indigo-600 bg-indigo-50/40"
                              : "border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold text-sm">
                                {app.user?.name || "Candidate"}
                              </p>
                              <p className="text-xs text-slate-500">
                                {app.user?.regNumber} • {app.user?.email}
                              </p>
                            </div>
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                                app.stage === "INTERVIEW"
                                  ? "bg-amber-100 text-amber-800"
                                  : app.stage === "SELECTED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : app.stage === "REJECTED"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {app.stage}
                            </span>
                          </div>

                          {/* Booked Slot Badge on Card */}
                          {app.booking?.slot ? (
                            <div className="mt-2 text-[11px] bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded border border-emerald-200 font-medium">
                              Slot Booked:{" "}
                              {new Date(app.booking.slot.startTime).toLocaleDateString()} at{" "}
                              {new Date(app.booking.slot.startTime).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          ) : (
                            <div className="mt-2 text-[11px] text-amber-600 font-medium">
                              Waiting for candidate to book a slot...
                            </div>
                          )}

                          <div className="mt-2 flex justify-between items-center text-xs text-slate-500">
                            <span>R1 Marks: {app.review1Marks ?? "N/A"}</span>
                            {app.review2Marks !== null &&
                              app.review2Marks !== undefined && (
                                <span className="font-semibold text-indigo-700">
                                  Interview Marks: {app.review2Marks}
                                </span>
                              )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right Panel: Review 2 Evaluation */}
                <div className="lg:col-span-7 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                  <h2 className="font-bold text-base border-b border-slate-200 pb-3 mb-4">
                    Review 2: Interview Grading & Final Selection
                  </h2>

                  {!selectedInterviewApp ? (
                    <p className="text-xs text-slate-500 py-12 text-center">
                      Select a candidate on the left to view their booked slot, conduct their interview, and enter final marks.
                    </p>
                  ) : (
                    <div className="space-y-5">
                      {/* Candidate Info */}
                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <span className="text-slate-400 block">Candidate Name</span>
                          <span className="font-semibold text-slate-800">
                            {selectedInterviewApp.user?.name}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Registration Number</span>
                          <span className="font-semibold text-slate-800">
                            {selectedInterviewApp.user?.regNumber}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Phone</span>
                          <span className="font-semibold text-slate-800">
                            {selectedInterviewApp.user?.phone || "N/A"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Domain</span>
                          <span className="font-semibold text-indigo-700">
                            {selectedInterviewApp.domain}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Current Stage</span>
                          <span className="font-semibold text-slate-800">
                            {selectedInterviewApp.stage}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Review 1 Score</span>
                          <span className="font-semibold text-emerald-700">
                            {selectedInterviewApp.review1Marks ?? 0} Marks
                          </span>
                        </div>
                      </div>

                      {/* Booked Slot Details Box */}
                      <div className="p-4 rounded-lg border border-indigo-200 bg-indigo-50/50 space-y-1">
                        <h3 className="text-xs font-bold text-indigo-900">
                          Booked Interview Slot
                        </h3>
                        {selectedInterviewApp.booking?.slot ? (
                          <div className="text-xs text-slate-700 space-y-1">
                            <p className="font-semibold">
                              {new Date(
                                selectedInterviewApp.booking.slot.startTime
                              ).toLocaleDateString()}{" "}
                              •{" "}
                              {new Date(
                                selectedInterviewApp.booking.slot.startTime
                              ).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}{" "}
                              –{" "}
                              {new Date(
                                selectedInterviewApp.booking.slot.endTime
                              ).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                            {selectedInterviewApp.booking.slot.meetingLink && (
                              <a
                                href={selectedInterviewApp.booking.slot.meetingLink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-block text-blue-600 font-semibold hover:underline"
                              >
                                Join Meeting: {selectedInterviewApp.booking.slot.meetingLink}
                              </a>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 italic">
                            This candidate has not booked an interview slot yet.
                          </p>
                        )}
                      </div>

                      {/* Review 1 Summary Reference */}
                      {selectedInterviewApp.review1Comments && (
                        <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 text-xs">
                          <span className="font-semibold text-slate-600 block mb-1">
                            Review 1 Comments:
                          </span>
                          <p className="text-slate-800 whitespace-pre-wrap">
                            {selectedInterviewApp.review1Comments}
                          </p>
                        </div>
                      )}

                      {/* Review 2 Grading Controls */}
                      <div className="space-y-4 pt-3 border-t border-slate-200">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Interview Marks (Review 2 Score)
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={review2Marks}
                              onChange={(e) =>
                                setReview2Marks(Number(e.target.value))
                              }
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Final Selection Decision
                            </label>
                            <select
                              value={review2StageDecision}
                              onChange={(e) =>
                                setReview2StageDecision(e.target.value)
                              }
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold"
                            >
                              {REVIEW2_ALLOWED_STAGES.map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Interview Feedback & Comments (Review 2)
                          </label>
                          <textarea
                            rows={3}
                            value={review2Comments}
                            onChange={(e) => setReview2Comments(e.target.value)}
                            placeholder="Enter interview notes, strengths, and final evaluation remarks..."
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                          />
                        </div>

                        <button
                          onClick={handleSaveReview2}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm py-2.5 rounded-lg"
                        >
                          Save Interview Marks & Finalize Decision
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: DOMAIN FORM QUESTIONS & MARKS BUILDER */}
            {activeTab === "questions" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 space-y-6">
                  <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="font-bold text-base mb-1">
                      Add Form Question & Assign Marks
                    </h2>
                    <p className="text-xs text-slate-500 mb-4">
                      Each Domain Head can add questions and set maximum marks for their domain's candidate form.
                    </p>

                    <form onSubmit={handleCreateQuestion} className="space-y-4">
                      {adminUser?.role === "ROOT_ADMIN" && (
                        <div>
                          <label className="block text-xs font-semibold mb-1">
                            Domain
                          </label>
                          <select
                            value={questionDomain}
                            onChange={(e) => {
                              setQuestionDomain(e.target.value);
                              fetchFormQuestions(e.target.value);
                            }}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                          >
                            {DOMAINS.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {subsectionsList.length > 0 && (
                        <div>
                          <label className="block text-xs font-semibold mb-1">
                            Subsection (Optional)
                          </label>
                          <select
                            value={selectedSubsectionId}
                            onChange={(e) =>
                              setSelectedSubsectionId(e.target.value)
                            }
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                          >
                            <option value="">General (No Subsection)</option>
                            {subsectionsList.map((sub: any) => (
                              <option key={sub.id} value={sub.id}>
                                {sub.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-semibold mb-1">
                          Question Prompt
                        </label>
                        <textarea
                          rows={3}
                          required
                          placeholder="Enter the question candidates will answer..."
                          value={newQuestionText}
                          onChange={(e) => setNewQuestionText(e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold mb-1">
                            Marks for Question
                          </label>
                          <input
                            type="number"
                            min={1}
                            required
                            value={newQuestionMarks}
                            onChange={(e) =>
                              setNewQuestionMarks(Number(e.target.value))
                            }
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1">
                            Question Order
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={newQuestionOrder}
                            onChange={(e) =>
                              setNewQuestionOrder(Number(e.target.value))
                            }
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2.5 rounded-lg"
                      >
                        Add Question to {questionDomain}
                      </button>
                    </form>
                  </div>

                  <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-sm mb-2">
                      Create Form Subsection (Optional)
                    </h3>
                    <form
                      onSubmit={handleCreateSubsection}
                      className="flex gap-2"
                    >
                      <input
                        type="text"
                        placeholder="e.g., Web Dev / AI-ML / Core"
                        value={newSubsectionName}
                        onChange={(e) => setNewSubsectionName(e.target.value)}
                        className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-xs"
                      />
                      <button
                        type="submit"
                        className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-lg"
                      >
                        Add
                      </button>
                    </form>
                  </div>
                </div>

                <div className="lg:col-span-7 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="font-bold text-base">
                      {questionDomain} Form Questions ({questionsList.length})
                    </h2>
                    <button
                      onClick={() => fetchFormQuestions(questionDomain)}
                      className="text-xs text-indigo-600 font-semibold hover:underline"
                    >
                      Refresh
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {questionsList.length === 0 ? (
                      <p className="text-xs text-slate-500 py-8 text-center">
                        No questions created for {questionDomain} yet.
                      </p>
                    ) : (
                      questionsList.map((q: any, idx: number) => (
                        <div
                          key={q.id || idx}
                          className="p-3.5 rounded-lg border border-slate-200 flex justify-between items-start gap-4"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-indigo-600">
                                Q{q.order || idx + 1}
                              </span>
                              {q.subsection?.name && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                  {q.subsection.name}
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-medium text-slate-800 mt-1">
                              {q.text}
                            </p>
                          </div>
                          <span className="shrink-0 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-2.5 py-1 rounded">
                            {q.maxMarks ?? 10} Marks
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: CALENDLY-STYLE INTERVIEW SLOTS */}
            {activeTab === "slots" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                  <h2 className="font-bold text-base mb-1">
                    Create Interview Availability (Calendly Style)
                  </h2>
                  <p className="text-xs text-slate-500 mb-4">
                    Pick a date on the calendar, choose your start and end time window, and set how many minutes each interview slot should last.
                  </p>
                  <form onSubmit={handleCreateSlots} className="space-y-4">
                    {adminUser?.role === "ROOT_ADMIN" && (
                      <div>
                        <label className="block text-xs font-semibold mb-1">
                          Domain
                        </label>
                        <select
                          value={slotDomain}
                          onChange={(e) => {
                            setSlotDomain(e.target.value);
                            fetchSlots(e.target.value);
                          }}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                        >
                          {DOMAINS.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        1. Choose Calendar Date
                      </label>
                      <input
                        type="date"
                        required
                        value={slotDate}
                        onChange={(e) => setSlotDate(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold mb-1">
                          2. From Time
                        </label>
                        <input
                          type="time"
                          required
                          value={slotStartTime}
                          onChange={(e) => setSlotStartTime(e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">
                          3. To Time
                        </label>
                        <input
                          type="time"
                          required
                          value={slotEndTime}
                          onChange={(e) => setSlotEndTime(e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        4. Duration Per Interview (Minutes)
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={240}
                        required
                        value={slotDuration}
                        onChange={(e) =>
                          setSlotDuration(Number(e.target.value))
                        }
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        5. Meeting Link (Sent when candidate books slot)
                      </label>
                      <input
                        type="url"
                        required
                        placeholder="https://meet.google.com/..."
                        value={slotMeetingLink}
                        onChange={(e) => setSlotMeetingLink(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-2.5 rounded-lg"
                    >
                      Generate Interview Slots
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-7 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="font-bold text-base">
                      Created Slots & Bookings ({slotsList.length})
                    </h2>
                    <button
                      onClick={() => fetchSlots(slotDomain)}
                      className="text-xs text-emerald-700 font-semibold hover:underline"
                    >
                      Refresh
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-[550px] overflow-y-auto">
                    {slotsList.length === 0 ? (
                      <p className="text-xs text-slate-500 py-8 text-center">
                        No slots created yet. Use the form on the left to add availability.
                      </p>
                    ) : (
                      slotsList.map((s: any) => (
                        <div
                          key={s.id}
                          className="p-3.5 rounded-lg border border-slate-200 flex justify-between items-center gap-4"
                        >
                          <div>
                            <p className="text-xs font-bold text-slate-800">
                              {new Date(s.startTime).toLocaleDateString()} •{" "}
                              {new Date(s.startTime).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}{" "}
                              –{" "}
                              {new Date(s.endTime).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                            {s.meetingLink && (
                              <a
                                href={s.meetingLink}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-blue-600 hover:underline block"
                              >
                                {s.meetingLink}
                              </a>
                            )}
                            {s.bookings?.length > 0 && (
                              <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                                Booked by:{" "}
                                {s.bookings
                                  .map((b: any) => {
                                    const u = b.application?.user;
                                    return u
                                      ? `${u.name} (${u.regNumber || u.email})`
                                      : "Candidate";
                                  })
                                  .join(", ")}
                              </p>
                            )}
                          </div>
                          <span
                            className={`text-xs font-semibold px-2.5 py-1 rounded shrink-0 ${
                              s.bookedCount > 0
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            Booked: {s.bookedCount} / {s.capacity}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: ROOT ADMIN WHITELIST */}
            {activeTab === "root" && adminUser?.role === "ROOT_ADMIN" && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 max-w-xl">
                <h2 className="font-bold text-base mb-1">
                  Assign & Whitelist Domain Heads
                </h2>
                <p className="text-xs text-slate-500 mb-4">
                  Enter one or more comma-separated emails. Once added, those Domain Heads can click "Create First-Time Password" on the login screen.
                </p>
                <form onSubmit={handleAssignDomainHeads} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Select Domain
                    </label>
                    <select
                      value={assignDomain}
                      onChange={(e) => setAssignDomain(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                    >
                      {DOMAINS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Domain Head Email(s)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="head1@gmail.com, head2@gmail.com"
                      value={assignEmails}
                      onChange={(e) => setAssignEmails(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                    />
                  </div>
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2.5 rounded-lg"
                  >
                    Grant Domain Head Access
                  </button>
                </form>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}