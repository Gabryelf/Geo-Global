// client/src/main.js
import * as THREE from 'three';
import { AppController } from './core/core/AppController';
import { UIManager } from './core/core/UIManager';
import { createLogger } from './utils/logger';
import { GeographyContext } from './contexts/geography/GeographyContext';
import { HistoryContext } from './contexts/history/HistoryContext';
import { Globe } from './core/implementations/Globe';
import { LayerManager } from './core/implementations/LayerManager';
import { SceneConfig, ScenePresets } from './configs/scene_config';
import { ApiConfig, apiRequest } from './configs/api.config';

const logger = createLogger('Main');

// ============================================================
// 1. СОСТОЯНИЕ ПРИЛОЖЕНИЯ
// ============================================================

let app = null;
let uiManager = null;
let isServerAvailable = false;
let serverStatus = null;

// ============================================================
// 2. ПРОВЕРКА СЕРВЕРА
// ============================================================

async function checkServerAvailability() {
    try {
        logger.info('Checking server availability...');
        const response = await fetch(ApiConfig.endpoints.status, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
            serverStatus = await response.json();
            isServerAvailable = true;
            logger.info('✅ Server is available:', serverStatus);
            return true;
        }
        return false;
    } catch (error) {
        isServerAvailable = false;
        logger.warn('⚠️ Server not available, using offline mode:', error.message);
        return false;
    }
}

// ============================================================
// 3. UI УВЕДОМЛЕНИЯ
// ============================================================

function showNotification(message, type = 'info', duration = 5000) {
    const panel = document.getElementById('info-panel');
    if (!panel) return;
    
    const title = panel.querySelector('.title');
    const subtitle = panel.querySelector('.subtitle');
    
    if (title) {
        const icons = {
            info: 'ℹ️',
            warning: '⚠️',
            error: '❌',
            success: '✅'
        };
        title.textContent = `${icons[type] || 'ℹ️'} ${message}`;
    }
    
    if (subtitle) {
        const messages = {
            info: 'Информационное сообщение',
            warning: 'Некоторые функции могут быть ограничены',
            error: 'Пожалуйста, проверьте подключение к интернету',
            success: 'Операция выполнена успешно'
        };
        subtitle.textContent = messages[type] || '';
    }
    
    panel.classList.add('visible');
    clearTimeout(panel._timeout);
    panel._timeout = setTimeout(() => {
        panel.classList.remove('visible');
    }, duration);
}

function updateStatusIndicator(available) {
    const dot = document.querySelector('.status-dot');
    const text = document.querySelector('.status-indicator span:last-child');
    
    if (dot) {
        dot.style.background = available ? '#4ade80' : '#ff4444';
        dot.style.animation = available ? 'pulse 2s infinite' : 'none';
    }
    
    if (text) {
        text.textContent = available ? 'Сервер доступен' : 'Офлайн режим';
        text.style.color = available ? 'rgba(255,255,255,0.6)' : 'rgba(255,68,68,0.6)';
    }
}

function showError(message) {
    const errorMsg = document.getElementById('error-message');
    if (errorMsg) {
        errorMsg.textContent = `❌ ${message}`;
        errorMsg.style.display = 'block';
        setTimeout(() => {
            errorMsg.style.display = 'none';
        }, 8000);
    }
}

function hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.classList.add('hidden');
        setTimeout(() => {
            loading.style.display = 'none';
        }, 800);
    }
}

// ============================================================
// 4. ИНИЦИАЛИЗАЦИЯ UI МЕНЕДЖЕРА
// ============================================================

function initializeUIManager() {
    logger.info('Initializing UI Manager...');
    
    uiManager = new UIManager();
    uiManager.initialize();

    // Регистрируем панель Географии
    uiManager.registerPanel('geography', {
        render: () => `
            <div class="panel-title">🌍 Географический атлас</div>
            <div class="panel-description">Исследуйте города мира, вращайте глобус и узнавайте новое</div>
        `,
        lenses: [
            { id: 'population', name: 'По населению', icon: '👥', description: 'Сортировка по населению', active: true },
            { id: 'area', name: 'По площади', icon: '📐', description: 'Сортировка по площади территории', active: false },
            { id: 'density', name: 'По плотности', icon: '📊', description: 'Сортировка по плотности населения', active: false },
            { id: 'capitals', name: 'Столицы', icon: '👑', description: 'Показать только столицы государств', active: false },
            { id: 'megacities', name: 'Мегаполисы', icon: '🏙️', description: 'Города с населением > 10 млн', active: false },
            { id: 'major', name: 'Крупные города', icon: '🌆', description: 'Города с населением > 1 млн', active: false }
        ]
    });

    // Регистрируем панель Истории
    uiManager.registerPanel('history', {
        render: () => `
            <div class="panel-title">📜 Исторический атлас</div>
            <div class="panel-description">Путешествуйте во времени и исследуйте исторические события</div>
        `,
        lenses: [
            { id: 'civilizations', name: 'Цивилизации', icon: '🏛️', description: 'Центры древних цивилизаций', active: true },
            { id: 'battles', name: 'Сражения', icon: '⚔️', description: 'Места исторических битв', active: false },
            { id: 'empires', name: 'Империи', icon: '👑', description: 'Территории великих империй', active: false },
            { id: 'trade', name: 'Торговые пути', icon: '🐫', description: 'Великие торговые пути', active: false },
            { id: 'culture', name: 'Культура', icon: '🎭', description: 'Центры искусства и науки', active: false }
        ],
        epochs: [
            { id: 'ancient', name: 'Древний мир', icon: '🏛️', years: '3000 до н.э. - 476 н.э.', active: true },
            { id: 'middle', name: 'Средневековье', icon: '⚔️', years: '476 - 1492', active: false },
            { id: 'new', name: 'Новое время', icon: '⛵', years: '1492 - 1789', active: false },
            { id: 'modern', name: 'Новейшее время', icon: '🏭', years: '1789 - 1945', active: false },
            { id: 'contemporary', name: 'Современность', icon: '💻', years: '1945 - наши дни', active: false }
        ]
    });

    // --- ОБРАБОТЧИКИ ЛИНЗ ---

    // Линзы географии
    uiManager.onLensToggle('capitals', (active) => {
        const context = app?.getActiveContext();
        if (context && context.toggleLens) {
            context.toggleLens('capitals');
            showNotification(active ? '👑 Столицы показаны' : '👑 Столицы скрыты', 'info', 1500);
        }
    });

    uiManager.onLensToggle('megacities', (active) => {
        const context = app?.getActiveContext();
        if (context && context.toggleLens) {
            context.toggleLens('megacities');
            showNotification(active ? '🏙️ Мегаполисы показаны' : '🏙️ Мегаполисы скрыты', 'info', 1500);
        }
    });

    uiManager.onLensToggle('major', (active) => {
        const context = app?.getActiveContext();
        if (context && context.toggleLens) {
            context.toggleLens('major');
            showNotification(active ? '🌆 Крупные города показаны' : '🌆 Крупные города скрыты', 'info', 1500);
        }
    });

    uiManager.onLensToggle('population', (active) => {
        const context = app?.getActiveContext();
        if (context && context.toggleLens) {
            context.toggleLens('population');
            showNotification(active ? '👥 Сортировка по населению' : '👥 Сортировка по населению отключена', 'info', 1500);
        }
    });

    uiManager.onLensToggle('area', (active) => {
        const context = app?.getActiveContext();
        if (context && context.toggleLens) {
            context.toggleLens('area');
            showNotification(active ? '📐 Сортировка по площади' : '📐 Сортировка по площади отключена', 'info', 1500);
        }
    });

    uiManager.onLensToggle('density', (active) => {
        const context = app?.getActiveContext();
        if (context && context.toggleLens) {
            context.toggleLens('density');
            showNotification(active ? '📊 Сортировка по плотности' : '📊 Сортировка по плотности отключена', 'info', 1500);
        }
    });

    // Линзы истории
    uiManager.onLensToggle('civilizations', (active) => {
        const context = app?.getActiveContext();
        if (context && context.toggleLens) {
            context.toggleLens('civilizations');
            showNotification(active ? '🏛️ Цивилизации показаны' : '🏛️ Цивилизации скрыты', 'info', 1500);
        }
    });

    uiManager.onLensToggle('battles', (active) => {
        const context = app?.getActiveContext();
        if (context && context.toggleLens) {
            context.toggleLens('battles');
            showNotification(active ? '⚔️ Сражения показаны' : '⚔️ Сражения скрыты', 'info', 1500);
        }
    });

    uiManager.onLensToggle('empires', (active) => {
        const context = app?.getActiveContext();
        if (context && context.toggleLens) {
            context.toggleLens('empires');
            showNotification(active ? '👑 Империи показаны' : '👑 Империи скрыты', 'info', 1500);
        }
    });

    uiManager.onLensToggle('trade', (active) => {
        const context = app?.getActiveContext();
        if (context && context.toggleLens) {
            context.toggleLens('trade');
            showNotification(active ? '🐫 Торговые пути показаны' : '🐫 Торговые пути скрыты', 'info', 1500);
        }
    });

    uiManager.onLensToggle('culture', (active) => {
        const context = app?.getActiveContext();
        if (context && context.toggleLens) {
            context.toggleLens('culture');
            showNotification(active ? '🎭 Культурные центры показаны' : '🎭 Культурные центры скрыты', 'info', 1500);
        }
    });

    // --- ОБРАБОТЧИКИ ЭПОХ ---

    uiManager.onEpochSelect('ancient', (epoch) => {
        const context = app?.getActiveContext();
        if (context && context.selectEpoch) {
            context.selectEpoch('ancient');
            showNotification(`🏛️ ${epoch.name}: ${epoch.years}`, 'info', 2000);
        }
    });

    uiManager.onEpochSelect('middle', (epoch) => {
        const context = app?.getActiveContext();
        if (context && context.selectEpoch) {
            context.selectEpoch('middle');
            showNotification(`⚔️ ${epoch.name}: ${epoch.years}`, 'info', 2000);
        }
    });

    uiManager.onEpochSelect('new', (epoch) => {
        const context = app?.getActiveContext();
        if (context && context.selectEpoch) {
            context.selectEpoch('new');
            showNotification(`⛵ ${epoch.name}: ${epoch.years}`, 'info', 2000);
        }
    });

    uiManager.onEpochSelect('modern', (epoch) => {
        const context = app?.getActiveContext();
        if (context && context.selectEpoch) {
            context.selectEpoch('modern');
            showNotification(`🏭 ${epoch.name}: ${epoch.years}`, 'info', 2000);
        }
    });

    uiManager.onEpochSelect('contemporary', (epoch) => {
        const context = app?.getActiveContext();
        if (context && context.selectEpoch) {
            context.selectEpoch('contemporary');
            showNotification(`💻 ${epoch.name}: ${epoch.years}`, 'info', 2000);
        }
    });

    // --- ОБРАБОТЧИК ПЕРЕКЛЮЧЕНИЯ ПАНЕЛЕЙ ---

    uiManager.on('panel:activate', (data) => {
        logger.info(`UI Panel activated: ${data.contextId}`);
        
        // Обновляем активную кнопку в топ-баре
        const buttons = document.querySelectorAll('.context-btn');
        buttons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.context === data.contextId);
        });
    });

    logger.info('UI Manager initialized successfully');
    return uiManager;
}

// ============================================================
// 5. ГЛАВНАЯ ФУНКЦИЯ ПРИЛОЖЕНИЯ
// ============================================================

(async function main() {
    try {
        logger.info('🚀 Starting Geo-Global application...');
        
        // --- 1. Проверяем доступность сервера ---
        const serverAvailable = await checkServerAvailability();
        updateStatusIndicator(serverAvailable);
        
        if (!serverAvailable) {
            showNotification('Сервер не доступен, используются кешированные данные', 'warning', 6000);
        } else {
            showNotification(`Сервер готов: ${serverStatus?.totalCities || 0} городов в кеше`, 'success', 3000);
        }
        
        // --- 2. Инициализируем UI Manager ---
        initializeUIManager();
        
        // --- 3. Получаем контейнер для глобуса ---
        const container = document.getElementById('globe-container');
        if (!container) {
            throw new Error('Container element not found');
        }
        logger.info('Container found:', container);
        
        // --- 4. Создаем конфигурацию глобуса ---
        const globeConfig = {
            radius: SceneConfig.globe.radius,
            segments: SceneConfig.globe.segments,
            textureUrl: SceneConfig.globe.textures.earth,
            cloudTextureUrl: SceneConfig.globe.textures.clouds,
            nightTextureUrl: SceneConfig.globe.textures.night,
            atmosphereHeight: SceneConfig.globe.atmosphere.height,
            starDensity: SceneConfig.stars.count,
            backgroundColor: SceneConfig.background.color,
            camera: {
                position: SceneConfig.camera.defaultPosition.clone(),
                fov: SceneConfig.camera.fov,
                near: SceneConfig.camera.near,
                far: SceneConfig.camera.far,
            },
            controls: {
                enableDamping: SceneConfig.controls.enableDamping,
                dampingFactor: SceneConfig.controls.dampingFactor,
                minDistance: SceneConfig.controls.minDistance,
                maxDistance: SceneConfig.controls.maxDistance,
                rotateSpeed: SceneConfig.controls.rotateSpeed,
                zoomSpeed: SceneConfig.controls.zoomSpeed,
            },
            material: SceneConfig.globe.material,
            clouds: SceneConfig.globe.clouds,
            atmosphere: SceneConfig.globe.atmosphere,
            lighting: SceneConfig.lighting,
            stars: SceneConfig.stars,
            performance: SceneConfig.performance,
            textures: SceneConfig.globe.textures,
            textureMapping: SceneConfig.globe.textureMapping,
            layers: SceneConfig.globe.layers,
        };
        
        // --- 5. Создаем контроллер приложения ---
        app = new AppController();
        app.serverAvailable = isServerAvailable;
        app.serverStatus = serverStatus;
        
        // --- 6. Создаем контексты ---
        const geographyContext = new GeographyContext();
        const historyContext = new HistoryContext();
        
        // --- 7. Конфигурация приложения ---
        const config = {
            globeConfig,
            globeCreator: (container, config) => {
                logger.info('Creating globe...');
                return new Globe(container, config);
            },
            layerManagerCreator: (scene) => {
                logger.info('Creating layer manager...');
                return new LayerManager(scene);
            },
            contexts: [
                geographyContext,
                historyContext,
                // Будущие контексты:
                // new BiologyContext(),
                // new TechnicalContext(),
            ],
            serverAvailable: isServerAvailable,
            serverUrl: ApiConfig.baseUrl,
            uiManager: uiManager,
        };
        
        // --- 8. Инициализируем приложение ---
        await app.initialize(container, config);
        logger.info('✅ Application initialized');
        
        // Сохраняем ссылки для отладки
        window.__globe = app.globe;
        window.__app = app;
        window.__ui = uiManager;
        
        // --- 9. Активируем панель географии по умолчанию ---
        uiManager.activatePanel('geography');
        
        // --- 10. Горячие клавиши ---
        document.addEventListener('keydown', (e) => {
            if (e.key === '1') {
                app.globe?.setPreset('day');
                logger.info('Switched to Day mode');
                showNotification('☀️ Дневной режим', 'info', 1500);
            } else if (e.key === '2') {
                app.globe?.setPreset('night');
                logger.info('Switched to Night mode');
                showNotification('🌙 Ночной режим', 'info', 1500);
            } else if (e.key === '3') {
                app.globe?.setPreset('scientific');
                logger.info('Switched to Scientific mode');
                showNotification('🔬 Научный режим', 'info', 1500);
            } else if (e.key === 'r' || e.key === 'R') {
                if (isServerAvailable) {
                    showNotification('🔄 Обновление данных...', 'info', 2000);
                    const context = app.getActiveContext();
                    if (context && context.refreshData) {
                        context.refreshData();
                        showNotification('✅ Данные обновлены', 'success', 2000);
                    }
                } else {
                    showNotification('❌ Сервер не доступен', 'error', 2000);
                }
            } else if (e.key === 'b' || e.key === 'B') {
                uiManager.toggleSidebar();
            }
        });
        
        // --- 11. Скрываем загрузочный экран ---
        hideLoading();
        
        // --- 12. Настраиваем кнопки контекстов ---
        const buttons = document.querySelectorAll('.context-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', async () => {
                const contextId = btn.getAttribute('data-context');
                if (!contextId) return;
                
                try {
                    await app.switchContext(contextId);
                    logger.info(`Switched to context: ${contextId}`);
                    
                    // Активируем соответствующую панель в UI
                    uiManager.activatePanel(contextId);
                    
                    const context = app.getActiveContext();
                    if (context) {
                        showNotification(`${context.name || contextId} активирован`, 'info', 2000);
                    }
                } catch (error) {
                    logger.error(`Failed to switch to ${contextId}`, error);
                    showNotification(`❌ Ошибка переключения: ${error.message}`, 'error', 4000);
                }
            });
        });
        
        // --- 13. Настраиваем обработчики событий глобуса ---
        container.addEventListener('click', (event) => {
            app.handleMouseEvent(event);
        });
        
        container.addEventListener('mousemove', (event) => {
            app.handleMouseEvent(event);
        });
        
        // --- 14. Обработка изменения размера окна ---
        window.addEventListener('resize', () => {
            const rect = container.getBoundingClientRect();
            const globe = app.globe;
            if (globe) {
                globe.resize(rect.width, rect.height);
            }
        });
        
        // --- 15. Рендер-цикл ---
        let lastTime = 0;
        let frameCount = 0;
        
        function render(time) {
            const deltaTime = (time - lastTime) / 1000;
            lastTime = time;
            
            app.update(deltaTime);
            
            frameCount++;
            if (frameCount % 60 === 0) {
                logger.debug(`Rendering frame ${frameCount}`);
            }
            
            requestAnimationFrame(render);
        }
        
        logger.info('🎯 Application is ready!');
        logger.info('📖 Управление:');
        logger.info('   🔄 Вращайте глобус мышью');
        logger.info('   🔍 Скролл для приближения');
        logger.info('   ⌨️  1=День, 2=Ночь, 3=Научный, R=Обновить, B=Скрыть/показать панель');
        
        render(0);
        
        // --- 16. Проверяем canvas ---
        setTimeout(() => {
            const canvas = container.querySelector('canvas');
            if (canvas) {
                logger.info('✅ Canvas found, rendering works');
                logger.info(`📐 Canvas size: ${canvas.width} x ${canvas.height}`);
            } else {
                logger.warn('⚠️ Canvas not found in container');
            }
        }, 1000);
        
        // --- 17. Приветственное сообщение ---
        setTimeout(() => {
            showNotification('🌍 Добро пожаловать! Вращайте глобус и исследуйте мир', 'info', 4000);
        }, 1500);
        
        // --- 18. Подсказка о панели ---
        setTimeout(() => {
            showNotification('📌 Нажмите B для показа/скрытия боковой панели', 'info', 3000);
        }, 3000);
        
    } catch (error) {
        logger.error('❌ Failed to initialize application:', error);
        showError(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
        hideLoading();
        showNotification(`❌ Ошибка: ${error.message}`, 'error', 8000);
    }
})();

// ============================================================
// 6. ЭКСПОРТЫ
// ============================================================

export { app, uiManager, isServerAvailable, serverStatus };