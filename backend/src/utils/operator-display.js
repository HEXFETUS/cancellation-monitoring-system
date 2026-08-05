// Single source of truth for the operator display-name SQL expression.
// Format: "HEXA-005 (IAN CHIONG)" — space before/after parentheses.
// Used by pos.routes.js and repair-record.routes.js so the display name
// is always formatted identically across the app.
export const operatorDisplay = (alias, parentAlias) => `
    COALESCE(
        NULLIF(TRIM(${alias}.operator), ''),
        CASE
            WHEN ${alias}.parent_operator_id IS NOT NULL
             AND UPPER(TRIM(COALESCE(${alias}.sub_op_name, ''))) NOT IN ('', 'EMPTY', 'NULL')
            THEN COALESCE(NULLIF(TRIM(${parentAlias}.operator), ''), ${parentAlias}.operator)
                || ' (' || TRIM(${alias}.sub_op_name) || ')'
            ELSE NULL
        END
    )
`;