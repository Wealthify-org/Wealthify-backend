import { Role } from "src/roles/roles.model"

export class UserPayload {
  readonly id: number
  readonly email: string
  readonly roles: Role[]
}