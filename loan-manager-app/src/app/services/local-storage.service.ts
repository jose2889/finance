import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LocalStorageService {
  constructor() { }

  setItem(key: string, value: any): void {
    console.log(`[LocalStorageService] setItem called with key: ${key}`);
    try {
      const stringValue = JSON.stringify(value);
      console.log(`[LocalStorageService] Stringified value for key ${key} (first 100 chars): ${stringValue.substring(0, 100)}`);
      localStorage.setItem(key, stringValue);
      console.log(`[LocalStorageService] Item set for key: ${key}`);
    } catch (e) {
      console.error(`[LocalStorageService] Error saving to localStorage for key ${key}:`, e);
    }
  }

  getItem<T>(key: string): T | null {
    console.log(`[LocalStorageService] getItem called with key: ${key}`);
    try {
      const item = localStorage.getItem(key);
      console.log(`[LocalStorageService] Raw item from localStorage for key ${key} (first 100 chars): ${item ? item.substring(0, 100) : null}`);
      if (item) {
        const parsedItem = JSON.parse(item);
        console.log(`[LocalStorageService] Parsed item for key ${key}:`, parsedItem);
        return parsedItem as T;
      }
      console.log(`[LocalStorageService] No item found for key: ${key}`);
      return null;
    } catch (e) {
      console.error(`[LocalStorageService] Error getting data from localStorage for key ${key}:`, e);
      return null;
    }
  }

  removeItem(key: string): void {
    console.log(`[LocalStorageService] removeItem called with key: ${key}`);
    try {
      localStorage.removeItem(key);
      console.log(`[LocalStorageService] Item removed for key: ${key}`);
    } catch (e) {
      console.error(`[LocalStorageService] Error removing data from localStorage for key ${key}:`, e);
    }
  }

  clear(): void {
    try {
      localStorage.clear();
    } catch (e) {
      console.error('Error clearing localStorage', e);
    }
  }
}
