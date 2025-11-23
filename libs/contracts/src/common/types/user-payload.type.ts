import { Role } from "@identity/roles/roles.model";

export class UserPayload {
  readonly id: number;
  readonly email: string;
  readonly roles: Role[];
}