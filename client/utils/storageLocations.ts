import { StorageLocation, StorageLocationId } from '../types';

export const DEFAULT_STORAGE_LOCATIONS: StorageLocation[] = [
  { id: 'mainWarehouse', name: 'Main Warehouse', capacityUnits: 0 },
  { id: 'backRoom', name: 'Back Room', capacityUnits: 0 },
  { id: 'showRoom', name: 'Show Room', capacityUnits: 0 }
];

const LOCATION_ORDER: StorageLocationId[] = ['mainWarehouse', 'backRoom', 'showRoom'];

const normalizeCapacityUnits = (value: unknown, fallback: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.round(value));
};

export const normalizeStorageLocations = (input: unknown): StorageLocation[] => {
  const defaults = new Map(DEFAULT_STORAGE_LOCATIONS.map((loc) => [loc.id, loc]));
  const incoming = Array.isArray(input) ? input : [];
  const merged = new Map<StorageLocationId, StorageLocation>();

  incoming.forEach((loc: any) => {
    if (!loc || typeof loc !== 'object') return;
    const id = loc.id as StorageLocationId;
    if (!defaults.has(id)) return;
    const fallback = defaults.get(id)!;
    const name = typeof loc.name === 'string' && loc.name.trim() ? loc.name.trim() : fallback.name;
    const rawUnits = typeof loc.capacityUnits === 'number' ? loc.capacityUnits : loc.capacity;
    const capacityUnits = normalizeCapacityUnits(rawUnits, 0);
    merged.set(id, { id, name, capacityUnits });
  });

  LOCATION_ORDER.forEach((id) => {
    if (!merged.has(id)) {
      merged.set(id, defaults.get(id)!);
    }
  });

  return LOCATION_ORDER.map((id) => merged.get(id)!);
};

export const fetchStorageLocations = async (): Promise<StorageLocation[]> => {
  try {
    const res = await fetch('/api/settings/storage-locations', { credentials: 'include' });
    if (!res.ok) {
      return DEFAULT_STORAGE_LOCATIONS;
    }
    const data = await res.json();
    return normalizeStorageLocations(data?.locations);
  } catch (err) {
    return DEFAULT_STORAGE_LOCATIONS;
  }
};

export const getLocationName = (locations: StorageLocation[], id: StorageLocationId) => {
  const found = locations.find((loc) => loc.id === id);
  return found ? found.name : id;
};
