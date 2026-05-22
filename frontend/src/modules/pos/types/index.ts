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

export interface BoothInfo {
    id: number;
    booth_code: string;
    coordinate: string | null;
    location?: string | null;
    booth_location: string | null;
    operator_id?: number | null;
    operator: string | null;
    created_at: string;
    updated_at: string;
}

export interface OperatorInfo {
    id: number;
    operator: string;
    created_at: string;
    updated_at: string;
}

export interface BoothChangeLog {
    id: number;
    pos_record_id: string | null;
    old_booth_code: string;
    new_booth_code: string;
    changed_by: string | null;
    date_changed: string;
}

export interface PosConvertHistory {
    id: number;
    pos_record_id: number;
    device_no: string;
    previous_area: string;
    new_area: string;
    changed_by: string | null;
    date_changed: string;
}

export interface StatusLog {
    id: number;
    pos_record_id: number;
    device_no: string;
    old_status: string;
    new_status: string;
    changed_by: string | null;
    date_changed: string;
}
