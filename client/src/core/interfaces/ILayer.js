import * as THREE from 'three';

/**
 * Типы слоев для категоризации
 */
export const LayerType = {
  BASE: 'base',
  THEMATIC: 'thematic',
  MARKER: 'marker',
  ANIMATION: 'animation',
  INFO: 'info',
  TEMPORARY: 'temporary'
};

/**
 * Базовый интерфейс для всех визуальных слоев на глобусе
 * @abstract
 */
export class ILayer {
  /** @type {string} */
  id = '';
  /** @type {string} */
  name = '';
  /** @type {string} */
  type = LayerType.THEMATIC;
  /** @type {boolean} */
  visible = true;
  /** @type {number} */
  opacity = 1;
  /** @type {number} */
  zIndex = 0;

  /**
   * Загрузка данных для слоя
   * @param {any[]} data - Данные для загрузки
   * @returns {Promise<void>}
   */
  async loadData(data) {
    throw new Error('Method loadData() must be implemented');
  }

  /**
   * Обновление слоя с новыми данными
   * @param {Partial<any>[]} data - Обновленные данные
   * @returns {Promise<void>}
   */
  async updateData(data) {
    throw new Error('Method updateData() must be implemented');
  }

  /**
   * Отрисовка слоя на сцене
   * @param {THREE.Scene} scene - Сцена Three.js
   * @param {any} options - Опции отрисовки
   * @returns {Promise<void>}
   */
  async render(scene, options) {
    throw new Error('Method render() must be implemented');
  }

  /**
   * Удаление слоя со сцены
   */
  remove() {
    throw new Error('Method remove() must be implemented');
  }

  /**
   * Получение всех объектов слоя для взаимодействия
   * @returns {THREE.Object3D[]}
   */
  getInteractiveObjects() {
    throw new Error('Method getInteractiveObjects() must be implemented');
  }

  /**
   * Фильтрация данных слоя
   * @param {Function} predicate - Функция-предикат для фильтрации
   * @returns {any[]}
   */
  filter(predicate) {
    throw new Error('Method filter() must be implemented');
  }

  /**
   * Очистка слоя
   */
  clear() {
    throw new Error('Method clear() must be implemented');
  }

  /**
   * Проверка, загружены ли данные
   * @returns {boolean}
   */
  isDataLoaded() {
    throw new Error('Method isDataLoaded() must be implemented');
  }
}