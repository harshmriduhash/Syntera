"use client"

import { memo } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { Card, CardContent } from '@/components/ui/card'
import { Briefcase, User, Tag } from 'lucide-react'

const ACTION_ICONS: Record<string, any> = {
  create_deal: Briefcase,
  update_contact: User,
  add_tag: Tag,
}

export const ActionNode = memo(({ data, selected }: NodeProps) => {
  const nodeType = (data as any).nodeType || 'action'
  const Icon = ACTION_ICONS[nodeType] || Briefcase

  return (
    <Card className={`min-w-[200px] ${selected ? 'ring-2 ring-primary' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4 text-green-500" />
          <span className="font-semibold text-sm">{data.label || 'Action'}</span>
        </div>
        <Handle type="target" position={Position.Top} />
        <Handle type="source" position={Position.Bottom} />
      </CardContent>
    </Card>
  )
})

ActionNode.displayName = 'ActionNode'











