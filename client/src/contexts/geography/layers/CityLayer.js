// client/src/contexts/geography/layers/CityLayer.js
import * as THREE from 'three';
import { LayerType } from '../../../core/interfaces/ILayer';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('CityLayer');

export class CityLayer {
    id = 'city-layer';
    name = 'Города мира';
    type = LayerType.MARKER;
    visible = true;
    opacity = 1;
    zIndex = 20;
    
    group = new THREE.Group();
    scene = null;
    allCities = [];
    filteredCities = [];
    cityObjects = new Map();
    currentLOD = 'far';
    camera = null;
    dataLoaded = false;
    isActive = false;
    lastLODUpdate = 0;

    // Настройки LOD с порогами населения
    lodLevels = {
        far: {
            distance: 6,
            minPopulation: 5000000,
            maxCities: 30,
            label: 'Мегаполисы',
            markerSize: 1.2
        },
        medium: {
            distance: 3.5,
            minPopulation: 1000000,
            maxCities: 100,
            label: 'Крупные города',
            markerSize: 0.9
        },
        close: {
            distance: 2.2,
            minPopulation: 500000,
            maxCities: 250,
            label: 'Большие города',
            markerSize: 0.7
        },
        veryClose: {
            distance: 1.2,
            minPopulation: 100000,
            maxCities: 500,
            label: 'Средние города',
            markerSize: 0.5
        },
        detailed: {
            distance: 0.6,
            minPopulation: 0,
            maxCities: 1000,
            label: 'Все города',
            markerSize: 0.4
        }
    };

    // Настройки визуализации
    config = {
        markerSize: 0.008,
        colors: {
            mega: 0xff4444,
            large: 0xff8844,
            medium: 0xffcc44,
            small: 0x44ccff,
            tiny: 0x88ddff,
            capital: 0xffdd44
        },
        glowIntensity: 0.3,
        animationSpeed: 0.5
    };

    // Доступные фильтры (линзы)
    filters = {
        minPopulation: 0,
        maxPopulation: Infinity,
        countries: [],
        continents: [],
        isCapital: false,
        searchQuery: '',
        onlyMajor: false,
        sortBy: 'population', // population, area, density, name
        minArea: 0,
        minDensity: 0,
        type: 'all' // all, capital, major
    };

    // Доступные линзы для пользователя
    availableLenses = [
        {
            id: 'population',
            name: 'По населению',
            icon: '👥',
            description: 'Показать города по численности населения',
            filter: (city) => true
        },
        {
            id: 'area',
            name: 'По площади',
            icon: '📐',
            description: 'Показать города по площади территории',
            filter: (city) => true
        },
        {
            id: 'density',
            name: 'По плотности',
            icon: '📊',
            description: 'Показать города по плотности населения',
            filter: (city) => true
        },
        {
            id: 'capitals',
            name: 'Только столицы',
            icon: '👑',
            description: 'Показать только столицы государств',
            filter: (city) => city.isCapital === true
        },
        {
            id: 'megacities',
            name: 'Мегаполисы',
            icon: '🏙️',
            description: 'Города с населением > 10 млн',
            filter: (city) => (city.population || 0) >= 10000000
        },
        {
            id: 'major',
            name: 'Крупные города',
            icon: '🌆',
            description: 'Города с населением > 1 млн',
            filter: (city) => (city.population || 0) >= 1000000
        }
    ];

    activeLenses = new Set(['population']);

    constructor() {
        this.cityLoader = null;
        this.group = new THREE.Group();
        this.cityObjects = new Map();
    }

    setDataLoader(loader) {
        this.cityLoader = loader;
    }

    async loadData(data) {
        this.allCities = data;
        this.dataLoaded = true;
        this.applyFilters();
        logger.info(`Loaded ${this.allCities.length} cities`);
    }

    async loadDataFromServer(filters = {}) {
        if (!this.cityLoader) {
            logger.warn('CityLoader not set');
            return;
        }

        try {
            const data = await this.cityLoader.load(filters);
            this.allCities = data;
            this.dataLoaded = true;
            this.applyFilters();
            logger.info(`Loaded ${this.allCities.length} cities from server`);
        } catch (error) {
            logger.error('Failed to load cities from server:', error);
        }
    }

    applyFilters() {
        let filtered = [...this.allCities];

        // Применяем активные линзы
        for (const lensId of this.activeLenses) {
            const lens = this.availableLenses.find(l => l.id === lensId);
            if (lens && lens.filter) {
                filtered = filtered.filter(lens.filter);
            }
        }

        // Дополнительные фильтры
        if (this.filters.minPopulation > 0) {
            filtered = filtered.filter(c => (c.population || 0) >= this.filters.minPopulation);
        }

        if (this.filters.maxPopulation < Infinity) {
            filtered = filtered.filter(c => (c.population || 0) <= this.filters.maxPopulation);
        }

        if (this.filters.countries.length > 0) {
            filtered = filtered.filter(c =>
                this.filters.countries.includes(c.country) ||
                this.filters.countries.includes(c.countryCode)
            );
        }

        if (this.filters.continents.length > 0) {
            filtered = filtered.filter(c =>
                this.filters.continents.includes(c.continent)
            );
        }

        if (this.filters.searchQuery) {
            const query = this.filters.searchQuery.toLowerCase();
            filtered = filtered.filter(c =>
                c.name?.toLowerCase().includes(query) ||
                c.nameRu?.toLowerCase().includes(query) ||
                c.country?.toLowerCase().includes(query)
            );
        }

        if (this.filters.minArea > 0) {
            filtered = filtered.filter(c => (c.area || 0) >= this.filters.minArea);
        }

        if (this.filters.minDensity > 0) {
            filtered = filtered.filter(c => (c.density || 0) >= this.filters.minDensity);
        }

        // Сортировка
        const sortBy = this.filters.sortBy || 'population';
        filtered.sort((a, b) => {
            const aVal = a[sortBy] || 0;
            const bVal = b[sortBy] || 0;
            return bVal - aVal;
        });

        this.filteredCities = filtered;
        
        // Обновляем отображение
        if (this.isActive) {
            this.updateDisplay();
        }
    }

    toggleLens(lensId) {
        if (this.activeLenses.has(lensId)) {
            this.activeLenses.delete(lensId);
        } else {
            this.activeLenses.add(lensId);
        }
        this.applyFilters();
        logger.info(`Lens ${lensId} toggled, active:`, Array.from(this.activeLenses));
    }

    setFilter(name, value) {
        if (name in this.filters) {
            this.filters[name] = value;
            this.applyFilters();
            logger.debug(`Filter ${name} set to ${value}`);
        }
    }

    resetFilters() {
        this.filters = {
            minPopulation: 0,
            maxPopulation: Infinity,
            countries: [],
            continents: [],
            isCapital: false,
            searchQuery: '',
            onlyMajor: false,
            sortBy: 'population',
            minArea: 0,
            minDensity: 0,
            type: 'all'
        };
        this.activeLenses = new Set(['population']);
        this.applyFilters();
        logger.info('Filters reset');
    }

    updateDisplay() {
        if (!this.camera) {
            this.renderAllCities();
            return;
        }
        this.updateLOD(this.camera.position);
    }

    renderAllCities() {
        const displayCities = (this.filteredCities || this.allCities).slice(0, 1000);
        this.clearMarkers();
        this.createMarkers(displayCities, 'medium');
    }

    async render(scene, options = {}) {
        this.scene = scene;
        this.camera = options.camera || null;
        this.group = new THREE.Group();
        
        if (this.isActive) {
            this.updateDisplay();
        } else {
            // Если не активен, просто сохраняем данные
            this.group.visible = false;
        }
        
        scene.add(this.group);
        this.isActive = true;
        logger.info(`City layer rendered with ${this.filteredCities?.length || 0} cities`);
    }

    updateLOD(cameraPosition) {
        if (!cameraPosition || !this.filteredCities || this.filteredCities.length === 0) {
            return;
        }

        const distance = cameraPosition.length();
        let currentLevel = 'far';
        
        for (const [level, config] of Object.entries(this.lodLevels)) {
            if (distance <= config.distance) {
                currentLevel = level;
            }
        }

        if (this.currentLOD !== currentLevel || Date.now() - this.lastLODUpdate > 500) {
            this.currentLOD = currentLevel;
            this.lastLODUpdate = Date.now();
            const config = this.lodLevels[currentLevel];
            
            let citiesToShow = this.filteredCities
                .filter(city => (city.population || 0) >= config.minPopulation)
                .slice(0, config.maxCities);

            this.clearMarkers();
            this.createMarkers(citiesToShow, currentLevel);
            
            logger.debug(`LOD: ${currentLevel} (${config.label}), ${citiesToShow.length} cities`);
        }
    }

    createMarkers(cities, level) {
        const lodConfig = this.lodLevels[level] || this.lodLevels.medium;
        const baseSize = this.config.markerSize * (lodConfig.markerSize || 1);
        
        for (const city of cities) {
            this.createCityMarker(city, baseSize);
        }
    }

    createCityMarker(city, baseSize) {
        const { lat, lon, population, isCapital } = city;
        
        const position = this.latLonToPosition(lat, lon, 1.02);
        const color = this.getColorByPopulation(population, isCapital);
        const size = this.getMarkerSize(population, baseSize);

        const markerGroup = new THREE.Group();
        markerGroup.position.copy(position);
        markerGroup.userData = {
            type: 'city',
            cityId: city.id,
            city: city
        };

        // Основной маркер
        const sphereGeom = new THREE.SphereGeometry(size, 8, 8);
        const sphereMat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.9
        });
        const sphere = new THREE.Mesh(sphereGeom, sphereMat);
        markerGroup.add(sphere);

        // Свечение для крупных городов
        if ((population || 0) >= 1000000 || isCapital) {
            const glowGeom = new THREE.SphereGeometry(size * 2.5, 8, 8);
            const glowMat = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.12
            });
            const glow = new THREE.Mesh(glowGeom, glowMat);
            glow.userData.isGlow = true;
            markerGroup.add(glow);
        }

        // Кольцо для столиц
        if (isCapital) {
            const ringGeom = new THREE.RingGeometry(size * 1.2, size * 1.8, 16);
            const ringMat = new THREE.MeshBasicMaterial({
                color: 0xffdd44,
                transparent: true,
                opacity: 0.6,
                side: THREE.DoubleSide
            });
            const ring = new THREE.Mesh(ringGeom, ringMat);
            ring.lookAt(new THREE.Vector3(0, 0, 0));
            markerGroup.add(ring);
        }

        // Анимация
        markerGroup.userData.animation = {
            speed: 0.5 + Math.random() * 0.5,
            phase: Math.random() * Math.PI * 2
        };

        this.group.add(markerGroup);
        this.cityObjects.set(city.id, markerGroup);
    }

    latLonToPosition(lat, lon, radius) {
        const latRad = lat * Math.PI / 180;
        const lonRad = lon * Math.PI / 180;
        
        return new THREE.Vector3(
            radius * Math.cos(latRad) * Math.sin(lonRad),
            radius * Math.sin(latRad),
            radius * Math.cos(latRad) * Math.cos(lonRad)
        );
    }

    getColorByPopulation(population, isCapital) {
        if (isCapital) return this.config.colors.capital;
        if (population >= 10000000) return this.config.colors.mega;
        if (population >= 5000000) return this.config.colors.large;
        if (population >= 1000000) return this.config.colors.medium;
        if (population >= 500000) return this.config.colors.small;
        return this.config.colors.tiny;
    }

    getMarkerSize(population, baseSize) {
        if (population >= 10000000) return baseSize * 2.0;
        if (population >= 5000000) return baseSize * 1.6;
        if (population >= 1000000) return baseSize * 1.3;
        if (population >= 500000) return baseSize * 1.1;
        return baseSize;
    }

    clearMarkers() {
        if (!this.group) return;
        
        while (this.group.children.length > 0) {
            const child = this.group.children[0];
            if (child instanceof THREE.Mesh) {
                child.geometry?.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else if (child.material) {
                    child.material.dispose();
                }
            }
            this.group.remove(child);
        }
        
        this.cityObjects.clear();
    }

    update(deltaTime) {
        if (!this.visible || !this.group || !this.isActive) return;

        // Анимация пульсации
        const time = Date.now() / 1000;
        this.group.children.forEach(markerGroup => {
            const anim = markerGroup.userData?.animation;
            if (anim) {
                const pulse = Math.sin(time * anim.speed + anim.phase) * 0.15 + 0.85;
                markerGroup.children.forEach(child => {
                    if (child instanceof THREE.Mesh && child.material?.transparent) {
                        if (child.userData?.isGlow) {
                            child.material.opacity = 0.12 * pulse;
                        }
                    }
                });
            }
        });

        // Обновляем LOD при движении камеры
        if (this.camera && this.isActive) {
            this.updateLOD(this.camera.position);
        }
    }

    getCityFromObject(object) {
        let current = object;
        while (current) {
            if (current.userData?.type === 'city' && current.userData?.city) {
                return current.userData.city;
            }
            current = current.parent;
        }
        return null;
    }

    getInteractiveObjects() {
        const objects = [];
        if (!this.group || !this.isActive) return objects;
        
        this.group.children.forEach(markerGroup => {
            markerGroup.children.forEach(child => {
                if (child instanceof THREE.Mesh && !child.userData?.isGlow) {
                    objects.push(child);
                }
            });
        });
        return objects;
    }

    filter(predicate) {
        return this.allCities.filter(predicate);
    }

    clear() {
        this.clearMarkers();
        this.allCities = [];
        this.filteredCities = [];
        this.dataLoaded = false;
        this.isActive = false;
        logger.info('City layer cleared');
    }

    remove() {
        if (this.group && this.group.parent) {
            this.group.removeFromParent();
        }
        this.isActive = false;
    }

    isDataLoaded() {
        return this.dataLoaded && this.allCities.length > 0;
    }

    activate() {
        this.isActive = true;
        if (this.group) {
            this.group.visible = true;
            // Пересоздаем маркеры если есть данные
            if (this.filteredCities && this.filteredCities.length > 0) {
                this.updateDisplay();
            }
        }
    }

    deactivate() {
        this.isActive = false;
        if (this.group) {
            this.group.visible = false;
        }
    }

    getLenses() {
        return this.availableLenses;
    }

    getActiveLenses() {
        return Array.from(this.activeLenses);
    }
}