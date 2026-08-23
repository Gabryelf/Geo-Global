import * as THREE from 'three';
import { AppController } from './core/core/AppController';
import { createLogger } from './utils/logger';
import { GeographyContext } from './contexts/geography/GeographyContext';
import { Globe } from './core/implementations/Globe';
import { LayerManager } from './core/implementations/LayerManager';
import { SceneConfig, ScenePresets } from './configs/scene_config';

const logger = createLogger('Main');

// Определяем URL сервера (используем тот же хост, что и клиент)
const SERVER_URL = window.location.origin;
const API_URL = `${SERVER_URL}/api`;

// Состояние приложения
let app = null;
let isServerAvailable = false;
let serverStatus = null;

/**
 * Проверка доступности сервера
 */
async function checkServerAvailability() {
    try {
        logger.info('Checking server availability...');
        const response = await fetch(`${API_URL}/status`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000) // Таймаут 5 секунд
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

/**
 * Показ уведомления пользователю
 */
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

/**
 * Обновление статуса индикатора
 */
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

/**
 * Обработка ошибок загрузки
 */
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

/**
 * Скрыть загрузочный экран
 */
function hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.classList.add('hidden');
        setTimeout(() => {
            loading.style.display = 'none';
        }, 800);
    }
}

/**
 * Главная функция приложения
 */
(async function main() {
    try {
        logger.info('🚀 Starting Geo-Global application...');
        
        // 1. Проверяем доступность сервера
        const serverAvailable = await checkServerAvailability();
        updateStatusIndicator(serverAvailable);
        
        if (!serverAvailable) {
            showNotification('Сервер не доступен, используются кешированные данные', 'warning', 6000);
        } else {
            showNotification(`Сервер готов: ${serverStatus?.totalCities || 0} городов в кеше`, 'success', 3000);
        }
        
        // 2. Получаем контейнер для глобуса
        const container = document.getElementById('globe-container');
        if (!container) {
            throw new Error('Container element not found');
        }
        logger.info('Container found:', container);
        
        // 3. Создаем конфигурацию глобуса
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
        
        // 4. Создаем контроллер приложения
        app = new AppController();
        
        // Сохраняем статус сервера в app для доступа из контекстов
        app.serverAvailable = isServerAvailable;
        app.serverStatus = serverStatus;
        
        // 5. Конфигурация приложения
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
                new GeographyContext(),
                // Здесь будут добавляться другие контексты
                // new HistoryContext(),
                // new BiologyContext(),
                // new TechnicalContext(),
            ],
            // Передаем информацию о сервере в контексты
            serverAvailable: isServerAvailable,
            serverUrl: SERVER_URL,
        };
        
        // 6. Инициализируем приложение
        await app.initialize(container, config);
        logger.info('✅ Application initialized');
        
        // Сохраняем ссылку на глобус для управления (для отладки)
        window.__globe = app.globe;
        window.__app = app;
        
        // 7. Настраиваем горячие клавиши для тестирования
        document.addEventListener('keydown', (e) => {
            if (e.key === '1') {
                app.globe?.setPreset('day');
                logger.info('Switched to Day mode');
                showNotification('Дневной режим', 'info', 1500);
            } else if (e.key === '2') {
                app.globe?.setPreset('night');
                logger.info('Switched to Night mode');
                showNotification('Ночной режим', 'info', 1500);
            } else if (e.key === '3') {
                app.globe?.setPreset('scientific');
                logger.info('Switched to Scientific mode');
                showNotification('Научный режим', 'info', 1500);
            } else if (e.key === 'r' || e.key === 'R') {
                // Обновить данные (если сервер доступен)
                if (isServerAvailable) {
                    showNotification('Обновление данных...', 'info', 2000);
                    const context = app.getActiveContext();
                    if (context && context.refreshData) {
                        context.refreshData();
                        showNotification('Данные обновлены', 'success', 2000);
                    }
                } else {
                    showNotification('Сервер не доступен', 'error', 2000);
                }
            }
        });
        
        // 8. Скрываем загрузочный экран
        hideLoading();
        
        // 9. Настраиваем кнопки контекстов
        const buttons = document.querySelectorAll('.context-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', async () => {
                const contextId = btn.getAttribute('data-context');
                if (!contextId) return;
                
                // Обновляем активную кнопку
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                try {
                    await app.switchContext(contextId);
                    logger.info(`Switched to context: ${contextId}`);
                    
                    const context = app.getActiveContext();
                    if (context) {
                        showNotification(`${context.name || contextId} активирован`, 'info', 2000);
                    }
                } catch (error) {
                    logger.error(`Failed to switch to ${contextId}`, error);
                    showNotification(`Ошибка переключения: ${error.message}`, 'error', 4000);
                }
            });
        });

        // Настройка фильтров/линз
        const lensButtons = document.querySelectorAll('.lens-btn');
        lensButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const lensId = btn.getAttribute('data-lens');
                if (!lensId) return;
                
                btn.classList.toggle('active');
                const context = app.getActiveContext();
                if (context && context.toggleLens) {
                    context.toggleLens(lensId);
                    logger.info(`Lens toggled: ${lensId}`);
                    
                    // Показываем уведомление
                    const lens = context.getLenses().find(l => l.id === lensId);
                    if (lens) {
                        const status = btn.classList.contains('active') ? 'включена' : 'выключена';
                        showNotification(`${lens.icon} ${lens.name}: ${status}`, 'info', 1500);
                    }
                }
            });
        });
        
        // 10. Настраиваем обработчики событий для взаимодействия с глобусом
        container.addEventListener('click', (event) => {
            app.handleMouseEvent(event);
        });
        
        container.addEventListener('mousemove', (event) => {
            app.handleMouseEvent(event);
        });
        
        // 11. Обработка изменения размера окна
        window.addEventListener('resize', () => {
            const rect = container.getBoundingClientRect();
            const globe = app.globe;
            if (globe) {
                globe.resize(rect.width, rect.height);
            }
        });
        
        // 12. Запускаем рендер-цикл
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
        logger.info('📖 Controls:');
        logger.info('   🔄 Drag to rotate');
        logger.info('   🔍 Scroll to zoom');
        logger.info('   ⌨️  1=Day, 2=Night, 3=Scientific, R=Refresh data');
        
        // Запускаем рендер
        render(0);
        
        // 13. Проверяем, что canvas создан
        setTimeout(() => {
            const canvas = container.querySelector('canvas');
            if (canvas) {
                logger.info('✅ Canvas found, rendering works');
                logger.info(`📐 Canvas size: ${canvas.width} x ${canvas.height}`);
            } else {
                logger.warn('⚠️ Canvas not found in container');
            }
        }, 1000);
        
        // 14. Показываем приветственное сообщение
        setTimeout(() => {
            showNotification('🌍 Добро пожаловать! Вращайте глобус и исследуйте мир', 'info', 4000);
        }, 1500);
        
    } catch (error) {
        logger.error('❌ Failed to initialize application:', error);
        showError(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
        hideLoading();
        
        // Показываем информацию об ошибке в панели
        showNotification(`Ошибка: ${error.message}`, 'error', 8000);
    }
})();

/**
 * Экспорт для использования в других модулях
 */
export { app, isServerAvailable, serverStatus, API_URL, SERVER_URL };