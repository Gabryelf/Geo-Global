// server/services/CacheManager.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class CacheManager {
    constructor() {
        this.cache = new Map();
        this.cacheDir = path.join(__dirname, '../data/cache');
        this.memoryCache = new Map();

        // Создаем директорию для кеша
        fs.mkdir(this.cacheDir, { recursive: true }).catch(() => { });
    }

    get(key) {
        // Сначала проверяем память
        if (this.memoryCache.has(key)) {
            const entry = this.memoryCache.get(key);
            if (this.isValid(entry)) {
                return entry.data;
            }
            this.memoryCache.delete(key);
        }

        // Затем файловый кеш
        return this.loadFromFile(key);
    }

    set(key, data) {
        // Сохраняем в памяти
        this.memoryCache.set(key, {
            data,
            timestamp: Date.now()
        });

        // Сохраняем в файл
        this.saveToFile(key, data).catch(() => { });
    }

    isValid(entry) {
        if (!entry || !entry.timestamp) return false;
        // 24 часа
        return (Date.now() - entry.timestamp) < 24 * 60 * 60 * 1000;
    }

    async saveToFile(key, data) {
        const filePath = path.join(this.cacheDir, `${key}.json`);
        await fs.writeFile(filePath, JSON.stringify({
            data,
            timestamp: Date.now()
        }, null, 2));
    }

    async loadFromFile(key) {
        try {
            const filePath = path.join(this.cacheDir, `${key}.json`);
            const content = await fs.readFile(filePath, 'utf-8');
            const entry = JSON.parse(content);

            if (this.isValid(entry)) {
                // Сохраняем в память для быстрого доступа
                this.memoryCache.set(key, entry);
                return entry.data;
            }

            // Удаляем устаревший кеш
            await fs.unlink(filePath).catch(() => { });
        } catch {
            // Файл не найден или поврежден
        }
        return null;
    }

    // Сохранение всего кеша на диск
    async flush() {
        console.log('💾 Flushing cache to disk...');
        let count = 0;
        for (const [key, data] of this.memoryCache) {
            await this.saveToFile(key, data.data);
            count++;
        }
        console.log(`✅ Flushed ${count} cache entries`);
    }

    // Получить информацию о кеше
    getInfo() {
        return {
            memorySize: this.memoryCache.size,
            diskPath: this.cacheDir,
            keys: Array.from(this.memoryCache.keys())
        };
    }

    getSize() {
        return this.memoryCache.size;
    }

    clear() {
        this.memoryCache.clear();
        fs.rm(this.cacheDir, { recursive: true, force: true }).catch(() => { });
    }
}