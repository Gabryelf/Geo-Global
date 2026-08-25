// client/src/core/core/UIManager.js
import { createLogger } from '../../utils/logger';

const logger = createLogger('UIManager');

export class UIManager {
    constructor() {
        this.sidebar = null;
        this.panels = new Map();
        this.activePanel = null;
        this.isCollapsed = false;
        this.listeners = [];
        this.lensHandlers = new Map();
        this.epochHandlers = new Map();
    }

    initialize() {
        logger.info('Initializing UIManager...');
        this.createSidebar();
        this.setupEventListeners();
        logger.info('UIManager initialized');
    }

    createSidebar() {
        // Создаем боковую панель
        this.sidebar = document.createElement('div');
        this.sidebar.className = 'sidebar';
        this.sidebar.id = 'context-sidebar';
        
        // Кнопка сворачивания
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'sidebar-toggle';
        toggleBtn.innerHTML = '<span class="toggle-icon">◀</span>';
        toggleBtn.title = 'Свернуть/развернуть панель';
        toggleBtn.addEventListener('click', () => this.toggleSidebar());
        this.sidebar.appendChild(toggleBtn);
        
        // Заголовок
        const header = document.createElement('div');
        header.className = 'sidebar-header';
        header.innerHTML = `
            <h2><span class="context-icon">🌍</span> <span class="context-name">Контекст</span></h2>
        `;
        this.sidebar.appendChild(header);
        
        // Контент
        const content = document.createElement('div');
        content.className = 'sidebar-content';
        content.id = 'sidebar-content';
        this.sidebar.appendChild(content);
        
        // Добавляем в DOM
        document.getElementById('ui-overlay').appendChild(this.sidebar);
        
        // Сохраняем ссылки
        this.sidebarHeader = header;
        this.sidebarContent = content;
        
        // Восстанавливаем состояние
        this.isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        if (this.isCollapsed) {
            this.sidebar.classList.add('collapsed');
        }
    }

    toggleSidebar() {
        this.isCollapsed = !this.isCollapsed;
        this.sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebarCollapsed', String(this.isCollapsed));
        
        // Обновляем иконку
        const icon = this.sidebar.querySelector('.toggle-icon');
        if (icon) {
            icon.textContent = this.isCollapsed ? '▶' : '◀';
        }
        
        // Событие
        this.emit('sidebar:toggle', { collapsed: this.isCollapsed });
    }

    registerPanel(contextId, config) {
        logger.info(`Registering panel: ${contextId}`);
        
        const panel = document.createElement('div');
        panel.className = 'context-panel';
        panel.id = `panel-${contextId}`;
        panel.dataset.context = contextId;
        
        // Содержимое панели
        if (config.render) {
            panel.innerHTML = config.render();
        }
        
        this.sidebarContent.appendChild(panel);
        this.panels.set(contextId, panel);
        
        // Настраиваем линзы
        if (config.lenses) {
            this.setupLenses(contextId, config.lenses);
        }
        
        // Настраиваем эпохи (для истории)
        if (config.epochs) {
            this.setupEpochs(contextId, config.epochs);
        }
        
        return panel;
    }

    setupLenses(contextId, lenses) {
        const panel = this.panels.get(contextId);
        if (!panel) return;
        
        const lensContainer = panel.querySelector('.lens-group') || this.createLensGroup(panel);
        
        for (const lens of lenses) {
            const item = document.createElement('div');
            item.className = 'lens-item';
            item.dataset.lens = lens.id;
            item.innerHTML = `
                <span class="lens-icon">${lens.icon}</span>
                <div class="lens-info">
                    <div class="lens-name">${lens.name}</div>
                    <div class="lens-desc">${lens.description || ''}</div>
                </div>
                <span class="lens-status">${lens.active ? 'Вкл' : 'Выкл'}</span>
            `;
            
            if (lens.active) {
                item.classList.add('active');
            }
            
            item.addEventListener('click', () => {
                const isActive = item.classList.toggle('active');
                const status = item.querySelector('.lens-status');
                if (status) {
                    status.textContent = isActive ? 'Вкл' : 'Выкл';
                }
                
                // Вызываем обработчик
                if (this.lensHandlers.has(lens.id)) {
                    this.lensHandlers.get(lens.id)(isActive);
                }
                
                this.emit('lens:toggle', {
                    contextId,
                    lensId: lens.id,
                    active: isActive
                });
            });
            
            lensContainer.appendChild(item);
        }
    }

    createLensGroup(panel) {
        const container = document.createElement('div');
        container.className = 'lens-group';
        container.innerHTML = `
            <div class="lens-group-label">🔍 Линзы</div>
        `;
        // Вставляем после заголовка
        const title = panel.querySelector('.panel-title');
        if (title) {
            title.after(container);
        } else {
            panel.prepend(container);
        }
        return container;
    }

    setupEpochs(contextId, epochs) {
        const panel = this.panels.get(contextId);
        if (!panel) return;
        
        const epochContainer = panel.querySelector('.epoch-group') || this.createEpochGroup(panel);
        
        for (const epoch of epochs) {
            const item = document.createElement('div');
            item.className = 'epoch-item';
            item.dataset.epoch = epoch.id;
            item.innerHTML = `
                <span class="epoch-icon">${epoch.icon}</span>
                <span class="epoch-name">${epoch.name}</span>
                <span class="epoch-year">${epoch.years || ''}</span>
            `;
            
            if (epoch.active) {
                item.classList.add('active');
            }
            
            item.addEventListener('click', () => {
                // Деактивируем все
                epochContainer.querySelectorAll('.epoch-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                
                // Вызываем обработчик
                if (this.epochHandlers.has(epoch.id)) {
                    this.epochHandlers.get(epoch.id)(epoch);
                }
                
                this.emit('epoch:select', {
                    contextId,
                    epochId: epoch.id,
                    epoch: epoch
                });
            });
            
            epochContainer.appendChild(item);
        }
    }

    createEpochGroup(panel) {
        const container = document.createElement('div');
        container.className = 'epoch-group';
        container.innerHTML = `
            <div class="lens-group-label">📜 Эпохи</div>
        `;
        
        // Вставляем после линз
        const lensGroup = panel.querySelector('.lens-group');
        if (lensGroup) {
            lensGroup.after(container);
        } else {
            panel.appendChild(container);
        }
        return container;
    }

    onLensToggle(lensId, handler) {
        this.lensHandlers.set(lensId, handler);
    }

    onEpochSelect(epochId, handler) {
        this.epochHandlers.set(epochId, handler);
    }

    activatePanel(contextId) {
        logger.info(`Activating panel: ${contextId}`);
        
        // Деактивируем все
        this.panels.forEach((panel, id) => {
            panel.classList.remove('active');
        });
        
        // Активируем нужную
        const panel = this.panels.get(contextId);
        if (panel) {
            panel.classList.add('active');
            this.activePanel = contextId;
            
            // Обновляем заголовок
            const header = this.sidebar.querySelector('.sidebar-header');
            if (header) {
                const icon = header.querySelector('.context-icon');
                const name = header.querySelector('.context-name');
                
                // Получаем информацию о контексте
                const context = this.getContextInfo(contextId);
                if (context) {
                    if (icon) icon.textContent = context.icon || '🌍';
                    if (name) name.textContent = context.name || contextId;
                }
            }
            
            this.emit('panel:activate', { contextId });
        }
    }

    getContextInfo(contextId) {
        const contexts = {
            geography: { icon: '🌍', name: 'География' },
            history: { icon: '📜', name: 'История' },
            biology: { icon: '🧬', name: 'Биология' },
            technical: { icon: '⚙️', name: 'Техника' }
        };
        return contexts[contextId] || { icon: '📌', name: contextId };
    }

    setupEventListeners() {
        // Обработка кликов по контекстным кнопкам
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.context-btn');
            if (btn) {
                const contextId = btn.dataset.context;
                if (contextId) {
                    this.activatePanel(contextId);
                }
            }
        });
    }

    // Система событий
    on(event, callback) {
        this.listeners.push({ event, callback });
    }

    emit(event, data) {
        for (const listener of this.listeners) {
            if (listener.event === event) {
                try {
                    listener.callback(data);
                } catch (error) {
                    logger.error(`Error in event listener ${event}:`, error);
                }
            }
        }
    }

    updateLensStatus(contextId, lensId, active) {
        const panel = this.panels.get(contextId);
        if (!panel) return;
        
        const item = panel.querySelector(`.lens-item[data-lens="${lensId}"]`);
        if (item) {
            item.classList.toggle('active', active);
            const status = item.querySelector('.lens-status');
            if (status) {
                status.textContent = active ? 'Вкл' : 'Выкл';
            }
        }
    }

    dispose() {
        if (this.sidebar && this.sidebar.parentNode) {
            this.sidebar.parentNode.removeChild(this.sidebar);
        }
        this.panels.clear();
        this.lensHandlers.clear();
        this.epochHandlers.clear();
        this.listeners = [];
        logger.info('UIManager disposed');
    }
}