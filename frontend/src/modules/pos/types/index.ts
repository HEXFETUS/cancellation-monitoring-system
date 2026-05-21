export interface PosRecord {
    id: number;
    device_no: string;
    serial_no: string;
    area: string | null;
    operator: string | null;
    coordinate: string | null;
    booth_code: string | null;
    booth_location: string | null;
    status: string | null;
    sticker: boolean;
    created_at: string;
    updated_at: string;
}