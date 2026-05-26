const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export interface OfficeDepartment {
    id: number;
    deptCode: string;
    name: string;
    description: string;
    active: boolean;
}

interface Wire {
    id: number;
    dept_code: string;
    name: string;
    description: string | null;
    active: boolean;
}

export type OfficeDepartmentInput = Omit<OfficeDepartment, "id">;

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

function fromWire(w: Wire): OfficeDepartment {
    return {
        id: w.id,
        deptCode: w.dept_code,
        name: w.name,
        description: w.description ?? "",
        active: w.active,
    };
}

function toBody(input: OfficeDepartmentInput) {
    return {
        deptCode: input.deptCode,
        name: input.name,
        description: input.description || null,
        active: input.active,
    };
}

export async function listOfficeDepartments(): Promise<OfficeDepartment[]> {
    const res = await fetch(apiUrl("/api/office-departments"));
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to load departments"));
    return ((await res.json()) as Wire[]).map(fromWire);
}

export async function createOfficeDepartment(input: OfficeDepartmentInput): Promise<OfficeDepartment> {
    const res = await fetch(apiUrl("/api/office-departments"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toBody(input)),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to create department"));
    return fromWire(await res.json());
}

export async function updateOfficeDepartment(
    id: number,
    input: OfficeDepartmentInput
): Promise<OfficeDepartment> {
    const res = await fetch(apiUrl(`/api/office-departments/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toBody(input)),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to update department"));
    return fromWire(await res.json());
}

export async function deleteOfficeDepartment(id: number, userId?: number): Promise<void> {
    const url = userId
        ? `/api/office-departments/${id}?user_id=${userId}`
        : `/api/office-departments/${id}`;
    const res = await fetch(apiUrl(url), { method: "DELETE" });
    if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to delete department"));
}
