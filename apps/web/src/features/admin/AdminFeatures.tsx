import { t, locale } from "../../i18n";
import React, { useState } from "react";
import {
  Activity,
  ArrowRight,
  ChartNoAxesCombined,
  CheckCheck,
  ChevronRight,
  Clock3,
  FilePenLine,
  Landmark,
  LayoutDashboard,
  LogOut,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import "./AdminPanel.css";
import type { Representative } from "@janpratinidhi/shared";
import type { AdminActivity } from "../../shared/types";

type Profile = Representative;
type Gender = "female" | "male" | "non_binary" | "prefer_not_to_say";
type User = {
  id: string;
  email: string;
  name: string;
  picture?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  gender?: Gender;
  profileComplete?: boolean;
  status?: "active" | "inactive" | "deleted";
};
type AdminUser = {
  _id: string;
  email: string;
  name: string;
  picture?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  gender?: Gender;
  profileComplete?: boolean;
  status?: "active" | "inactive" | "deleted";
  createdAt: string;
  lastLoginAt: string;
  lastActivity?: { action: string; details: string; at: string } | null;
};
type AdminRepresentative = Profile & { _id: string; status: "draft" | "published" };
type AdminStats = {
  users: number;
  representatives: number;
  published: number;
  drafts: number;
  todayVisitors: number;
  dailyVisitors: Array<{ date: string; count: number }>;
};
const filters = ["All representatives", "Lok Sabha MP", "Rajya Sabha MP", "MLA", "MLC"] as const;

export function ProfileCompletionModal({
  user,
  busy,
  onSubmit,
}: {
  user: User;
  busy: boolean;
  onSubmit: (profile: {
    firstName: string;
    lastName: string;
    phoneNumber: string;
    gender: Gender;
  }) => Promise<void>;
}) {
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const values = new FormData(event.currentTarget);
    try {
      await onSubmit({
        firstName: String(values.get("firstName") ?? ""),
        lastName: String(values.get("lastName") ?? ""),
        phoneNumber: String(values.get("phoneNumber") ?? ""),
        gender: String(values.get("gender") ?? "") as Gender,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save your profile");
    }
  };
  return (
    <div className="modal-backdrop profile-completion-backdrop">
      <section
        className="profile-modal profile-completion-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="complete-profile-title"
      >
        <div className="admin-login-icon">
          <Landmark size={21} />
        </div>
        <div className="eyebrow small-eyebrow">{t("ONE MORE STEP")}</div>
        <h2 id="complete-profile-title">{t("Complete your profile")}</h2>
        <p className="profile-completion-copy">
          {t("Signed in with") + " "}
          {user.email}
          {t(". Add these details to finish creating your account.")}
        </p>
        <form className="profile-completion-form" onSubmit={submit}>
          <label>
            {t("First name")}
            <input
              name="firstName"
              autoComplete="given-name"
              defaultValue={user.firstName}
              maxLength={80}
              required
            />
          </label>
          <label>
            {t("Last name")}
            <input
              name="lastName"
              autoComplete="family-name"
              defaultValue={user.lastName}
              maxLength={80}
              required
            />
          </label>
          <label>
            {t("Phone number")}
            <input
              name="phoneNumber"
              type="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              defaultValue={user.phoneNumber}
              required
            />
          </label>
          <label>
            {t("Gender")}
            <select name="gender" defaultValue={user.gender ?? ""} required>
              <option value="" disabled>
                {t("Select an option")}
              </option>
              <option value="female">{t("Female")}</option>
              <option value="male">{t("Male")}</option>
              <option value="non_binary">{t("Non-binary")}</option>
              <option value="prefer_not_to_say">{t("Prefer not to say")}</option>
            </select>
          </label>
          <p className="profile-data-note">
            {t("Your details are used for your account and shown to administrators.")}
          </p>
          {error && <p className="admin-login-error">{t(error)}</p>}
          <button className="admin-add-button" type="submit" disabled={busy}>
            {busy ? t("Saving profile…") : t("Save and continue")}
          </button>
        </form>
      </section>
    </div>
  );
}

export function AdminLoginForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (email: string, password: string) => Promise<void>;
}) {
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const values = new FormData(event.currentTarget);
    try {
      await onSubmit(String(values.get("email") ?? ""), String(values.get("password") ?? ""));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Admin sign-in failed");
    }
  };
  return (
    <form className="admin-route-login-form" onSubmit={submit}>
      <h2>{t("Admin sign in")}</h2>
      <p>{t("Enter the administrator email and password.")}</p>
      <label>
        {t("Admin email")}
        <input type="email" name="email" autoComplete="username" required autoFocus />
      </label>
      <label>
        {t("Password")}
        <input type="password" name="password" autoComplete="current-password" required />
      </label>
      {error && <p className="admin-login-error">{t(error)}</p>}
      <button className="admin-add-button" type="submit" disabled={busy}>
        {busy ? t("Signing in…") : t("Sign in to admin")}
      </button>
    </form>
  );
}

async function adminRequest(apiUrl: string, path: string, init: RequestInit = {}) {
  const token = sessionStorage.getItem("janpratinidhi-admin-token");
  if (!token) throw new Error("Your admin session expired. Sign in again.");
  const response = await fetch(`${apiUrl}/admin${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Admin request failed");
  return body;
}

export function AdminPanel({
  users,
  stats,
  representatives: records,
  loading,
  onRefresh,
  onNotice,
  onClose,
  onSignOut,
  onStatusChange,
  onDeleteUser,
  apiUrl,
}: {
  users: AdminUser[];
  stats: AdminStats;
  representatives: AdminRepresentative[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onNotice: (message: string) => void;
  onClose: () => void;
  onSignOut: () => void;
  onStatusChange: (user: AdminUser, status: "active" | "inactive") => void;
  onDeleteUser: (user: AdminUser) => void;
  apiUrl: string;
}) {
  const [view, setView] = useState<"overview" | "representatives" | "users" | "activity">(
    "overview",
  );
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<AdminRepresentative | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [activityUser, setActivityUser] = useState<AdminUser | null>(null);
  const [userActivity, setUserActivity] = useState<AdminActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const visibleRecords = records.filter((person) =>
    `${person.name} ${person.party} ${person.state} ${person.constituency}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const maxDailyVisitors = Math.max(1, ...stats.dailyVisitors.map(({ count }) => count));

  const showUserActivity = async (account: AdminUser) => {
    setActivityUser(account);
    setActivityLoading(true);
    try {
      const body = await adminRequest(
        apiUrl,
        `/activity?userId=${encodeURIComponent(account._id)}&limit=250`,
      );
      setUserActivity(body.data as AdminActivity[]);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not load user activity");
    } finally {
      setActivityLoading(false);
    }
  };

  const saveRepresentative = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parseJsonList = (key: string) => {
      const value = String(form.get(key) ?? "[]").trim();
      const parsed = JSON.parse(value || "[]");
      if (!Array.isArray(parsed))
        throw new Error(t("{field} must be a JSON array", { field: key }));
      return parsed;
    };
    try {
      setSaving(true);
      const name = String(form.get("name") ?? "").trim();
      const payload = {
        name,
        slug: String(form.get("slug") ?? "").trim(),
        initials:
          String(form.get("initials") ?? "").trim() ||
          name
            .split(/\s+/)
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase(),
        party: String(form.get("party") ?? "").trim(),
        partyShort: String(form.get("partyShort") ?? "").trim(),
        office: String(form.get("office") ?? ""),
        state: String(form.get("state") ?? "").trim(),
        constituency: String(form.get("constituency") ?? "").trim(),
        since: String(form.get("since") ?? "").trim(),
        photoUrl: String(form.get("photoUrl") ?? "").trim(),
        partySymbolUrl: String(form.get("partySymbolUrl") ?? "").trim(),
        house: String(form.get("house") ?? "").trim(),
        description: String(form.get("description") ?? "").trim(),
        termStart: String(form.get("termStart") ?? "").trim(),
        termEnd: String(form.get("termEnd") ?? "").trim(),
        electionYear: form.get("electionYear") ? Number(form.get("electionYear")) : undefined,
        education: String(form.get("education") ?? "").trim(),
        summary: String(form.get("summary") ?? "").trim(),
        status: String(form.get("status") ?? "draft"),
        sources: parseJsonList("sources"),
        elections: parseJsonList("elections"),
        recordData: JSON.parse(String(form.get("recordData") ?? "{}") || "{}"),
      };
      const path = editor === "new" ? "/representatives" : `/representatives/${editor?._id}`;
      await adminRequest(apiUrl, path, {
        method: editor === "new" ? "POST" : "PATCH",
        body: JSON.stringify(payload),
      });
      setEditor(null);
      await onRefresh();
      onNotice("Representative record saved");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not save record");
    } finally {
      setSaving(false);
    }
  };

  const removeRepresentative = async (person: AdminRepresentative) => {
    if (!window.confirm(t("Permanently delete {name}'s record?", { name: person.name }))) return;
    try {
      await adminRequest(apiUrl, `/representatives/${person._id}`, { method: "DELETE" });
      await onRefresh();
      onNotice("Representative record deleted");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not delete record");
    }
  };

  return (
    <section className="admin-panel admin-workspace" id="admin-panel">
      <div className="admin-panel-heading">
        <div>
          <div className="eyebrow small-eyebrow">
            {t("ADMINISTRATION") + " "}
            <span className="heading-rule" />
          </div>
          <h2>
            {t(
              {
                overview: "Dashboard overview",
                representatives: "Representative records",
                users: "Registered users",
                activity: "User activity",
              }[view],
            )}
            <span>.</span>
          </h2>
          <p>{t("Manage representative records and review registered Google accounts.")}</p>
        </div>
        <div className="admin-heading-actions">
          <button className="modal-done" onClick={onClose}>
            {t("Close admin")}
          </button>
          <button className="modal-done" onClick={onSignOut}>
            <LogOut size={15} aria-hidden="true" />
            {" " + t("Sign out")}
          </button>
        </div>
      </div>
      <div className="admin-layout">
        <nav className="admin-sidebar" aria-label={t("Admin sections")}>
          <div className="admin-sidebar-brand">
            <span>
              <ShieldCheck size={22} />
            </span>
            <div>
              <strong>{t("Admin workspace")}</strong>
              <small>{t("Jan Pratinidhi")}</small>
            </div>
          </div>
          <p className="admin-sidebar-label">{t("WORKSPACE")}</p>
          {(
            [
              ["overview", "Overview", LayoutDashboard],
              ["representatives", "Representatives", Landmark],
              ["users", "Signed-in users", Users],
              ["activity", "User activity", Activity],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              aria-current={view === key ? "page" : undefined}
              data-section={key}
              className={view === key ? "admin-side-button active" : "admin-side-button"}
              onClick={() => {
                setView(key);
                setEditor(null);
              }}
            >
              <Icon size={18} aria-hidden="true" />
              <strong>{t(label)}</strong>
              {key === "users" ? (
                <span>{stats.users}</span>
              ) : (
                <ChevronRight size={14} className="admin-side-chevron" aria-hidden="true" />
              )}
            </button>
          ))}
          <div className="admin-sidebar-note">
            <ShieldCheck size={18} aria-hidden="true" />
            <p>
              {t("Better records.")}
              <br />
              <strong>{t("Better public information.")}</strong>
            </p>
          </div>
        </nav>
        <div className="admin-content">
          {loading ? (
            <p className="admin-empty">{t("Loading dashboard data…")}</p>
          ) : (
            <>
              {view === "overview" && (
                <>
                  <div className="admin-stat-grid">
                    {[
                      { label: "Registered users", value: stats.users, icon: Users, tone: "blue" },
                      {
                        label: "Representative records",
                        value: stats.representatives,
                        icon: Landmark,
                        tone: "violet",
                      },
                      {
                        label: "Published records",
                        value: stats.published,
                        icon: CheckCheck,
                        tone: "green",
                      },
                      { label: "Drafts", value: stats.drafts, icon: FilePenLine, tone: "amber" },
                      {
                        label: "Visitors today",
                        value: stats.todayVisitors,
                        icon: ChartNoAxesCombined,
                        tone: "blue",
                      },
                    ].map(({ label, value, icon: Icon, tone }) => (
                      <article className="admin-stat-card" data-tone={tone} key={label}>
                        <span className="admin-metric-icon">
                          <Icon size={19} aria-hidden="true" />
                        </span>
                        <small>{t(label)}</small>
                        <b>{value.toLocaleString(locale())}</b>
                      </article>
                    ))}
                  </div>
                  <section className="admin-visitor-chart">
                    <div>
                      <h3>{t("Daily visitors")}</h3>
                      <p>{t("Unique browsers recorded per UTC day · last 7 days")}</p>
                    </div>
                    <div className="admin-visitor-bars">
                      {stats.dailyVisitors.map(({ date, count }) => (
                        <div
                          className="admin-visitor-day"
                          key={date}
                          title={t("{count} unique visitors on {date}", { count, date })}
                        >
                          <b>{count}</b>
                          <div className="admin-visitor-bar-track">
                            <span
                              style={{
                                height: `${count ? Math.max(8, (count / maxDailyVisitors) * 100) : 0}%`,
                              }}
                            />
                          </div>
                          <small>
                            {new Date(`${date}T00:00:00Z`).toLocaleDateString(locale(), {
                              weekday: "short",
                              timeZone: "UTC",
                            })}
                          </small>
                        </div>
                      ))}
                    </div>
                  </section>
                  <div className="admin-overview-row">
                    <div>
                      <h3>{t("Recent sign-ins")}</h3>
                      <p>{t("Latest accounts registered with Google")}</p>
                    </div>
                    <button className="admin-inline-button" onClick={() => setView("users")}>
                      {t("View all users") + " "}
                      <ArrowRight size={14} />
                    </button>
                  </div>
                  {users.slice(0, 5).length ? (
                    <UserTable
                      users={users.slice(0, 5)}
                      onStatusChange={onStatusChange}
                      onDeleteUser={onDeleteUser}
                      onViewActivity={(user) => void showUserActivity(user)}
                    />
                  ) : (
                    <p className="admin-empty">{t("No users have signed in yet.")}</p>
                  )}
                  <div className="admin-overview-row">
                    <div>
                      <h3>{t("Representative content")}</h3>
                      <p>
                        {stats.published}
                        {" " + t("published ·") + " "}
                        {stats.drafts}
                        {" " + t("drafts")}
                      </p>
                    </div>
                    <button
                      className="admin-inline-button"
                      onClick={() => setView("representatives")}
                    >
                      {t("Manage records") + " "}
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </>
              )}
              {view === "users" && (
                <>
                  <div className="admin-view-title">
                    <div>
                      <h3>{t("Signed-in users")}</h3>
                      <p>
                        {users.length}
                        {" " + t("registered Google")}{" "}
                        {users.length === 1 ? t("account") : t("accounts")}
                      </p>
                    </div>
                  </div>
                  {users.length ? (
                    <UserTable
                      users={users}
                      onStatusChange={onStatusChange}
                      onDeleteUser={onDeleteUser}
                      onViewActivity={(user) => void showUserActivity(user)}
                    />
                  ) : (
                    <p className="admin-empty">{t("No Google accounts have signed in yet.")}</p>
                  )}
                </>
              )}
              {view === "activity" && (
                <>
                  <div className="admin-view-title">
                    <div>
                      <h3>{t("User activity")}</h3>
                      <p>
                        {t(
                          "One row per account with its latest action. Open details to see all recorded activity; repeat visits to a page update its last-visited time without adding another page entry.",
                        )}
                      </p>
                    </div>
                  </div>
                  {users.length ? (
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>{t("User")}</th>
                            <th>{t("Email")}</th>
                            <th>{t("Last action")}</th>
                            <th>{t("Time")}</th>
                            <th>{t("Details")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((account) => (
                            <tr key={account._id}>
                              <td>
                                <b>{account.name}</b>
                              </td>
                              <td>{account.email}</td>
                              <td>
                                {account.lastActivity ? (
                                  <>
                                    {account.lastActivity.action}
                                    <small className="admin-subline">
                                      {account.lastActivity.details}
                                    </small>
                                  </>
                                ) : (
                                  "No activity yet"
                                )}
                              </td>
                              <td>
                                {account.lastActivity
                                  ? new Date(account.lastActivity.at).toLocaleString(locale())
                                  : "—"}
                              </td>
                              <td>
                                <button
                                  type="button"
                                  title={t("Show {name}'s activity", { name: account.name })}
                                  aria-label={t("Show {name}'s activity", { name: account.name })}
                                  onClick={() => void showUserActivity(account)}
                                >
                                  <Clock3 size={15} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="admin-empty">{t("No users or activity recorded yet.")}</p>
                  )}
                </>
              )}
              {view === "representatives" && (
                <>
                  <div className="admin-view-title">
                    <div>
                      <h3>{t("Representative records")}</h3>
                      <p>{t("Only published records appear in the public directory.")}</p>
                    </div>
                    {!editor && (
                      <button className="admin-add-button" onClick={() => setEditor("new")}>
                        {t("+ Add representative")}
                      </button>
                    )}
                  </div>
                  {editor ? (
                    <RepresentativeEditor
                      key={editor === "new" ? "new" : editor._id}
                      person={editor === "new" ? undefined : editor}
                      saving={saving}
                      onCancel={() => setEditor(null)}
                      onSubmit={saveRepresentative}
                    />
                  ) : (
                    <>
                      <div className="admin-search">
                        <Search size={15} />
                        <input
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder={t("Search records by person, party, state…")}
                        />
                      </div>
                      {visibleRecords.length ? (
                        <div className="admin-table-wrap">
                          <table className="admin-table">
                            <thead>
                              <tr>
                                <th>{t("Representative")}</th>
                                <th>{t("Office")}</th>
                                <th>{t("State / constituency")}</th>
                                <th>{t("Status")}</th>
                                <th>{t("Actions")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {visibleRecords.map((person) => (
                                <tr key={person._id}>
                                  <td>
                                    <b>{person.name}</b>
                                    <small className="admin-subline">{person.party}</small>
                                  </td>
                                  <td>{t(person.office)}</td>
                                  <td>
                                    {person.state}
                                    <small className="admin-subline">
                                      {person.constituency || t("Constituency not set")}
                                    </small>
                                  </td>
                                  <td>
                                    <span className={`admin-status ${person.status}`}>
                                      {t(person.status)}
                                    </span>
                                  </td>
                                  <td>
                                    <div className="admin-row-actions">
                                      <button onClick={() => setEditor(person)}>{t("Edit")}</button>
                                      <button
                                        className="danger"
                                        onClick={() => void removeRepresentative(person)}
                                      >
                                        {t("Delete")}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="admin-empty">
                          {t("No database records found. Add a representative to get started.")}
                        </p>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
      {activityUser && (
        <div className="user-activity-backdrop">
          <section
            className="user-activity-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-activity-title"
          >
            <header>
              <div>
                <h3 id="user-activity-title">
                  {t("Activity ·") + " "}
                  {activityUser.name}
                </h3>
                <p>
                  {activityUser.email}
                  {" " + t("· Page names are listed once, with the latest visit time.")}
                </p>
              </div>
              <button
                type="button"
                className="user-activity-close"
                onClick={() => setActivityUser(null)}
                aria-label={t("Close activity details")}
              >
                <X size={18} />
              </button>
            </header>
            {activityLoading ? (
              <p className="admin-empty">{t("Loading user activity…")}</p>
            ) : userActivity.length ? (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t("Activity")}</th>
                      <th>{t("Details")}</th>
                      <th>{t("Time")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userActivity.map((event) => (
                      <tr key={event._id}>
                        <td>{event.action}</td>
                        <td>{event.details || "—"}</td>
                        <td>
                          {new Date(event.lastSeenAt ?? event.createdAt).toLocaleString(locale())}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="admin-empty">{t("No activity recorded for this user yet.")}</p>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

function UserTable({
  users,
  onStatusChange,
  onDeleteUser,
  onViewActivity,
}: {
  users: AdminUser[];
  onStatusChange: (user: AdminUser, status: "active" | "inactive") => void;
  onDeleteUser: (user: AdminUser) => void;
  onViewActivity: (user: AdminUser) => void;
}) {
  const genderLabel: Record<Gender, string> = {
    female: "Female",
    male: "Male",
    non_binary: "Non-binary",
    prefer_not_to_say: "Not specified",
  };
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>{t("User")}</th>
            <th>{t("Email")}</th>
            <th>{t("Phone")}</th>
            <th>{t("Gender")}</th>
            <th>{t("Joined")}</th>
            <th>{t("Last sign-in")}</th>
            <th>{t("Last action")}</th>
            <th>{t("Status")}</th>
            <th>{t("Actions")}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((account) => (
            <tr key={account._id}>
              <td>
                <span className="admin-user-cell">
                  {account.picture && <img src={account.picture} alt="" />}
                  <b>{account.name}</b>
                </span>
              </td>
              <td>{account.email}</td>
              <td>{account.phoneNumber || t("Profile incomplete")}</td>
              <td>{account.gender ? t(genderLabel[account.gender]) : "—"}</td>
              <td>{new Date(account.createdAt).toLocaleDateString(locale())}</td>
              <td>{new Date(account.lastLoginAt).toLocaleString(locale())}</td>
              <td>
                {account.lastActivity ? (
                  <>
                    <b>{account.lastActivity.action}</b>
                    <small className="admin-subline">
                      {account.lastActivity.details} ·{" "}
                      {new Date(account.lastActivity.at).toLocaleString(locale())}
                    </small>
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td>
                <span className={`admin-status ${account.status ?? "active"}`}>
                  {t(account.status ?? "active")}
                </span>
              </td>
              <td>
                <div className="admin-row-actions">
                  <button
                    type="button"
                    title={t("Show {name}'s activity", { name: account.name })}
                    aria-label={t("Show {name}'s activity", { name: account.name })}
                    onClick={() => onViewActivity(account)}
                  >
                    <Clock3 size={15} />
                  </button>
                  {account.status !== "deleted" && (
                    <>
                      <button
                        onClick={() =>
                          onStatusChange(
                            account,
                            account.status === "inactive" ? "active" : "inactive",
                          )
                        }
                      >
                        {account.status === "inactive" ? t("Activate") : t("Deactivate")}
                      </button>
                      <button className="danger" onClick={() => onDeleteUser(account)}>
                        {t("Delete")}
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RepresentativeEditor({
  person,
  saving,
  onCancel,
  onSubmit,
}: {
  person?: AdminRepresentative;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="admin-editor" onSubmit={onSubmit}>
      <div className="admin-editor-heading">
        <h3>{person ? `Edit ${person.name}` : t("Add representative")}</h3>
        <span>{t("Required fields are marked *")}</span>
      </div>
      <div className="admin-form-grid">
        <label>
          {t("Full name *")}
          <input name="name" required defaultValue={person?.name} />
        </label>
        <label>
          {t("Slug")}
          <input
            name="slug"
            defaultValue={person?.slug}
            placeholder={t("optional-profile-url-name")}
          />
        </label>
        <label>
          {t("Initials")}
          <input name="initials" maxLength={4} defaultValue={person?.initials} />
        </label>
        <label>
          {t("Office *")}
          <select name="office" required defaultValue={person?.office ?? "MLA"}>
            {filters.slice(1).map((office) => (
              <option key={office} value={office}>
                {t(office)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("Record status")}
          <select name="status" defaultValue={person?.status ?? "draft"}>
            <option value="draft">{t("Draft (hidden)")}</option>
            <option value="published">{t("Published (public)")}</option>
          </select>
        </label>
        <label>
          {t("Party *")}
          <input name="party" required defaultValue={person?.party} />
        </label>
        <label>
          {t("Party short name")}
          <input name="partyShort" defaultValue={person?.partyShort} />
        </label>
        <label>
          {t("Party symbol image URL")}
          <input name="partySymbolUrl" type="url" defaultValue={person?.partySymbolUrl} />
        </label>
        <label>
          {t("Profile photo URL")}
          <input name="photoUrl" type="url" defaultValue={person?.photoUrl} />
        </label>
        <label>
          {t("State *")}
          <input name="state" required defaultValue={person?.state} />
        </label>
        <label>
          {t("Constituency")}
          <input name="constituency" defaultValue={person?.constituency} />
        </label>
        <label>
          {t("House")}
          <input
            name="house"
            placeholder={t("Lok Sabha or Vidhan Sabha")}
            defaultValue={person?.house}
          />
        </label>
        <label>
          {t("Serving since")}
          <input name="since" defaultValue={person?.since} />
        </label>
        <label>
          {t("Term start")}
          <input
            name="termStart"
            defaultValue={person?.termStart}
            placeholder={t("YYYY or date")}
          />
        </label>
        <label>
          {t("Term end")}
          <input name="termEnd" defaultValue={person?.termEnd} placeholder={t("YYYY or date")} />
        </label>
        <label>
          {t("Election year")}
          <input
            name="electionYear"
            type="number"
            min="1900"
            max="2200"
            defaultValue={person?.electionYear}
          />
        </label>
        <label>
          {t("Education")}
          <input name="education" defaultValue={person?.education} />
        </label>
        <label className="wide-field">
          {t("Biography / description")}
          <textarea
            name="description"
            rows={3}
            defaultValue={person?.description ?? person?.summary}
          />
        </label>
        <label className="wide-field">
          {t("Profile summary")}
          <textarea name="summary" rows={2} defaultValue={person?.summary} />
        </label>
        <label className="wide-field">
          {t("Sources (JSON array)")}
          <textarea
            name="sources"
            rows={4}
            defaultValue={JSON.stringify(person?.sources ?? [], null, 2)}
            spellCheck={false}
          />
          <small>{t("Each source needs title, url, publisher, sourceType, and accessedAt.")}</small>
        </label>
        <label className="wide-field">
          {t("Election history (JSON array)")}
          <textarea
            name="elections"
            rows={5}
            defaultValue={JSON.stringify(person?.elections ?? [], null, 2)}
            spellCheck={false}
          />
          <small>{t("Keep each election's source details with its result.")}</small>
        </label>
        <label className="wide-field">
          {t("Additional record data (JSON object)")}
          <textarea
            name="recordData"
            rows={5}
            defaultValue={JSON.stringify(person?.recordData ?? {}, null, 2)}
            spellCheck={false}
          />
        </label>
      </div>
      <div className="admin-editor-actions">
        <button type="button" className="modal-done" onClick={onCancel}>
          {t("Cancel")}
        </button>
        <button type="submit" className="admin-add-button" disabled={saving}>
          {saving ? t("Saving…") : t("Save record")}
        </button>
      </div>
    </form>
  );
}
