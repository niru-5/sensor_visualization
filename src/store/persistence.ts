import { SEED_LENSES, SEED_SENSORS } from '../lib/seedData'
import type { Lens, Sensor } from '../lib/types'

const STORAGE_KEY = 'camera-selection-tool/v1'

export interface StoredData {
  schemaVersion: 1
  sensors: Sensor[]
  lenses: Lens[]
}

function isBrowserStorageAvailable(): boolean {
  try {
    const testKey = '__storage_test__'
    window.localStorage.setItem(testKey, '1')
    window.localStorage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}

export function loadData(): StoredData {
  if (!isBrowserStorageAvailable()) {
    return { schemaVersion: 1, sensors: SEED_SENSORS, lenses: SEED_LENSES }
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    const seeded: StoredData = { schemaVersion: 1, sensors: SEED_SENSORS, lenses: SEED_LENSES }
    saveData(seeded)
    return seeded
  }

  try {
    const parsed = JSON.parse(raw) as StoredData
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.sensors) || !Array.isArray(parsed.lenses)) {
      throw new Error('unrecognized schema')
    }
    return parsed
  } catch {
    // Corrupt/unreadable local data — fall back to the seed set rather than
    // crashing the app. We deliberately don't overwrite the bad data here,
    // in case the user wants to recover it manually from devtools.
    return { schemaVersion: 1, sensors: SEED_SENSORS, lenses: SEED_LENSES }
  }
}

export function saveData(data: StoredData): void {
  if (!isBrowserStorageAvailable()) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function exportDataAsJson(data: StoredData): string {
  return JSON.stringify(data, null, 2)
}

export function importDataFromJson(json: string): StoredData {
  const parsed = JSON.parse(json) as StoredData
  if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.sensors) || !Array.isArray(parsed.lenses)) {
    throw new Error('This file does not look like a camera-selection-tool export.')
  }
  return parsed
}
