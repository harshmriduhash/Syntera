"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2 } from 'lucide-react'

interface KeyValueEditorProps {
  value: Record<string, unknown>
  onChange: (value: Record<string, unknown>) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
  label?: string
  className?: string
}

export function KeyValueEditor({
  value,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  label,
  className,
}: KeyValueEditorProps) {
  const [pairs, setPairs] = useState<Array<{ key: string; value: string }>>(() => {
    return Object.entries(value || {}).map(([k, v]) => ({
      key: k,
      value: String(v || ''),
    }))
  })

  const updatePairs = (newPairs: Array<{ key: string; value: string }>) => {
    setPairs(newPairs)
    const newValue: Record<string, unknown> = {}
    newPairs.forEach((pair) => {
      if (pair.key.trim()) {
        // Try to parse as JSON if it looks like JSON
        try {
          const parsed = JSON.parse(pair.value)
          newValue[pair.key.trim()] = parsed
        } catch {
          // Not JSON, use as string
          newValue[pair.key.trim()] = pair.value
        }
      }
    })
    onChange(newValue)
  }

  const addPair = () => {
    updatePairs([...pairs, { key: '', value: '' }])
  }

  const removePair = (index: number) => {
    updatePairs(pairs.filter((_, i) => i !== index))
  }

  const updatePair = (index: number, field: 'key' | 'value', newValue: string) => {
    const newPairs = [...pairs]
    newPairs[index] = { ...newPairs[index], [field]: newValue }
    updatePairs(newPairs)
  }

  return (
    <div className={className}>
      {label && <Label className="mb-2 block">{label}</Label>}
      <div className="space-y-2">
        {pairs.map((pair, index) => (
          <div key={index} className="flex gap-2 items-start">
            <Input
              value={pair.key}
              onChange={(e) => updatePair(index, 'key', e.target.value)}
              placeholder={keyPlaceholder}
              className="flex-1"
            />
            <Input
              value={pair.value}
              onChange={(e) => updatePair(index, 'value', e.target.value)}
              placeholder={valuePlaceholder}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removePair(index)}
              className="h-9 w-9 flex-shrink-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addPair}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Field
        </Button>
      </div>
      {pairs.length === 0 && (
        <p className="text-xs text-muted-foreground mt-2">
          No fields added. Click "Add Field" to add key-value pairs.
        </p>
      )}
    </div>
  )
}










