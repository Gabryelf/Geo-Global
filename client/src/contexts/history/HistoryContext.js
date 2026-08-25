// client/src/contexts/history/HistoryContext.js
import { ContextState } from '../../core/interfaces/IContext';
import { createLogger } from '../../utils/logger';
import { HistoricalDataLoader } from './dataLoaders/HistoricalDataLoader';
import { HistoricalLayer } from './layers/HistoricalLayer';

const logger = createLogger('HistoryContext');

export class HistoryContext {
    id = 'history';
    name = 'Исторический атлас';
    description = 'Изучение истории через карту мира';
    version = '1.0.0';
    state = ContextState.UNINITIALIZED;
    layers = [];
    dataLoaders = new Map();
    historicalLayer = null;
    historicalLoader = null;
    isActive = false;
    cachedData = null;
    activeEpoch = 'all';

    // Доступные эпохи
    epochs = [
        { id: 'ancient', name: 'Древний мир', icon: '🏛️', years: '3000 до н.э. - 476 н.э.' },
        { id: 'middle', name: 'Средневековье', icon: '⚔️', years: '476 - 1492' },
        { id: 'new', name: 'Новое время', icon: '⛵', years: '1492 - 1789' },
        { id: 'modern', name: 'Новейшее время', icon: '🏭', years: '1789 - 1945' },
        { id: 'contemporary', name: 'Современность', icon: '💻', years: '1945 - наши дни' }
    ];

    // Линзы для исторического контекста
    lenses = [
        {
            id: 'civilizations',
            name: 'Цивилизации',
            icon: '🏛️',
            description: 'Показать центры древних цивилизаций',
            active: true
        },
        {
            id: 'battles',
            name: 'Сражения',
            icon: '⚔️',
            description: 'Отметить места исторических битв',
            active: false
        },
        {
            id: 'empires',
            name: 'Империи',
            icon: '👑',
            description: 'Показать территории империй',
            active: false
        },
        {
            id: 'trade',
            name: 'Торговые пути',
            icon: '🐫',
            description: 'Великие торговые пути',
            active: false
        },
        {
            id: 'culture',
            name: 'Культурные центры',
            icon: '🎭',
            description: 'Центры искусства и науки',
            active: false
        }
    ];

    async initialize(config) {
        this.state = ContextState.INITIALIZING;
        logger.info('Initializing History Context...');

        try {
            this.historicalLoader = new HistoricalDataLoader();
            this.dataLoaders.set('historical', this.historicalLoader);

            this.historicalLayer = new HistoricalLayer();
            this.historicalLayer.setDataLoader(this.historicalLoader);
            this.layers.push(this.historicalLayer);

            // Загружаем данные
            const data = await this.historicalLoader.load({
                epoch: this.activeEpoch
            });

            if (data && data.length > 0) {
                this.cachedData = data;
                await this.historicalLayer.loadData(data);
                this.state = ContextState.INITIALIZED;
                logger.info(`✅ History Context initialized with ${data.length} historical objects`);
            } else {
                logger.warn('No historical data loaded, using empty dataset');
                this.state = ContextState.INITIALIZED;
            }

        } catch (error) {
            this.state = ContextState.ERROR;
            logger.error('Failed to initialize History Context:', error);
            throw error;
        }
    }

    getLenses() {
        return this.lenses;
    }

    getEpochs() {
        return this.epochs;
    }

    toggleLens(lensId) {
        logger.info(`Toggling historical lens: ${lensId}`);
        // Здесь будет логика фильтрации по линзам
    }

    async selectEpoch(epochId) {
        this.activeEpoch = epochId;
        logger.info(`Selected epoch: ${epochId}`);
        
        if (this.historicalLayer) {
            this.historicalLayer.setEpoch(epochId);
        }
        
        // Обновляем данные
        if (this.historicalLoader) {
            const data = await this.historicalLoader.load({ epoch: epochId });
            if (data && data.length > 0 && this.historicalLayer) {
                await this.historicalLayer.loadData(data);
            }
        }
    }

    async activate() {
        if (this.state === ContextState.UNINITIALIZED) {
            throw new Error('Context not initialized');
        }

        this.state = ContextState.ACTIVATING;
        logger.info('Activating History Context...');

        try {
            if (this.historicalLayer) {
                if (!this.historicalLayer.isDataLoaded() || this.historicalLayer.allData.length === 0) {
                    const data = await this.historicalLoader.load({
                        epoch: this.activeEpoch
                    });
                    if (data && data.length > 0) {
                        await this.historicalLayer.loadData(data);
                    }
                }
                this.historicalLayer.activate();
            }

            this.isActive = true;
            this.state = ContextState.ACTIVE;
            logger.info('History Context activated');

        } catch (error) {
            this.state = ContextState.ERROR;
            logger.error('Failed to activate History Context:', error);
            throw error;
        }
    }

    async deactivate() {
        if (this.state !== ContextState.ACTIVE) {
            return;
        }

        this.state = ContextState.DEACTIVATING;
        logger.info('Deactivating History Context...');

        try {
            if (this.historicalLayer) {
                this.historicalLayer.deactivate();
            }
            this.isActive = false;
            this.state = ContextState.INITIALIZED;
            logger.info('History Context deactivated');
        } catch (error) {
            this.state = ContextState.ERROR;
            logger.error('Failed to deactivate History Context:', error);
            throw error;
        }
    }

    handleClick(object, position) {
        if (!this.isActive) return;
        
        const item = this.historicalLayer?.getItemFromObject(object);
        if (item) {
            logger.info(`Clicked on historical item: ${item.name}`, item);
        }
    }

    handleHover(object, position) {
        if (!this.isActive) {
            document.body.style.cursor = 'default';
            return;
        }

        const isItem = object && this.historicalLayer?.getItemFromObject(object);
        document.body.style.cursor = isItem ? 'pointer' : 'default';
    }

    getLayers() {
        return this.layers;
    }

    async refreshData() {
        if (!this.historicalLoader) {
            logger.warn('HistoricalLoader not available');
            return;
        }
        
        try {
            const data = await this.historicalLoader.refreshCache();
            if (data && data.length > 0 && this.historicalLayer) {
                await this.historicalLayer.loadData(data);
                logger.info(`Historical data refreshed: ${data.length} items`);
            }
        } catch (error) {
            logger.error('Failed to refresh historical data:', error);
        }
    }

    dispose() {
        for (const layer of this.layers) {
            try {
                layer.clear();
                layer.remove();
            } catch (error) {
                logger.warn(`Error disposing layer ${layer.id}:`, error);
            }
        }
        this.layers = [];
        this.dataLoaders.clear();
        this.historicalLayer = null;
        this.historicalLoader = null;
        this.cachedData = null;
        this.isActive = false;
        this.state = ContextState.UNINITIALIZED;
        logger.info('History Context disposed');
    }
}

export default HistoryContext;