import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { Send, User, MessageSquare, Search, Users } from "lucide-react";

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const POLL_INTERVAL_MS = 3000;

type UserType = {
    id: number;
    name: string;
    usertype: string;
    profile_picture: string | null;
    last_message?: string | null;
    last_message_at?: string | null;
    last_message_sender_id?: number | null;
    last_incoming_message_at?: string | null;
};
type MessageType = { id: number; message: string; attachment_urls: string[]; created_at: string; sender_id: number; sender: { id: number; name: string; profile_picture: string | null; role: string } };

type AdminGroupInfo = {
    conversation_id: number;
    last_message: string | null;
    last_message_sender_id: number | null;
    last_message_at: string | null;
};

function userSeenStorageKey(userId?: number | null) {
    return userId ? `msg_user_seen_${userId}` : null;
}

function readUserSeenMap(userId?: number | null): Record<number, number> {
    const key = userSeenStorageKey(userId);
    if (!key) return {};
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function writeUserSeenMap(userId: number | undefined | null, map: Record<number, number>) {
    const key = userSeenStorageKey(userId);
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(map));
}

function getIncomingMessageTime(user: UserType) {
    const incomingAt = user.last_incoming_message_at ?? (
        Number(user.last_message_sender_id) === Number(user.id) ? user.last_message_at : null
    );
    if (!incomingAt) return 0;
    const time = new Date(incomingAt).getTime();
    return Number.isFinite(time) ? time : 0;
}

function resolveAvatar(p?: string | null) {
    if (!p) return null;
    if (/^https?:\/\//i.test(p)) return p;
    return `${API_BASE_URL}${p}`;
}

function formatTime(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateHeader(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return "Today";
    const y = new Date(now); y.setDate(y.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function userInitials(name: string) {
    return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
}


export default function MessagesPage() {
    const { user: authUser } = useAuth();
    const [users, setUsers] = useState<UserType[]>([]);
    const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
    const [conversationId, setConversationId] = useState<number | null>(null);
    const [messages, setMessages] = useState<MessageType[]>([]);
    const [inputText, setInputText] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [userSeenMap, setUserSeenMap] = useState<Record<number, number>>(() => readUserSeenMap(authUser?.id));
    const [newMessageMap, setNewMessageMap] = useState<Record<number, boolean>>({});
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const hasViewedRef = useRef(false);

    // Admin group chat state
    const isAdmin = authUser?.usertype === "admin";
    const [adminGroup, setAdminGroup] = useState<AdminGroupInfo | null>(null);
    const [adminGroupOpen, setAdminGroupOpen] = useState(false);
    const [adminGroupUnread, setAdminGroupUnread] = useState(false);
    const adminGroupSeenKey = authUser?.id ? `admin_group_seen_${authUser.id}` : null;
    const adminGroupOpenRef = useRef(false);

    const readAdminGroupSeen = useCallback((): number => {
        if (!adminGroupSeenKey) return 0;
        try { return Number(localStorage.getItem(adminGroupSeenKey) ?? 0); } catch { return 0; }
    }, [adminGroupSeenKey]);

    const writeAdminGroupSeen = useCallback((time: number) => {
        if (!adminGroupSeenKey) return;
        try { localStorage.setItem(adminGroupSeenKey, String(time)); } catch { }
    }, [adminGroupSeenKey]);

    useEffect(() => {
        setUserSeenMap(readUserSeenMap(authUser?.id));
        setNewMessageMap({});
        hasViewedRef.current = false;
    }, [authUser?.id]);

    const fetchAdminGroup = useCallback(async () => {
        if (!authUser?.id || !isAdmin) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/messages/admin-group?user_id=${authUser.id}`);
            if (!res.ok) return;
            const data = await res.json();
            setAdminGroup(data);
            // Check unread status — use ref for open state to avoid stale closures in polling
            const lastMsgAt = data.last_message_at ? new Date(data.last_message_at).getTime() : 0;
            // Only show unread if the last message was not sent by the current admin
            const isOwn = data.last_message_sender_id != null && Number(data.last_message_sender_id) === Number(authUser.id);
            if (lastMsgAt > 0 && !isOwn) {
                const seen = readAdminGroupSeen();
                if (lastMsgAt > seen && !adminGroupOpenRef.current) {
                    setAdminGroupUnread(true);
                }
            }
        } catch { }
    }, [authUser?.id, isAdmin, readAdminGroupSeen]);

    const fetchUsers = useCallback(async () => {
        if (!authUser?.id) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/messages/users?user_id=${authUser.id}`);
            if (!res.ok) return;
            const data = await res.json();
            const userList: UserType[] = data.users ?? [];
            setUsers(userList);
            const map: Record<number, boolean> = {};
            userList.forEach((u) => {
                const t = getIncomingMessageTime(u);
                const userLastSeen = userSeenMap[u.id] ?? 0;
                if (t > userLastSeen) {
                    if (u.id === selectedUser?.id && hasViewedRef.current) {
                        // Don't add to newMessageMap
                    } else {
                        map[u.id] = true;
                    }
                }
            });
            setNewMessageMap(map);
        } catch { } finally { setLoading(false); }
    }, [authUser?.id, selectedUser?.id, userSeenMap]);

    // Initial load
    useEffect(() => {
        fetchUsers();
        fetchAdminGroup();
    }, [fetchUsers, fetchAdminGroup]);

    // Poll all data
    useEffect(() => {
        if (!authUser?.id) return;
        const interval = window.setInterval(() => {
            fetchUsers();
            fetchAdminGroup();
        }, 4000);
        return () => window.clearInterval(interval);
    }, [authUser?.id, fetchUsers, fetchAdminGroup]);

    const handleSelectUser = useCallback(async (u: UserType) => {
        setSelectedUser(u);
        setConversationId(null);
        setMessages([]);
        setAdminGroupOpen(false);
        adminGroupOpenRef.current = false;
        hasViewedRef.current = false;

        if (!authUser?.id) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/messages/conversations`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: authUser.id, other_user_id: u.id }),
            });
            if (!res.ok) return;
            const data = await res.json();
            setConversationId(data.conversation_id);
        } catch { }
    }, [authUser?.id]);

    const handleOpenAdminGroup = useCallback(async () => {
        setSelectedUser(null);
        setConversationId(null);
        setAdminGroupOpen(true);
        adminGroupOpenRef.current = true;
        setMessages([]);
        hasViewedRef.current = false;
        setAdminGroupUnread(false);

        if (!authUser?.id || !isAdmin) return;
        try {
            // Get or create admin group
            const res = await fetch(`${API_BASE_URL}/api/messages/admin-group?user_id=${authUser.id}`);
            if (!res.ok) return;
            const data = await res.json();
            setAdminGroup(data);
            setConversationId(data.conversation_id);
            // Mark as seen
            writeAdminGroupSeen(Date.now());
        } catch { }
    }, [authUser?.id, isAdmin, writeAdminGroupSeen]);

    const fetchMessages = useCallback(async () => {
        if (!conversationId || !authUser?.id) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/messages/conversations/${conversationId}?user_id=${authUser.id}`);
            if (!res.ok) return;
            const data = await res.json();
            setMessages(data.messages ?? []);

            if (!hasViewedRef.current) {
                hasViewedRef.current = true;
                const seenAt = Date.now();

                if (adminGroupOpen && isAdmin) {
                    writeAdminGroupSeen(seenAt);
                    setAdminGroupUnread(false);
                    // Also update userSeenMap for admin group marker in the sidebar
                } else if (selectedUser) {
                    setUserSeenMap((prev) => {
                        const updated = { ...prev, [selectedUser.id]: Math.max(prev[selectedUser.id] ?? 0, seenAt) };
                        writeUserSeenMap(authUser.id, updated);
                        return updated;
                    });
                    setNewMessageMap((prev) => ({ ...prev, [selectedUser.id]: false }));
                }
            }
        } catch { }
    }, [conversationId, authUser?.id, selectedUser, adminGroupOpen, isAdmin, writeAdminGroupSeen]);

    useEffect(() => { fetchMessages(); }, [fetchMessages]);
    useEffect(() => {
        if (!conversationId) return;
        const interval = setInterval(fetchMessages, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [conversationId, fetchMessages]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = useCallback(async () => {
        const text = inputText.trim();
        if (!text || !conversationId || !authUser?.id || sending) return;
        setSending(true);
        setInputText("");

        // Determine the correct send endpoint
        const url = adminGroupOpen && isAdmin
            ? `${API_BASE_URL}/api/messages/admin-group/messages`
            : `${API_BASE_URL}/api/messages/conversations/${conversationId}/messages`;

        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: authUser.id, message: text }),
            });
            if (!res.ok) { setInputText(text); return; }
            const newMsg = await res.json();
            setMessages((prev) => [...prev, newMsg]);
            // Update seen timestamp after sending
            const seenAt = Date.now();
            if (adminGroupOpen && isAdmin) {
                writeAdminGroupSeen(seenAt);
                setAdminGroupUnread(false);
            } else if (selectedUser) {
                setUsers((prev) => prev.map((u) => u.id === selectedUser?.id ? { ...u, last_message: text, last_message_at: new Date().toISOString(), last_message_sender_id: authUser.id } : u));
                setUserSeenMap((prev) => {
                    const updated = { ...prev, [selectedUser.id]: Math.max(prev[selectedUser.id] ?? 0, seenAt) };
                    writeUserSeenMap(authUser.id, updated);
                    return updated;
                });
                setNewMessageMap((prev) => ({ ...prev, [selectedUser.id]: false }));
            }
        } catch { setInputText(text); } finally { setSending(false); }
    }, [inputText, conversationId, authUser?.id, sending, selectedUser, adminGroupOpen, isAdmin, writeAdminGroupSeen]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    const filteredUsers = users.filter(
        (u) => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.usertype.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const sortedUsers = [...filteredUsers].sort((a, b) => {
        if (a.last_message_at && b.last_message_at) return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
        if (a.last_message_at) return -1;
        if (b.last_message_at) return 1;
        return a.name.localeCompare(b.name);
    });

    const groupedMessages: { date: string; messages: MessageType[] }[] = [];
    let currentDate = "";
    for (const msg of messages) {
        const dateKey = new Date(msg.created_at).toDateString();
        if (dateKey !== currentDate) {
            currentDate = dateKey;
            groupedMessages.push({ date: msg.created_at, messages: [msg] });
        } else {
            groupedMessages[groupedMessages.length - 1].messages.push(msg);
        }
    }

    const hasUnseenIncoming = selectedUser && messages.some((msg) => {
        if (Number(msg.sender_id) === Number(authUser?.id)) return false;
        const msgTime = new Date(msg.created_at).getTime();
        return msgTime > (userSeenMap[selectedUser.id] ?? 0);
    });

    return (
        <div className="flex h-full min-h-0 gap-4 overflow-hidden">
            {/* Left sidebar */}
            <div className="w-80 shrink-0 flex flex-col rounded-2xl border border-slate-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl overflow-hidden h-full">
                <div className="p-4 border-b border-slate-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-3">
                        <MessageSquare className="h-5 w-5 text-[#92C7CF]" />
                        <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-200">Messages</h2>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-gray-600 bg-white/80 dark:bg-gray-700/80 text-sm text-slate-700 dark:text-gray-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#92C7CF]/40"
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {/* Admin Group Chat — always on top for admins */}
                    {isAdmin && adminGroup && (
                        <button
                            onClick={handleOpenAdminGroup}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-200 hover:bg-slate-100 dark:hover:bg-gray-700/50 ${
                                adminGroupOpen ? "bg-[#92C7CF]/10 dark:bg-[#92C7CF]/10 border-l-2 border-[#92C7CF]" : "border-l-2 border-transparent"
                            }`}
                        >
                            <div className="shrink-0">
                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#92C7CF] to-[#AAD7D9] flex items-center justify-center text-white text-sm font-bold ring-2 ring-white/60 dark:ring-gray-600">
                                    <Users className="h-5 w-5" />
                                </div>
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        {adminGroupUnread && <span className="h-2 w-2 rounded-full shrink-0" style={{ background: "#EF4444", boxShadow: "0 0 6px rgba(239,68,68,0.7)" }} />}
                                        <span className={`text-sm truncate ${adminGroupUnread ? "font-bold text-slate-900 dark:text-gray-100" : "font-medium text-slate-800 dark:text-gray-200"}`}>
                                            👥 Admin Team Chat
                                        </span>
                                    </div>
                                    {adminGroup.last_message_at && <span className="text-[10px] text-slate-400 dark:text-gray-500 shrink-0 ml-2">{formatTime(adminGroup.last_message_at)}</span>}
                                </div>
                                {adminGroup.last_message && (
                                    <p className={`text-xs truncate mt-0.5 ${adminGroupUnread ? "text-slate-600 dark:text-gray-300 font-medium" : "text-slate-400 dark:text-gray-500"}`}>
                                        {adminGroup.last_message.length > 60 ? adminGroup.last_message.slice(0, 60) + "..." : adminGroup.last_message}
                                    </p>
                                )}
                            </div>
                        </button>
                    )}

                    {/* Divider between admin group and user conversations */}
                    {isAdmin && adminGroup && sortedUsers.length > 0 && (
                        <div className="px-4 py-1.5">
                            <div className="border-t border-slate-200 dark:border-gray-700" />
                        </div>
                    )}

                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <div className="h-6 w-6 rounded-full border-2 border-[#92C7CF]/30 border-t-[#92C7CF] animate-spin" />
                        </div>
                    ) : sortedUsers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-slate-400 dark:text-gray-500">
                            <User className="h-8 w-8 mb-2 opacity-50" />
                            <p className="text-sm">No users found</p>
                        </div>
                    ) : (
                        sortedUsers.map((u) => (
                            <button
                                key={u.id}
                                onClick={() => handleSelectUser(u)}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-200 hover:bg-slate-100 dark:hover:bg-gray-700/50 ${selectedUser?.id === u.id ? "bg-[#92C7CF]/10 dark:bg-[#92C7CF]/10 border-l-2 border-[#92C7CF]" : "border-l-2 border-transparent"}`}
                            >
                                <div className="shrink-0">
                                    {resolveAvatar(u.profile_picture) ? (
                                        <img src={resolveAvatar(u.profile_picture)!} alt={u.name} className="h-10 w-10 rounded-full object-cover ring-2 ring-white/60 dark:ring-gray-600" />
                                    ) : (
                                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#92C7CF] to-[#AAD7D9] flex items-center justify-center text-white text-sm font-bold ring-2 ring-white/60 dark:ring-gray-600">
                                            {userInitials(u.name)}
                                        </div>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            {newMessageMap[u.id] && <span className="h-2 w-2 rounded-full shrink-0" style={{ background: "#EF4444", boxShadow: "0 0 6px rgba(239,68,68,0.7)" }} />}
                                            <span className={`text-sm truncate ${newMessageMap[u.id] ? "font-bold text-slate-900 dark:text-gray-100" : "font-medium text-slate-800 dark:text-gray-200"}`}>{u.name}</span>
                                        </div>
                                        {u.last_message_at && <span className="text-[10px] text-slate-400 dark:text-gray-500 shrink-0 ml-2">{formatTime(u.last_message_at)}</span>}
                                    </div>
                                    {u.last_message && <p className={`text-xs truncate mt-0.5 ${newMessageMap[u.id] ? "text-slate-600 dark:text-gray-300 font-medium" : "text-slate-400 dark:text-gray-500"}`}>{u.last_message.length > 60 ? u.last_message.slice(0, 60) + "..." : u.last_message}</p>}
                                </div>
                            </button>
                        ))
                    )}
                </div>
                <div className="p-3 border-t border-slate-200 dark:border-gray-700">
                    <p className="text-[11px] text-slate-400 dark:text-gray-500 text-center">{users.length} user{users.length !== 1 ? "s" : ""}</p>
                </div>
            </div>

            {/* Right panel */}
            <div className="flex-1 flex flex-col rounded-2xl border border-slate-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl h-full">
                {!selectedUser && !adminGroupOpen ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-gray-500">
                        <MessageSquare className="h-16 w-16 mb-4 opacity-30" />
                        <h3 className="text-lg font-medium text-slate-500 dark:text-gray-400 mb-1">No conversation selected</h3>
                        <p className="text-sm">Choose a user or group from the left to start chatting</p>
                    </div>
                ) : adminGroupOpen && isAdmin ? (
                    <>
                        <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-200 dark:border-gray-700 bg-white/40 dark:bg-gray-800/40 shrink-0">
                            <div className="shrink-0">
                                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold ring-2 ring-white/60 dark:ring-gray-600">
                                    <Users className="h-5 w-5" />
                                </div>
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-800 dark:text-gray-200 truncate">Admin Team Chat</p>
                                <p className="text-[10px] text-slate-400 dark:text-gray-500">All administrators</p>
                            </div>
                        </div>

                        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
                            {messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-gray-500">
                                    <Users className="h-10 w-10 mb-2 opacity-30" />
                                    <p className="text-sm">No messages yet in Admin Group Chat.</p>
                                </div>
                            ) : (
                                groupedMessages.map((group, gi) => (
                                    <div key={gi}>
                                        <div className="flex justify-center my-3">
                                            <span className="text-[11px] text-slate-400 dark:text-gray-500 bg-slate-100 dark:bg-gray-700 px-3 py-1 rounded-full">{formatDateHeader(group.date)}</span>
                                        </div>
                                        {group.messages.map((msg) => {
                                            const isMine = Number(msg.sender_id) === Number(authUser?.id);
                                            return (
                                                <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"} mb-3`}>
                                                    <div className={`max-w-[75%] ${isMine ? "order-1" : "order-1"}`}>
                                                        {!isMine && (
                                                            <div className="flex items-center gap-1.5 mb-1 ml-1">
                                                                {msg.sender.profile_picture ? (
                                                                    <img src={resolveAvatar(msg.sender.profile_picture)!} alt={msg.sender.name} className="h-5 w-5 rounded-full object-cover" />
                                                                ) : (
                                                                    <div className="h-5 w-5 rounded-full bg-gradient-to-br from-[#92C7CF] to-[#AAD7D9] flex items-center justify-center text-white text-[8px] font-bold">
                                                                        {userInitials(msg.sender.name)}
                                                                    </div>
                                                                )}
                                                                <span className="text-[11px] font-semibold text-slate-600 dark:text-gray-300">{msg.sender.name}</span>
                                                            </div>
                                                        )}
                                                        <div className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${isMine ? "bg-[#92C7CF] text-white rounded-br-md" : "bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-200 rounded-bl-md"}`}>
                                                            <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                                                            <p className={`text-[10px] mt-1 text-right ${isMine ? "text-white/70" : "text-slate-400 dark:text-gray-500"}`}>{formatTime(msg.created_at)}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="px-4 py-3 border-t border-slate-200 dark:border-gray-700 bg-white/40 dark:bg-gray-800/40 shrink-0">
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Type a message..."
                                    disabled={sending}
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-gray-600 bg-white/80 dark:bg-gray-700/80 text-sm text-slate-700 dark:text-gray-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#92C7CF]/40 disabled:opacity-50"
                                />
                                <button onClick={handleSend} disabled={!inputText.trim() || sending} className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-[#92C7CF] text-white hover:bg-[#7FB8C0] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                    <Send className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </>
                ) : selectedUser ? (
                    <>
                        <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-200 dark:border-gray-700 bg-white/40 dark:bg-gray-800/40 shrink-0">
                            <div className="shrink-0">
                                {resolveAvatar(selectedUser.profile_picture) ? (
                                    <img src={resolveAvatar(selectedUser.profile_picture)!} alt={selectedUser.name} className="h-9 w-9 rounded-full object-cover ring-2 ring-white/60 dark:ring-gray-600" />
                                ) : (
                                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#92C7CF] to-[#AAD7D9] flex items-center justify-center text-white text-sm font-bold ring-2 ring-white/60 dark:ring-gray-600">
                                        {userInitials(selectedUser.name)}
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-800 dark:text-gray-200 truncate">{selectedUser.name}</p>
                            </div>
                            {hasUnseenIncoming && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500 text-[10px] font-bold text-white shadow">
                                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                                    New
                                </span>
                            )}
                        </div>

                        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
                            {messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-gray-500">
                                    <MessageSquare className="h-10 w-10 mb-2 opacity-30" />
                                    <p className="text-sm">No messages yet. Say hello!</p>
                                </div>
                            ) : (
                                groupedMessages.map((group, gi) => (
                                    <div key={gi}>
                                        <div className="flex justify-center my-3">
                                            <span className="text-[11px] text-slate-400 dark:text-gray-500 bg-slate-100 dark:bg-gray-700 px-3 py-1 rounded-full">{formatDateHeader(group.date)}</span>
                                        </div>
                                        {group.messages.map((msg) => {
                                            const isMine = Number(msg.sender_id) === Number(authUser?.id);
                                            const msgTime = new Date(msg.created_at).getTime();
                                            const userLastSeen = userSeenMap[selectedUser?.id] ?? 0;
                                            const isNew = !isMine && msgTime > userLastSeen;
                                            return (
                                                <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"} mb-2`}>
                                                    <div className={`max-w-[75%] ${isMine ? "order-1" : "order-1"}`}>
                                                        {!isMine && <p className={`text-[10px] mb-0.5 ml-1 ${isNew ? "text-red-500 font-bold" : "text-slate-400 dark:text-gray-500"}`}>{msg.sender.name}</p>}
                                                        <div className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${isMine ? "bg-[#92C7CF] text-white rounded-br-md" : "bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-200 rounded-bl-md"} ${isNew ? "ring-1 ring-red-400/50" : ""}`}>
                                                            <p className={`whitespace-pre-wrap break-words ${isNew ? "font-bold" : ""}`}>{msg.message}</p>
                                                            <p className={`text-[10px] mt-1 text-right ${isMine ? "text-white/70" : "text-slate-400 dark:text-gray-500"}`}>{formatTime(msg.created_at)}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="px-4 py-3 border-t border-slate-200 dark:border-gray-700 bg-white/40 dark:bg-gray-800/40 shrink-0">
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Type a message..."
                                    disabled={sending}
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-gray-600 bg-white/80 dark:bg-gray-700/80 text-sm text-slate-700 dark:text-gray-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#92C7CF]/40 disabled:opacity-50"
                                />
                                <button onClick={handleSend} disabled={!inputText.trim() || sending} className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-[#92C7CF] text-white hover:bg-[#7FB8C0] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                    <Send className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
}