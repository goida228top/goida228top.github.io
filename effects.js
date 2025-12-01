
import { PHYSICS_SCALE } from './game_config.js';

// Хранилище активных эффектов (взрывов)
let activeEffects = [];

/**
 * Создает новый красивый взрыв
 * @param {object} pos - Позиция в метрах {x, y}
 * @param {number} radius - Радиус взрыва в метрах (влияет на разлет частиц)
 */
export function addExplosionEffect(pos, radius) {
    const particles = [];
    const scale = radius / 10; // Масштаб эффекта относительно базового размера

    // 1. Ударная волна (Shockwave)
    particles.push({
        type: 'shockwave',
        x: pos.x,
        y: pos.y,
        radius: 0.5 * scale,
        maxRadius: radius * 1.2,
        life: 1.0, // от 1.0 до 0.0
        decay: 2.5 // Скорость исчезновения
    });

    // 2. Огонь (Fire core)
    const fireCount = 10 + Math.floor(radius * 2);
    for (let i = 0; i < fireCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * radius * 2;
        particles.push({
            type: 'fire',
            x: pos.x,
            y: pos.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: (0.5 + Math.random() * 1.0) * scale,
            life: 1.0,
            decay: 1.5 + Math.random() * 2.0
        });
    }

    // 3. Дым (Smoke)
    const smokeCount = 15 + Math.floor(radius * 3);
    for (let i = 0; i < smokeCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * radius * 1.0;
        particles.push({
            type: 'smoke',
            x: pos.x,
            y: pos.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: (0.8 + Math.random() * 1.5) * scale,
            life: 1.0,
            decay: 0.5 + Math.random() * 0.8, // Дым живет дольше
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 2
        });
    }

    // 4. Искры (Sparks) - быстрые и яркие
    const sparkCount = 20 + Math.floor(radius * 4);
    for (let i = 0; i < sparkCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (radius * 3) + Math.random() * radius * 5;
        particles.push({
            type: 'spark',
            x: pos.x,
            y: pos.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: (0.05 + Math.random() * 0.1) * scale,
            life: 1.0,
            decay: 3.0 + Math.random() * 2.0,
            color: Math.random() > 0.5 ? '#ffffaa' : '#ffaa00'
        });
    }

    activeEffects.push({ particles });
}

/**
 * Обновляет состояние частиц (физику).
 * Вызывается из игрового цикла, когда игра НЕ на паузе.
 * @param {number} dt - Дельта времени в секундах
 */
export function updateEffects(dt) {
    for (let i = activeEffects.length - 1; i >= 0; i--) {
        const effect = activeEffects[i];
        const particles = effect.particles;
        let aliveParticles = false;

        for (let j = 0; j < particles.length; j++) {
            const p = particles[j];
            
            if (p.life > 0) {
                aliveParticles = true;
                p.life -= p.decay * dt;

                if (p.type !== 'shockwave') {
                    p.x += p.vx * dt;
                    p.y += p.vy * dt;
                }

                // Специфичная логика
                if (p.type === 'smoke') {
                    p.size += 1.0 * dt; // Дым расширяется
                    p.rotation += p.rotationSpeed * dt;
                    p.vx *= 0.95; // Сопротивление воздуха для дыма
                    p.vy *= 0.95;
                } else if (p.type === 'fire') {
                    p.size -= 0.5 * dt; // Огонь уменьшается
                    // FIX: Защита от отрицательного размера
                    if (p.size < 0) p.size = 0;
                } else if (p.type === 'shockwave') {
                    p.radius += (p.maxRadius - p.radius) * 5 * dt;
                }
            }
        }

        // Если все частицы в эффекте умерли, удаляем эффект
        if (!aliveParticles) {
            activeEffects.splice(i, 1);
        }
    }
}

/**
 * Рисует эффекты. Не меняет их состояние.
 * @param {CanvasRenderingContext2D} context 
 */
export function renderExplosions(context) {
    // Рисуем эффекты слоями: Сначала дым (фон), потом огонь, потом искры, потом волна
    
    // Функция отрисовки одного типа частиц
    const drawParticles = (typeFilter) => {
        for (const effect of activeEffects) {
            for (const p of effect.particles) {
                if (p.life <= 0) continue;
                
                // Если передан фильтр и тип не совпадает, пропускаем
                if (typeFilter && p.type !== typeFilter) continue;
                
                // Если фильтра нет (отрисовка всего остального) и тип особый, пропускаем
                if (!typeFilter && (p.type === 'smoke' || p.type === 'fire' || p.type === 'shockwave' || p.type === 'spark')) continue;

                const px = p.x * PHYSICS_SCALE;
                const py = p.y * PHYSICS_SCALE;

                if (p.type === 'smoke') {
                    // FIX: Защита от отрисовки нулевого радиуса
                    if (p.size <= 0) continue;
                    
                    const sizePx = p.size * PHYSICS_SCALE;
                    const alpha = Math.min(0.6, p.life); // Дым полупрозрачный
                    
                    context.save();
                    context.translate(px, py);
                    context.rotate(p.rotation);
                    context.fillStyle = `rgba(80, 80, 80, ${alpha})`;
                    context.beginPath();
                    // Рисуем "облачко" (квадрат или круг)
                    context.arc(0, 0, sizePx, 0, Math.PI * 2);
                    context.fill();
                    context.restore();

                } else if (p.type === 'fire') {
                    // FIX: Защита от отрисовки нулевого радиуса
                    if (p.size <= 0) continue;

                    const sizePx = p.size * PHYSICS_SCALE;
                    // Цвет меняется от желтого к красному
                    const r = 255;
                    const g = Math.floor(255 * p.life);
                    const b = 0;
                    const alpha = p.life;
                    
                    context.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
                    context.beginPath();
                    context.arc(px, py, sizePx, 0, Math.PI * 2);
                    context.fill();

                } else if (p.type === 'spark') {
                    // FIX: Защита от отрисовки нулевого радиуса
                    if (p.size <= 0) continue;

                    const sizePx = p.size * PHYSICS_SCALE;
                    context.fillStyle = p.color;
                    context.globalAlpha = p.life;
                    context.beginPath();
                    // Искра вытянута по движению
                    const len = Math.sqrt(p.vx*p.vx + p.vy*p.vy) * 0.05 * PHYSICS_SCALE;
                    const angle = Math.atan2(p.vy, p.vx);
                    
                    context.save();
                    context.translate(px, py);
                    context.rotate(angle);
                    context.rect(0, -sizePx/2, Math.max(sizePx, len), sizePx);
                    context.fill();
                    context.restore();
                    context.globalAlpha = 1.0;

                } else if (p.type === 'shockwave') {
                    // FIX: Защита от отрисовки нулевого радиуса
                    if (p.radius <= 0) continue;

                    const radiusPx = p.radius * PHYSICS_SCALE;
                    context.beginPath();
                    context.arc(px, py, radiusPx, 0, Math.PI * 2);
                    context.strokeStyle = `rgba(255, 255, 255, ${p.life * 0.5})`;
                    context.lineWidth = 10 * p.life;
                    context.stroke();
                }
            }
        }
    };

    // Порядок отрисовки важен для красоты
    drawParticles('smoke');
    drawParticles('fire');
    drawParticles('spark');
    drawParticles('shockwave');
}
