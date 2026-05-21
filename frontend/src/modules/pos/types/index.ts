export interface PosRecord {
    id: number;
    device_no: string;
    serial_no: string;
    serial_number?: string;
    area: string | null;
    booth_id?: number | null;
    operator_id?: number | null;
    operator: string | null;
    coordinate: string | null;
    booth_code: string | null;
    booth_location: string | null;
    status: string | null;
    sticker: boolean;
    created_at: string;
    updated_at: string;
}
