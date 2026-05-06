export interface Process {
  id: number
  active: boolean
}
export interface ElectionResult {
  leader: number | null
  logs: string[]
}