// Isolated adapter around the (alpha) @mmote/niimbluelib for local NIIMBOT
// printing. Everything that knows about the library lives here so a breaking
// change in the alpha API only touches this file. The library is loaded
// lazily (dynamic import) so it stays out of the main bundle until someone
// actually prints.
//
// NOTE: niimbluelib is community-maintained, alpha, and carries a
// non-commercial-use notice. Keep the version pinned exactly.
//
// B21S detail: niimbluelib detects this printer as a "D110"-class device, and
// the D110 task is in fact the CORRECT protocol for it. The blank / duplicate /
// cut-off labels originally seen were NOT a print-task problem — they were
// caused by sending an over-wide image: a 50mm label renders to 400px, wider
// than the 384px (48mm) print head. Once the image is clamped to the head width
// (see printCanvas), the auto-detected D110 task prints correctly.
//
// NOTE: the dedicated "B21_V1" task actually prints BLANK on this unit, so do
// NOT default to it — let auto-detection pick D110.

import { useSyncExternalStore } from "react";

export type NiimbotTransport = "serial" | "ble";
export type NiimbotStatus = "disconnected" | "connecting" | "connected" | "printing" | "error";
export type PrintDirection = "left" | "top";

export interface LabelPreset {
    id: string;
    label: string;
    widthMm: number;
    heightMm: number;
}

/** Common NIIMBOT label stock sizes. */
export const LABEL_PRESETS: LabelPreset[] = [
    { id: "50x30", label: "50 x 30 mm", widthMm: 50, heightMm: 30 },
    { id: "40x30", label: "40 x 30 mm", widthMm: 40, heightMm: 30 },
    { id: "40x20", label: "40 x 20 mm", widthMm: 40, heightMm: 20 },
    { id: "30x20", label: "30 x 20 mm", widthMm: 30, heightMm: 20 },
    { id: "30x15", label: "30 x 15 mm", widthMm: 30, heightMm: 15 },
    { id: "25x25", label: "25 x 25 mm", widthMm: 25, heightMm: 25 },
];

export const DEFAULT_PRINT_TASK = "D110"; // matches this printer's detected model (see note above)
export const PRINT_TASK_OPTIONS = ["auto", "D110", "B21_V1", "B1", "D11_V1", "D110M_V4", "H1S"] as const;

export interface NiimbotSettings {
    transport: NiimbotTransport;
    labelWidthMm: number;
    labelHeightMm: number;
    density: number;
    direction: PrintDirection;
    /** "auto" lets the library detect; otherwise a niimbluelib PrintTaskName. */
    printTaskName: string;
}

// Bumped to v4 to clear the short-lived "B21_V1" default (which prints blank on
// this unit) so everyone reverts to auto-detection — which correctly picks the
// D110 task. The actual print fix is the image-width clamp in printCanvas.
const SETTINGS_KEY = "niimbot.settings.v4";

const DEFAULT_SETTINGS: NiimbotSettings = {
    transport: "serial",
    labelWidthMm: 50,
    labelHeightMm: 30,
    density: 3,
    // "top" = print without rotation, so the label width maps to the print
    // head. This is correct for landscape stock like 50x30mm. "left" rotates
    // 90deg (use only if your label feeds the other way).
    direction: "top",
    // "auto" lets niimbluelib detect the model (D110 for this printer, which is
    // correct). The real print fix was clamping the image to the print-head
    // width, not the task — see the note near DEFAULT_PRINT_TASK.
    printTaskName: "auto",
};

export interface PrintProgress {
    page: number;
    pagesTotal: number;
    pagePrintProgress: number;
    pageFeedProgress: number;
}

export interface NiimbotState {
    status: NiimbotStatus;
    error: string | null;
    /** Print task the library detected after connecting (if any). */
    detectedTask: string | null;
    progress: PrintProgress | null;
    settings: NiimbotSettings;
}

// ---- Minimal structural types for the alpha lib (kept local on purpose) ----

interface PrintTask {
    printInit(): Promise<void>;
    printPage(image: unknown, quantity: number): Promise<void>;
    waitForPageFinished(): Promise<void>;
    waitForFinished(): Promise<void>;
    printEnd(): Promise<void>;
}

interface Abstraction {
    newPrintTask(
        name: string,
        opts: {
            totalPages: number;
            density?: number;
            statusPollIntervalMs?: number;
            statusTimeoutMs?: number;
            pageTimeoutMs?: number;
        }
    ): PrintTask;
    /** Ends the print session. Returns true once the printer acknowledges. */
    printEnd(): Promise<boolean>;
    /** Reads the printer's current print status (page counter + progress). */
    getPrintStatus?(
        retries?: number
    ): Promise<{ page: number; pagePrintProgress: number; pageFeedProgress: number }>;
}

interface NiimbotClient {
    on(event: string, cb: (e: unknown) => void): void;
    connect(): Promise<void>;
    disconnect(): void | Promise<void>;
    getPrintTaskType?(): string | undefined;
    /** Model metadata incl. printhead width in pixels (e.g. B21S = 384). */
    getModelMetadata?(): { printheadPixels?: number } | undefined;
    abstraction: Abstraction;
}

interface NiimbotLib {
    NiimbotBluetoothClient: new () => NiimbotClient;
    NiimbotSerialClient: new () => NiimbotClient;
    ImageEncoder: { encodeCanvas(canvas: HTMLCanvasElement, direction: PrintDirection): unknown };
}

// ---- Feature detection ----

export function isSerialSupported(): boolean {
    return typeof navigator !== "undefined" && "serial" in navigator;
}

/**
 * Web Serial / Web Bluetooth only exist in a secure context (HTTPS or
 * localhost). On a plain-HTTP LAN origin the APIs are undefined, which is the
 * most common reason "I can't connect the printer" on a teammate's machine.
 */
export function isSecureContext(): boolean {
    return typeof window !== "undefined" && window.isSecureContext === true;
}

export function isBleSupported(): boolean {
    return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export function isAnyTransportSupported(): boolean {
    return isSerialSupported() || isBleSupported();
}

// ---- Singleton store (so one printer connection is shared app-wide) ----

let client: NiimbotClient | null = null;
let libPromise: Promise<NiimbotLib> | null = null;

let state: NiimbotState = {
    status: "disconnected",
    error: null,
    detectedTask: null,
    progress: null,
    settings: loadSettings(),
};

const listeners = new Set<() => void>();

function setState(patch: Partial<NiimbotState>) {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function getSnapshot(): NiimbotState {
    return state;
}

function loadSettings(): NiimbotSettings {
    if (typeof localStorage === "undefined") return { ...DEFAULT_SETTINGS };
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) return { ...DEFAULT_SETTINGS };
        return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<NiimbotSettings>) };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

export function updateSettings(patch: Partial<NiimbotSettings>): void {
    const next = { ...state.settings, ...patch };
    setState({ settings: next });
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
        // ignore persistence failures (private mode, etc.)
    }
}

function loadLib(): Promise<NiimbotLib> {
    if (!libPromise) {
        libPromise = import("@mmote/niimbluelib") as unknown as Promise<NiimbotLib>;
    }
    return libPromise;
}

function errorMessage(e: unknown): string {
    if (e instanceof Error) return e.message;
    if (typeof e === "string") return e;
    return "Unknown printer error";
}

export async function connect(transport?: NiimbotTransport): Promise<void> {
    const useTransport = transport ?? state.settings.transport;
    if (transport) updateSettings({ transport });

    if (useTransport === "serial" && !isSerialSupported()) {
        setState({ status: "error", error: "Web Serial isn't available in this browser. Use Chrome or Edge." });
        return;
    }
    if (useTransport === "ble" && !isBleSupported()) {
        setState({ status: "error", error: "Web Bluetooth isn't available in this browser. Use Chrome or Edge." });
        return;
    }

    setState({ status: "connecting", error: null, progress: null });

    try {
        const lib = await loadLib();
        if (client) {
            try {
                await client.disconnect();
            } catch {
                // best-effort
            }
            client = null;
        }

        const instance =
            useTransport === "ble" ? new lib.NiimbotBluetoothClient() : new lib.NiimbotSerialClient();

        instance.on("disconnect", () => {
            client = null;
            setState({ status: "disconnected", detectedTask: null, progress: null });
        });
        instance.on("printprogress", (e) => {
            setState({ progress: e as PrintProgress });
        });

        await instance.connect();
        client = instance;

        let detected: string | null = null;
        try {
            detected = instance.getPrintTaskType?.() ?? null;
        } catch {
            detected = null;
        }
        setState({ status: "connected", error: null, detectedTask: detected });
    } catch (e) {
        client = null;
        setState({ status: "error", error: errorMessage(e) });
    }
}

export async function disconnect(): Promise<void> {
    if (client) {
        try {
            await client.disconnect();
        } catch {
            // best-effort
        }
    }
    client = null;
    setState({ status: "disconnected", detectedTask: null, progress: null });
}

// B21S printhead width in pixels (48mm @203dpi). Used as a fallback when the
// connected model's metadata isn't available.
const FALLBACK_PRINTHEAD_PX = 384;

/**
 * Scale a label canvas down so the dimension that maps across the printhead
 * never exceeds the head's pixel width. With direction "top" that's the canvas
 * width; with "left" (rotated 90°) it's the height. The across-head dimension
 * ends up exactly `headPx` (a multiple of 8, as the encoder requires); the
 * other dimension scales proportionally to preserve the label's aspect ratio.
 */
function fitCanvasToPrinthead(
    canvas: HTMLCanvasElement,
    direction: PrintDirection,
    headPx: number
): HTMLCanvasElement {
    const acrossHead = direction === "left" ? canvas.height : canvas.width;
    if (!headPx || acrossHead <= headPx) return canvas;

    const scale = headPx / acrossHead;
    const newWidth = direction === "left" ? Math.max(8, Math.round(canvas.width * scale)) : headPx;
    const newHeight = direction === "left" ? headPx : Math.max(8, Math.round(canvas.height * scale));

    const out = document.createElement("canvas");
    out.width = newWidth;
    out.height = newHeight;
    const ctx = out.getContext("2d");
    if (!ctx) return canvas;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, newWidth, newHeight);
    ctx.drawImage(canvas, 0, 0, newWidth, newHeight);
    return out;
}

/**
 * Print a pre-rendered label canvas. The canvas must already be sized to the
 * label stock at the printer resolution (see renderDeviceLabelCanvas).
 */
export async function printCanvas(canvas: HTMLCanvasElement, quantity = 1): Promise<void> {
    if (!client) {
        setState({ status: "error", error: "Printer not connected." });
        throw new Error("Printer not connected");
    }

    const lib = await loadLib();
    const { direction, density, printTaskName } = state.settings;
    setState({ status: "printing", error: null, progress: null });

    // Clamp the image to the printhead width before encoding. The B21S head is
    // 384px (48mm @203dpi); a 50mm label renders to 400px. encodeCanvas("top")
    // maps the canvas WIDTH across the head, so a 400px page is wider than the
    // head can print — the firmware then emits blank, garbled, or clipped
    // labels (e.g. the right-side QR gets cut off). Scaling the canvas down to
    // the head fixes it.
    //
    // The B21S reports a usable width wider than it can actually print, so cap
    // the reported value at the true printable head (384px). Without the cap
    // the 400px canvas passes through unscaled and its rightmost ~16px — where
    // the QR sits on wide (asset-coding) labels — is clipped.
    const reportedHeadPx = client.getModelMetadata?.()?.printheadPixels ?? FALLBACK_PRINTHEAD_PX;
    const headPx = Math.min(reportedHeadPx, FALLBACK_PRINTHEAD_PX);
    const printable = fitCanvasToPrinthead(canvas, direction, headPx);
    const encoded = lib.ImageEncoder.encodeCanvas(printable, direction);

    const taskName =
        printTaskName === "auto" ? (client.getPrintTaskType?.() ?? DEFAULT_PRINT_TASK) : printTaskName;

    // --- Diagnostic instrumentation ---------------------------------------
    // Logs the printer's page counter at each lifecycle stage + every printEnd
    // result, so we can VERIFY (not assume) whether the counter accumulates
    // across jobs and whether printEnd actually resets it. Filter the console
    // by "[niimbot]" to capture. Remove once the root cause is confirmed.
    const activeClient = client;
    const logStatus = async (label: string) => {
        try {
            const s = await activeClient.abstraction.getPrintStatus?.(2);
            console.info(
                `[niimbot] ${label}: page=${s?.page} print%=${s?.pagePrintProgress} feed%=${s?.pageFeedProgress}`
            );
        } catch (err) {
            console.info(`[niimbot] ${label}: getPrintStatus failed`, err);
        }
    };

    console.info(
        `[niimbot] === job start === task=${taskName} quantity=${quantity} totalPages=${quantity}`
    );
    await logStatus("before printInit");

    // Pass density through so the print task actually applies it (printInit
    // sets density from these options); the previous separate call was
    // overridden by the task default. Conservative poll/timeout values make the
    // first print after connecting more reliable.
    const task = activeClient.abstraction.newPrintTask(taskName, {
        totalPages: quantity,
        density,
        statusPollIntervalMs: 300,
        statusTimeoutMs: 10_000,
        pageTimeoutMs: 15_000,
    });

    try {
        await task.printInit();
        await task.printPage(encoded, quantity);
        console.info(`[niimbot] printPage sent (quantity=${quantity})`);
        await task.waitForPageFinished();
        await task.waitForFinished();
        await logStatus("after waitForFinished");
        setState({ status: "connected", progress: null });
    } catch (e) {
        setState({ status: "error", error: errorMessage(e) });
        throw e;
    } finally {
        // Retry printEnd until acknowledged (only AFTER the print physically
        // finished — calling it mid-print blanks the label on this unit). Log
        // each attempt so we can see whether printEnd is refused and whether it
        // resets the page counter.
        for (let attempt = 0; attempt < 8; attempt++) {
            let ended = false;
            try {
                ended = await activeClient.abstraction.printEnd();
            } catch (err) {
                console.info(`[niimbot] printEnd attempt ${attempt} threw`, err);
            }
            console.info(`[niimbot] printEnd attempt ${attempt} -> ${ended}`);
            if (ended) break;
            await new Promise((resolve) => setTimeout(resolve, 200));
        }
        await logStatus("after printEnd");
        console.info("[niimbot] === job end ===");
    }
}

// ---- React hook ----

export interface UseNiimbot extends NiimbotState {
    serialSupported: boolean;
    bleSupported: boolean;
    secureContext: boolean;
    connect: typeof connect;
    disconnect: typeof disconnect;
    printCanvas: typeof printCanvas;
    updateSettings: typeof updateSettings;
}

export function useNiimbot(): UseNiimbot {
    const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    return {
        ...snapshot,
        serialSupported: isSerialSupported(),
        bleSupported: isBleSupported(),
        secureContext: isSecureContext(),
        connect,
        disconnect,
        printCanvas,
        updateSettings,
    };
}
