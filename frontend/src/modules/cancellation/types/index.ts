export type CancellationRecord = {
    id: number;
    date: string;
    area: string;
    approved: number;
    denied: number;
    cancelled_by_id: number | null;
    created_at: string;
    updated_at: string;
};

export type CancellationHumanForce = {
    id: number;
    date: string;
    area: string;
    reaseon_for_deny: string;
    created_at: string;
    booth_id: number | null;
    booth_code?: string | null;
    ticket_number: string;
};

export type CancellationHumanErrorBooth = {
    id: number;
    area: string;
    booth_code: string;
    human_error: number;
};

export type CancellationSyncResult = {
    date: string;
    sync_all?: boolean;
    synced_dates?: string[];
    fetched?: number;
    scanned: number;
    records: CancellationRecord[];
    human_force: CancellationHumanForce[];
};
