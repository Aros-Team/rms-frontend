/** One inclusive row run in the restaurant floor grid. */
export interface FloorLayoutSegment {
  /** Zero-based row, top to bottom. */
  readonly row: number;
  /** Inclusive first column. */
  readonly from: number;
  /** Inclusive last column. */
  readonly to: number;
}

/** One independent region linked to an existing area. */
export interface FloorLayoutRegion {
  /** Stable client-generated key (UUID). */
  readonly key: string;
  readonly areaId: number;
  readonly segments: readonly FloorLayoutSegment[];
}

/** Complete floor layout as returned by the API. */
export interface FloorLayout {
  readonly columns: number;
  readonly rows: number;
  readonly regions: readonly FloorLayoutRegion[];
  readonly updatedAt?: string | null;
}

/** Complete floor layout sent to the API on save. */
export interface FloorLayoutRequest {
  readonly columns: number;
  readonly rows: number;
  readonly regions: readonly FloorLayoutRegion[];
}


/** One table placed on a floor-grid cell. */
export interface FloorTablePlacement {
  readonly tableId: number;
  readonly row: number;
  readonly column: number;
}
