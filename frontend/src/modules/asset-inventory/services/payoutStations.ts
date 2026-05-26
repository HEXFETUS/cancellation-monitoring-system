const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export interface PayoutStation {
    id: number;
    stationCode: string;
    name: string;
    description: string;
    active: boolean;
}

interface Wire {
    id: number;
    station_code: string;
    name: string;
    description: string | null;
    active: boolean;
}

export type PayoutStationInput = Omit<PayoutStation, "id">;

function apiUrl(path: string) {
    return `${API_BASE_URL}${path}`;
}

async function getErrorMessage(res: Response, fallback: string) {
    try {
        const data = await res.json();
        return data.error || data.message || fallback;
    } catch {
        return fallback;
    }
}

function fromWire(w: Wire): PayoutStation {
    return {
        id: w.id,
        stationCode: w.station_code,
        name: w.name,
        description: w.description ?? "",
        active: w.active,
    };
}

function toBody(input: PayoutStationInput) {
    return {
        stationCode: input.stationCode,
        name: input.name,
        description: input.description || null,
        active: input.active,
    };
}

export async function listPayoutStations(): Promise<PayoutStation[]> {
    const res = await fetch(apiUrl("/api/payout-stations"));
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to load stations"));
    return ((await res.json()) as Wire[]).map(fromWire);
}

export async function createPayoutStation(input: PayoutStationInput): Promise<PayoutStation> {
    const res = await fetch(apiUrl("/api/payout-stations"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toBody(input)),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to create station"));
    return fromWire(await res.json());
}

export async function updatePayoutStation(id: number, input: PayoutStationInput): Promise<PayoutStation> {
    const res = await fetch(apiUrl(`/api/payout-stations/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toBody(input)),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to update station"));
    return fromWire(await res.json());
}

export async function deletePayoutStation(id: number, userId?: number): Promise<void> {
    const url = userId
        ? `/api/payout-stations/${id}?user_id=${userId}`
        : `/api/payout-stations/${id}`;
    const res = await fetch(apiUrl(url), { method: "DELETE" });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to delete station"));
}
