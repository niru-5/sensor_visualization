import { useCallback, useEffect, useState } from 'react'
import type { Lens, Sensor } from '../lib/types'
import { exportDataAsJson, importDataFromJson, loadData, saveData, type StoredData } from './persistence'

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function useAppData() {
  const [data, setData] = useState<StoredData>(() => loadData())

  useEffect(() => {
    saveData(data)
  }, [data])

  const addSensor = useCallback((sensor: Omit<Sensor, 'id'>) => {
    const withId: Sensor = { ...sensor, id: makeId('sensor') }
    setData((prev) => ({ ...prev, sensors: [...prev.sensors, withId] }))
    return withId
  }, [])

  const updateSensor = useCallback((id: string, patch: Partial<Sensor>) => {
    setData((prev) => ({
      ...prev,
      sensors: prev.sensors.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }))
  }, [])

  const removeSensor = useCallback((id: string) => {
    setData((prev) => ({ ...prev, sensors: prev.sensors.filter((s) => s.id !== id) }))
  }, [])

  const addLens = useCallback((lens: Omit<Lens, 'id'>) => {
    const withId: Lens = { ...lens, id: makeId('lens') }
    setData((prev) => ({ ...prev, lenses: [...prev.lenses, withId] }))
    return withId
  }, [])

  const updateLens = useCallback((id: string, patch: Partial<Lens>) => {
    setData((prev) => ({
      ...prev,
      lenses: prev.lenses.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }))
  }, [])

  const removeLens = useCallback((id: string) => {
    setData((prev) => ({ ...prev, lenses: prev.lenses.filter((l) => l.id !== id) }))
  }, [])

  const exportJson = useCallback(() => exportDataAsJson(data), [data])

  const importJson = useCallback((json: string) => {
    const imported = importDataFromJson(json)
    setData(imported)
  }, [])

  return {
    sensors: data.sensors,
    lenses: data.lenses,
    addSensor,
    updateSensor,
    removeSensor,
    addLens,
    updateLens,
    removeLens,
    exportJson,
    importJson,
  }
}
