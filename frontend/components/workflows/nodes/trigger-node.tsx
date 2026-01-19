"use client"

import { memo } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { Card, CardContent } from '@/components/ui/card'
import { Zap } from 'lucide-react'

export const TriggerNode = memo(({ data, selected }: NodeProps) => {
  return (
    <Card className={`min-w-[200px] ${selected ? 'ring-2 ring-primary' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="h-4 w-4 text-yellow-500" />
          <span className="font-semibold text-sm">{data.label || 'Trigger'}</span>
        </div>
        <Handle type="source" position={Position.Bottom} />
      </CardContent>
    </Card>
  )
})

TriggerNode.displayName = 'TriggerNode'











