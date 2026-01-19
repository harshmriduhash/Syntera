"use client"

import { useState, useEffect } from 'react'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from 'lucide-react'
import { format, subDays } from 'date-fns'
import type { DateRange } from '@/lib/api/analytics'

interface DateRangePickerProps {
  value?: DateRange
  onChange: (range: DateRange) => void
}

const PRESETS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
] as const

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [preset, setPreset] = useState<string>('30')

  const handlePresetChange = (presetValue: string) => {
    setPreset(presetValue)
    const days = parseInt(presetValue)
    if (!isNaN(days)) {
      const endDate = new Date()
      const startDate = subDays(endDate, days)
      onChange({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      })
    } else if (presetValue === 'custom') {
      // Custom range - user will select dates manually
      const endDate = new Date()
      const startDate = subDays(endDate, 30)
      onChange({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      })
    }
  }

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (value) {
      onChange({
        ...value,
        startDate: e.target.value,
      })
      setPreset('custom')
    }
  }

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (value) {
      onChange({
        ...value,
        endDate: e.target.value,
      })
      setPreset('custom')
    }
  }

  // Initialize with default range if no value (use useEffect to avoid calling onChange during render)
  useEffect(() => {
    if (!value) {
      const endDate = new Date()
      const startDate = subDays(endDate, 30)
      onChange({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      })
      setPreset('30')
    }
  }, []) // Only run once on mount

  return (
    <div className="flex items-center gap-4">
      <Select value={preset} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select period" />
        </SelectTrigger>
        <SelectContent>
          {PRESETS.map((p) => (
            <SelectItem key={p.days} value={String(p.days)}>
              {p.label}
            </SelectItem>
          ))}
          <SelectItem value="custom">Custom Range</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <input
          type="date"
          value={value?.startDate || ''}
          onChange={handleStartDateChange}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <span className="text-muted-foreground">to</span>
        <input
          type="date"
          value={value?.endDate || ''}
          onChange={handleEndDateChange}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
    </div>
  )
}

