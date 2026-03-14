import { useState, useEffect, useRef } from 'react'
import { InfrastructureCanvas } from '@/components/Canvas'
import { Toolbar, NodeEditor } from '@/components/Sidebar'
import { AddNodeModal } from '@/components/Modals'
import { useInfraStore } from '@/stores/useInfraStore'
import { useMonitoringWebSocket } from '@/hooks/useMonitoringWebSocket'

export function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const hasFetched = useRef(false)
  
  const { fetchAll, selectedNodeId, setSelectedNode } = useInfraStore()

  // Connect to WebSocket for real-time updates
  useMonitoringWebSocket()

  // Fetch nodes and edges on mount - only once
  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true
    
    fetchAll().catch((error) => {
      console.error('Failed to fetch infrastructure data:', error)
    })
  }, [fetchAll])

  const handleAddNode = () => {
    setIsModalOpen(true)
  }

  const handleCloseEditor = () => {
    setSelectedNode(null)
  }

  return (
    <div className="relative h-full">
      {/* Toolbar - floating top-left */}
      <Toolbar onAddNode={handleAddNode} />

      {/* Canvas - fills available space */}
      <InfrastructureCanvas />

      {/* Node Editor - right sidebar (conditionally rendered) */}
      {selectedNodeId && (
        <NodeEditor nodeId={selectedNodeId} onClose={handleCloseEditor} />
      )}

      {/* Add Node Modal */}
      <AddNodeModal open={isModalOpen} onOpenChange={setIsModalOpen} />
    </div>
  )
}
