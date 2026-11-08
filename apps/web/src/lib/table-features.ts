import { tableFeatures } from "@tanstack/react-table";

// Every table in this app renders server-managed data with the core row
// model only: sorting, filtering, and pagination all happen on the server,
// so no table features are registered (the core row model is always
// included in TanStack Table v9). Sharing one features object keeps the
// TFeatures type consistent across all column helpers and table components.
export const coreTableFeatures = tableFeatures({});

export type CoreTableFeatures = typeof coreTableFeatures;
