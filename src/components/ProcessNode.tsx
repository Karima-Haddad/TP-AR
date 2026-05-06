import type { Process } from "../types/Process"

interface Props {
  processItem: Process
  isLeader: boolean
}

export default function ProcessNode({ processItem, isLeader }: Props) {
  return (
    <div style={{
      padding: "10px",
      margin: "5px",
      border: "2px solid",
      borderColor: isLeader ? "purple" : "gray",
      borderRadius: "8px"
    }}>
      <strong>P{processItem.id}</strong>
      <div>{processItem.active ? "Actif" : "Panne"}</div>
      {isLeader && <div>👑 Leader</div>}
    </div>
  )
}
