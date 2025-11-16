// @ts-nocheck
import planck from './planck.js';
import { ImageLoader } from './image_loader.js';
import { spawnWaterParticle, deleteAllWater } from './water.js';
import { spawnSandParticle, deleteAllSand } from './sand.js'; // NEW: Импортируем функции для песка

// Вспомогательная функция для сериализации свойств фикстуры
function serializeFixture(fixture) {
    const shape = fixture.getShape();
    const shapeType = shape.getType();
    const fixtureData = {
        friction: fixture.getFriction(),
        restitution: fixture.getRestitution(),
        density: fixture.getDensity(),
        shape: {
            type: shapeType,
        }
    };

    if (shapeType === 'circle') {
        fixtureData.shape.radius = shape.m_radius;
        fixtureData.shape.center = { x: shape.m_p.x, y: shape.m_p.y };
    } else if (shapeType === 'polygon') {
        fixtureData.shape.vertices = shape.m_vertices.map(v => ({ x: v.x, y: v.y }));
    }
    return fixtureData;
}


export function serializeWorld(world, waterParticlesPool, sandParticlesPool) { // NEW: Добавляем sandParticlesPool
    const state = {
        bodies: [],
        waterParticles: [],
        sandParticles: [], // NEW: Для частиц песка
        joints: [],
    };
    const bodyIndexMap = new Map();

    let objectCount = 0;
    let waterCount = 0;
    let sandCount = 0; // NEW: Счетчик песка

    // Сериализация обычных тел
    for (let body = world.getBodyList(); body; body = body.getNext()) {
        const userData = body.getUserData() || {};
        if (userData.label === 'boundary' || userData.label === 'water' || userData.label === 'sand') continue; // NEW: Пропускаем частицы песка
        
        objectCount++;
        bodyIndexMap.set(body, state.bodies.length);

        const fixtures = [];
        for (let f = body.getFixtureList(); f; f = f.getNext()) {
            fixtures.push(serializeFixture(f));
        }
        
        // Клонируем userData и удаляем несериализуемые части
        const serializableUserData = JSON.parse(JSON.stringify(userData));
        if (serializableUserData.render) {
            delete serializableUserData.render.texture;
        }


        state.bodies.push({
            type: body.getType(),
            position: body.getPosition(),
            angle: body.getAngle(),
            linearVelocity: body.getLinearVelocity(),
            angularVelocity: body.getAngularVelocity(),
            linearDamping: body.getLinearDamping(),
            userData: serializableUserData,
            fixtures: fixtures,
        });
    }

    // Сериализация соединений
    for (let joint = world.getJointList(); joint; joint = joint.getNext()) {
        const type = joint.getType();
        const bodyA = joint.getBodyA();
        const bodyB = joint.getBodyB();
        
        // Сохраняем только соединения между сериализованными телами
        if (!bodyIndexMap.has(bodyA) || !bodyIndexMap.has(bodyB)) continue;

        const jointData = {
            type: type,
            bodyAIndex: bodyIndexMap.get(bodyA),
            bodyBIndex: bodyIndexMap.get(bodyB),
        };

        if (type === 'weld-joint') {
            Object.assign(jointData, {
                localAnchorA: joint.getLocalAnchorA(),
                localAnchorB: joint.getLocalAnchorB(),
                referenceAngle: joint.getReferenceAngle()
            });
        } else if (type === 'distance-joint') {
             Object.assign(jointData, {
                localAnchorA: joint.getLocalAnchorA(),
                localAnchorB: joint.getLocalAnchorB(),
                length: joint.getLength(),
                frequencyHz: joint.getFrequency(),
                dampingRatio: joint.getDampingRatio(),
                userData: joint.getUserData() // Сохраняем userData для пружин/стержней
            });
        }
        
        state.joints.push(jointData);
    }


    // Сериализация активных частиц воды
    for (const particle of waterParticlesPool) {
        if (particle.isActive()) {
            waterCount++;
            state.waterParticles.push({
                position: particle.getPosition(),
                linearVelocity: particle.getLinearVelocity(),
            });
        }
    }

    // NEW: Сериализация активных частиц песка
    for (const particle of sandParticlesPool) {
        if (particle.isActive()) {
            sandCount++;
            state.sandParticles.push({
                position: particle.getPosition(),
                linearVelocity: particle.getLinearVelocity(),
            });
        }
    }
    
    return {
        worldState: state,
        stats: {
            objectCount: objectCount,
            waterCount: waterCount,
            sandCount: sandCount // NEW: Статистика по песку
        }
    };
}

function clearWorld(world) {
    const bodiesToDestroy = [];
    for (let body = world.getBodyList(); body; body = body.getNext()) {
        const userData = body.getUserData() || {};
        // Не уничтожаем границы или частицы воды/песка (они обрабатываются отдельно)
        if (userData.label !== 'boundary' && userData.label !== 'water' && userData.label !== 'sand') { // NEW: Пропускаем частицы песка
            bodiesToDestroy.push(body);
        }
    }
    bodiesToDestroy.forEach(body => world.destroyBody(body));
    deleteAllWater();
    deleteAllSand(); // NEW: Также очищаем песок
}


export function deserializeWorld(world, state) {
    clearWorld(world);
    const createdBodies = [];

    // Воссоздание тел
    state.bodies.forEach(bodyState => {
        const bodyDef = {
            type: bodyState.type,
            position: planck.Vec2(bodyState.position.x, bodyState.position.y),
            angle: bodyState.angle,
            linearVelocity: planck.Vec2(bodyState.linearVelocity.x, bodyState.linearVelocity.y),
            angularVelocity: bodyState.angularVelocity,
            linearDamping: bodyState.linearDamping || 0,
            userData: bodyState.userData,
        };

        // Восстанавливаем ссылку на текстуру по URL
        if (bodyDef.userData?.render?.textureUrl) {
            bodyDef.userData.render.texture = ImageLoader.getImage(bodyDef.userData.render.textureUrl);
        }

        const body = world.createBody(bodyDef);
        createdBodies.push(body);

        bodyState.fixtures.forEach(fixtureState => {
            let shape;
            const shapeData = fixtureState.shape;
            if (shapeData.type === 'polygon') {
                const vertices = shapeData.vertices.map(v => planck.Vec2(v.x, v.y));
                shape = planck.Polygon(vertices);
            } else if (shapeData.type === 'circle') {
                shape = planck.Circle(planck.Vec2(shapeData.center.x, shapeData.center.y), shapeData.radius);
            }

            if (shape) {
                const fixtureDef = {
                    friction: fixtureState.friction,
                    restitution: fixtureState.restitution,
                    density: fixtureState.density,
                };
                body.createFixture(shape, fixtureDef);
            }
        });
        body.resetMassData();
    });

    // Воссоздание соединений
    if (state.joints) {
        state.joints.forEach(jointState => {
            const bodyA = createdBodies[jointState.bodyAIndex];
            const bodyB = createdBodies[jointState.bodyBIndex];
            
            if (!bodyA || !bodyB) return;
            
            let jointDef = { bodyA, bodyB };

            if (jointState.type === 'weld-joint') {
                Object.assign(jointDef, {
                    localAnchorA: planck.Vec2(jointState.localAnchorA.x, jointState.localAnchorA.y),
                    localAnchorB: planck.Vec2(jointState.localAnchorB.x, jointState.localAnchorB.y),
                    referenceAngle: jointState.referenceAngle,
                });
                world.createJoint(planck.WeldJoint(jointDef));
            } else if (jointState.type === 'distance-joint') {
                Object.assign(jointDef, {
                    localAnchorA: planck.Vec2(jointState.localAnchorA.x, jointState.localAnchorA.y),
                    localAnchorB: planck.Vec2(jointState.localAnchorB.x, jointState.localAnchorB.y),
                    length: jointState.length,
                    frequencyHz: jointState.frequencyHz,
                    dampingRatio: jointState.dampingRatio,
                });
                const joint = world.createJoint(planck.DistanceJoint(jointDef));
                if (jointState.userData) {
                    joint.setUserData(jointState.userData);
                }
            }
        });
    }

    // Воссоздание частиц воды
    if (state.waterParticles) {
        state.waterParticles.forEach(particleState => {
            spawnWaterParticle(
                world,
                particleState.position.x,
                particleState.position.y,
                planck.Vec2(particleState.linearVelocity.x, particleState.linearVelocity.y)
            );
        });
    }

    // NEW: Воссоздание частиц песка
    if (state.sandParticles) {
        state.sandParticles.forEach(particleState => {
            spawnSandParticle(
                world,
                particleState.position.x,
                particleState.position.y,
                planck.Vec2(particleState.linearVelocity.x, particleState.linearVelocity.y)
            );
        });
    }
}