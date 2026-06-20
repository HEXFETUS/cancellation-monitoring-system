// Isolated adapter around the (alpha) @mmote/niimbluelib for local NIIMBOT
// printing. Everything that knows about the library lives here so a breaking
// change in the alpha API only touches this file. The library is loaded
// lazily (dynamic import) so it stays out of the main bundle until someone
// actually prints.
//
// NOTE: niimbluelib is community-maintained, alpha, and carries a
// non-commercial-use notice. Keep the version pinned exactly.
//
// B21S detail: the printer reports as a "D110"-class device in niimbluelib's
// model->print-task map, so when auto-detection is unavailable we fall back to
// the "D110" print task.

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

export const DEFAULT_PRINT_TASK = "D110"; // B21S
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

const SETTINGS_KEY = "niimbot.settings.v2";

const DEFAULT_SETTINGS: NiimbotSettings = {
    transport: "serial",
    labelWidthMm: 50,
    labelHeightMm: 30,
    density: 3,
    // "top" = print without rotation, so the label width maps to the print
    // head. This is correct for landscape stock like 50x30mm. "left" rotates
    // 90deg (use only if your label feeds the other way).
    direction: "top",
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
        opts: { totalPages: number; statusPollIntervalMs?: number; statusTimeoutMs?: number }
    ): PrintTask;
    setLabelDensity?(density: number): Promise<void>;
}

interface NiimbotClient {
    on(event: string, cb: (e: unknown) => void): void;
    connect(): Promise<void>;
    disconnect(): void | Promise<void>;
    getPrintTaskType?(): string | undefined;
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

    const encoded = lib.ImageEncoder.encodeCanvas(canvas, direction);
    const taskName =
        printTaskName === "auto" ? (client.getPrintTaskType?.() ?? DEFAULT_PRINT_TASK) : printTaskName;

    const task = client.abstraction.newPrintTask(taskName, {
        totalPages: quantity,
        statusPollIntervalMs: 100,
        statusTimeoutMs: 8_000,
    });

    try {
        // Best-effort density; not all firmware/tasks expose it.
        if (typeof client.abstraction.setLabelDensity === "function") {
            try {
                await client.abstraction.setLabelDensity(density);
            } catch {
                // ignore – density is a nice-to-have
            }
        }

        await task.printInit();
        await task.printPage(encoded, quantity);
        await task.waitForPageFinished();
        await task.waitForFinished();
        setState({ status: "connected", progress: null });
    } catch (e) {
        setState({ status: "error", error: errorMessage(e) });
        throw e;
    } finally {
        try {
            await task.printEnd();
        } catch {
            // best-effort
        }
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
