export interface AreaRequest {
  name: string;
  type: 'KITCHEN' | 'BARTENDER';
}

export interface AreaResponse {
  id: number;
  name: string;
  type: 'KITCHEN' | 'BARTENDER';
  enabled: boolean;
}
