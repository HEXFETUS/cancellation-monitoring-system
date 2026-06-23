import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { Send, X } from "lucide-react";

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const POLL_INTERVAL_MS = 3000;

type MessageType = {
    id: number;
    message: string;
    created_at: string;
    sender_id: number;
    sender: { id: number; name: string; profile_picture: string | null; role: string };
};

type ConversationType = {
    conversation_id: number;
    last_message: string | null;
    last_message_at: string | null;
    participants: Array<{ id: number; name: string; usertype: string; profile_picture: string | null }>;
};

function formatTime(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const y = new Date(now); y.setDate(y.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function userInitials(name: string) {
    return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

export default function MessageDock() {
    const { user: authUser } = useAuth();
    const [conversations, setConversations] = useState<ConversationType[]>([]);
    const [activeConv, setActiveConv] = useState<number | null>(null);
    const [messages, setMessages] = useState<MessageType[]>([]);
    const [inputText, setInputText] = useState("");
    const [sending, setSending] = useState(false);
    const [unreadMap, setUnreadMap] = useState<Record<number, boolean>>({});
    const isAdmin = authUser?.usertype === "admin";
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const refreshData = useCallback(async () => {
        if (!authUser?.id) return;
        try {
            const convRes = await fetch(`${API_BASE_URL}/api/messages/conversations?user_id=${authUser.id}`);
            if (convRes.ok) {
                const convData = await convRes.json();
                const convs: ConversationType[] = convData.conversations ?? [];
                setConversations(convs);
                const lastSeen = Number(localStorage.getItem(`msg_dock_seen_${authUser.id}`) ?? 0);
                const map: Record<number, boolean> = {};
                convs.forEach((c) => {
                    const t = c.last_message_at ? new Date(c.last_message_at).getTime() : 0;
                    if (t > lastSeen) map[c.conversation_id] = true;
                });
                setUnreadMap(map);
            }
            if (activeConv) {
                const msgRes = await fetch(`${API_BASE_URL}/api/messages/conversations/${activeConv}?user_id=${authUser.id}`);
                if (msgRes.ok) {
                    const msgData = await msgRes.json();
                    setMessages(msgData.messages ?? []);
                }
            }
        } catch { }
    }, [authUser?.id, activeConv]);

    useEffect(() => { refreshData(); const interval = setInterval(refreshData, POLL_INTERVAL_MS); return () => clearInterval(interval); }, [refreshData]);

    useEffect(() => {
        if (activeConv) {
            refreshData();
            try { localStorage.setItem(`msg_dock_seen_${authUser?.id}`, String(Date.now())); } catch { }
            setUnreadMap((prev) => ({ ...prev, [activeConv]: false }));
        }
    }, [activeConv, authUser?.id, refreshData]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = useCallback(async () => {
        const text = inputText.trim();
        if (!text || !activeConv || !authUser?.id || sending) return;
        setSending(true);
        setInputText("");
        try {
            const res = await fetch(`${API_BASE_URL}/api/messages/conversations/${activeConv}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: authUser.id, message: text }),
            });
            if (!res.ok) { setInputText(text); return; }
            const newMsg = await res.json();
            setMessages((prev) => [...prev, newMsg]);
            refreshData();
        } catch { setInputText(text); } finally { setSending(false); }
    }, [inputText, activeConv, authUser?.id, sending, refreshData]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    function getOtherParticipant(conv: ConversationType) {
        if (!conv.participants) return null;
        return conv.participants.find((p) => p.id !== authUser?.id) ?? conv.participants[0];
    }

    if (isAdmin) return null;

    const dockConversations = conversations.filter((conv) => {
        const other = getOtherParticipant(conv);
        return other?.usertype === "admin";
    });
    const visibleConversation = dockConversations[0] ?? null;
    const activeConvData = conversations.find((c) => c.conversation_id === activeConv);
    const activeOther = activeConvData ? getOtherParticipant(activeConvData) : null;

    return (
        <div className="fixed right-24 bottom-0 z-50 flex flex-col items-end">
            {/* Chat panel - bottom right */}
            {activeConv && activeOther && (
                <div
                    className="w-80 rounded-2xl border shadow-2xl overflow-hidden"
                    style={{
                        background: "rgba(255,255,255,0.98)",
                        border: "1px solid rgba(146,199,207,0.25)",
                        boxShadow: "0 8px 40px rgba(31,38,135,0.2)",
                    }}
                >
                    {/* Header */}
                    <div
                        className="flex items-center justify-between px-4 py-2.5 border-b shrink-0 cursor-pointer"
                        onClick={() => setActiveConv(null)}
                        style={{
                            background: "linear-gradient(135deg, #92C7CF, #AAD7D9)",
                        }}
                    >
                        <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold">
                                {userInitials(activeOther.name)}
                            </div>
                            <span className="text-white text-sm font-semibold truncate">{activeOther.name}</span>
                        </div>
                        <button onClick={() => setActiveConv(null)} className="text-white/80 hover:text-white">
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="h-64 overflow-y-auto px-3 py-2 space-y-1">
                        {messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                <p className="text-xs">No messages yet</p>
                            </div>
                        ) : (
                            messages.map((msg) => {
                                const isMine = Number(msg.sender_id) === Number(authUser?.id);
                                return (
                                    <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                                        <div className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm leading-relaxed ${isMine ? "bg-[#92C7CF] text-white rounded-br-md" : "bg-slate-100 text-slate-600 rounded-bl-md"}`}>
                                            <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                                            <p className={`text-[9px] mt-0.5 text-right ${isMine ? "text-white/70" : "text-slate-400"}`}>{formatTime(msg.created_at)}</p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="px-3 py-2 border-t border-slate-100">
                        <div className="flex items-center gap-1.5">
                            <input
                                type="text"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Reply..."
                                disabled={sending}
                                className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#92C7CF]/40 disabled:opacity-50"
                            />
                            <button
                                onClick={handleSend}
                                disabled={!inputText.trim() || sending}
                                className="inline-flex items-center justify-center h-8 w-8 rounded-xl bg-[#92C7CF] text-white hover:bg-[#7FB8C0] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <Send className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Admin tab - bottom edge */}
            {!activeConv && visibleConversation && (() => {
                const other = getOtherParticipant(visibleConversation);
                if (!other) return null;
                const hasUnread = !!unreadMap[visibleConversation.conversation_id];
                return (
                    <button
                        key={visibleConversation.conversation_id}
                        onClick={() => setActiveConv((current) => current === visibleConversation.conversation_id ? null : visibleConversation.conversation_id)}
                        className="relative flex min-w-[180px] items-center gap-2 pl-2.5 pr-5 py-2 rounded-t-lg shadow-lg transition-all duration-200 hover:scale-105"
                        style={{
                            background: "linear-gradient(135deg, #92C7CF, #AAD7D9)",
                        }}
                        title={other.name}
                    >
                        <div className="h-6 w-6 rounded bg-white/20 flex items-center justify-center text-white text-[10px] font-bold">
                            {userInitials(other.name)}
                        </div>
                        <span className="text-white text-xs font-medium max-w-[80px] truncate">
                            {other.name}
                        </span>
                        {hasUnread && (
                            <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-md">
                                !
                            </span>
                        )}
                    </button>
                );
            })()}
        </div>
    );
}
