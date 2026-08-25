// client/src/contexts/history/layers/HistoricalLayer.js
import * as THREE from 'three';
import { LayerType } from '../../../core/interfaces/ILayer';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('HistoricalLayer');

export class HistoricalLayer {
    id = 'historical-layer';
    name = 'Исторические объекты';
    type = LayerType.MARKER;
    visible = true;
    opacity = 1;
    zIndex = 25;
    
    group = new THREE.Group();
    scene = null;
    allData = [];
    filteredData = [];
    cityObjects = new Map();
    camera = null;
    dataLoaded = false;
    isActive = false;
    currentEpoch = 'all';

    config = {
        markerSize: 0.012,
        colors: {
            civilization: 0xffdd44,
            battle: 0xff4444,
            empire: 0x44ff88,
            trade: 0x44ccff,
            culture: 0xcc88ff,
            default: 0x88ddff
        }
    };

    constructor() {
        this.dataLoader = null;
        this.group = new THREE.Group();
        this.cityObjects = new Map();
    }

    setDataLoader(loader) {
        this.dataLoader = loader;
    }

    async loadData(data) {
        this.allData = data;
        this.dataLoaded = true;
        this.applyFilters();
        logger.info(`Loaded ${this.allData.length} historical objects`);
    }

    setEpoch(epochId) {
        this.currentEpoch = epochId;
        this.applyFilters();
        logger.info(`Epoch set to: ${epochId}`);
    }

    applyFilters() {
        let filtered = [...this.allData];

        // Фильтр по эпохе
        if (this.currentEpoch && this.currentEpoch !== 'all') {
            filtered = filtered.filter(item => item.epoch === this.currentEpoch);
        }

        this.filteredData = filtered;
        
        if (this.isActive) {
            this.updateDisplay();
        }
    }

    updateDisplay() {
        this.clearMarkers();
        if (this.filteredData && this.filteredData.length > 0) {
            this.createMarkers(this.filteredData);
        }
    }

    async render(scene, options = {}) {
        this.scene = scene;
        this.camera = options.camera || null;
        this.group = new THREE.Group();
        
        if (this.isActive && this.filteredData && this.filteredData.length > 0) {
            this.createMarkers(this.filteredData);
        }
        
        scene.add(this.group);
        this.isActive = true;
        logger.info(`Historical layer rendered with ${this.filteredData?.length || 0} objects`);
    }

    createMarkers(data) {
        for (const item of data) {
            this.createMarker(item);
        }
    }

    createMarker(item) {
        const { lat, lon, name, type, description, icon } = item;
        
        const position = this.latLonToPosition(lat, lon, 1.02);
        const color = this.getColorByType(type);
        const size = this.config.markerSize * 1.2;

        const markerGroup = new THREE.Group();
        markerGroup.position.copy(position);
        markerGroup.userData = {
            type: 'historical',
            itemId: item.id,
            item: item
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

        // Свечение
        const glowGeom = new THREE.SphereGeometry(size * 2.5, 8, 8);
        const glowMat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.15
        });
        const glow = new THREE.Mesh(glowGeom, glowMat);
        glow.userData.isGlow = true;
        markerGroup.add(glow);

        // Кольцо
        const ringGeom = new THREE.RingGeometry(size * 1.2, size * 1.8, 16);
        const ringMat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.lookAt(new THREE.Vector3(0, 0, 0));
        markerGroup.add(ring);

        // Анимация
        markerGroup.userData.animation = {
            speed: 0.3 + Math.random() * 0.3,
            phase: Math.random() * Math.PI * 2
        };

        this.group.add(markerGroup);
        this.cityObjects.set(item.id, markerGroup);
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

    getColorByType(type) {
        const colors = {
            civilization: this.config.colors.civilization,
            battle: this.config.colors.battle,
            empire: this.config.colors.empire,
            trade: this.config.colors.trade,
            culture: this.config.colors.culture
        };
        return colors[type] || this.config.colors.default;
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

        const time = Date.now() / 1000;
        this.group.children.forEach(markerGroup => {
            const anim = markerGroup.userData?.animation;
            if (anim) {
                const pulse = Math.sin(time * anim.speed + anim.phase) * 0.15 + 0.85;
                markerGroup.children.forEach(child => {
                    if (child instanceof THREE.Mesh && child.material?.transparent) {
                        if (child.userData?.isGlow) {
                            child.material.opacity = 0.15 * pulse;
                        }
                    }
                });
            }
        });
    }

    getItemFromObject(object) {
        let current = object;
        while (current) {
            if (current.userData?.type === 'historical' && current.userData?.item) {
                return current.userData.item;
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

    clear() {
        this.clearMarkers();
        this.allData = [];
        this.filteredData = [];
        this.dataLoaded = false;
        this.isActive = false;
        logger.info('Historical layer cleared');
    }

    remove() {
        if (this.group && this.group.parent) {
            this.group.removeFromParent();
        }
        this.isActive = false;
    }

    isDataLoaded() {
        return this.dataLoaded && this.allData.length > 0;
    }

    activate() {
        this.isActive = true;
        if (this.group) {
            this.group.visible = true;
            if (this.filteredData && this.filteredData.length > 0) {
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
}

export default HistoricalLayer;