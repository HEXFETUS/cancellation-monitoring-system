import { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  Megaphone,
  Plus,
  Trash2,
  Loader2,
  Image,
  MapPin,
  Calendar as CalendarIcon,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import {
  fetchResults,
  createResult,
  deleteResult,
  fetchAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  type LotteryResult,
  type Announcement,
} from "../services/posts";

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const teal = "#92C7CF";

const areas = ["National", "Local CDO", "Local MISOR"] as const;

const defaultDrawLabels: Record<string, string[]> = {
  National: [
    "3D 1st Draw (2 PM)",
    "3D 2nd Draw (5 PM)",
    "3D 3rd Draw (9 PM)",
  ],
  "Local CDO": [
    "STL 1st Draw (11 AM)",
    "STL 2nd Draw (4 PM)",
    "STL 3rd Draw (8 PM)",
  ],
  "Local MISOR": [
    "STL 1st Draw (11 AM)",
    "STL 2nd Draw (4 PM)",
    "STL 3rd Draw (8 PM)",
  ],
};

export default function CsrPostsTabbedPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"results" | "events-news">("results");

  // ── Results State ──
  const [results, setResults] = useState<LotteryResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(true);
  const [newResult, setNewResult] = useState({
    draw_label: "",
    winning_number: "",
    area: "National" as string,
    draw_date: new Date().toISOString().split("T")[0],
  });

  // ── Announcements State ──
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [showPostForm, setShowPostForm] = useState(false);
  const [newPost, setNewPost] = useState({
    title: "",
    caption: "",
    type: "news" as "event" | "news",
    location: "",
  });
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Load results
  const loadResults = async () => {
    setLoadingResults(true);
    try {
      const data = await fetchResults();
      setResults(data);
    } catch {
      console.error("Failed to load results");
    } finally {
      setLoadingResults(false);
    }
  };

  // Load announcements
  const loadAnnouncements = async () => {
    setLoadingAnnouncements(true);
    try {
      const data = await fetchAnnouncements();
      setAnnouncements(data);
    } catch {
      console.error("Failed to load announcements");
    } finally {
      setLoadingAnnouncements(false);
    }
  };

  useEffect(() => {
    loadResults();
    loadAnnouncements();
  }, []);

  // Handle area change in result form — auto-select first draw label
  const handleAreaChange = (area: string) => {
    const labels = defaultDrawLabels[area] || [];
    setNewResult({
      ...newResult,
      area,
      draw_label: labels[0] || "",
    });
  };

  // Submit a new result
  const handleSubmitResult = async () => {
    if (!newResult.draw_label || !newResult.winning_number || !user) return;
    try {
      await createResult(
        {
          draw_label: newResult.draw_label,
          winning_number: newResult.winning_number,
          area: newResult.area as LotteryResult["area"],
          draw_date: newResult.draw_date,
        },
        user.id
      );
      setNewResult({
        draw_label: "",
        winning_number: "",
        area: "National",
        draw_date: new Date().toISOString().split("T")[0],
      });
      loadResults();
    } catch {
      console.error("Failed to create result");
    }
  };

  // Delete a result
  const handleDeleteResult = async (id: number) => {
    if (!user) return;
    try {
      await deleteResult(id, user.id);
      loadResults();
    } catch {
      console.error("Failed to delete result");
    }
  };

  // Submit a new announcement
  const handleSubmitPost = async () => {
    if (!newPost.title || !user) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("title", newPost.title);
      formData.append("caption", newPost.caption);
      formData.append("type", newPost.type);
      formData.append("location", newPost.location);
      mediaFiles.forEach((file) => formData.append("media", file));

      await createAnnouncement(formData, user.id);
      setNewPost({ title: "", caption: "", type: "news", location: "" });
      setMediaFiles([]);
      setShowPostForm(false);
      loadAnnouncements();
    } catch {
      console.error("Failed to create announcement");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete an announcement
  const handleDeletePost = async (id: number) => {
    if (!user) return;
    try {
      await deleteAnnouncement(id, user.id);
      loadAnnouncements();
    } catch {
      console.error("Failed to delete announcement");
    }
  };

  const tabs = [
    { id: "results" as const, label: "Results", icon: FileSpreadsheet },
    { id: "events-news" as const, label: "Events & News", icon: Megaphone },
  ];

  return (
    <div className="space-y-6">
      {/* Tab switcher */}
      <div className="flex gap-2 border-b pb-2" style={{ borderColor: "#E5E1DA" }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-t-xl text-sm font-semibold transition-all"
              style={{
                backgroundColor: isActive ? teal : "transparent",
                color: isActive ? "white" : "#6B7280",
              }}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── RESULTS TAB ── */}
      {activeTab === "results" && (
        <div className="space-y-6">
          {/* Add Result Form */}
          <div
            className="rounded-2xl p-6"
            style={{ backgroundColor: "white", border: "1px solid #E5E1DA" }}
          >
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Add New Result
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Area */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#6b6b6b" }}>
                  Area
                </label>
                <select
                  value={newResult.area}
                  onChange={(e) => handleAreaChange(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm border bg-white outline-none transition-all"
                  style={{
                    borderColor: "#E5E1DA",
                    color: "#4a4a4a",
                  }}
                >
                  {areas.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>

              {/* Draw Label */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#6b6b6b" }}>
                  Draw Label
                </label>
                <select
                  value={newResult.draw_label}
                  onChange={(e) => setNewResult({ ...newResult, draw_label: e.target.value })}
                  className="w-full rounded-xl px-3 py-2.5 text-sm border bg-white outline-none transition-all"
                  style={{ borderColor: "#E5E1DA", color: "#4a4a4a" }}
                >
                  <option value="">Select draw</option>
                  {(defaultDrawLabels[newResult.area] || []).map((label) => (
                    <option key={label} value={label}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Winning Number */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#6b6b6b" }}>
                  Winning Number
                </label>
                <input
                  type="text"
                  value={newResult.winning_number}
                  onChange={(e) => setNewResult({ ...newResult, winning_number: e.target.value })}
                  placeholder="e.g. 128"
                  className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none transition-all"
                  style={{ borderColor: "#E5E1DA", color: "#4a4a4a" }}
                />
              </div>

              {/* Draw Date */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#6b6b6b" }}>
                  Draw Date
                </label>
                <input
                  type="date"
                  value={newResult.draw_date}
                  onChange={(e) => setNewResult({ ...newResult, draw_date: e.target.value })}
                  className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none transition-all"
                  style={{ borderColor: "#E5E1DA", color: "#4a4a4a" }}
                />
              </div>
            </div>

            <button
              onClick={handleSubmitResult}
              disabled={!newResult.draw_label || !newResult.winning_number}
              className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ backgroundColor: teal }}
            >
              <Plus className="h-4 w-4" />
              Add Result
            </button>
          </div>

          {/* Results List */}
          <div
            className="rounded-2xl p-6"
            style={{ backgroundColor: "white", border: "1px solid #E5E1DA" }}
          >
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Recent Results (Last 3 Days)
            </h3>

            {loadingResults ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: teal }} />
              </div>
            ) : results.length === 0 ? (
              <p className="text-sm" style={{ color: "#999" }}>No results posted yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left" style={{ color: "#6b6b6b" }}>
                      <th className="pb-3 pr-4 font-medium">Draw</th>
                      <th className="pb-3 pr-4 font-medium">Number</th>
                      <th className="pb-3 pr-4 font-medium">Area</th>
                      <th className="pb-3 pr-4 font-medium">Date</th>
                      <th className="pb-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.id} className="border-t" style={{ borderColor: "#E5E1DA" }}>
                        <td className="py-3 pr-4 text-gray-800">{r.draw_label}</td>
                        <td className="py-3 pr-4 font-bold text-gray-800">{r.winning_number}</td>
                        <td className="py-3 pr-4" style={{ color: "#6b6b6b" }}>{r.area}</td>
                        <td className="py-3 pr-4" style={{ color: "#999" }}>
                          {new Date(r.draw_date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3">
                          <button
                            onClick={() => handleDeleteResult(r.id)}
                            className="p-1.5 rounded-lg transition-colors hover:bg-red-50"
                            style={{ color: "#ef4444" }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── EVENTS & NEWS TAB ── */}
      {activeTab === "events-news" && (
        <div className="space-y-6">
          {/* Toggle post form */}
          <button
            onClick={() => setShowPostForm(!showPostForm)}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all"
            style={{ backgroundColor: teal }}
          >
            <Plus className="h-4 w-4" />
            {showPostForm ? "Cancel" : "New Post"}
          </button>

          {/* Post Form */}
          {showPostForm && (
            <div
              className="rounded-2xl p-6 space-y-4"
              style={{ backgroundColor: "white", border: "1px solid #E5E1DA" }}
            >
              <h3 className="text-lg font-semibold text-gray-800">Create a Post</h3>

              {/* Type selector */}
              <div className="flex gap-3">
                {(["news", "event"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setNewPost({ ...newPost, type })}
                    className="rounded-xl px-4 py-2 text-sm font-semibold transition-all capitalize"
                    style={{
                      backgroundColor:
                        newPost.type === type ? teal : "rgba(229, 225, 218, 0.3)",
                      color: newPost.type === type ? "white" : "#6B7280",
                    }}
                  >
                    {type === "news" ? "📰 News" : "📅 Event"}
                  </button>
                ))}
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#6b6b6b" }}>
                  Title *
                </label>
                <input
                  type="text"
                  value={newPost.title}
                  onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                  placeholder="Post title"
                  className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none transition-all"
                  style={{ borderColor: "#E5E1DA", color: "#4a4a4a" }}
                />
              </div>

              {/* Caption */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#6b6b6b" }}>
                  Caption
                </label>
                <textarea
                  value={newPost.caption}
                  onChange={(e) => setNewPost({ ...newPost, caption: e.target.value })}
                  placeholder="Write your caption here..."
                  rows={3}
                  className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none transition-all resize-none"
                  style={{ borderColor: "#E5E1DA", color: "#4a4a4a" }}
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#6b6b6b" }}>
                  Location
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#999" }} />
                  <input
                    type="text"
                    value={newPost.location}
                    onChange={(e) => setNewPost({ ...newPost, location: e.target.value })}
                    placeholder="e.g. Cagayan de Oro City"
                    className="w-full rounded-xl pl-10 pr-3 py-2.5 text-sm border outline-none transition-all"
                    style={{ borderColor: "#E5E1DA", color: "#4a4a4a" }}
                  />
                </div>
              </div>

              {/* Media upload */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#6b6b6b" }}>
                  Media (Images / Videos)
                </label>
                <div
                  className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all"
                  style={{ borderColor: "#E5E1DA" }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const files = Array.from(e.dataTransfer.files).filter(
                      (f) =>
                        f.type.startsWith("image/") || f.type.startsWith("video/")
                    );
                    setMediaFiles((prev) => [...prev, ...files]);
                  }}
                >
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    className="hidden"
                    id="media-upload"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setMediaFiles((prev) => [...prev, ...files]);
                    }}
                  />
                  <label htmlFor="media-upload" className="cursor-pointer">
                    <Image className="mx-auto h-8 w-8 mb-2" style={{ color: "#999" }} />
                    <p className="text-sm" style={{ color: "#6b6b6b" }}>
                      Click or drag files to upload
                    </p>
                    <p className="text-xs mt-1" style={{ color: "#999" }}>
                      Images or videos (max 5 files, 10MB each)
                    </p>
                  </label>
                </div>

                {/* File preview */}
                {mediaFiles.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {mediaFiles.map((file, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs"
                        style={{
                          backgroundColor: "rgba(146, 199, 207, 0.1)",
                          border: "1px solid rgba(146, 199, 207, 0.2)",
                        }}
                      >
                        {file.name}
                        <button
                          onClick={() => setMediaFiles((prev) => prev.filter((_, j) => j !== i))}
                          className="ml-1"
                          style={{ color: "#ef4444" }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleSubmitPost}
                disabled={!newPost.title || submitting}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50"
                style={{ backgroundColor: teal }}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Megaphone className="h-4 w-4" />
                )}
                {submitting ? "Posting..." : "Publish Post"}
              </button>
            </div>
          )}

          {/* Announcements List */}
          <div
            className="rounded-2xl p-6"
            style={{ backgroundColor: "white", border: "1px solid #E5E1DA" }}
          >
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Published Posts
            </h3>

            {loadingAnnouncements ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: teal }} />
              </div>
            ) : announcements.length === 0 ? (
              <p className="text-sm" style={{ color: "#999" }}>No posts yet.</p>
            ) : (
              <div className="space-y-4">
                {announcements.map((post) => (
                  <div
                    key={post.id}
                    className="rounded-xl p-4"
                    style={{
                      backgroundColor: "#FBF9F1",
                      border: "1px solid #E5E1DA",
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                            style={{
                              backgroundColor:
                                post.type === "event"
                                  ? "rgba(146, 199, 207, 0.1)"
                                  : "rgba(229, 225, 218, 0.4)",
                              color: post.type === "event" ? teal : "#8a8a8a",
                            }}
                          >
                            {post.type === "event" ? "📅 Event" : "📰 News"}
                          </span>
                          <span className="text-xs" style={{ color: "#999" }}>
                            {new Date(post.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                        <h4 className="text-base font-semibold text-gray-800">
                          {post.title}
                        </h4>
                        {post.caption && (
                          <p className="mt-1 text-sm leading-relaxed" style={{ color: "#6b6b6b" }}>
                            {post.caption}
                          </p>
                        )}
                        {post.location && (
                          <p className="mt-2 text-xs flex items-center gap-1" style={{ color: "#999" }}>
                            <MapPin className="h-3 w-3" style={{ color: teal }} />
                            {post.location}
                          </p>
                        )}
                        {/* Media previews */}
                        {post.media_urls.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {post.media_urls.map((url, i) => (
                              <img
                                key={i}
                                src={`${API_BASE}${url}`}
                                alt={`Media ${i + 1}`}
                                className="h-16 w-16 rounded-lg object-cover"
                                style={{ border: "1px solid #E5E1DA" }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        className="p-1.5 rounded-lg transition-colors hover:bg-red-50 shrink-0"
                        style={{ color: "#ef4444" }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}