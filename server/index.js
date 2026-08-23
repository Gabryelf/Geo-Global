// server/index.js
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { CityService } from './services/CityService.js';
import { CacheManager } from './services/CacheManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Настройка CORS
app.use(cors());
app.use(express.json());

// ============================================================
// 1. ПОДКЛЮЧАЕМ VITE (ПРАВИЛЬНАЯ КОНФИГУРАЦИЯ)
// ============================================================

let vite = null;
let isDev = false;

try {
    const { createServer } = await import('vite');
    
    // Создаем Vite сервер в middleware режиме
    vite = await createServer({
        server: {
            middlewareMode: true,
            hmr: {
                // Важно: указываем порт для HMR
                port: 24678, // Отдельный порт для WebSocket
                host: 'localhost'
            },
            // Отключаем автоматический open
            open: false,
        },
        appType: 'spa',
        root: path.join(__dirname, '../client'),
        // Отключаем HMR в middleware режиме
        // или настраиваем его правильно
    });
    
    // Используем Vite middleware
    app.use(vite.middlewares);
    isDev = true;
    console.log('✅ Vite подключен (режим разработки)');
    console.log('   🔄 HMR работает на порту 24678');
} catch (error) {
    console.warn('⚠️ Не удалось подключить Vite:', error.message);
    isDev = false;
}

// ============================================================
// 2. ИНИЦИАЛИЗАЦИЯ СЕРВИСОВ
// ============================================================

const cacheManager = new CacheManager();
const cityService = new CityService(cacheManager);

let serverReady = false;

async function initializeServer() {
    try {
        console.log('🔄 Инициализация сервера...');
        await cityService.initialize();
        serverReady = true;
        console.log('✅ Сервер готов к работе');
        console.log(`📊 Данные загружены: ${await cityService.getTotalCount()} городов`);
    } catch (error) {
        console.error('❌ Ошибка инициализации сервера:', error);
        serverReady = true;
    }
}

// ============================================================
// 3. API ЭНДПОИНТЫ
// ============================================================

app.get('/api/status', async (req, res) => {
    try {
        const total = await cityService.getTotalCount();
        res.json({
            status: serverReady ? 'ready' : 'initializing',
            serverTime: new Date().toISOString(),
            lastUpdate: cityService.lastUpdate,
            totalCities: total,
            cacheSize: cacheManager.getSize(),
            isRefreshing: cityService.isRefreshing || false,
            mode: isDev ? 'development' : 'production'
        });
    } catch (error) {
        res.json({
            status: 'error',
            error: error.message,
            serverTime: new Date().toISOString()
        });
    }
});

app.get('/api/cities', async (req, res) => {
    try {
        const {
            limit = 1000,
            minPopulation = 0,
            maxPopulation,
            country,
            continent,
            search,
            bounds,
            isCapital = false,
            onlyMajor = false,
        } = req.query;

        let parsedBounds = null;
        if (bounds) {
            try {
                parsedBounds = JSON.parse(bounds);
            } catch {
                const parts = bounds.split(',').map(Number);
                if (parts.length === 4) {
                    parsedBounds = {
                        north: parts[0],
                        south: parts[1],
                        east: parts[2],
                        west: parts[3]
                    };
                }
            }
        }

        const cities = await cityService.getCities({
            limit: parseInt(limit),
            minPopulation: parseInt(minPopulation),
            maxPopulation: maxPopulation ? parseInt(maxPopulation) : undefined,
            country: country ? String(country) : undefined,
            continent: continent ? String(continent) : undefined,
            search: search ? String(search) : undefined,
            bounds: parsedBounds,
            isCapital: isCapital === 'true',
            onlyMajor: onlyMajor === 'true',
        });

        res.json({
            success: true,
            data: cities,
            total: cities.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching cities:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

app.get('/api/cities/:id', async (req, res) => {
    try {
        const city = await cityService.getCityById(req.params.id);
        if (!city) {
            return res.status(404).json({
                success: false,
                error: 'City not found'
            });
        }
        res.json({
            success: true,
            data: city,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/cities/search', async (req, res) => {
    try {
        const { q, limit = 20 } = req.query;
        if (!q) {
            return res.status(400).json({
                success: false,
                error: 'Search query "q" is required'
            });
        }
        const results = await cityService.searchCities(q, parseInt(limit));
        res.json({
            success: true,
            data: results,
            total: results.length,
            query: q,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/countries', async (req, res) => {
    try {
        const countries = await cityService.getCountries();
        res.json({
            success: true,
            data: countries,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/continents', async (req, res) => {
    try {
        const continents = await cityService.getContinents();
        res.json({
            success: true,
            data: continents,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.post('/api/refresh', async (req, res) => {
    try {
        if (cityService.isRefreshing) {
            return res.status(409).json({
                success: false,
                error: 'Refresh already in progress'
            });
        }
        cityService.forceRefresh().catch(err => {
            console.error('Background refresh error:', err);
        });
        res.json({
            success: true,
            message: 'Refresh started in background',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        const stats = await cityService.getStats();
        res.json({
            success: true,
            data: stats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================
// 4. ОТДАЧА СТАТИЧЕСКИХ ФАЙЛОВ (если Vite не используется)
// ============================================================

if (!isDev) {
    const distPath = path.join(__dirname, '../dist');
    const clientPath = path.join(__dirname, '../client');
    
    const staticPath = fs.existsSync(distPath) ? distPath : clientPath;
    app.use(express.static(staticPath));
    
    app.get('*', (req, res) => {
        const indexFile = path.join(staticPath, 'index.html');
        if (fs.existsSync(indexFile)) {
            res.sendFile(indexFile);
        } else {
            res.status(404).send('index.html not found');
        }
    });
}

// ============================================================
// 5. ЗАПУСК СЕРВЕРА
// ============================================================

await initializeServer();

app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log(`🌍 Geo-Global Server`);
    console.log('='.repeat(60));
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`📄 Клиент: http://localhost:${PORT}`);
    console.log(`📊 API: http://localhost:${PORT}/api/status`);
    console.log('='.repeat(60));
    console.log(`📦 Режим: ${isDev ? 'DEVELOPMENT' : 'PRODUCTION'}`);
    if (isDev) {
        console.log(`🔄 Горячая перезагрузка: активна (порт 24678)`);
    }
    console.log('='.repeat(60));
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
});

process.on('SIGINT', async () => {
    console.log('\n👋 Завершение...');
    if (vite) {
        await vite.close();
    }
    process.exit(0);
});

export { app, cityService, cacheManager };