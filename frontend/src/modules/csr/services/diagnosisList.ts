const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export interface DiagnosisItem {
    id: number;
    diagnosisCode: string;
    name: string;
    description: string;
    active: boolean;
}

interface Wire {
    id: number;
    name?: string;
    diagnosis_name?: string;
}

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

function fromWire(w: Wire): DiagnosisItem {
    const name = w.name ?? w.diagnosis_name ?? "";

    return {
        id: w.id,
        diagnosisCode: "",
        name,
        description: "",
        active: true,
    };
}

export async function listDiagnoses(): Promise<DiagnosisItem[]> {
    const res = await fetch(apiUrl("/api/diagnosis-list"));
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to load diagnoses"));
    const payload = await res.json();
    const rows = Array.isArray(payload) ? payload : payload.data ?? payload.rows ?? [];

    return (rows as Wire[]).map(fromWire).filter((d) => d.name.trim().length > 0);
}
