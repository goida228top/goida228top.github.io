
import planck from './planck.js';
import { SoundManager } from './sound.js';
import { tntTypes } from './tnt_textures.js';
import { ImageLoader } from './image_loader.js';
import { TOOL_SETTINGS, PHYSICS_SCALE } from './game_config.js';
import { addExplosionEffect } from './effects.js';
import { showToast } from './ui_common.js';
import { t } from './lang.js';

export function createBox(world, start, end) {
    const minX = Math.min(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxX = Math.max(start.x, end.x);
    const maxY = Math.max(start.y, end.y);

    const width = maxX - minX;
    const height = maxY - minY;

    if (width < 0.1 || height < 0.1) return;

    SoundManager.playSound('create_object', { volume: 0.7 });
    const body = world.createDynamicBody({
        position: planck.Vec2(minX + width / 2, minY + height / 2),
        linearDamping: 0.1,
    });

    body.createFixture(planck.Box(width / 2, height / 2), {
        friction: 0.3,
        restitution: 0.1,
        density: 1.0,
    });
}

export function createCircle(world, center, edge) {
    const dx = edge.x - center.x;
    const dy = edge.y - center.y;
    let radius = Math.sqrt(dx * dx + dy * dy);

    radius = Math.max(0.25, Math.round(radius * 4) / 4);

    if (radius < 0.25) return;

    SoundManager.playSound('create_object', { volume: 0.7 });
    const body = world.createDynamicBody({
        position: center,
        linearDamping: 0.1,
    });
    body.createFixture(planck.Circle(radius), {
        friction: 10.0, // ОЧЕНЬ высокое трение для "Липких шин" (Arcade Grip)
        restitution: 0.1,
        density: 1.0,
    });
    body.setUserData({
        motor: {
            isEnabled: false,
            speed: 150.0 // Повышенная начальная скорость для драйва
        }
    });
}

export function createBrushStroke(world, p1, p2, thickness) {
     const dist = planck.Vec2.distance(p1, p2);
     if (dist < 0.01) return;

     SoundManager.playSound('create_object', { volume: 0.5, pitch: 1.2 });
     const center = planck.Vec2.mid(p1, p2);
     const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

     const body = world.createBody({
        type: 'static',
        position: center,
        angle: angle,
        userData: {
            label: 'brush-stroke',
            render: { fillStyle: '#4a2a0a' }
        }
     });

     body.createFixture(planck.Box(dist / 2, thickness / 2), {
        friction: 0.8,
        restitution: 0.1,
     });
}

export function createWeld(world, bodyA, bodyB, point) {
    SoundManager.playSound('create_object', { volume: 0.6, pitch: 0.9 });
    const worldAnchor = point;
    world.createJoint(planck.WeldJoint({
        bodyA: bodyA,
        bodyB: bodyB,
        localAnchorA: bodyA.getLocalPoint(worldAnchor),
        localAnchorB: bodyB.getLocalPoint(worldAnchor),
        referenceAngle: bodyB.getAngle() - bodyA.getAngle(),
    }));
}

export function createSpring(world, bodyA, bodyB, anchorA, anchorB) {
    SoundManager.playSound('create_object', { volume: 0.6, pitch: 1.1 });
    const length = planck.Vec2.distance(anchorA, anchorB);
    const joint = planck.DistanceJoint({
        bodyA: bodyA,
        bodyB: bodyB,
        localAnchorA: bodyA.getLocalPoint(anchorA),
        localAnchorB: bodyB.getLocalPoint(anchorB),
        length: length,
        frequencyHz: TOOL_SETTINGS.spring.defaultStiffness,
        dampingRatio: TOOL_SETTINGS.spring.defaultDamping,
    });
    joint.setUserData({ tool: 'spring', isFixed: false });
    world.createJoint(joint);
}

export function createRod(world, bodyA, bodyB, anchorA, anchorB) {
    SoundManager.playSound('create_object', { volume: 0.6, pitch: 0.8 });
    const length = planck.Vec2.distance(anchorA, anchorB);
    const joint = planck.DistanceJoint({
        bodyA: bodyA,
        bodyB: bodyB,
        localAnchorA: bodyA.getLocalPoint(anchorA),
        localAnchorB: bodyB.getLocalPoint(anchorB),
        length: length,
        frequencyHz: 100.0,
        dampingRatio: 1.0,
    });
    joint.setUserData({ tool: 'rod' });
    world.createJoint(joint);
}


export function createTNT(world, position, type = 'small') {
    SoundManager.playSound('create_object', { volume: 0.7 });
    const tntConfig = TOOL_SETTINGS.tnt[type];
    const textureUrl = tntTypes[type].textureUrl;
    const texture = ImageLoader.getImage(textureUrl);

    if (!texture) {
        console.error(`Текстура для ТНТ типа "${type}" не найдена.`);
        return;
    }

    const width = tntConfig.baseVisualWidth;
    const height = tntConfig.baseVisualHeight;
    
    const hitboxWidth = width * tntConfig.hitboxWidthRatio;
    const hitboxHeight = height * tntConfig.hitboxHeightRatio;
    const hitboxOffsetX = width * tntConfig.hitboxOffsetXRatio;

    const body = world.createDynamicBody({
        position: position,
        linearDamping: 0.1,
    });

    body.createFixture(planck.Box(
        hitboxWidth / 2, 
        hitboxHeight / 2, 
        planck.Vec2(hitboxOffsetX, 0)
    ), {
        friction: 0.5,
        restitution: 0.1,
        density: 2.0,
    });

    body.setUserData({
        label: 'tnt',
        tntType: type,
        render: {
            texture: texture,
            textureUrl: textureUrl,
            width: width,
            height: height,
            strokeStyle: '#FFD700'
        }
    });
}

export function eraseAt(world, point) {
    const aabb = new planck.AABB(
        point.clone().sub(planck.Vec2(0.5, 0.5)),
        point.clone().add(planck.Vec2(0.5, 0.5))
    );
    const bodiesToDestroy = [];
    world.queryAABB(aabb, (fixture) => {
        const body = fixture.getBody();
        if (fixture.testPoint(point)) {
            const userData = body.getUserData() || {};
            if(body.isDynamic() || userData.label === 'brush-stroke') {
                bodiesToDestroy.push(body);
            }
        }
        return true;
    });

    if (bodiesToDestroy.length > 0) {
         SoundManager.playSound('create_object', { volume: 0.4, pitch: 0.7 });
    }
    bodiesToDestroy.forEach(body => {
        if (body.getWorld()) {
            const userData = body.getUserData() || {};
            if(userData.motor && userData.motor.joint) {
                world.destroyJoint(userData.motor.joint);
            }
            world.destroyBody(body);
        }
    });
}

// --- TNT Logic ---

let createExplosion; // Hoisted

export function detonateTNT(world, body) {
    if (!body || !body.getWorld()) return;
    const userData = body.getUserData() || {};
    const type = userData.tntType || 'small';
    
    const tntConfig = TOOL_SETTINGS.tnt[type];
    const explosionPower = tntConfig.power; 
    const explosionRadius = tntConfig.explosionRadius;

    const explosionCenter = body.getPosition();
    try {
        world.destroyBody(body);
    } catch (e) {
        console.warn("Попытка уничтожить уже уничтоженное тело.");
        return;
    }
    createExplosion(world, explosionCenter, explosionRadius, explosionPower, type);
};

createExplosion = function(world, center, radius, power, type) {
    addExplosionEffect(center, radius, 400);
    SoundManager.playSound(`explosion_${type}`, { volume: 0.8 });

    const aabb = new planck.AABB(
        center.clone().sub(planck.Vec2(radius, radius)),
        center.clone().add(planck.Vec2(radius, radius))
    );
    
    const tntsToDetonate = new Set();

    world.queryAABB(aabb, (fixture) => {
        const body = fixture.getBody();
        const userData = body.getUserData() || {};

        if (userData.label === 'tnt') {
            tntsToDetonate.add(body);
            return true;
        }

        if (!body.isDynamic()) return true;

        const bodyPos = body.getPosition();
        const direction = planck.Vec2.sub(bodyPos, center);
        const distance = direction.length();

        if (distance < 0.1 || distance > radius) return true;

        direction.normalize();

        const falloff = 1 - (distance / radius);
        const impulseMagnitude = power * falloff; 
        
        const impulse = direction.mul(impulseMagnitude);
        body.applyLinearImpulse(impulse, bodyPos, true);
        body.setAwake(true);

        return true;
    });
    
    tntsToDetonate.forEach(bodyToDetonate => {
        setTimeout(() => detonateTNT(world, bodyToDetonate), 50 + Math.random() * 100);
    });
};

// --- Polygon Logic Helpers ---

function onSegment(p, q, r) {
    return (q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
        q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y));
}

function orientation(p, q, r) {
    const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
    if (Math.abs(val) < 1e-10) return 0;
    return (val > 0) ? 1 : 2;
}

function segmentsIntersect(p1, q1, p2, q2) {
    const o1 = orientation(p1, q1, p2);
    const o2 = orientation(p1, q1, q2);
    const o3 = orientation(p2, q2, p1);
    const o4 = orientation(p2, q2, q1);
    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && onSegment(p1, p2, q1)) return true;
    if (o2 === 0 && onSegment(p1, q2, q1)) return true;
    if (o3 === 0 && onSegment(p2, p1, q2)) return true;
    if (o4 === 0 && onSegment(p2, q1, q2)) return true;
    return false;
}

function isSelfIntersecting(vertices) {
    const n = vertices.length;
    if (n <= 3) return false;
    for (let i = 0; i < n; ++i) {
        for (let j = i + 2; j < n; ++j) {
            if (i === 0 && j === n - 1) continue;
            if (segmentsIntersect(vertices[i], vertices[(i + 1) % n], vertices[j], vertices[(j + 1) % n])) {
                return true;
            }
        }
    }
    return false;
}

function getPolygonArea(vertices) {
    let area = 0;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        area += vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y;
    }
    return area / 2;
}

function isPointInTriangle(p, a, b, c) {
    const s = a.y * c.x - a.x * c.y + (c.y - a.y) * p.x + (a.x - c.x) * p.y;
    const t = a.x * b.y - a.y * b.x + (a.y - b.y) * p.x + (b.x - a.x) * p.y;
    if ((s < 0) !== (t < 0) && s !== 0 && t !== 0) return false;
    const A = -b.y * c.x + a.y * (c.x - b.x) + a.x * (b.y - c.y) + b.x * c.y;
    return A < 0 ? (s <= 0 && s + t >= A) : (s >= 0 && s + t <= A);
}

function triangulate(vertices) {
    const triangles = [];
    if (vertices.length < 3) return triangles;
    let localVertices = [...vertices];
    if (getPolygonArea(localVertices) > 0) {
        localVertices.reverse();
    }
    let iterations = 0;
    const maxIterations = localVertices.length * 2;
    while (localVertices.length >= 3 && iterations < maxIterations) {
        iterations++;
        let foundEar = false;
        for (let i = 0; i < localVertices.length; i++) {
            const p1_idx = i;
            const p2_idx = (i + 1) % localVertices.length;
            const p3_idx = (i + 2) % localVertices.length;
            const p1 = localVertices[p1_idx];
            const p2 = localVertices[p2_idx];
            const p3 = localVertices[p3_idx];
            if (orientation(p1, p2, p3) === 2) {
                let isEar = true;
                for (let j = 0; j < localVertices.length; j++) {
                    if (j === p1_idx || j === p2_idx || j === p3_idx) continue;
                    if (isPointInTriangle(localVertices[j], p1, p2, p3)) {
                        isEar = false;
                        break;
                    }
                }
                if (isEar) {
                    triangles.push([p1, p2, p3]);
                    localVertices.splice(p2_idx, 1);
                    foundEar = true;
                    break;
                }
            }
        }
        if (!foundEar) {
            console.error("Triangulation failed: No ear found.");
            return null;
        }
    }
    if (iterations >= maxIterations) {
        console.error("Triangulation failed: Exceeded max iterations.");
        return null;
    }
    return triangles;
}


export function createPolygon(world, vertices) {
    if (vertices.length < 3) return;
    if (isSelfIntersecting(vertices)) {
        showToast(t('polygon-self-intersection-error'), 'error');
        return;
    }
    const triangles = triangulate(vertices);
    if (!triangles || triangles.length === 0) {
        console.warn("Polygon triangulation failed. Body not created.");
        return;
    }
    SoundManager.playSound('create_object', { volume: 0.7 });
    const body = world.createDynamicBody({ linearDamping: 0.1 });
    try {
        triangles.forEach(triangle => {
            const shape = planck.Polygon(triangle);
            body.createFixture(shape, {
                friction: 0.3,
                restitution: 0.1,
                density: 1.0,
            });
        });
    } catch(e) {
        console.error("Error creating fixtures from triangles:", e);
        world.destroyBody(body);
    }
}
