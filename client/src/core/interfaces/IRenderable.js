/**
 * Интерфейс для объектов, которые могут быть отрендерены на сцене
 * @abstract
 */
 export class IRenderable {
  /** @type {THREE.Object3D} */
  object = null;
  /** @type {boolean} */
  visible = true;
  /** @type {string} */
  description = '';

  /**
   * Обновление состояния объекта
   * @param {number} deltaTime - Время с последнего обновления
   */
  update(deltaTime) {
    throw new Error('Method update() must be implemented');
  }

  /**
   * Анимация появления объекта
   * @param {number} duration - Длительность анимации
   * @param {Function} easing - Функция интерполяции
   * @returns {Promise<void>}
   */
  async appear(duration, easing) {
    throw new Error('Method appear() must be implemented');
  }

  /**
   * Анимация исчезновения объекта
   * @param {number} duration - Длительность анимации
   * @param {Function} easing - Функция интерполяции
   * @returns {Promise<void>}
   */
  async disappear(duration, easing) {
    throw new Error('Method disappear() must be implemented');
  }

  /**
   * Получение данных о состоянии объекта
   * @returns {Object}
   */
  getState() {
    throw new Error('Method getState() must be implemented');
  }
}