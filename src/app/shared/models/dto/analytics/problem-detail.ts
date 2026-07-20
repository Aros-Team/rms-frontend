export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: { parameter?: string; value?: string; expected?: string }[];
}