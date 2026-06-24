import { useEffect, useRef, useState } from "react";

const EMOJI_CATEGORIES = [
    {
        label: "Smileys",
        emojis: ["😀","😁","😂","🤣","😃","😄","😅","😆","😉","😊","😋","😎","😍","🤩","🥰","😘","😗","😙","😚","🙂","🤗","🤔","😐","😑","😶","😏","😒","🙄","😬","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🥵","🥶","🥴","😵","🤯","🤠","🥳","🥸","😎","🤓","🧐"],
    },
    {
        label: "Gestures",
        emojis: ["👍","👎","👌","✌️","🤞","🤟","🤘","🤙","👋","🤚","🖐","✋","🖖","👏","🙌","🤲","🤝","🙏","✍️","💪","🦾","🦿","🦵","🦶","👂","🦻","👃","🧠","🫀","🫁","🦷","🦴","👀","👁","👅","👄"],
    },
    {
        label: "Hearts",
        emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","♥️","😻","💑","💏","👩‍❤️‍👨","👨‍❤️‍👨","👩‍❤️‍👩","💌","💋","👄"],
    },
    {
        label: "Objects",
        emojis: ["📱","💻","🖥","🖨","⌨️","🖱","🖲","🕹","🗜","💽","💾","💿","📀","📼","📷","📸","📹","🎥","📽","🎞","📞","☎️","📟","📠","📺","📻","🎙","🎚","🎛","🧭","⏱","⏲","⏰","🕰","⌛","⏳","📡","🔋","🪫","🔌","💡","🔦","🕯","💎","🔑","🗝","🚪","🛋","🛏","🛌","🧹","🧺","🧻","🧼","🧽","🧯","🛒","🎒","🎓","🧿","🪬","🪪"],
    },
    {
        label: "Symbols",
        emojis: ["✅","❌","⚠️","🚫","⭕","✅","❌","❗","❓","💯","🔴","🟠","🟡","🟢","🔵","🟣","⚫","⚪","🟤","🔺","🔻","🔸","🔹","💢","🆗","🆘","🆙","🆒","🆕","🆓","0️⃣","1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟","💯","🔢","#️⃣","*️⃣","⏏️","▶️","⏸","⏯","⏹","⏺","⏭","⏮","⏩","⏪","⏫","⏬","◀️","🔼","🔽","➡️","⬅️","⬆️","⬇️","↗️","↘️","↙️","↖️","↕️","↔️","↪️","↩️","⤴️","⤵️","🔀","🔁","🔂","🔄","🔃","🎵","🎶","➕","➖","➗","✖️","♾","💲","💱","™️","©️","®️","〽️","🔱","🔠","🔡","🔢","🔣","🔤","🆎","🅱️","🆑","🅾️","🆘","❌","⭕","🛑","🛇","☠️"],
    },
];

export default function EmojiPicker({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) {
    const ref = useRef<HTMLDivElement>(null);
    const [query, setQuery] = useState("");

    useEffect(() => {
        const handler = (ev: MouseEvent) => {
            if (ref.current && !ref.current.contains(ev.target as Node)) onClose();
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [onClose]);

    const filtered = EMOJI_CATEGORIES.map((c) => ({
        ...c,
        emojis: c.emojis.filter((e) => e.toLowerCase().includes(query.toLowerCase())),
    })).filter((c) => c.emojis.length > 0);

    return (
        <div
            ref={ref}
            className="absolute bottom-full mb-2 right-0 w-80 max-h-80 rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col overflow-hidden z-50"
        >
            <div className="p-2 border-b border-slate-100">
                <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search emoji..."
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#92C7CF]/40"
                />
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {filtered.map((cat) => (
                    <div key={cat.label}>
                        <p className="text-[10px] font-semibold text-slate-400 px-1 mb-1">{cat.label}</p>
                        <div className="flex flex-wrap gap-0.5">
                            {cat.emojis.map((em) => (
                                <button
                                    key={em}
                                    onMouseDown={(ev) => { ev.preventDefault(); onSelect(em); }}
                                    className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-slate-100 text-lg transition-colors"
                                >
                                    {em}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
                {filtered.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">No emojis found</p>
                )}
            </div>
        </div>
    );
}